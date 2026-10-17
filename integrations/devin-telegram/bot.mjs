#!/usr/bin/env node
// Защищённый шлюз Telegram -> облачная сессия Devin (REST API v1).
// У каждого чата/топика своя привязанная сессия; ответы Devin помечаются названием.
// В группе с включёнными темами (forum) новая задача создаёт отдельный топик.
// Запуск: node --env-file=.devin/telegram-bot.env integrations/devin-telegram/bot.mjs

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

export const TELEGRAM_LIMIT = 4000;
export const TOPIC_NAME_LIMIT = 64;
export const DEFAULT_DEVIN_API = "https://api.devin.ai";
export const DEFAULT_TELEGRAM_API = "https://api.telegram.org";

const DEFAULT_STATE_FILE = fileURLToPath(
  new URL("../../.devin/telegram-bot.state.json", import.meta.url),
);
const USER_ORIGINS = new Set(["api", "web", "webapp", "slack", "user", "telegram"]);
const TERMINAL_STATUSES = new Set(["finished", "expired"]);

export function splitMessage(text, limit = TELEGRAM_LIMIT) {
  const parts = [];
  let rest = String(text ?? "");
  while (rest.length > limit) {
    let cut = rest.lastIndexOf("\n", limit);
    if (cut < limit / 2) cut = limit;
    parts.push(rest.slice(0, cut));
    rest = rest.slice(cut).replace(/^\n/, "");
  }
  if (rest.length > 0) parts.push(rest);
  return parts;
}

export function isOwner(userId, ownerId) {
  return String(userId) === String(ownerId);
}

export function isValidSessionId(value) {
  const v = String(value ?? "").trim();
  return (
    /^devin-[a-z0-9]+$/i.test(v) ||
    /^https:\/\/app\.devin\.ai\/sessions\/devin-[a-z0-9]+\/?$/i.test(v)
  );
}

export function normalizeSessionId(value) {
  const v = String(value ?? "").trim();
  const match = v.match(/devin-[a-z0-9]+/i);
  return match && isValidSessionId(v) ? match[0] : null;
}

export function isOutboundUserMessage(msg) {
  const type = String(msg?.type ?? "").toLowerCase();
  if (type.includes("user")) return true;
  if (type.includes("devin")) return false;
  return USER_ORIGINS.has(String(msg?.origin ?? "").toLowerCase());
}

export function parseCommand(text) {
  const [raw = "", ...rest] = String(text ?? "").trim().split(/\s+/);
  const [name = "", target = ""] = raw.startsWith("/")
    ? raw.slice(1).split("@")
    : [null, null];
  return { command: name ? name.toLowerCase() : null, arg: rest.join(" "), target };
}

export function stripBotMention(text, botUsername) {
  if (!botUsername) return String(text ?? "").trim();
  const mention = new RegExp(`@${botUsername}`, "gi");
  return String(text ?? "").replace(mention, " ").replace(/\s+/g, " ").trim();
}

export function shortId(sessionId) {
  const id = String(sessionId ?? "");
  return id.startsWith("devin-") ? `devin-${id.slice(6, 14)}` : id;
}

export function sessionLabel(session) {
  const title = String(session?.title ?? "").trim();
  return title || shortId(session?.id);
}

// Метка происхождения сессии: какой шлюз её создал (cloud VM или локальный ПК).
export function originTag(session) {
  const origin = String(session?.origin ?? "").trim();
  if (!origin) return "";
  return ` · ${{ cloud: "облако", local: "локально" }[origin] || origin}`;
}

// Область привязки: "<chatId>:<threadId>" (threadId = 0 для чата без топика).
export function scopeKey(chatId, threadId) {
  return `${chatId}:${Number(threadId) || 0}`;
}

export function parseScope(scope) {
  const [chatId, threadId = "0"] = String(scope).split(":");
  return { chatId, threadId: Number(threadId) || 0 };
}

export function topicName(text, limit = TOPIC_NAME_LIMIT) {
  const first = String(text ?? "").split("\n")[0].replace(/\s+/g, " ").trim();
  return first.length > limit ? `${first.slice(0, limit - 1)}…` : first || "Задача";
}

function buildHelp() {
  return [
    "Шлюз Telegram ↔ Devin. У каждого чата и топика — своя сессия.",
    "В личке любой текст идёт в активную сессию. В группе-форуме новая задача",
    "создаёт отдельную тему с названием из текста задачи; внутри темы всё идёт в её сессию.",
    "",
    "/status — состояние шлюза и сессии этого чата/темы",
    "/list — сессии этого чата/темы",
    "/use <N|devin-...> — переключить активную сессию",
    "/new — следующий запрос создаст новую сессию Devin",
    "/bind <devin-...|URL> — привязать существующую сессию",
    "/cancel — остановить активную сессию (требует /cancel confirm)",
    "/whoami — ваш Telegram user ID и chat ID",
    "/help — эта справка",
  ].join("\n");
}

function loadConfig(env) {
  const token = env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN не задан");
  return {
    token,
    ownerId: env.TELEGRAM_OWNER_ID?.trim() || null,
    devinKey: env.DEVIN_API_KEY?.trim() || null,
    devinApi: (env.DEVIN_API_BASE || DEFAULT_DEVIN_API).replace(/\/+$/, ""),
    telegramApi: (env.TELEGRAM_API_BASE || DEFAULT_TELEGRAM_API).replace(/\/+$/, ""),
    pollMs: Number(env.POLL_INTERVAL_MS) || 4000,
    stateFile: env.STATE_FILE || DEFAULT_STATE_FILE,
    seedSessionId: normalizeSessionId(env.DEVIN_SESSION_ID || ""),
    // Где работает шлюз: "local" (ПК пользователя) или "cloud" (облачная VM).
    origin: env.BOT_ORIGIN?.trim() || "local",
  };
}

export function migrateState(parsed, { seedSessionId = null, ownerId = null } = {}) {
  const chats = {};
  const raw = parsed?.chats && typeof parsed.chats === "object" && !Array.isArray(parsed.chats)
    ? parsed.chats
    : {};
  for (const [key, entry] of Object.entries(raw)) {
    // Старый формат: ключ — голый chatId; новый — "chatId:threadId".
    const scope = key.includes(":") ? key : `${key}:0`;
    chats[scope] = entry;
  }
  const legacy = normalizeSessionId(parsed?.sessionId || "") || seedSessionId;
  if (legacy && ownerId && !chats[scopeKey(ownerId, 0)]) {
    chats[scopeKey(ownerId, 0)] = { active: legacy, sessions: [{ id: legacy, title: null }] };
  }
  for (const entry of Object.values(chats)) {
    if (!entry || typeof entry !== "object") continue;
    if (!Array.isArray(entry.sessions)) entry.sessions = [];
    if (!entry.active && entry.sessions.length > 0) entry.active = entry.sessions[0].id;
  }
  return { chats, offset: Number(parsed?.offset) || 0 };
}

export function loadState(stateFile, seedSessionId, ownerId) {
  try {
    const parsed = JSON.parse(readFileSync(stateFile, "utf8"));
    return migrateState(parsed, { seedSessionId, ownerId });
  } catch {
    return migrateState({}, { seedSessionId, ownerId });
  }
}

function saveState(stateFile, state) {
  try {
    mkdirSync(dirname(stateFile), { recursive: true });
    writeFileSync(stateFile, JSON.stringify(state, null, 2) + "\n", "utf8");
  } catch (error) {
    console.error("Не удалось сохранить state-файл:", error.message);
  }
}

export function makeGateway({ config, state, fetchImpl = fetch, log = console.error }) {
  let running = true;
  const pendingCancel = new Set();
  const activePolls = new Map();
  const titleCache = new Map();

  function persist() {
    saveState(config.stateFile, state);
  }

  function chatEntry(scope) {
    const key = String(scope);
    if (!state.chats[key]) state.chats[key] = { active: null, sessions: [] };
    const entry = state.chats[key];
    if (!Array.isArray(entry.sessions)) entry.sessions = [];
    return entry;
  }

  function findSession(entry, sessionId) {
    return entry.sessions.find((s) => s.id === sessionId) ?? null;
  }

  function activeSession(scope) {
    const entry = chatEntry(scope);
    return entry.active ? findSession(entry, entry.active) : null;
  }

  function labelFor(scope, sessionId) {
    const entry = chatEntry(scope);
    const name = entry.name || titleCache.get(sessionId) || shortId(sessionId);
    return name + originTag(findSession(entry, sessionId));
  }

  async function telegram(method, body) {
    const res = await fetchImpl(`${config.telegramApi}/bot${config.token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
      throw new Error(`Telegram ${method}: HTTP ${res.status} ${data.description ?? ""}`.trim());
    }
    return data.result;
  }

  async function send(scope, text) {
    const { chatId, threadId } = parseScope(scope);
    for (const part of splitMessage(text)) {
      const body = { chat_id: chatId, text: part };
      if (threadId) body.message_thread_id = threadId;
      await telegram("sendMessage", body);
    }
  }

  async function devinApi(path, { method = "GET", body } = {}) {
    if (!config.devinKey) throw new Error("DEVIN_API_KEY не задан в конфигурации");
    const res = await fetchImpl(`${config.devinApi}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${config.devinKey}`,
        "content-type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.status === 404) throw new Error(`Devin API 404: ${path}`);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Devin API HTTP ${res.status}: ${text.slice(0, 300)}`);
    }
    if (res.status === 204) return null;
    const data = await res.json().catch(() => null);
    return data;
  }

  // fresh=true для только что созданных сессий: их первые ответы надо переслать,
  // а не считать старыми.
  function bind(scope, sessionId, { fresh = false } = {}) {
    const entry = chatEntry(scope);
    let session = findSession(entry, sessionId);
    if (!session) {
      session = { id: sessionId, title: titleCache.get(sessionId) ?? null, origin: config.origin };
      entry.sessions.push(session);
    } else if (!session.origin) {
      session.origin = config.origin;
    }
    entry.active = sessionId;
    pendingCancel.delete(scope);
    persist();
    ensurePolling(scope, sessionId, fresh);
  }

  function ensurePolling(scope, sessionId, fresh = false) {
    const key = `${scope}|${sessionId}`;
    if (activePolls.has(key)) return;
    activePolls.set(key, {});
    pollSession(scope, sessionId, { fresh })
      .catch((error) => {
        log("Ошибка поллинга сессии:", error.message);
      })
      .finally(() => activePolls.delete(key));
  }

  async function pollSession(scope, sessionId, { fresh = false } = {}) {
    const seen = new Set();
    let snapshot;
    try {
      snapshot = await devinApi(`/v1/sessions/${sessionId}`);
      // Для существующих сессий снимок — базовая линия: старую историю не шлём.
      // Для новых сессий снимок может уже содержать первый ответ Devin — его шлём.
      if (!fresh) {
        for (const msg of snapshot.messages ?? []) seen.add(msg.event_id);
      }
    } catch (error) {
      await send(scope, `Не удалось прочитать сессию ${sessionId}: ${error.message}`);
      return;
    }
    updateTitle(scope, sessionId, snapshot);
    let announcedEnd = false;
    while (running && chatEntry(scope).active === sessionId) {
      await delay(config.pollMs);
      try {
        snapshot = await devinApi(`/v1/sessions/${sessionId}`);
      } catch (error) {
        log("poll error:", error.message);
        continue;
      }
      updateTitle(scope, sessionId, snapshot);
      const label = labelFor(scope, sessionId);
      for (const msg of snapshot.messages ?? []) {
        if (seen.has(msg.event_id)) continue;
        if (isOutboundUserMessage(msg)) {
          seen.add(msg.event_id);
          continue;
        }
        try {
          await send(scope, `[${label}] ${msg.message}`);
          seen.add(msg.event_id); // отмечаем только после успешной доставки
        } catch (error) {
          log("Не удалось переслать сообщение в Telegram:", error.message);
        }
      }
      if (!announcedEnd && TERMINAL_STATUSES.has(snapshot.status_enum)) {
        announcedEnd = true;
        await send(scope, `[${label}] Сессия завершилась (статус: ${snapshot.status_enum}).`);
      }
      if (announcedEnd) break;
    }
  }

  function updateTitle(scope, sessionId, snapshot) {
    const title = String(snapshot?.title ?? "").trim();
    if (!title) return;
    const entry = chatEntry(scope);
    const session = findSession(entry, sessionId);
    if (titleCache.get(sessionId) === title && session?.title === title) return;
    titleCache.set(sessionId, title);
    if (session) session.title = title;
    persist();
  }

  async function handleText(scope, text) {
    try {
      const entry = chatEntry(scope);
      if (entry.active) {
        await devinApi(`/v1/sessions/${entry.active}/message`, {
          method: "POST",
          body: { message: text },
        });
        await send(scope, `Отправлено в [${labelFor(scope, entry.active)}].`);
        ensurePolling(scope, entry.active);
      } else {
        const created = await devinApi("/v1/sessions", {
          method: "POST",
          body: { prompt: text },
        });
        const sessionId = normalizeSessionId(created?.session_id);
        if (!sessionId) throw new Error("Devin API не вернул session_id");
        bind(scope, sessionId, { fresh: true });
        await send(scope, `Создана сессия [${labelFor(scope, sessionId)}] ${created.url ?? sessionId}`);
      }
    } catch (error) {
      await send(scope, `Ошибка Devin: ${error.message}`);
    }
  }

  async function handleCommand(scope, userId, command, arg) {
    const entry = chatEntry(scope);
    switch (command) {
      case "start":
      case "help":
        await send(scope, buildHelp());
        return;
      case "whoami":
        await send(scope, `Telegram user ID: ${userId}\nScope: ${scope}`);
        return;
      case "status": {
        const session = activeSession(scope);
        if (!session) {
          await send(scope, `Шлюз работает. Здесь нет активной сессии (scope: ${scope}).`);
          return;
        }
        let extra = "";
        try {
          const s = await devinApi(`/v1/sessions/${session.id}`);
          extra = ` Статус: ${s.status_enum ?? s.status}.`;
          updateTitle(scope, session.id, s);
        } catch (error) {
          extra = ` (${error.message})`;
        }
        await send(
          scope,
          `Шлюз работает. Активная сессия: [${labelFor(scope, session.id)}] ${session.id}.${extra}`,
        );
        return;
      }
      case "list": {
        if (entry.sessions.length === 0) {
          await send(scope, "Здесь пока нет сессий. Отправьте текст — создам новую.");
          return;
        }
        const lines = entry.sessions.map((s, i) => {
          const marker = s.id === entry.active ? "→" : `${i + 1}.`;
          return `${marker} [${sessionLabel(s)}${originTag(s)}] ${s.id}`;
        });
        await send(scope, `Сессии:\n${lines.join("\n")}\nПереключить: /use N`);
        return;
      }
      case "use": {
        const argId = normalizeSessionId(arg);
        let target = null;
        if (argId) {
          target = findSession(entry, argId);
          if (!target) {
            bind(scope, argId);
            await send(scope, `Привязана сессия [${labelFor(scope, argId)}].`);
            return;
          }
        } else {
          const n = Number(arg);
          if (Number.isInteger(n) && n >= 1 && n <= entry.sessions.length) {
            target = entry.sessions[n - 1];
          }
        }
        if (!target) {
          await send(scope, "Формат: /use N (номер из /list) или /use devin-<id>");
          return;
        }
        entry.active = target.id;
        pendingCancel.delete(scope);
        persist();
        ensurePolling(scope, target.id);
        await send(scope, `Активная сессия: [${sessionLabel(target)}${originTag(target)}].`);
        return;
      }
      case "new":
        entry.active = null;
        pendingCancel.delete(scope);
        persist();
        await send(scope, "Привязка снята. Следующий запрос создаст новую сессию Devin.");
        return;
      case "bind": {
        const sessionId = normalizeSessionId(arg);
        if (!sessionId) {
          await send(scope, "Формат: /bind devin-<id> или /bind https://app.devin.ai/sessions/devin-<id>");
          return;
        }
        bind(scope, sessionId);
        await send(scope, `Привязана сессия [${labelFor(scope, sessionId)}].`);
        return;
      }
      case "cancel": {
        if (!entry.active) {
          await send(scope, "Здесь нет активной сессии.");
          return;
        }
        if (arg.toLowerCase() !== "confirm") {
          pendingCancel.add(scope);
          await send(
            scope,
            `Остановка сессии [${labelFor(scope, entry.active)}] необратима. Подтвердите: /cancel confirm`,
          );
          return;
        }
        const sessionId = entry.active;
        try {
          await devinApi(`/v1/sessions/${sessionId}`, { method: "DELETE" });
          await send(scope, `Сессия [${labelFor(scope, sessionId)}] остановлена.`);
        } catch (error) {
          await send(scope, `Ошибка остановки: ${error.message}`);
        }
        entry.active = null;
        pendingCancel.delete(scope);
        persist();
        return;
      }
      default:
        await send(scope, buildHelp());
    }
  }

  async function handleMessage(msg) {
    const chatId = msg?.chat?.id;
    const userId = msg?.from?.id;
    let text = msg?.text;
    if (chatId === undefined || userId === undefined || typeof text !== "string") return;
    if (config.ownerId && !isOwner(userId, config.ownerId)) {
      await send(scopeKey(chatId, 0), `Доступ запрещён. Ваш Telegram user ID: ${userId}`);
      return;
    }
    if (!config.ownerId) {
      const { command } = parseCommand(text);
      if (command !== "whoami" && command !== "start" && command !== "help") {
        await send(
          scopeKey(chatId, 0),
          `Шлюз не настроен: задайте TELEGRAM_OWNER_ID=${userId} в конфигурации и перезапустите.`,
        );
        return;
      }
    }
    const { command, arg, target } = parseCommand(text);
    const chatType = msg.chat.type;
    // threadId 0/1 — верхний уровень (обычная группа или тема General в форуме);
    // threadId > 1 — пользовательская тема = отдельная задача.
    const rawThreadId = Number(msg.message_thread_id) || 0;
    const threadId = rawThreadId > 1 ? rawThreadId : 0;

    if (chatType === "private") {
      const scope = scopeKey(chatId, 0);
      if (command) {
        await handleCommand(scope, userId, command, arg);
        return;
      }
      if (!config.devinKey) {
        await send(scope, "DEVIN_API_KEY не задан — добавьте персональный ключ Devin API в конфигурацию.");
        return;
      }
      await handleText(scope, text);
      return;
    }

    // Групповые чаты.
    const botUsername = config.botUsername;
    if (command && target && botUsername && target.toLowerCase() !== botUsername.toLowerCase()) {
      return; // команда адресована другому боту
    }
    const scope = scopeKey(chatId, threadId);
    if (command) {
      await handleCommand(scope, userId, command, arg);
      return;
    }

    const replyToBot = msg.reply_to_message?.from?.id === config.botId;
    const mentioned = botUsername
      ? text.toLowerCase().includes(`@${botUsername.toLowerCase()}`)
      : false;
    if (mentioned) text = stripBotMention(text, botUsername);
    if (!text) return;

    if (threadId) {
      // Сообщение внутри темы — это продолжение задачи этой темы.
      if (!config.devinKey) {
        await send(scope, "DEVIN_API_KEY не задан — добавьте персональный ключ Devin API в конфигурацию.");
        return;
      }
      await handleText(scope, text);
      return;
    }

    if (!mentioned && !replyToBot) return; // чужой разговор в группе

    if (!config.devinKey) {
      await send(scope, "DEVIN_API_KEY не задан — добавьте персональный ключ Devin API в конфигурацию.");
      return;
    }
    const generalScope = scopeKey(chatId, 0);
    // Если в General выбрана активная сессия (/bind или /use) — задача идёт в неё.
    if (!chatEntry(generalScope).active) {
      // Новая задача: пробуем создать отдельную тему с названием из текста.
      let topicId = 0;
      let topicTitle = "";
      try {
        const topic = await telegram("createForumTopic", {
          chat_id: String(chatId),
          name: topicName(text),
        });
        topicId = Number(topic?.message_thread_id) || 0;
        topicTitle = String(topic?.name ?? "");
      } catch (error) {
        log("createForumTopic (группа не в режиме тем?):", error.message);
      }
      if (topicId) {
        const topicScope = scopeKey(chatId, topicId);
        chatEntry(topicScope).name = topicTitle || topicName(text);
        persist();
        await handleText(topicScope, text);
        return;
      }
    }
    await handleText(generalScope, text);
  }

  async function run() {
    try {
      const me = await telegram("getMe");
      config.botId = me?.id;
      config.botUsername = me?.username ?? "";
    } catch (error) {
      log("getMe:", error.message);
    }
    try {
      await telegram("setMyCommands", {
        commands: [
          { command: "status", description: "Состояние шлюза и сессии" },
          { command: "list", description: "Сессии этого чата/темы" },
          { command: "use", description: "Переключить сессию" },
          { command: "new", description: "Новая сессия Devin" },
          { command: "bind", description: "Привязать сессию" },
          { command: "cancel", description: "Остановить сессию" },
          { command: "whoami", description: "Показать ID" },
        ],
      });
    } catch (error) {
      log("setMyCommands:", error.message);
    }
    // Возобновить поллинг активных сессий после рестарта.
    for (const [scope, entry] of Object.entries(state.chats ?? {})) {
      if (entry?.active) ensurePolling(scope, entry.active);
    }
    let offset = Number(state.offset) || 0;
    while (running) {
      let updates;
      try {
        updates = await telegram("getUpdates", { offset, timeout: 30, allowed_updates: ["message"] });
      } catch (error) {
        log("getUpdates:", error.message);
        await delay(5000);
        continue;
      }
      for (const update of updates ?? []) {
        offset = update.update_id + 1;
        try {
          await handleMessage(update.message);
        } catch (error) {
          log("handleMessage:", error.message);
        }
        // Фиксируем обработанный оффсет, чтобы рестарт не повторил команды.
        state.offset = offset;
        persist();
      }
    }
  }

  function stop() {
    running = false;
  }

  return { run, stop, handleMessage, telegram, devinApi };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const config = loadConfig(process.env);
  const state = loadState(config.stateFile, config.seedSessionId, config.ownerId);
  const gateway = makeGateway({ config, state });
  process.on("SIGINT", () => gateway.stop());
  process.on("SIGTERM", () => gateway.stop());
  gateway.run().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

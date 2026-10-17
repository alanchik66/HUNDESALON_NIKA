#!/usr/bin/env node
// Защищённый шлюз Telegram -> облачная сессия Devin (REST API v1).
// У каждого чата своя привязанная сессия; ответы Devin помечаются названием сессии.
// Запуск: node --env-file=.devin/telegram-bot.env integrations/devin-telegram/bot.mjs

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

export const TELEGRAM_LIMIT = 4000;
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

function buildHelp() {
  return [
    "Шлюз Telegram ↔ Devin. У каждого чата — своя сессия.",
    "Любой текст без команды отправляется в сессию этого чата (или создаёт новую).",
    "В группах пишите @<бот> <задача> или отвечайте на сообщения бота.",
    "",
    "/status — состояние шлюза и сессии этого чата",
    "/list — сессии этого чата",
    "/use <N|devin-...> — переключить активную сессию чата",
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
  };
}

export function migrateState(parsed, { seedSessionId = null, ownerId = null } = {}) {
  const chats =
    parsed?.chats && typeof parsed.chats === "object" && !Array.isArray(parsed.chats)
      ? parsed.chats
      : {};
  const legacy = normalizeSessionId(parsed?.sessionId || "") || seedSessionId;
  if (legacy && ownerId && !chats[String(ownerId)]) {
    chats[String(ownerId)] = {
      active: legacy,
      sessions: [{ id: legacy, title: null }],
    };
  }
  for (const entry of Object.values(chats)) {
    if (!entry || typeof entry !== "object") continue;
    if (!Array.isArray(entry.sessions)) entry.sessions = [];
    if (!entry.active && entry.sessions.length > 0) entry.active = entry.sessions[0].id;
  }
  return { chats };
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

  function chatEntry(chatId) {
    const key = String(chatId);
    if (!state.chats[key]) state.chats[key] = { active: null, sessions: [] };
    const entry = state.chats[key];
    if (!Array.isArray(entry.sessions)) entry.sessions = [];
    return entry;
  }

  function findSession(entry, sessionId) {
    return entry.sessions.find((s) => s.id === sessionId) ?? null;
  }

  function activeSession(chatId) {
    const entry = chatEntry(chatId);
    return entry.active ? findSession(entry, entry.active) : null;
  }

  function labelFor(sessionId) {
    return titleCache.get(sessionId) || shortId(sessionId);
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

  async function send(chatId, text) {
    for (const part of splitMessage(text)) {
      await telegram("sendMessage", { chat_id: chatId, text: part });
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

  function bind(chatId, sessionId) {
    const entry = chatEntry(chatId);
    if (!findSession(entry, sessionId)) {
      entry.sessions.push({ id: sessionId, title: titleCache.get(sessionId) ?? null });
    }
    entry.active = sessionId;
    pendingCancel.delete(String(chatId));
    saveState(config.stateFile, state);
    ensurePolling(chatId, sessionId);
  }

  function ensurePolling(chatId, sessionId) {
    if (activePolls.has(sessionId)) return;
    activePolls.set(sessionId, { chatId });
    pollSession(chatId, sessionId)
      .catch((error) => {
        log("Ошибка поллинга сессии:", error.message);
      })
      .finally(() => activePolls.delete(sessionId));
  }

  async function pollSession(chatId, sessionId) {
    const seen = new Set();
    let snapshot;
    try {
      snapshot = await devinApi(`/v1/sessions/${sessionId}`);
      for (const msg of snapshot.messages ?? []) seen.add(msg.event_id);
    } catch (error) {
      await send(chatId, `Не удалось прочитать сессию ${sessionId}: ${error.message}`);
      return;
    }
    updateTitle(chatId, sessionId, snapshot);
    let announcedEnd = false;
    while (running && chatEntry(chatId).active === sessionId) {
      await delay(config.pollMs);
      try {
        snapshot = await devinApi(`/v1/sessions/${sessionId}`);
      } catch (error) {
        log("poll error:", error.message);
        continue;
      }
      updateTitle(chatId, sessionId, snapshot);
      const label = labelFor(sessionId);
      for (const msg of snapshot.messages ?? []) {
        if (seen.has(msg.event_id)) continue;
        seen.add(msg.event_id);
        if (isOutboundUserMessage(msg)) continue;
        try {
          await send(chatId, `[${label}] ${msg.message}`);
        } catch (error) {
          log("Не удалось переслать сообщение в Telegram:", error.message);
        }
      }
      if (!announcedEnd && TERMINAL_STATUSES.has(snapshot.status_enum)) {
        announcedEnd = true;
        await send(chatId, `[${label}] Сессия завершилась (статус: ${snapshot.status_enum}).`);
      }
      if (announcedEnd) break;
    }
  }

  function updateTitle(chatId, sessionId, snapshot) {
    const title = String(snapshot?.title ?? "").trim();
    if (!title) return;
    const entry = chatEntry(chatId);
    const session = findSession(entry, sessionId);
    if (titleCache.get(sessionId) === title && session?.title === title) return;
    titleCache.set(sessionId, title);
    if (session) session.title = title;
    saveState(config.stateFile, state);
  }

  async function handleText(chatId, text) {
    try {
      const entry = chatEntry(chatId);
      if (entry.active) {
        await devinApi(`/v1/sessions/${entry.active}/message`, {
          method: "POST",
          body: { message: text },
        });
        await send(chatId, `Отправлено в [${labelFor(entry.active)}].`);
        ensurePolling(chatId, entry.active);
      } else {
        const created = await devinApi("/v1/sessions", {
          method: "POST",
          body: { prompt: text },
        });
        const sessionId = normalizeSessionId(created?.session_id);
        if (!sessionId) throw new Error("Devin API не вернул session_id");
        bind(chatId, sessionId);
        await send(chatId, `Создана сессия [${labelFor(sessionId)}] ${created.url ?? sessionId}`);
      }
    } catch (error) {
      await send(chatId, `Ошибка Devin: ${error.message}`);
    }
  }

  async function handleCommand(chatId, userId, command, arg) {
    const entry = chatEntry(chatId);
    switch (command) {
      case "start":
      case "help":
        await send(chatId, buildHelp());
        return;
      case "whoami":
        await send(chatId, `Telegram user ID: ${userId}\nChat ID: ${chatId}`);
        return;
      case "status": {
        const session = activeSession(chatId);
        if (!session) {
          await send(chatId, `Шлюз работает. В этом чате нет активной сессии (chat ID: ${chatId}).`);
          return;
        }
        let extra = "";
        try {
          const s = await devinApi(`/v1/sessions/${session.id}`);
          extra = ` Статус: ${s.status_enum ?? s.status}.`;
          updateTitle(chatId, session.id, s);
        } catch (error) {
          extra = ` (${error.message})`;
        }
        await send(
          chatId,
          `Шлюз работает. Активная сессия: [${sessionLabel(session)}] ${session.id}.${extra}`,
        );
        return;
      }
      case "list": {
        if (entry.sessions.length === 0) {
          await send(chatId, "В этом чате пока нет сессий. Отправьте текст — создам новую.");
          return;
        }
        const lines = entry.sessions.map((s, i) => {
          const marker = s.id === entry.active ? "→" : `${i + 1}.`;
          return `${marker} [${sessionLabel(s)}] ${s.id}`;
        });
        await send(chatId, `Сессии этого чата:\n${lines.join("\n")}\nПереключить: /use N`);
        return;
      }
      case "use": {
        const argId = normalizeSessionId(arg);
        let target = null;
        if (argId) {
          target = findSession(entry, argId);
          if (!target) {
            bind(chatId, argId);
            await send(chatId, `Привязана сессия [${labelFor(argId)}].`);
            return;
          }
        } else {
          const n = Number(arg);
          if (Number.isInteger(n) && n >= 1 && n <= entry.sessions.length) {
            target = entry.sessions[n - 1];
          }
        }
        if (!target) {
          await send(chatId, "Формат: /use N (номер из /list) или /use devin-<id>");
          return;
        }
        entry.active = target.id;
        pendingCancel.delete(String(chatId));
        saveState(config.stateFile, state);
        ensurePolling(chatId, target.id);
        await send(chatId, `Активная сессия: [${sessionLabel(target)}].`);
        return;
      }
      case "new":
        entry.active = null;
        pendingCancel.delete(String(chatId));
        saveState(config.stateFile, state);
        await send(chatId, "Привязка снята. Следующий запрос создаст новую сессию Devin.");
        return;
      case "bind": {
        const sessionId = normalizeSessionId(arg);
        if (!sessionId) {
          await send(chatId, "Формат: /bind devin-<id> или /bind https://app.devin.ai/sessions/devin-<id>");
          return;
        }
        bind(chatId, sessionId);
        await send(chatId, `Привязана сессия [${labelFor(sessionId)}].`);
        return;
      }
      case "cancel": {
        if (!entry.active) {
          await send(chatId, "В этом чате нет активной сессии.");
          return;
        }
        if (arg.toLowerCase() !== "confirm") {
          pendingCancel.add(String(chatId));
          await send(
            chatId,
            `Остановка сессии [${labelFor(entry.active)}] необратима. Подтвердите: /cancel confirm`,
          );
          return;
        }
        const sessionId = entry.active;
        try {
          await devinApi(`/v1/sessions/${sessionId}`, { method: "DELETE" });
          await send(chatId, `Сессия [${labelFor(sessionId)}] остановлена.`);
        } catch (error) {
          await send(chatId, `Ошибка остановки: ${error.message}`);
        }
        entry.active = null;
        pendingCancel.delete(String(chatId));
        saveState(config.stateFile, state);
        return;
      }
      default:
        await send(chatId, buildHelp());
    }
  }

  async function handleMessage(msg) {
    const chatId = msg?.chat?.id;
    const userId = msg?.from?.id;
    let text = msg?.text;
    if (chatId === undefined || userId === undefined || typeof text !== "string") return;
    if (config.ownerId && !isOwner(userId, config.ownerId)) {
      await send(chatId, `Доступ запрещён. Ваш Telegram user ID: ${userId}`);
      return;
    }
    if (!config.ownerId) {
      const { command } = parseCommand(text);
      if (command !== "whoami" && command !== "start" && command !== "help") {
        await send(
          chatId,
          `Шлюз не настроен: задайте TELEGRAM_OWNER_ID=${userId} в конфигурации и перезапустите.`,
        );
        return;
      }
    }
    const { command, arg, target } = parseCommand(text);
    const chatType = msg.chat.type;
    if (chatType !== "private") {
      const botUsername = config.botUsername;
      const replyToBot = msg.reply_to_message?.from?.id === config.botId;
      const mentioned = botUsername && !command
        ? text.toLowerCase().includes(`@${botUsername.toLowerCase()}`)
        : false;
      if (command && target && botUsername && target.toLowerCase() !== botUsername.toLowerCase()) {
        return; // команда адресована другому боту
      }
      if (!command && !replyToBot && !mentioned) return; // чужой разговор в группе
      if (mentioned) text = stripBotMention(text, botUsername);
      if (!text) return;
    }
    if (command) {
      await handleCommand(chatId, userId, command, arg);
      return;
    }
    if (!config.devinKey) {
      await send(chatId, "DEVIN_API_KEY не задан — добавьте персональный ключ Devin API в конфигурацию.");
      return;
    }
    await handleText(chatId, text);
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
          { command: "status", description: "Состояние шлюза и сессии чата" },
          { command: "list", description: "Сессии этого чата" },
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
    for (const [chatId, entry] of Object.entries(state.chats ?? {})) {
      if (entry?.active) ensurePolling(chatId, entry.active);
    }
    let offset = 0;
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

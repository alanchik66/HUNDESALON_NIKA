#!/usr/bin/env node
// Защищённый шлюз Telegram -> облачная сессия Devin (REST API v1).
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
  const command = raw.startsWith("/") ? raw.slice(1).split("@")[0].toLowerCase() : null;
  return { command, arg: rest.join(" ") };
}

function buildHelp() {
  return [
    "Шлюз Telegram ↔ Devin.",
    "Любой текст без команды отправляется в привязанную сессию Devin (или создаёт новую).",
    "",
    "/status — состояние шлюза и привязанной сессии",
    "/new — следующий запрос создаст новую сессию Devin",
    "/bind <devin-...|URL> — привязать существующую сессию",
    "/cancel — остановить привязанную сессию (требует /cancel confirm)",
    "/whoami — ваш Telegram user ID",
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

function loadState(stateFile, seedSessionId) {
  try {
    const parsed = JSON.parse(readFileSync(stateFile, "utf8"));
    return { sessionId: normalizeSessionId(parsed.sessionId || "") || seedSessionId };
  } catch {
    return { sessionId: seedSessionId };
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
  let pendingCancel = false;
  let activePoll = null;

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
    state.sessionId = sessionId;
    pendingCancel = false;
    saveState(config.stateFile, state);
    ensurePolling(chatId, sessionId);
  }

  function ensurePolling(chatId, sessionId) {
    if (activePoll?.sessionId === sessionId) return;
    activePoll = { sessionId, done: pollSession(chatId, sessionId).catch((error) => {
      log("Ошибка поллинга сессии:", error.message);
    }) };
  }

  async function pollSession(chatId, sessionId) {
    const seen = new Set();
    try {
      const first = await devinApi(`/v1/sessions/${sessionId}`);
      for (const msg of first.messages ?? []) seen.add(msg.event_id);
    } catch (error) {
      await send(chatId, `Не удалось прочитать сессию ${sessionId}: ${error.message}`);
      return;
    }
    let announcedEnd = false;
    while (running && state.sessionId === sessionId) {
      await delay(config.pollMs);
      let snapshot;
      try {
        snapshot = await devinApi(`/v1/sessions/${sessionId}`);
      } catch (error) {
        log("poll error:", error.message);
        continue;
      }
      for (const msg of snapshot.messages ?? []) {
        if (seen.has(msg.event_id)) continue;
        seen.add(msg.event_id);
        if (isOutboundUserMessage(msg)) continue;
        try {
          await send(chatId, msg.message);
        } catch (error) {
          log("Не удалось переслать сообщение в Telegram:", error.message);
        }
      }
      if (!announcedEnd && TERMINAL_STATUSES.has(snapshot.status_enum)) {
        announcedEnd = true;
        await send(chatId, `Сессия ${sessionId} завершилась (статус: ${snapshot.status_enum}).`);
      }
      if (announcedEnd) break;
    }
  }

  async function handleText(chatId, text) {
    try {
      if (state.sessionId) {
        await devinApi(`/v1/sessions/${state.sessionId}/message`, {
          method: "POST",
          body: { message: text },
        });
        await send(chatId, `Отправлено в сессию ${state.sessionId}.`);
        ensurePolling(chatId, state.sessionId);
      } else {
        const created = await devinApi("/v1/sessions", {
          method: "POST",
          body: { prompt: text },
        });
        const sessionId = normalizeSessionId(created?.session_id);
        if (!sessionId) throw new Error("Devin API не вернул session_id");
        bind(chatId, sessionId);
        await send(chatId, `Создана сессия ${created.url ?? sessionId}`);
      }
    } catch (error) {
      await send(chatId, `Ошибка Devin: ${error.message}`);
    }
  }

  async function handleCommand(chatId, userId, command, arg) {
    switch (command) {
      case "start":
      case "help":
        await send(chatId, buildHelp());
        return;
      case "whoami":
        await send(chatId, `Ваш Telegram user ID: ${userId}`);
        return;
      case "status": {
        let extra = "";
        if (state.sessionId) {
          try {
            const s = await devinApi(`/v1/sessions/${state.sessionId}`);
            extra = ` Статус: ${s.status_enum ?? s.status}.`;
          } catch (error) {
            extra = ` (${error.message})`;
          }
        }
        await send(
          chatId,
          `Шлюз работает. Сессия: ${state.sessionId ?? "не привязана"}.${extra}`,
        );
        return;
      }
      case "new":
        state.sessionId = null;
        pendingCancel = false;
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
        await send(chatId, `Привязана сессия ${sessionId}.`);
        return;
      }
      case "cancel": {
        if (!state.sessionId) {
          await send(chatId, "Нет привязанной сессии.");
          return;
        }
        if (arg.toLowerCase() !== "confirm") {
          pendingCancel = true;
          await send(
            chatId,
            `Остановка сессии ${state.sessionId} необратима. Подтвердите: /cancel confirm`,
          );
          return;
        }
        try {
          await devinApi(`/v1/sessions/${state.sessionId}`, { method: "DELETE" });
          await send(chatId, `Сессия ${state.sessionId} остановлена.`);
        } catch (error) {
          await send(chatId, `Ошибка остановки: ${error.message}`);
        }
        state.sessionId = null;
        pendingCancel = false;
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
    const text = msg?.text;
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
    const { command, arg } = parseCommand(text);
    if (command) {
      await handleCommand(chatId, userId, command, arg);
      return;
    }
    if (!config.devinKey) {
      await send(chatId, "DEVIN_API_KEY не задан — добавьте ключ сервисного пользователя в конфигурацию.");
      return;
    }
    await handleText(chatId, text);
  }

  async function run() {
    try {
      await telegram("setMyCommands", {
        commands: [
          { command: "status", description: "Состояние шлюза" },
          { command: "new", description: "Новая сессия Devin" },
          { command: "bind", description: "Привязать сессию" },
          { command: "cancel", description: "Остановить сессию" },
          { command: "whoami", description: "Показать user ID" },
        ],
      });
    } catch (error) {
      log("setMyCommands:", error.message);
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
  const state = loadState(config.stateFile, config.seedSessionId);
  const gateway = makeGateway({ config, state });
  process.on("SIGINT", () => gateway.stop());
  process.on("SIGTERM", () => gateway.stop());
  gateway.run().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

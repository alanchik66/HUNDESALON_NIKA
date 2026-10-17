import assert from "node:assert/strict";
import test from "node:test";

import {
  isOutboundUserMessage,
  isOwner,
  isValidSessionId,
  migrateState,
  normalizeSessionId,
  originTag,
  parseCommand,
  parseScope,
  scopeKey,
  sessionLabel,
  shortId,
  splitMessage,
  stripBotMention,
  topicName,
} from "./bot.mjs";

test("splitMessage разбивает длинный текст на части", () => {
  const text = "строка\n".repeat(1000);
  const parts = splitMessage(text, 4000);
  assert.ok(parts.length > 1);
  assert.ok(parts.every((p) => p.length <= 4000));
  assert.deepEqual(
    parts.join("\n").split("\n").filter(Boolean),
    text.split("\n").filter(Boolean),
  );
});

test("splitMessage не разбивает короткий текст", () => {
  assert.deepEqual(splitMessage("привет"), ["привет"]);
});

test("isOwner сравнивает ID как строки", () => {
  assert.equal(isOwner(12345, "12345"), true);
  assert.equal(isOwner("12345", 12345), true);
  assert.equal(isOwner(1, 2), false);
});

test("isValidSessionId принимает только ID или URL Devin", () => {
  assert.equal(isValidSessionId("devin-abc123"), true);
  assert.equal(isValidSessionId("https://app.devin.ai/sessions/devin-abc123"), true);
  assert.equal(isValidSessionId("https://app.devin.ai/sessions/devin-abc123/"), true);
  assert.equal(isValidSessionId("https://example.com/sessions/devin-abc123"), false);
  assert.equal(isValidSessionId("devin-abc123; rm -rf /"), false);
  assert.equal(isValidSessionId(""), false);
});

test("normalizeSessionId извлекает devin-id", () => {
  assert.equal(normalizeSessionId("devin-abc123"), "devin-abc123");
  assert.equal(
    normalizeSessionId("https://app.devin.ai/sessions/devin-ABC123"),
    "devin-ABC123",
  );
  assert.equal(normalizeSessionId("random text"), null);
});

test("isOutboundUserMessage отличает сообщения пользователя от ответов Devin", () => {
  assert.equal(isOutboundUserMessage({ type: "user_message", origin: "api" }), true);
  assert.equal(isOutboundUserMessage({ type: "user_message", origin: "web" }), true);
  assert.equal(isOutboundUserMessage({ type: "devin_message", origin: null }), false);
  assert.equal(isOutboundUserMessage({ type: "devin_message", origin: "api" }), false);
  assert.equal(isOutboundUserMessage({ type: "", origin: "api" }), true);
  assert.equal(isOutboundUserMessage({ type: "status", origin: null }), false);
});

test("parseCommand разбирает команды и аргументы", () => {
  assert.deepEqual(parseCommand("/bind devin-abc"), { command: "bind", arg: "devin-abc", target: "" });
  assert.deepEqual(parseCommand("/status@MyBot"), { command: "status", arg: "", target: "MyBot" });
  assert.deepEqual(parseCommand("обычный текст"), { command: null, arg: "текст", target: null });
  assert.deepEqual(parseCommand("/cancel confirm"), { command: "cancel", arg: "confirm", target: "" });
});

test("stripBotMention убирает @username бота из текста", () => {
  assert.equal(stripBotMention("@devin_hundesalon_bot сделай задачу", "devin_hundesalon_bot"), "сделай задачу");
  assert.equal(stripBotMention("сделай @Devin_Hundesalon_Bot задачу", "devin_hundesalon_bot"), "сделай задачу");
  assert.equal(stripBotMention("без упоминания", "devin_hundesalon_bot"), "без упоминания");
});

test("shortId и sessionLabel помечают сессии", () => {
  assert.equal(shortId("devin-8ad3cf3a772b4341995db6dd890b509b"), "devin-8ad3cf3a");
  assert.equal(shortId("other-id"), "other-id");
  assert.equal(sessionLabel({ id: "devin-8ad3cf3a772b", title: "TG-E2E-OK" }), "TG-E2E-OK");
  assert.equal(sessionLabel({ id: "devin-8ad3cf3a772b", title: "  " }), "devin-8ad3cf3a");
  assert.equal(sessionLabel({ id: "devin-8ad3cf3a772b" }), "devin-8ad3cf3a");
});

test("migrateState переносит старый формат sessionId в чат владельца", () => {
  const migrated = migrateState({ sessionId: "devin-abc123" }, { ownerId: "269792140" });
  assert.deepEqual(migrated.chats["269792140:0"], {
    active: "devin-abc123",
    sessions: [{ id: "devin-abc123", title: null }],
  });
});

test("migrateState сохраняет чаты и поднимает active из sessions", () => {
  const migrated = migrateState({
    chats: {
      "111": { sessions: [{ id: "devin-a", title: null }] },
      "222:5": { active: "devin-b", sessions: [{ id: "devin-b", title: "T" }] },
    },
    offset: 42,
  });
  assert.equal(migrated.chats["111:0"].active, "devin-a");
  assert.equal(migrated.chats["222:5"].active, "devin-b");
  assert.equal(migrated.chats["222:5"].sessions[0].title, "T");
  assert.equal(migrated.offset, 42);
});

test("migrateState без владельца не привязывает legacy-сессию", () => {
  const migrated = migrateState({ sessionId: "devin-abc123" }, {});
  assert.deepEqual(migrated.chats, {});
});

test("scopeKey и parseScope кодируют чат и топик", () => {
  assert.equal(scopeKey(269792140, 0), "269792140:0");
  assert.equal(scopeKey(-5378765672, 12), "-5378765672:12");
  assert.equal(scopeKey("-5378765672"), "-5378765672:0");
  assert.deepEqual(parseScope("-5378765672:12"), { chatId: "-5378765672", threadId: 12 });
  assert.deepEqual(parseScope("269792140:0"), { chatId: "269792140", threadId: 0 });
});

test("topicName строит название темы из текста задачи", () => {
  assert.equal(topicName("поправь футер на сайте"), "поправь футер на сайте");
  assert.equal(topicName("первая строка\nвторая"), "первая строка");
  assert.equal(topicName("   "), "Задача");
  assert.ok(topicName("слово ".repeat(30)).length <= 64);
});

test("originTag помечает локальные и облачные сессии", () => {
  assert.equal(originTag({ origin: "cloud" }), " · облако");
  assert.equal(originTag({ origin: "local" }), " · локально");
  assert.equal(originTag({ origin: "vm-01" }), " · vm-01");
  assert.equal(originTag({}), "");
  assert.equal(originTag(null), "");
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  isOutboundUserMessage,
  isOwner,
  isValidSessionId,
  normalizeSessionId,
  parseCommand,
  splitMessage,
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
  assert.deepEqual(parseCommand("/bind devin-abc"), { command: "bind", arg: "devin-abc" });
  assert.deepEqual(parseCommand("/status@MyBot"), { command: "status", arg: "" });
  assert.deepEqual(parseCommand("обычный текст"), { command: null, arg: "текст" });
  assert.deepEqual(parseCommand("/cancel confirm"), { command: "cancel", arg: "confirm" });
});

#!/usr/bin/env node
/**
 * HUNDESALON NIKA — Site Ops MCP (local stdio)
 *
 * Typed tools for the post-edit / post-deploy gate that agents otherwise
 * reinvent via shell: validate, link check, live HTML, IndexNow.
 *
 * Deployment: local stdio (repo + npm scripts). Upgrade path: MCPB if
 * distributing outside this machine.
 * Tool pattern: one tool per action (<15). Read/write split required.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const MAX_OUT = 24_000;

function runNpm(script, extraArgs = []) {
  return new Promise((resolve) => {
    const child = spawn(
      "npm",
      ["run", script, "--silent", ...extraArgs],
      {
        cwd: ROOT,
        env: process.env,
        shell: true,
        windowsHide: true,
      },
    );
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (d) => {
      stdout += d.toString();
    });
    child.stderr?.on("data", (d) => {
      stderr += d.toString();
    });
    child.on("close", (code) => {
      const trim = (s) =>
        s.length > MAX_OUT ? `${s.slice(0, MAX_OUT)}\n…[truncated]` : s;
      resolve({
        ok: code === 0,
        code: code ?? 1,
        stdout: trim(stdout),
        stderr: trim(stderr),
      });
    });
    child.on("error", (err) => {
      resolve({ ok: false, code: 1, stdout: "", stderr: String(err) });
    });
  });
}

function formatResult(label, result) {
  const lines = [
    `${label}: ${result.ok ? "PASS" : "FAIL"} (exit ${result.code})`,
    result.stdout ? `--- stdout ---\n${result.stdout}` : "",
    result.stderr ? `--- stderr ---\n${result.stderr}` : "",
  ].filter(Boolean);
  return {
    content: [{ type: "text", text: lines.join("\n") }],
    isError: !result.ok,
  };
}

const server = new McpServer(
  { name: "hundesalon-site-ops", version: "0.1.0" },
  {
    instructions:
      "Local gate for HUNDESALON NIKA. Prefer validate_site after HTML/CSS/JS edits. Use check_live_html only against production. submit_indexnow is a write — call only after an explicit deploy or indexing request.",
  },
);

server.registerTool(
  "validate_site",
  {
    title: "Validate site",
    description:
      "Run the full local validation gate (lint, links, project health, agents routing, payments). Use after code/content edits before claiming done. Does not deploy or hit IndexNow.",
    inputSchema: {},
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  async () => formatResult("validate", await runNpm("validate")),
);

server.registerTool(
  "check_links",
  {
    title: "Check internal links",
    description:
      "Scan local HTML for broken internal links. Faster than validate_site when only link integrity matters. Does not run lint or project checks.",
    inputSchema: {},
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  async () => formatResult("check:links", await runNpm("check:links")),
);

server.registerTool(
  "check_live_html",
  {
    title: "Check live HTML",
    description:
      "Fetch production HTML and verify cache/headers shape after a deploy. Not a local lint substitute — use validate_site for that.",
    inputSchema: {},
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: true,
    },
  },
  async () => formatResult("check:live-html", await runNpm("check:live-html")),
);

server.registerTool(
  "preview_indexnow_urls",
  {
    title: "Preview IndexNow URLs",
    description:
      "Dry-run: list URLs that seo:indexnow would submit (apex + www, sitemap). Does not notify search engines — use submit_indexnow for that.",
    inputSchema: {},
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  async () => formatResult("seo:urls", await runNpm("seo:urls")),
);

server.registerTool(
  "submit_indexnow",
  {
    title: "Submit IndexNow",
    description:
      "Submit all sitemap URLs to IndexNow (apex + www). Write operation — only after an explicit deploy or re-index request. Preview URLs first with preview_indexnow_urls.",
    inputSchema: {
      confirm: z
        .literal(true)
        .describe("Must be true to acknowledge this notifies search engines."),
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async ({ confirm }) => {
    if (confirm !== true) {
      return {
        content: [
          {
            type: "text",
            text: "Aborted: pass confirm=true after an explicit indexing request.",
          },
        ],
        isError: true,
      };
    }
    return formatResult("seo:indexnow", await runNpm("seo:indexnow"));
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);

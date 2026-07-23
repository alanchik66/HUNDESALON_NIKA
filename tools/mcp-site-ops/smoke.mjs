import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const child = spawn(process.execPath, ["server.mjs"], {
  cwd: dir,
  stdio: ["pipe", "pipe", "pipe"],
  windowsHide: true,
});

const send = (msg) => {
  child.stdin.write(`${JSON.stringify(msg)}\n`);
};

let buf = "";
const timer = setTimeout(() => {
  console.error("timeout\n", buf);
  child.kill();
  process.exit(1);
}, 10000);

child.stdout.on("data", (d) => {
  buf += d.toString();
  const lines = buf.split("\n");
  buf = lines.pop() ?? "";
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.id === 1 && msg.result?.serverInfo?.name) {
        console.log("initialize:", msg.result.serverInfo.name);
        send({ jsonrpc: "2.0", method: "notifications/initialized" });
        send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
      }
      if (msg.id === 2 && msg.result?.tools) {
        clearTimeout(timer);
        console.log(
          "tools:",
          msg.result.tools.map((t) => t.name).join(", "),
        );
        child.kill();
        process.exit(0);
      }
    } catch {
      /* ignore partial */
    }
  }
});

child.stderr.on("data", (d) => process.stderr.write(d));
child.on("error", (e) => {
  console.error(e);
  process.exit(1);
});

send({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "smoke", version: "0.0.1" },
  },
});

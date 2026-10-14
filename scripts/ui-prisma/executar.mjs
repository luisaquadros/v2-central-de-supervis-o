import { spawn } from "node:child_process";
import { copyFile, unlink } from "node:fs/promises";
const fixture = "__prisma_ui_fixture.html";
await copyFile(new URL("./fixture.html", import.meta.url), fixture);
const vite = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "--host",
    "127.0.0.1",
    "--port",
    "4174",
    "--strictPort",
  ],
  { stdio: "ignore" },
);
let exitCode;
vite.on("exit", (code) => {
  exitCode = code;
});
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (exitCode !== undefined)
      throw new Error("Vite não iniciou: confira se a porta 4174 está livre.");
    try {
      if ((await fetch("http://127.0.0.1:4174/" + fixture)).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!ready) throw new Error("Vite não respondeu no prazo.");
  await import("./interacoes.mjs");
  await import("./telas.mjs");
  await import("./avaliacao-rss.mjs");
} finally {
  vite.kill("SIGTERM");
  await unlink(fixture).catch(() => {});
}

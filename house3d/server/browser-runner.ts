import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, accessSync, statSync, constants } from "node:fs";
import { tmpdir } from "node:os";
import { join, delimiter, isAbsolute } from "node:path";

export function browserBinary() {
  const configured = process.env.HOUSE_CHROME;
  const candidates = configured
    ? [configured]
    : [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
        ...["PROGRAMFILES", "PROGRAMFILES(X86)", "LOCALAPPDATA"].flatMap((k) =>
          process.env[k]
            ? [
                join(process.env[k]!, "Google/Chrome/Application/chrome.exe"),
                join(process.env[k]!, "Microsoft/Edge/Application/msedge.exe"),
              ]
            : []
        ),
        ...(process.env.PATH || "")
          .split(delimiter)
          .filter(isAbsolute)
          .flatMap((d) =>
            [
              "chromium",
              "chromium-browser",
              "google-chrome",
              "microsoft-edge",
            ].map((n) => join(d, n))
          ),
      ];
  for (const path of candidates)
    try {
      if (isAbsolute(path) && statSync(path).isFile()) {
        accessSync(path, constants.X_OK);
        return path;
      }
    } catch {}
  throw Error(
    "找不到可执行的 Chrome/Chromium。设置 HOUSE_CHROME 为绝对路径，或用 node start.mjs --no-runner。没有下载浏览器。"
  );
}
export function launchRunner(
  binary: string,
  url: string,
  onExit: (reason: string) => void
) {
  const profile = mkdtempSync(join(tmpdir(), "agent-home-chrome-"));
  const child = spawn(
    binary,
    [
      "--headless",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
      "--window-size=960,720",
      "--user-data-dir=" + profile,
      url,
    ],
    { stdio: ["ignore", "ignore", "pipe"] }
  );
  // Keep bounded startup diagnostics (e.g. missing Linux libraries); never log the launch capability.
  const secret=new URLSearchParams(new URL(url).hash.slice(1)).get("runner");
  let stderr="";
  child.stderr.on("data",chunk=>{stderr=(stderr+chunk.toString()).slice(-2048)});
  let stopping = false;
  const closed = new Promise<void>((done) => {
    let reason = "";
    child.once("error", (e) => {
      reason = e.message;
    });
    child.once("close", (code, signal) => {
      try {
        rmSync(profile, { recursive: true, force: true, maxRetries: 3 });
      } catch {
        console.warn("未能清理 Runner 临时浏览器目录:", profile);
      }
      if (!stopping) {
        const message=[reason||String(signal||code),stderr.trim().split("\n").slice(-3).join(" ")].filter(Boolean).join(": ");
        onExit(secret?message.replaceAll(secret,"[runner]"):message);
      }
      done();
    });
  });
  return {
    pid: child.pid,
    async stop() {
      stopping = true;
      child.kill("SIGTERM");
      const timer = setTimeout(() => child.kill("SIGKILL"), 4000);
      try {
        await closed;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

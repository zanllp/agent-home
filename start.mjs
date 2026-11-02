import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 22 || (major === 22 && minor < 12)) {
  console.error("Agent Home requires Node.js 22.12 or newer.");
  process.exit(1);
}
const needsFlag = (major === 22 && minor < 13) || (major === 23 && minor < 4);
if (needsFlag && !process.execArgv.includes("--experimental-sqlite")) {
  const child = spawn(
    process.execPath,
    [
      "--experimental-sqlite",
      ...process.execArgv,
      fileURLToPath(import.meta.url),
      ...process.argv.slice(2),
    ],
    { stdio: "inherit" },
  );
  for (const signal of ["SIGINT", "SIGTERM"])
    process.once(signal, () => child.kill(signal));
  child.on("error", (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
  child.on("exit", (code, signal) => {
    process.exitCode = code ?? (signal ? 1 : 0);
  });
} else {
  if (!existsSync(new URL("./runtime/server.mjs", import.meta.url))) {
    console.error(
      "Missing prebuilt runtime. Download the runnable package, or run npm run build in a development checkout.",
    );
    process.exit(1);
  }
  await import("./runtime/server.mjs");
}

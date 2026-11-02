import { readFileSync, statSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url)),
  manifest = JSON.parse(
    readFileSync(resolve(root, "runtime-assets.json"), "utf8"),
  ).assets;
for (const [name, expected] of Object.entries(manifest)) {
  const bytes = readFileSync(resolve(root, name));
  if (
    bytes.length !== expected.bytes ||
    createHash("sha256").update(bytes).digest("hex") !== expected.sha256
  )
    throw Error(
      "Runtime asset differs from verified full-project copy: " + name,
    );
}
const files = [
  ...new Set(
    execFileSync(
      "git",
      ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
      { cwd: root },
    )
      .toString()
      .split("\0")
      .filter(Boolean),
  ),
].filter((f) => existsSync(resolve(root, f)));
const size = files.reduce((n, f) => n + statSync(resolve(root, f)).size, 0);
if (size >= 100_000_000)
  throw Error(`Tracked checkout exceeds 100 MB budget: ${size}`);
console.log(
  JSON.stringify(
    {
      checkout_bytes: size,
      checkout_MB: Math.round(size / 10000) / 100,
      runtime_assets_unchanged: Object.keys(manifest).length,
      budget_bytes: 100_000_000,
    },
    null,
    2,
  ),
);

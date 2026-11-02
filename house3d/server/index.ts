import { createServer, type IncomingMessage } from "node:http";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { HouseApp, loadContext, type Reply } from "./app.js";
const root =
  process.env.HOUSE_ROOT ||
  fileURLToPath(new URL("../house3d/", import.meta.url));
const web =
  process.env.HOUSE_WEB_ROOT ||
  fileURLToPath(new URL("./web/", import.meta.url));
const port = Number(process.env.HOUSE_PORT || 19130);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw Error("HOUSE_PORT must be an integer between 1 and 65535");
const app = new HouseApp(
  loadContext(root),
  process.env.HOUSE_DB || resolve(root, "data/house.sqlite"),
  root,
  web,
);
const server = createServer(async (req, res) => {
  const reply = (r: Reply) => {
    const bytes = r.bytes ?? Buffer.from(JSON.stringify(r.body));
    res.writeHead(r.status, {
      "Content-Type": r.type || "application/json; charset=utf-8",
      "Content-Length": bytes.length,
      "X-Content-Type-Options": "nosniff",
    });
    res.end(req.method === "HEAD" ? undefined : bytes);
  };
  try {
    const chunks: Buffer[] = [];
    let length = 0;
    for await (const chunk of req) {
      length += chunk.length;
      if (length > 5 * 1024 * 1024) {
        reply({ status: 413, body: { error: "Request body exceeds 5 MiB" } });
        req.resume();
        return;
      }
      chunks.push(Buffer.from(chunk));
    }
    const bytes = Buffer.concat(chunks);
    let body: unknown;
    if (
      bytes.length &&
      (req.headers["content-type"] || "").split(";")[0] === "application/json"
    ) {
      try {
        body = JSON.parse(bytes.toString("utf8"));
      } catch {
        reply({ status: 400, body: { error: "Invalid JSON" } });
        return;
      }
    }
    const headers = Object.fromEntries(
      Object.entries(req.headers).map(([k, v]) => [
        k,
        Array.isArray(v) ? v.join(",") : v,
      ]),
    );
    reply(
      app.handle({
        method: req.method || "GET",
        url: req.url || "/",
        headers,
        body,
        bytes,
      }),
    );
  } catch (e) {
    console.error("House request failed:", (e as Error).message);
    if (!res.headersSent)
      reply({ status: 500, body: { error: "Internal server error" } });
    else res.end();
  }
});
server.requestTimeout = 15000;
server.headersTimeout = 10000;
server.on("error", (error) => {
  console.error("Could not start Agent Home:", error.message);
  app.close();
  process.exitCode = 1;
});
server.listen(port, "127.0.0.1", () =>
  console.log(`Agent Home: http://127.0.0.1:${port}/`),
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () =>
    server.close(() => {
      app.close();
      process.exit(0);
    }),
  );

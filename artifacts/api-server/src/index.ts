import http from "node:http";
import app from "./app";
import { logger } from "./lib/logger";
import { seedAdmin } from "./lib/admin-seed";
import { attachRealtime } from "./lib/realtime";

seedAdmin();

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = http.createServer(app);

const sessionSecret =
  process.env.SESSION_SECRET ?? "dev-only-fallback-do-not-use-in-prod";
attachRealtime(server, sessionSecret);

server.listen(port, () => {
  logger.info({ port }, "Server listening (HTTP + WebSocket)");
});

server.on("error", (err) => {
  logger.error({ err }, "Server error");
  process.exit(1);
});

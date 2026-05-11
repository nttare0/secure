import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import path from "node:path";
import fs from "node:fs";
import router from "./routes";
import { logger } from "./lib/logger";
import { SqliteStore } from "./lib/session-store";
import { generalLimiter } from "./lib/rate-limit";

const app: Express = express();

const isProd = process.env.NODE_ENV === "production";

app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  next();
});

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req: Request) {
        return { id: (req as any).id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res: Response) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  if (isProd) {
    throw new Error("SESSION_SECRET environment variable is required in production");
  }
  logger.warn("SESSION_SECRET not set; using insecure dev fallback. Do NOT use in production.");
}

app.use(
  session({
    name: "vc.sid",
    secret: sessionSecret ?? "dev-only-fallback-do-not-use-in-prod",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
      maxAge: 1000 * 60 * 60 * 24 * 30,
    },
    store: new SqliteStore(),
  }),
);

app.use("/api", generalLimiter, router);

// Serve the built React frontend (self-contained: one server for everything)
const clientDist = path.resolve(import.meta.dirname, "..", "..", "vaultchat", "dist", "public");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist, { maxAge: "1d", index: false }));
  // For any non-API route, serve the SPA index.html (client-side routing)
  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
  logger.info({ clientDist }, "Serving bundled frontend");
} else {
  logger.warn({ clientDist }, "No built frontend found — run: pnpm --filter @workspace/vaultchat run build");
}

// JSON error handler so errors don't return HTML
app.use((err: unknown, req: Request, res: Response, _next: NextFunction): void => {
  req.log?.error({ err }, "Unhandled error");
  if (res.headersSent) return;
  // Multer / payload-too-large
  const anyErr = err as { type?: string; status?: number; message?: string };
  if (anyErr?.type === "entity.too.large" || anyErr?.status === 413) {
    res.status(413).json({ error: "Request payload too large" });
    return;
  }
  // Don't leak internal error details in production
  const message = isProd
    ? "Internal server error"
    : err instanceof Error
      ? err.message
      : "Internal server error";
  res.status(500).json({ error: message });
});

export default app;

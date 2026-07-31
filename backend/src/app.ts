import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "node:path";
import { apiRouter } from "./routes/index.js";
import { env } from "./config/env.js";
import { httpLogger } from "./config/logger.js";
import { emailService } from "./services/email.service.js";
import { notFoundHandler } from "./middleware/not-found.js";
import { errorHandler } from "./middleware/error-handler.js";

export const app = express();

const allowedOrigins = env.CORS_ORIGIN.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(httpLogger);
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
    frameguard: false
  })
);
app.use(
  cors({
    origin: (origin, callback) => {
      // Reflect allowed SPA origins; never throw (throwing breaks /uploads iframe loads).
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true
  })
);

// Attachments must be readable/embeddable from the SPA origin
app.use("/uploads", (_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  next();
});
app.use(express.json({ limit: "12mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/health", (_req, res) => {
  res.json({ success: true, data: { status: "ok" } });
});

app.post("/send-mail", async (req, res) => {
  const { email } = req.body as { email?: string };

  if (!email) {
    res.status(400).json({ success: false, error: { message: "email is required" } });
    return;
  }

  try {
    const sent = await emailService.sendSimpleWelcomeEmail(email);
    res.json({ success: true, data: { sent } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send email";
    res.status(500).json({ success: false, error: { message } });
  }
});

// DB-backed file GET (and POST) — register before static so missing disk files still resolve
app.use("/", apiRouter);
app.use("/api", apiRouter);
// Disk fallback for older uploads that still exist on disk
app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));

app.use(notFoundHandler);
app.use(errorHandler);
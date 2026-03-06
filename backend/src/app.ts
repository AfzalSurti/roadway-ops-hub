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
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true
  })
);
app.use(express.json({ limit: "2mb" }));
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

app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));
app.use("/", apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);
import "dotenv/config";
import cors from "cors";
import express from "express";
import { sendContactEmail, validateContactPayload } from "./send-contact-email.js";

const app = express();
const port = Number(process.env.CONTACT_SERVER_PORT ?? 3098);

app.use(
  cors({
    origin: ["http://localhost:3099", "http://127.0.0.1:3099"],
    methods: ["POST", "OPTIONS"]
  })
);
app.use(express.json({ limit: "32kb" }));

app.post("/api/contact", async (req, res) => {
  try {
    const payload = validateContactPayload(req.body);
    await sendContactEmail(payload);
    res.json({ success: true, message: "Message sent successfully" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send message";
    const status = message.includes("Invalid") || message.includes("Please enter") ? 400 : 500;
    res.status(status).json({ success: false, message });
  }
});

app.listen(port, () => {
  console.log(`Contact API running on http://localhost:${port}`);
});

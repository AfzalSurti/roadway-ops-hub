import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sendContactEmail, validateContactPayload } from "../server/send-contact-email.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ success: false, message: "Method not allowed" });
    return;
  }

  try {
    const payload = validateContactPayload(req.body);
    await sendContactEmail(payload);
    res.status(200).json({ success: true, message: "Message sent successfully" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send message";
    const status = message.includes("Invalid") || message.includes("Please enter") ? 400 : 500;
    res.status(status).json({ success: false, message });
  }
}

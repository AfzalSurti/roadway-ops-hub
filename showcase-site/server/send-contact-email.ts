import { Resend } from "resend";

export type ContactPayload = {
  name: string;
  email: string;
  phone?: string;
  message: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendContactEmail(payload: ContactPayload) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_EMAIL_TO ?? "surtiafzal915@gmail.com";
  const from =
    process.env.CONTACT_EMAIL_FROM ?? "OpsForge Portfolio <onboarding@resend.dev>";

  if (!apiKey) {
    throw new Error("Email service is not configured");
  }

  const resend = new Resend(apiKey);
  const phoneLine = payload.phone?.trim()
    ? `<p><strong>Phone:</strong> ${escapeHtml(payload.phone.trim())}</p>`
    : "";

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a; max-width: 640px;">
      <h2 style="margin-bottom: 8px;">New portfolio inquiry</h2>
      <p style="color: #64748b; margin-top: 0;">Someone submitted the OpsForge showcase contact form.</p>
      <div style="margin: 20px 0; padding: 16px; border: 1px solid #cbd5e1; border-radius: 12px; background: #f8fafc;">
        <p style="margin: 0 0 8px;"><strong>Name:</strong> ${escapeHtml(payload.name)}</p>
        <p style="margin: 0 0 8px;"><strong>Email:</strong> ${escapeHtml(payload.email)}</p>
        ${phoneLine}
        <p style="margin: 12px 0 6px;"><strong>Message:</strong></p>
        <p style="margin: 0; white-space: pre-wrap;">${escapeHtml(payload.message)}</p>
      </div>
      <p style="font-size: 13px; color: #64748b;">Reply directly to ${escapeHtml(payload.email)} to respond.</p>
    </div>
  `;

  const text = [
    "New portfolio inquiry",
    "",
    `Name: ${payload.name}`,
    `Email: ${payload.email}`,
    payload.phone?.trim() ? `Phone: ${payload.phone.trim()}` : null,
    "",
    "Message:",
    payload.message
  ]
    .filter(Boolean)
    .join("\n");

  const result = await resend.emails.send({
    from,
    to: [to],
    replyTo: payload.email,
    subject: `OpsForge inquiry from ${payload.name}`,
    html,
    text
  });

  if (result.error) {
    throw new Error(result.error.message);
  }

  return result.data;
}

export function validateContactPayload(body: unknown): ContactPayload {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid request body");
  }

  const data = body as Record<string, unknown>;
  const name = typeof data.name === "string" ? data.name.trim() : "";
  const email = typeof data.email === "string" ? data.email.trim() : "";
  const phone = typeof data.phone === "string" ? data.phone.trim() : "";
  const message = typeof data.message === "string" ? data.message.trim() : "";

  if (!name || name.length < 2) {
    throw new Error("Please enter your full name");
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Please enter a valid email address");
  }

  if (!message || message.length < 10) {
    throw new Error("Please describe your project or message (at least 10 characters)");
  }

  return { name, email, phone: phone || undefined, message };
}

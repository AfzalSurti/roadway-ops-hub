import nodemailer from "nodemailer";
import { Resend } from "resend";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

const transporter =
  env.GMAIL && env.APP_PASSWORD
    ? nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        requireTLS: true,
        auth: {
          user: env.GMAIL,
          pass: env.APP_PASSWORD
        },
        connectionTimeout: 20000,
        greetingTimeout: 15000,
        socketTimeout: 20000
      })
    : null;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildWelcomeHtml(payload: { employeeName: string; employeeEmail: string; password: string }, appUrl: string) {
  const employeeName = escapeHtml(payload.employeeName);
  const employeeEmail = escapeHtml(payload.employeeEmail);
  const password = escapeHtml(payload.password);
  const safeAppUrl = escapeHtml(appUrl);

  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a; max-width: 640px; margin: 0 auto;">
      <h2 style="margin-bottom: 12px;">Hello ${employeeName},</h2>
      <p>You are invited to Sankalp website.</p>
      <p>
        Website link:
        <a href="${safeAppUrl}" style="color: #2563eb; text-decoration: none;">${safeAppUrl}</a>
      </p>
      <div style="margin: 20px 0; padding: 16px; border: 1px solid #cbd5e1; border-radius: 12px; background: #f8fafc;">
        <p style="margin: 0 0 10px;"><strong>Your credentials</strong></p>
        <p style="margin: 0 0 6px;"><strong>Email:</strong> ${employeeEmail}</p>
        <p style="margin: 0;"><strong>Password:</strong> ${password}</p>
      </div>
      <p>Please use these credentials to sign in.</p>
      <p style="margin-top: 20px;">RoadwayOps Hub Team</p>
    </div>
  `;
}

function buildWelcomeText(payload: { employeeName: string; employeeEmail: string; password: string }, appUrl: string) {
  return [
    `Hello ${payload.employeeName},`,
    "",
    "You are invited to Sankalp website.",
    `Website link: ${appUrl}`,
    "",
    "Your credentials:",
    `Email: ${payload.employeeEmail}`,
    `Password: ${payload.password}`,
    "",
    "Please use these credentials to sign in.",
    "",
    "RoadwayOps Hub Team"
  ].join("\n");
}

async function sendViaResend(args: { to: string; subject: string; html: string; text: string }) {
  if (!resend) {
    return false;
  }

  const from = env.EMAIL_FROM ?? "RoadwayOps Hub <onboarding@resend.dev>";

  const result = await resend.emails.send({
    from,
    to: [args.to],
    subject: args.subject,
    html: args.html,
    text: args.text
  });

  if (result.error) {
    throw new Error(`Resend send failed: ${result.error.message}`);
  }

  return true;
}

export const emailService = {
  isEnabled() {
    return Boolean(env.RESEND_API_KEY || transporter);
  },

  async sendEmployeeWelcomeEmail(payload: { to: string; employeeName: string; employeeEmail: string; password: string }) {
    const appUrl = env.APP_URL ?? "https://roadway-ops-hub.vercel.app";

    const subject = "Invitation to Sankalp Website";
    const html = buildWelcomeHtml(payload, appUrl);
    const text = buildWelcomeText(payload, appUrl);

    if (env.RESEND_API_KEY) {
      try {
        await sendViaResend({ to: payload.to, subject, html, text });
        return true;
      } catch (error) {
        logger.warn({ err: error, to: payload.to }, "Resend email send failed; falling back to SMTP");
      }
    }

    if (!transporter || !env.GMAIL) {
      logger.warn("No email provider configured (RESEND_API_KEY or GMAIL/APP_PASSWORD). Welcome email skipped.");
      return false;
    }

    await transporter.sendMail({
      from: env.EMAIL_FROM ?? `RoadwayOps Hub <${env.GMAIL}>`,
      to: payload.to,
      subject,
      html,
      text
    });

    return true;
  },

  async sendSimpleWelcomeEmail(to: string) {
    const html = "<p>Your account is created successfully.</p>";
    const subject = "Welcome Employee";
    const text = "Your account is created successfully.";

    if (resend) {
      await sendViaResend({ to, subject, html, text });
      return true;
    }

    if (!transporter || !env.GMAIL) {
      logger.warn("No email provider configured (RESEND_API_KEY or GMAIL/APP_PASSWORD). Welcome email skipped.");
      return false;
    }

    await transporter.sendMail({
      from: env.EMAIL_FROM ?? `RoadwayOps Hub <${env.GMAIL}>`,
      to,
      subject,
      html,
      text
    });

    return true;
  }
};

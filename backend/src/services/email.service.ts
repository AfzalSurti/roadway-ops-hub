import nodemailer from "nodemailer";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";

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

function buildWelcomeHtml(payload: { employeeName: string; employeeEmail: string; password: string }, appUrl: string) {
  return `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #0f172a;">
        <h2 style="margin-bottom: 12px;">Welcome to RoadwayOps Hub</h2>
        <p>Hi ${payload.employeeName},</p>
        <p>Your employee account has been created successfully.</p>
        <p><strong>Website:</strong> <a href="${appUrl}">${appUrl}</a></p>
        <p><strong>Login Credentials</strong></p>
        <ul>
          <li><strong>Email:</strong> ${payload.employeeEmail}</li>
          <li><strong>Password:</strong> ${payload.password}</li>
        </ul>
        <p>Please sign in and change your password after first login.</p>
        <p style="margin-top: 20px;">- RoadwayOps Hub</p>
      </div>
    `;
}

async function sendViaResend(args: { to: string; subject: string; html: string }) {
  if (!env.RESEND_API_KEY) {
    return false;
  }

  const from = env.EMAIL_FROM ?? "RoadwayOps Hub <onboarding@resend.dev>";

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: [args.to],
      subject: args.subject,
      html: args.html
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend send failed (${response.status}): ${body}`);
  }

  return true;
}

export const emailService = {
  isEnabled() {
    return Boolean(env.RESEND_API_KEY || transporter);
  },

  async sendEmployeeWelcomeEmail(payload: { to: string; employeeName: string; employeeEmail: string; password: string }) {
    const appUrl = env.APP_URL ?? "https://roadway-ops-hub.vercel.app";

    const subject = "Your RoadwayOps Hub Employee Account";
    const html = buildWelcomeHtml(payload, appUrl);

    if (env.RESEND_API_KEY) {
      try {
        await sendViaResend({ to: payload.to, subject, html });
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
      html
    });

    return true;
  }
};

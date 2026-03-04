import nodemailer from "nodemailer";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";

const transporter =
  env.GMAIL && env.APP_PASSWORD
    ? nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: env.GMAIL,
          pass: env.APP_PASSWORD
        }
      })
    : null;

export const emailService = {
  isEnabled() {
    return Boolean(transporter);
  },

  async sendEmployeeWelcomeEmail(payload: { to: string; employeeName: string; employeeEmail: string; password: string }) {
    if (!transporter || !env.GMAIL) {
      logger.warn("GMAIL/APP_PASSWORD not configured. Welcome email skipped.");
      return false;
    }

    const appUrl = env.APP_URL ?? "https://roadway-ops-hub.vercel.app";

    const html = `
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
        <p style="margin-top: 20px;">— RoadwayOps Hub</p>
      </div>
    `;

    await transporter.sendMail({
      from: `RoadwayOps Hub <${env.GMAIL}>`,
      to: payload.to,
      subject: "Your RoadwayOps Hub Employee Account",
      html
    });

    return true;
  }
};

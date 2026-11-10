import "server-only";
import { db } from "./db";
import { env } from "./env";

/** Emails the business owner via Resend when configured. Never throws and never logs message contents. */
export async function notify(subject: string, text: string) {
  const key = env("RESEND_API_KEY");
  if (!key) return;
  let to = process.env.NOTIFY_EMAIL || "";
  try {
    const s = await db.storeSettings.findUnique({ where: { id: 1 }, select: { notifyEmail: true } });
    to = s?.notifyEmail || to;
  } catch {}
  if (!to) return;
  await sendEmail(to, subject, text);
}

export async function sendEmail(to: string, subject: string, text: string) {
  const key = env("RESEND_API_KEY");
  if (!key) return false;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM || "Store <onboarding@resend.dev>", to: [to], subject, text }),
    });
    return r.ok;
  } catch {
    console.error(JSON.stringify({ level: "error", msg: "email_send_failed" }));
    return false;
  }
}

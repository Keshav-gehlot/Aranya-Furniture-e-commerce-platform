import "server-only";
import { headers } from "next/headers";

/** Client IP and user agent for audit logs. Behind the ALB the left-most X-Forwarded-For entry is the client. */
export async function requestMeta() {
  try {
    const h = await headers();
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
    return { ip, userAgent: h.get("user-agent")?.slice(0, 300) ?? null };
  } catch {
    return { ip: null, userAgent: null };
  }
}

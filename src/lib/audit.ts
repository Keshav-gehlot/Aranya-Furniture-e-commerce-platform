import "server-only";
import { db } from "./db";
import { requestMeta } from "./request-meta";
import type { Prisma } from "@/generated/prisma/client";

type Actor = { id: string; email: string } | null | undefined;

/**
 * Records a sensitive action. Never pass passwords, tokens, secrets or card data in `details`.
 * Audit failures are logged but never block the action itself.
 */
export async function audit(
  actor: Actor,
  action: string,
  target?: { type: string; id?: string | null },
  details?: Prisma.InputJsonValue,
) {
  try {
    const meta = await requestMeta();
    await db.auditLog.create({
      data: {
        actorId: actor?.id ?? null,
        actorEmail: actor?.email ?? null,
        action,
        targetType: target?.type ?? null,
        targetId: target?.id ?? null,
        details: details ?? undefined,
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
    });
  } catch (e) {
    console.error(JSON.stringify({ level: "error", msg: "audit_write_failed", action, error: String(e) }));
  }
}

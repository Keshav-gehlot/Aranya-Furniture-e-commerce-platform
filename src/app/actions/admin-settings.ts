"use server";
/** Admin-only actions: store settings and staff access. All require a fresh MFA check. */
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRecentMfa } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { toMinor } from "@/lib/money";
import { randomToken, sha256 } from "@/lib/crypto";
import { sanitizePermissions } from "@/lib/permissions";
import { sendEmail } from "@/lib/notify";
import { site } from "@/config/site";
import { taxSchema } from "@/lib/tax-rules";
import { saveTaxSettings } from "@/lib/tax";

export type SettingsState = { error?: string; ok?: string; inviteLink?: string; /** What was typed, so a refused form keeps it. */ values?: Record<string, string> } | undefined;

const INVITE_HOURS = 72;

const settingsSchema = z.object({
  gstPercent: z.coerce.number().min(0).max(50),
  domesticShipping: z.string(),
  domesticFreeShippingOver: z.string(),
  exportHandling: z.string(),
  defaultMoq: z.coerce.number().int().min(1).max(10_000),
  reservationMinutes: z.coerce.number().int().min(10).max(240),
  notifyEmail: z.union([z.literal(""), z.string().email()]),
});

export async function saveStoreSettings(_: SettingsState, fd: FormData): Promise<SettingsState> {
  const user = await requireRecentMfa("settings", "/admin/settings");
  const parsed = settingsSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;
  const data = {
    gstRateBps: Math.round(v.gstPercent * 100),
    domesticShipping: toMinor(v.domesticShipping),
    domesticFreeShippingOver: toMinor(v.domesticFreeShippingOver),
    exportHandling: toMinor(v.exportHandling),
    defaultMoq: v.defaultMoq,
    reservationMinutes: v.reservationMinutes,
    notifyEmail: v.notifyEmail || null,
    updatedById: user.id,
  };
  await db.storeSettings.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });
  await audit(user, "settings.updated", { type: "StoreSettings", id: "1" }, { ...data, updatedById: undefined });
  revalidatePath("/admin/settings");
  return { ok: "Settings saved." };
}

export async function saveTaxDetails(_: SettingsState, fd: FormData): Promise<SettingsState> {
  const user = await requireRecentMfa("settings", "/admin/settings");
  const typed = Object.fromEntries([...fd].filter((e): e is [string, string] => typeof e[1] === "string" && !e[0].startsWith("$")));
  const parsed = taxSchema.safeParse(typed);
  if (!parsed.success) return { error: parsed.error.issues[0].message, values: typed };
  await saveTaxSettings(parsed.data, user.id);
  await audit(user, "settings.tax_updated", { type: "TaxSettings", id: "1" }, parsed.data);
  revalidatePath("/admin/settings");
  return { ok: "Tax details saved. They now appear on order pages." };
}

const inviteSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email().max(200),
  role: z.enum(["STAFF", "ADMIN"]),
});

export async function inviteStaff(_: SettingsState, fd: FormData): Promise<SettingsState> {
  const user = await requireRecentMfa("staff", "/admin/settings/staff");
  const parsed = inviteSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: "Enter a name, a valid email and a role." };
  const v = parsed.data;
  const permissions = v.role === "STAFF" ? sanitizePermissions(fd.getAll("permissions")) : [];
  if (v.role === "STAFF" && permissions.length === 0) return { error: "Give staff at least one module." };
  if (await db.user.findUnique({ where: { email: v.email } })) return { error: "An account already uses this email." };

  // One live invite per email.
  await db.staffInvite.updateMany({ where: { email: v.email, acceptedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
  const token = randomToken();
  const invite = await db.staffInvite.create({
    data: { email: v.email, name: v.name, role: v.role, permissions, tokenHash: sha256(token), expiresAt: new Date(Date.now() + INVITE_HOURS * 3600_000), invitedById: user.id },
  });
  const base = process.env.NEXT_PUBLIC_SITE_URL || "";
  const link = `${base}/invite/${token}`;
  const emailed = await sendEmail(
    v.email,
    `You're invited to the ${site.name} admin panel`,
    `Hello ${v.name},\n\n${user.name} has invited you to the ${site.name} admin panel as ${v.role.toLowerCase()}.\n\nSet your password here (link expires in ${INVITE_HOURS} hours):\n${link}\n\nYou'll also set up two-step sign-in with an authenticator app.`,
  );
  await audit(user, "staff.invited", { type: "StaffInvite", id: invite.id }, { email: v.email, role: v.role, permissions, emailed });
  revalidatePath("/admin/settings/staff");
  return { ok: emailed ? `Invitation emailed to ${v.email}.` : "Invitation created. Email isn't set up, so send this link yourself — it's shown only once:", inviteLink: emailed ? undefined : link };
}

export async function revokeInvite(fd: FormData) {
  const user = await requireRecentMfa("staff", "/admin/settings/staff");
  const id = String(fd.get("id"));
  await db.staffInvite.update({ where: { id }, data: { revokedAt: new Date() } });
  await audit(user, "staff.invite_revoked", { type: "StaffInvite", id });
  revalidatePath("/admin/settings/staff");
}

/** Change a staff member's role/modules, disable them, sign them out everywhere, or reset their MFA. */
export async function updateStaff(_: SettingsState, fd: FormData): Promise<SettingsState> {
  const user = await requireRecentMfa("staff", "/admin/settings/staff");
  const id = String(fd.get("id"));
  const action = String(fd.get("action"));
  if (id === user.id) return { error: "You can't change your own access. Ask another administrator." };
  const target = await db.user.findUnique({ where: { id } });
  if (!target || (target.role !== "STAFF" && target.role !== "ADMIN")) return { error: "Staff member not found." };

  const activeAdmins = await db.user.count({ where: { role: "ADMIN", isActive: true } });
  const removingAdmin = target.role === "ADMIN" && target.isActive && (action === "disable" || (action === "save" && fd.get("role") === "STAFF"));
  if (removingAdmin && activeAdmins <= 1) return { error: "Keep at least one active administrator." };

  if (action === "save") {
    const role = fd.get("role") === "ADMIN" ? "ADMIN" : "STAFF";
    const permissions = role === "STAFF" ? sanitizePermissions(fd.getAll("permissions")) : [];
    if (role === "STAFF" && permissions.length === 0) return { error: "Give staff at least one module, or disable the account." };
    await db.user.update({ where: { id }, data: { role, permissions, sessionVersion: { increment: 1 } } });
    await audit(user, "staff.access_changed", { type: "User", id }, { from: { role: target.role, permissions: target.permissions }, to: { role, permissions } });
    revalidatePath("/admin/settings/staff");
    return { ok: `Access updated for ${target.name}. They've been signed out and will sign in with the new access.` };
  }
  if (action === "disable" || action === "enable") {
    await db.user.update({ where: { id }, data: { isActive: action === "enable", sessionVersion: { increment: 1 } } });
    await audit(user, action === "disable" ? "staff.disabled" : "staff.enabled", { type: "User", id });
    revalidatePath("/admin/settings/staff");
    return { ok: action === "disable" ? `${target.name} can no longer sign in, effective immediately.` : `${target.name} can sign in again.` };
  }
  if (action === "signout") {
    await db.user.update({ where: { id }, data: { sessionVersion: { increment: 1 } } });
    await audit(user, "staff.signed_out", { type: "User", id });
    return { ok: `${target.name} has been signed out on every device.` };
  }
  if (action === "reset-mfa") {
    await db.user.update({ where: { id }, data: { mfaEnabled: false, mfaSecretEnc: null, mfaRecoveryCodes: [], sessionVersion: { increment: 1 } } });
    await audit(user, "staff.mfa_reset", { type: "User", id });
    revalidatePath("/admin/settings/staff");
    return { ok: `${target.name} will set up two-step sign-in again at their next sign-in.` };
  }
  return { error: "Unknown action." };
}

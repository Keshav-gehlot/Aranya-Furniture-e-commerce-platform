"use server";
import { z } from "zod";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  checkPassword,
  createMfaPending,
  createSession,
  destroySession,
  dummyPasswordCheck,
  getAuth,
  hashPassword,
} from "@/lib/auth";
import { isPrivileged } from "@/lib/permissions";
import { MFA_PENDING_COOKIE, verifyMfaPending } from "@/lib/session";
import { audit } from "@/lib/audit";
import { newMfaSecret, newRecoveryCodes, useRecoveryCode, verifyTotp } from "@/lib/mfa";
import { sha256 } from "@/lib/crypto";

export type FormState = { error?: string; ok?: string; codes?: string[]; qr?: string; secret?: string } | undefined;

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

function safeNext(next: unknown, fallback: string) {
  const n = typeof next === "string" ? next : "";
  return n.startsWith("/") && !n.startsWith("//") && !n.startsWith("/\\") ? n : fallback;
}

// ---------------------------------------------------------------- sign in

export async function loginAction(_: FormState, fd: FormData): Promise<FormState> {
  const email = String(fd.get("email") || "").trim().toLowerCase();
  const password = String(fd.get("password") || "");
  if (!email || !password) return { error: "Enter your email and password." };

  const user = await db.user.findUnique({ where: { email } });
  const generic = { error: "Incorrect email or password." };
  if (!user) {
    await dummyPasswordCheck(password);
    return generic;
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return { error: `Too many attempts. Try again after ${user.lockedUntil.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}.` };
  }
  if (!(await checkPassword(password, user.passwordHash))) {
    const failed = user.failedLogins + 1;
    const lock = failed >= MAX_FAILED;
    await db.user.update({
      where: { id: user.id },
      data: { failedLogins: lock ? 0 : failed, lockedUntil: lock ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null },
    });
    if (isPrivileged(user.role) || lock) await audit({ id: user.id, email: user.email }, lock ? "auth.locked" : "auth.login_failed", { type: "User", id: user.id });
    return lock ? { error: `Too many attempts. This account is locked for ${LOCK_MINUTES} minutes.` } : generic;
  }
  if (!user.isActive) return { error: "This account has been disabled. Please contact the store." };

  await db.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } });
  const next = fd.get("next");

  if (isPrivileged(user.role)) {
    if (user.mfaEnabled) {
      await createMfaPending(user.id, safeNext(next, "/admin"));
      redirect("/login/mfa");
    }
    // Not enrolled yet: signed in, but every admin page sends them to MFA setup first.
    await createSession(user);
    await audit({ id: user.id, email: user.email }, "auth.login_password_only", { type: "User", id: user.id });
    redirect("/admin/mfa/setup");
  }

  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createSession(user);
  redirect(safeNext(next, "/account"));
}

export async function verifyMfaLogin(_: FormState, fd: FormData): Promise<FormState> {
  const pending = await verifyMfaPending((await cookies()).get(MFA_PENDING_COOKIE)?.value);
  if (!pending) return { error: "Your sign-in timed out. Please sign in again." };
  const user = await db.user.findUnique({ where: { id: pending.sub } });
  if (!user || !user.isActive || !user.mfaEnabled || !user.mfaSecretEnc) return { error: "Please sign in again." };
  if (user.lockedUntil && user.lockedUntil > new Date()) return { error: "Too many attempts. Try again later." };

  const code = String(fd.get("code") || "").trim();
  let ok = false;
  let usedRecovery = false;
  if (/^\d{6}$/.test(code.replace(/\s/g, ""))) {
    ok = verifyTotp(user.mfaSecretEnc, code, user.email);
  } else if (code) {
    const remaining = useRecoveryCode(user.mfaRecoveryCodes, code);
    if (remaining) {
      ok = true;
      usedRecovery = true;
      await db.user.update({ where: { id: user.id }, data: { mfaRecoveryCodes: remaining } });
    }
  }
  if (!ok) {
    const failed = user.failedLogins + 1;
    const lock = failed >= MAX_FAILED;
    await db.user.update({
      where: { id: user.id },
      data: { failedLogins: lock ? 0 : failed, lockedUntil: lock ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null },
    });
    await audit({ id: user.id, email: user.email }, "auth.mfa_failed", { type: "User", id: user.id });
    return { error: lock ? "Too many attempts. Account locked for 15 minutes." : "That code didn't work. Check your authenticator app and try again." };
  }
  await db.user.update({ where: { id: user.id }, data: { failedLogins: 0, lastLoginAt: new Date() } });
  await createSession(user, { mfa: true });
  await audit({ id: user.id, email: user.email }, usedRecovery ? "auth.login_recovery_code" : "auth.login", { type: "User", id: user.id });
  redirect(safeNext(pending.next, "/admin"));
}

// ---------------------------------------------------------------- MFA enrolment & re-check

/** Step 1: creates a new (not yet active) secret and returns the QR code. */
export async function startMfaSetup(): Promise<FormState> {
  const auth = await getAuth();
  if (!auth || !isPrivileged(auth.user.role)) return { error: "Please sign in." };
  if (auth.user.mfaEnabled) return { error: "Two-step sign-in is already set up." };
  const { secret, secretEnc, qrDataUrl } = await newMfaSecret(auth.user.email);
  await db.user.update({ where: { id: auth.user.id }, data: { mfaSecretEnc: secretEnc } });
  return { qr: qrDataUrl, secret };
}

/** Step 2: confirms the first code, turns MFA on and returns one-time recovery codes. */
export async function confirmMfaSetup(_: FormState, fd: FormData): Promise<FormState> {
  const auth = await getAuth();
  if (!auth || !isPrivileged(auth.user.role)) return { error: "Please sign in." };
  const user = await db.user.findUnique({ where: { id: auth.user.id } });
  if (!user?.mfaSecretEnc || user.mfaEnabled) return { error: "Start the setup again." };
  if (!verifyTotp(user.mfaSecretEnc, String(fd.get("code") || ""), user.email)) {
    return { error: "That code didn't match. Wait for the next code and try again." };
  }
  const { codes, hashes } = newRecoveryCodes();
  const updated = await db.user.update({
    where: { id: user.id },
    data: { mfaEnabled: true, mfaRecoveryCodes: hashes, sessionVersion: { increment: 1 } },
  });
  await createSession(updated, { mfa: true });
  await audit({ id: user.id, email: user.email }, "auth.mfa_enabled", { type: "User", id: user.id });
  return { ok: "Two-step sign-in is on.", codes };
}

/** Re-confirms identity before sensitive operations (staff, settings, refunds). */
export async function reauthAction(_: FormState, fd: FormData): Promise<FormState> {
  const auth = await getAuth();
  if (!auth || !isPrivileged(auth.user.role) || !auth.user.mfaEnabled || !auth.user.mfaSecretEnc) return { error: "Please sign in again." };
  if (!verifyTotp(auth.user.mfaSecretEnc, String(fd.get("code") || ""), auth.user.email)) {
    await audit({ id: auth.user.id, email: auth.user.email }, "auth.reauth_failed", { type: "User", id: auth.user.id });
    return { error: "That code didn't work." };
  }
  await createSession(auth.user, { mfa: true });
  redirect(safeNext(fd.get("next"), "/admin"));
}

// ---------------------------------------------------------------- customer registration

const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Enter your full name.").max(100),
    email: z.string().trim().toLowerCase().email("Enter a valid email.").max(200),
    phone: z.string().trim().max(30).optional(),
    password: z.string().min(10, "Password must be at least 10 characters.").max(200),
    accountType: z.enum(["RETAIL", "BUSINESS"]),
    companyName: z.string().trim().max(150).optional(),
    taxId: z.string().trim().max(40).optional(),
    country: z.string().trim().min(2, "Select your country.").max(60),
  })
  .refine((v) => v.accountType === "RETAIL" || (v.companyName && v.companyName.length >= 2), {
    message: "Company name is required for business accounts.",
  });

/** Public sign-up only ever creates CUSTOMER accounts. Staff and admins join by invitation. */
export async function registerAction(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;
  if (await db.user.findUnique({ where: { email: v.email } })) {
    return { error: "An account with this email already exists. Try signing in." };
  }
  const user = await db.user.create({
    data: {
      name: v.name,
      email: v.email,
      phone: v.phone || null,
      passwordHash: await hashPassword(v.password),
      role: "CUSTOMER",
      accountType: v.accountType,
      companyName: v.accountType === "BUSINESS" ? v.companyName : null,
      taxId: v.accountType === "BUSINESS" ? v.taxId || null : null,
      country: v.country,
    },
  });
  await createSession(user);
  redirect(safeNext(fd.get("next"), "/account"));
}

// ---------------------------------------------------------------- staff invitation

export async function acceptInvite(_: FormState, fd: FormData): Promise<FormState> {
  const token = String(fd.get("token") || "");
  const password = String(fd.get("password") || "");
  if (password.length < 12) return { error: "Use at least 12 characters for a staff password." };
  if (password !== String(fd.get("confirm") || "")) return { error: "The passwords don't match." };

  const invite = await db.staffInvite.findUnique({ where: { tokenHash: sha256(token) } });
  if (!invite || invite.acceptedAt || invite.revokedAt || invite.expiresAt < new Date()) {
    return { error: "This invitation link is invalid or has expired. Ask an administrator for a new one." };
  }
  const existing = await db.user.findUnique({ where: { email: invite.email } });
  if (existing) return { error: "An account already uses this email. Ask an administrator to invite a different address." };

  const user = await db.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: {
        name: invite.name,
        email: invite.email,
        passwordHash: await hashPassword(password),
        role: invite.role,
        permissions: invite.role === "STAFF" ? invite.permissions : [],
      },
    });
    await tx.staffInvite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });
    return u;
  });
  await audit({ id: user.id, email: user.email }, "staff.invite_accepted", { type: "User", id: user.id }, { role: user.role });
  await createSession(user);
  redirect("/admin/mfa/setup");
}

export async function logoutAction() {
  const auth = await getAuth();
  if (auth && isPrivileged(auth.user.role)) await audit({ id: auth.user.id, email: auth.user.email }, "auth.logout");
  await destroySession();
  redirect("/");
}

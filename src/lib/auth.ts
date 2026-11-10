import "server-only";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "./db";
import { can, isPrivileged, type Permission } from "./permissions";
import {
  CUSTOMER_SESSION_SECONDS,
  MFA_PENDING_COOKIE,
  MFA_PENDING_SECONDS,
  SESSION_COOKIE,
  STAFF_SESSION_SECONDS,
  cookieOptions,
  signToken,
  verifySession,
  type SessionPayload,
} from "./session";

export const RECENT_MFA_SECONDS = 15 * 60;

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 12);
}
export async function checkPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

let dummyHash: Promise<string> | null = null;
/** Spends the same time as a real check, so unknown emails can't be detected by response time. */
export async function dummyPasswordCheck(pw: string) {
  dummyHash ??= bcrypt.hash("not-a-real-password", 12);
  await bcrypt.compare(pw, await dummyHash);
}

type SessionUser = { id: string; role: string; sessionVersion: number };

export async function createSession(user: SessionUser, opts: { mfa?: boolean } = {}) {
  const role = user.role === "ADMIN" ? "ADMIN" : user.role === "STAFF" ? "STAFF" : "CUSTOMER";
  const seconds = role === "CUSTOMER" ? CUSTOMER_SESSION_SECONDS : STAFF_SESSION_SECONDS;
  const token = await signToken(
    { typ: "session", sub: user.id, role, sv: user.sessionVersion, mfa: opts.mfa ? Math.floor(Date.now() / 1000) : undefined },
    seconds,
  );
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, cookieOptions(seconds));
  jar.delete(MFA_PENDING_COOKIE);
}

export async function createMfaPending(userId: string, next?: string) {
  const token = await signToken({ typ: "mfa_pending", sub: userId, next }, MFA_PENDING_SECONDS);
  (await cookies()).set(MFA_PENDING_COOKIE, token, cookieOptions(MFA_PENDING_SECONDS));
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(MFA_PENDING_COOKIE);
}

/**
 * Loads the session and the user fresh from the database on every request.
 * A session is rejected when the account is disabled or its sessionVersion changed (revoked),
 * or when the role in the token no longer matches the account.
 */
export const getAuth = cache(async (): Promise<{ user: NonNullable<Awaited<ReturnType<typeof loadUser>>>; session: SessionPayload } | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);
  if (!session) return null;
  const user = await loadUser(session.sub);
  if (!user || !user.isActive) return null;
  if (user.sessionVersion !== session.sv) return null;
  if (user.role !== session.role) return null;
  return { user, session };
});

function loadUser(id: string) {
  return db.user.findUnique({ where: { id } });
}

export async function getCurrentUser() {
  return (await getAuth())?.user ?? null;
}

export async function requireUser(next = "/account") {
  const auth = await getAuth();
  if (!auth) redirect(`/login?next=${encodeURIComponent(next)}`);
  return auth.user;
}

/** Why a staff session is not usable yet, or null when it is fine. */
export function staffGate(auth: Awaited<ReturnType<typeof getAuth>>): "login" | "not-staff" | "mfa-setup" | "mfa-verify" | null {
  if (!auth) return "login";
  if (!isPrivileged(auth.user.role)) return "not-staff";
  if (!auth.user.mfaEnabled) return "mfa-setup";
  if (!auth.session.mfa) return "mfa-verify";
  return null;
}

/** Any signed-in ADMIN or STAFF who has completed MFA. For pages and server actions. */
export async function requireStaff(opts: { allowMfaSetup?: boolean } = {}) {
  const auth = await getAuth();
  const gate = staffGate(auth);
  if (gate === "login") redirect("/login?next=/admin");
  if (gate === "not-staff") redirect("/");
  if (gate === "mfa-setup" && !opts.allowMfaSetup) redirect("/admin/mfa/setup");
  if (gate === "mfa-verify") {
    await destroySession();
    redirect("/login?next=/admin");
  }
  return auth!;
}

/** Staff with a specific permission. Use at the top of every admin page and server action. */
export async function requirePermission(perm: Permission) {
  const auth = await requireStaff();
  if (!can(auth.user, perm)) redirect(`/admin/forbidden?need=${perm}`);
  return auth.user;
}

/** Like requirePermission, but also needs an MFA check within the last 15 minutes (sensitive operations). */
export async function requireRecentMfa(perm: Permission, returnTo: string) {
  const user = await requirePermission(perm);
  const auth = (await getAuth())!;
  const age = Math.floor(Date.now() / 1000) - (auth.session.mfa ?? 0);
  if (age > RECENT_MFA_SECONDS) redirect(`/admin/reauth?next=${encodeURIComponent(returnTo)}`);
  return user;
}

export async function hasRecentMfa() {
  const auth = await getAuth();
  if (!auth?.session.mfa) return false;
  return Math.floor(Date.now() / 1000) - auth.session.mfa <= RECENT_MFA_SECONDS;
}

/** For API routes: the user, or null if not allowed (never redirects). */
export async function apiUser() {
  return getCurrentUser();
}
export async function apiPermission(perm: Permission) {
  const auth = await getAuth();
  if (staffGate(auth) !== null) return null;
  return can(auth!.user, perm) ? auth!.user : null;
}

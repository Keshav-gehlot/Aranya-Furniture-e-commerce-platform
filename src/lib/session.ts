// Edge-safe token helpers (used by middleware and server code). Authoritative checks live in auth.ts.
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "session";
export const MFA_PENDING_COOKIE = "mfa_pending";

export const CUSTOMER_SESSION_SECONDS = 60 * 60 * 24 * 7; // 7 days
export const STAFF_SESSION_SECONDS = 60 * 60 * 8; // 8 hours — staff sign in again each working day
export const MFA_PENDING_SECONDS = 60 * 5;

export type SessionPayload = {
  typ: "session";
  sub: string;
  role: "CUSTOMER" | "STAFF" | "ADMIN";
  /** user.sessionVersion at sign-in; a mismatch means the session was revoked */
  sv: number;
  /** unix seconds of the last successful MFA check (privileged users only) */
  mfa?: number;
};
export type MfaPendingPayload = { typ: "mfa_pending"; sub: string; next?: string };

function key() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error("JWT_SECRET is missing or shorter than 32 characters.");
  return new TextEncoder().encode(secret);
}

export async function signToken(payload: SessionPayload | MfaPendingPayload, seconds: number) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${seconds}s`)
    .sign(key());
}

export async function verifySession(token?: string | null): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    return payload.typ === "session" ? (payload as unknown as SessionPayload) : null;
  } catch {
    return null;
  }
}

export async function verifyMfaPending(token?: string | null): Promise<MfaPendingPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    return payload.typ === "mfa_pending" ? (payload as unknown as MfaPendingPayload) : null;
  } catch {
    return null;
  }
}

export function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

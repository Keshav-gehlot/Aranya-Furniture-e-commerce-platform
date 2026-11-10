import "server-only";
import crypto from "crypto";

function mfaKey() {
  const raw = process.env.MFA_ENCRYPTION_KEY;
  if (!raw) throw new Error("MFA_ENCRYPTION_KEY is not set (32 random bytes, base64).");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("MFA_ENCRYPTION_KEY must decode to exactly 32 bytes.");
  return key;
}

/** AES-256-GCM. Output: base64(iv).base64(tag).base64(ciphertext) */
export function encryptSecret(plain: string) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", mfaKey(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64")).join(".");
}

export function decryptSecret(payload: string) {
  const [iv, tag, enc] = payload.split(".").map((p) => Buffer.from(p, "base64"));
  const d = crypto.createDecipheriv("aes-256-gcm", mfaKey(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}

export function sha256(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function safeEqual(a: string, b: string) {
  const A = Buffer.from(a);
  const B = Buffer.from(b || "");
  return A.length === B.length && crypto.timingSafeEqual(A, B);
}

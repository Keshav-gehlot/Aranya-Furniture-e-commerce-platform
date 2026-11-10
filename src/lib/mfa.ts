import "server-only";
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";
import crypto from "crypto";
import { decryptSecret, encryptSecret, sha256 } from "./crypto";
import { site } from "@/config/site";

function totp(secretBase32: string, label: string) {
  return new OTPAuth.TOTP({
    issuer: site.shortName,
    label,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  });
}

export async function newMfaSecret(email: string) {
  const secret = new OTPAuth.Secret({ size: 20 }).base32;
  const uri = totp(secret, email).toString();
  const qrDataUrl = await QRCode.toDataURL(uri, { margin: 1, width: 220 });
  return { secret, secretEnc: encryptSecret(secret), qrDataUrl };
}

/** Accepts the current code and one step either side (±30s clock drift). */
export function verifyTotp(secretEnc: string, code: string, email = "user") {
  const clean = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean)) return false;
  const delta = totp(decryptSecret(secretEnc), email).validate({ token: clean, window: 1 });
  return delta !== null;
}

export function newRecoveryCodes(n = 8) {
  const codes = Array.from({ length: n }, () => {
    const raw = crypto.randomBytes(5).toString("hex").toUpperCase();
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });
  return { codes, hashes: codes.map((c) => sha256(c)) };
}

/** Returns the remaining hashes if the code matched, otherwise null. */
export function useRecoveryCode(hashes: string[], code: string) {
  const h = sha256(code.trim().toUpperCase());
  if (!hashes.includes(h)) return null;
  return hashes.filter((x) => x !== h);
}

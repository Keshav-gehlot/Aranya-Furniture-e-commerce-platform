import { describe, expect, it } from "vitest";
import * as OTPAuth from "otpauth";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { newMfaSecret, newRecoveryCodes, useRecoveryCode, verifyTotp } from "@/lib/mfa";
import { sniffImage } from "@/lib/storage";
import { verifyRazorpayCheckoutSignature } from "@/lib/payments";
import crypto from "crypto";

describe("MFA", () => {
  it("stores the TOTP secret encrypted and verifies real codes only", async () => {
    const { secret, secretEnc } = await newMfaSecret("a@b.c");
    expect(secretEnc).not.toContain(secret);
    expect(decryptSecret(secretEnc)).toBe(secret);
    const code = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret) }).generate();
    expect(verifyTotp(secretEnc, code)).toBe(true);
    expect(verifyTotp(secretEnc, code === "000000" ? "111111" : "000000")).toBe(false);
    expect(verifyTotp(secretEnc, "abc")).toBe(false);
  });
  it("rejects tampered ciphertext", () => {
    const enc = encryptSecret("hello");
    const parts = enc.split(".");
    parts[2] = Buffer.from("xxxxx").toString("base64");
    expect(() => decryptSecret(parts.join("."))).toThrow();
  });
  it("recovery codes work exactly once", () => {
    const { codes, hashes } = newRecoveryCodes();
    expect(hashes.join()).not.toContain(codes[0]);
    const left = useRecoveryCode(hashes, codes[0].toLowerCase());
    expect(left).toHaveLength(7);
    expect(useRecoveryCode(left!, codes[0])).toBeNull();
  });
});

describe("upload validation", () => {
  it("identifies images by content, not by name or claimed type", () => {
    expect(sniffImage(Buffer.from("89504e470d0a1a0a0000000d49484452", "hex"))?.mime).toBe("image/png");
    expect(sniffImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]))?.mime).toBe("image/jpeg");
    expect(sniffImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))).toBeNull();
    expect(sniffImage(Buffer.from("<html><body>hi</body></html>"))).toBeNull();
  });
});

describe("Razorpay checkout signature", () => {
  it("accepts only the HMAC made with the key secret", () => {
    process.env.RAZORPAY_KEY_SECRET = "rzp_secret";
    const sig = crypto.createHmac("sha256", "rzp_secret").update("order_1|pay_1").digest("hex");
    expect(verifyRazorpayCheckoutSignature("order_1", "pay_1", sig)).toBe(true);
    expect(verifyRazorpayCheckoutSignature("order_1", "pay_2", sig)).toBe(false);
    expect(verifyRazorpayCheckoutSignature("order_1", "pay_1", "deadbeef")).toBe(false);
    delete process.env.RAZORPAY_KEY_SECRET;
  });
});

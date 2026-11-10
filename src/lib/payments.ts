import "server-only";
import crypto from "crypto";
import Stripe from "stripe";
import { safeEqual } from "./crypto";
import { env, isStaging } from "./env";

export const razorpayEnabled = () => !!(env("RAZORPAY_KEY_ID") && env("RAZORPAY_KEY_SECRET"));
export const stripeEnabled = () => !!env("STRIPE_SECRET_KEY");
/**
 * Simulated ("demo") payments mark an order paid without charging anyone.
 * - Local development: on unless ALLOW_DEMO_PAYMENTS=false.
 * - Production builds: off, with one deliberate exception — a staging deployment that sets BOTH
 *   DEPLOYMENT_STAGE=staging and ALLOW_DEMO_PAYMENTS=true. Staging shows a banner on every page.
 *   A real production environment never sets DEPLOYMENT_STAGE=staging, so demo stays impossible there.
 * Demo is only ever a fallback: once a gateway's keys are set, that gateway is used instead.
 */
export const demoAllowed = () =>
  process.env.NODE_ENV !== "production"
    ? process.env.ALLOW_DEMO_PAYMENTS !== "false"
    : isStaging() && process.env.ALLOW_DEMO_PAYMENTS === "true";

export function providerFor(currency: "INR" | "USD"): "RAZORPAY" | "STRIPE" | "DEMO" | null {
  if (currency === "INR") return razorpayEnabled() ? "RAZORPAY" : demoAllowed() ? "DEMO" : null;
  return stripeEnabled() ? "STRIPE" : demoAllowed() ? "DEMO" : null;
}

// ---------------------------------------------------------------- Razorpay (REST)

/** API base overrides exist only so automated tests can point at a local mock server. */
const testOverride = (name: string) => (process.env.PAYMENT_API_OVERRIDE_FOR_TESTS === "true" ? process.env[name] : undefined);
const rzpBase = () => testOverride("RAZORPAY_API_BASE") || "https://api.razorpay.com";

async function rzp<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const auth = Buffer.from(`${env("RAZORPAY_KEY_ID")}:${env("RAZORPAY_KEY_SECRET")}`).toString("base64");
  const res = await fetch(`${rzpBase()}${path}`, {
    method,
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Razorpay ${method} ${path} failed: ${res.status}`);
  return (await res.json()) as T;
}

export type RzpPayment = { id: string; order_id: string; amount: number; currency: string; status: string; amount_refunded?: number };

export const createRazorpayOrder = (amount: number, receipt: string, notes: Record<string, string>) =>
  rzp<{ id: string; amount: number; currency: string }>("POST", "/v1/orders", { amount, currency: "INR", receipt, notes });
export const fetchRazorpayPayment = (paymentId: string) => rzp<RzpPayment>("GET", `/v1/payments/${encodeURIComponent(paymentId)}`);
export const captureRazorpayPayment = (paymentId: string, amount: number) =>
  rzp<RzpPayment>("POST", `/v1/payments/${encodeURIComponent(paymentId)}/capture`, { amount, currency: "INR" });
export const refundRazorpayPayment = (paymentId: string, amount: number, receipt: string) =>
  rzp<{ id: string; amount: number }>("POST", `/v1/payments/${encodeURIComponent(paymentId)}/refund`, { amount, receipt });

/** Checkout callback signature: HMAC-SHA256(order_id|payment_id, key secret). */
export function verifyRazorpayCheckoutSignature(orderId: string, paymentId: string, signature: string) {
  const secret = env("RAZORPAY_KEY_SECRET");
  if (!secret || !orderId || !paymentId || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  return safeEqual(expected, signature);
}

/** Webhook signature: HMAC-SHA256(raw body, webhook secret). Must use the raw body, never re-serialised JSON. */
export function verifyRazorpayWebhook(rawBody: string, signature: string) {
  const secret = env("RAZORPAY_WEBHOOK_SECRET");
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqual(expected, signature);
}

// ---------------------------------------------------------------- Stripe

let _stripe: Stripe | null = null;
export function stripe() {
  if (!_stripe) {
    const override = testOverride("STRIPE_API_BASE");
    const base = override ? new URL(override) : null;
    _stripe = new Stripe(env("STRIPE_SECRET_KEY") || "", {
      maxNetworkRetries: 2,
      ...(base ? { host: base.hostname, port: Number(base.port) || undefined, protocol: base.protocol.replace(":", "") as "http" | "https" } : {}),
    });
  }
  return _stripe;
}

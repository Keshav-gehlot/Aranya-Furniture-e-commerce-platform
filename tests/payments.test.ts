import { afterEach, describe, expect, it, vi } from "vitest";
import crypto, { randomUUID } from "crypto";
import Stripe from "stripe";
import { db } from "@/lib/db";
import { createCheckout } from "@/lib/checkout";
import { adminTransition, confirmPayment, expireOrder, releaseExpiredReservations, syncRefund } from "@/lib/orders";
import { quoteCart } from "@/lib/pricing";
import { POST as razorpayWebhook } from "@/app/api/payments/razorpay/webhook/route";
import { POST as stripeWebhook } from "@/app/api/payments/stripe/webhook/route";
import { makeProduct, makeUser, shipping, stockOf } from "./helpers";

const SITE = "http://localhost:3000";

async function demoCheckout(productId: string, qty: number, type: "RETAIL" | "BUSINESS" = "RETAIL", key = randomUUID()) {
  const user = await makeUser();
  const r = await createCheckout(user, { checkoutKey: key, currency: "INR", items: [{ productId, type, qty }], ...shipping, companyName: type === "BUSINESS" ? "Acme Interiors" : undefined }, SITE);
  return { user, r };
}

function rzpWebhook(body: object, eventId = `evt_${randomUUID()}`, secret = "rzp_whsec_test") {
  const raw = JSON.stringify(body);
  const sig = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  return razorpayWebhook(new Request("http://x/api/payments/razorpay/webhook", { method: "POST", body: raw, headers: { "x-razorpay-signature": sig, "x-razorpay-event-id": eventId } }));
}

function stripeEvent(type: string, object: object, id = `evt_${randomUUID()}`) {
  const raw = JSON.stringify({ id, object: "event", type, data: { object } });
  const header = new Stripe("sk_test_x").webhooks.generateTestHeaderString({ payload: raw, secret: "whsec_test_secret" });
  return stripeWebhook(new Request("http://x/api/payments/stripe/webhook", { method: "POST", body: raw, headers: { "stripe-signature": header } }));
}

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.RAZORPAY_KEY_ID;
  delete process.env.RAZORPAY_KEY_SECRET;
});

describe("server-side pricing", () => {
  it("prices from the database and enforces the business minimum", async () => {
    const p = await makeProduct();
    const q = await quoteCart([{ productId: p.id, type: "BUSINESS", qty: 5 }], "INR");
    expect(q.errors[0]).toMatch(/at least 10/);
    const ok = await quoteCart([{ productId: p.id, type: "BUSINESS", qty: 10 }], "INR");
    expect(ok.errors).toEqual([]);
    expect(ok.subtotal).toBe(10 * 800_00);
    expect(ok.tax).toBe(Math.round(10 * 800_00 * 0.18));
  });
  it("ignores hidden products and absurd quantities", async () => {
    const p = await makeProduct({ status: "DRAFT" });
    const q = await quoteCart([{ productId: p.id, type: "RETAIL", qty: 1 }], "INR");
    expect(q.lines).toHaveLength(0);
    const p2 = await makeProduct();
    const q2 = await quoteCart([{ productId: p2.id, type: "RETAIL", qty: 1e9 }], "INR");
    expect(q2.lines[0].qty).toBe(10_000);
  });
});

describe("checkout", () => {
  it("holds stock and returns the same order for a repeated submit", async () => {
    const p = await makeProduct({ stock: 20 });
    const key = randomUUID();
    const { user, r } = await demoCheckout(p.id, 12, "BUSINESS", key);
    expect(r.ok).toBe(true);
    expect(await stockOf(p.id)).toBe(8);
    const again = await createCheckout(user, { checkoutKey: key, currency: "INR", items: [{ productId: p.id, type: "BUSINESS", qty: 12 }], ...shipping, companyName: "Acme" }, SITE);
    expect(again.ok && again.orderId).toBe(r.ok && r.orderId);
    expect(await stockOf(p.id)).toBe(8);
  });

  it("never oversells when two buyers race for the last units", async () => {
    const p = await makeProduct({ stock: 5 });
    const results = await Promise.all([demoCheckout(p.id, 4), demoCheckout(p.id, 4), demoCheckout(p.id, 4)]);
    const succeeded = results.filter((x) => x.r.ok).length;
    expect(succeeded).toBe(1);
    expect(await stockOf(p.id)).toBe(1);
  });

  it("refuses a key that belongs to another user", async () => {
    const p = await makeProduct();
    const key = randomUUID();
    await demoCheckout(p.id, 1, "RETAIL", key);
    const other = await makeUser();
    const r = await createCheckout(other, { checkoutKey: key, currency: "INR", items: [{ productId: p.id, type: "RETAIL", qty: 1 }], ...shipping }, SITE);
    expect(r.ok).toBe(false);
  });

  it("releases stock when a checkout expires", async () => {
    const p = await makeProduct({ stock: 10 });
    const { r } = await demoCheckout(p.id, 3);
    if (!r.ok) throw new Error("checkout failed");
    await db.order.update({ where: { id: r.orderId }, data: { reservedUntil: new Date(Date.now() - 1000) } });
    expect(await releaseExpiredReservations()).toBeGreaterThanOrEqual(1);
    expect(await stockOf(p.id)).toBe(10);
    expect((await db.order.findUniqueOrThrow({ where: { id: r.orderId } })).status).toBe("EXPIRED");
  });
});

describe("payment confirmation", () => {
  it("rejects a confirmation whose amount doesn't match what the server charged", async () => {
    const p = await makeProduct();
    const { r } = await demoCheckout(p.id, 1);
    if (!r.ok) throw new Error();
    const res = await confirmPayment({ provider: "DEMO", providerOrderId: `demo_${r.orderId}`, amount: 1, currency: "INR", source: "test" });
    expect(res).toEqual({ ok: false, reason: "amount_mismatch" });
    const o = await db.order.findUniqueOrThrow({ where: { id: r.orderId } });
    expect(o.status).toBe("PENDING_PAYMENT");
    expect(o.needsAttention).toBe(true);
  });

  it("is idempotent: confirming twice pays once and doesn't touch stock again", async () => {
    const p = await makeProduct({ stock: 10 });
    const { r } = await demoCheckout(p.id, 2);
    if (!r.ok) throw new Error();
    const o = await db.order.findUniqueOrThrow({ where: { id: r.orderId } });
    const input = { provider: "DEMO" as const, providerOrderId: `demo_${o.id}`, amount: o.total, currency: "INR", source: "test" };
    const [a, b] = await Promise.all([confirmPayment(input), confirmPayment(input)]);
    expect([a, b].filter((x) => x.ok && !x.alreadyPaid)).toHaveLength(1);
    expect(await stockOf(p.id)).toBe(8);
    const events = await db.orderEvent.count({ where: { orderId: o.id, type: "payment_succeeded" } });
    expect(events).toBe(1);
  });

  it("a payment that arrives after expiry takes stock again, or flags the order if none is left", async () => {
    const p = await makeProduct({ stock: 3 });
    const { r } = await demoCheckout(p.id, 3);
    if (!r.ok) throw new Error();
    await expireOrder(r.orderId, "test");
    expect(await stockOf(p.id)).toBe(3);
    await demoCheckout(p.id, 3); // someone else buys it all
    const o = await db.order.findUniqueOrThrow({ where: { id: r.orderId } });
    const res = await confirmPayment({ provider: "DEMO", providerOrderId: `demo_${o.id}`, amount: o.total, currency: "INR", source: "late" });
    expect(res.ok && res.needsAttention).toBe(true);
    const after = await db.order.findUniqueOrThrow({ where: { id: o.id } });
    expect(after.status).toBe("PAID");
    expect(after.needsAttention).toBe(true);
    expect(await stockOf(p.id)).toBe(0);
  });
});

describe("Razorpay", () => {
  async function razorpayOrder(qty = 2) {
    process.env.RAZORPAY_KEY_ID = "rzp_test_key";
    process.env.RAZORPAY_KEY_SECRET = "rzp_secret";
    const rzOrderId = `order_${randomUUID().slice(0, 12)}`;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      const body = JSON.parse(String(init?.body ?? "{}"));
      return new Response(JSON.stringify({ id: rzOrderId, amount: body.amount, currency: "INR" }), { status: 200 });
    });
    const p = await makeProduct({ stock: 10 });
    const user = await makeUser();
    const r = await createCheckout(user, { checkoutKey: randomUUID(), currency: "INR", items: [{ productId: p.id, type: "RETAIL", qty }], ...shipping }, SITE);
    if (!r.ok || r.provider !== "RAZORPAY") throw new Error("expected razorpay checkout");
    const order = await db.order.findUniqueOrThrow({ where: { id: r.orderId } });
    return { p, order, rzOrderId };
  }
  const captured = (rzOrderId: string, amount: number, payId = `pay_${randomUUID().slice(0, 10)}`) => ({
    event: "payment.captured",
    payload: { payment: { entity: { id: payId, order_id: rzOrderId, amount, currency: "INR", status: "captured" } } },
  });

  it("creates the Razorpay order for the server-calculated total", async () => {
    const { order, rzOrderId } = await razorpayOrder();
    const sent = JSON.parse(String((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body));
    expect(sent.amount).toBe(order.total);
    expect((await db.payment.findUniqueOrThrow({ where: { providerOrderId: rzOrderId } })).amount).toBe(order.total);
  });

  it("rejects webhooks with a bad signature or no event id", async () => {
    const { order, rzOrderId } = await razorpayOrder();
    expect((await rzpWebhook(captured(rzOrderId, order.total), undefined, "wrong-secret")).status).toBe(400);
    const raw = JSON.stringify(captured(rzOrderId, order.total));
    const sig = crypto.createHmac("sha256", "rzp_whsec_test").update(raw).digest("hex");
    const res = await razorpayWebhook(new Request("http://x", { method: "POST", body: raw, headers: { "x-razorpay-signature": sig } }));
    expect(res.status).toBe(400);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PENDING_PAYMENT");
  });

  it("a signed payment.captured marks the order paid; replays change nothing", async () => {
    const { p, order, rzOrderId } = await razorpayOrder(2);
    const evt = captured(rzOrderId, order.total, "pay_abc123");
    expect((await rzpWebhook(evt, "evt_fixed_1")).status).toBe(200);
    const dup = await rzpWebhook(evt, "evt_fixed_1");
    expect(await dup.json()).toMatchObject({ duplicate: true });
    await rzpWebhook({ ...evt, event: "order.paid" }, "evt_other_2"); // different event, same payment
    const o = await db.order.findUniqueOrThrow({ where: { id: order.id }, include: { payments: true } });
    expect(o.status).toBe("PAID");
    expect(o.payments[0].providerPaymentId).toBe("pay_abc123");
    expect(await stockOf(p.id)).toBe(8);
    expect(await db.orderEvent.count({ where: { orderId: o.id, type: "payment_succeeded" } })).toBe(1);
  });

  it("ignores a captured amount that differs from the order", async () => {
    const { order, rzOrderId } = await razorpayOrder();
    await rzpWebhook(captured(rzOrderId, order.total - 100));
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PENDING_PAYMENT");
  });

  it("refund webhooks apply the provider's total, so repeats don't double count", async () => {
    const { order, rzOrderId } = await razorpayOrder();
    await rzpWebhook(captured(rzOrderId, order.total, "pay_ref1"));
    const refund = { event: "refund.processed", payload: { payment: { entity: { id: "pay_ref1", order_id: rzOrderId, amount: order.total, currency: "INR", status: "captured", amount_refunded: 500 } } } };
    await rzpWebhook(refund);
    await rzpWebhook(refund);
    let o = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(o.refundedAmount).toBe(500);
    expect(o.status).toBe("PAID");
    await rzpWebhook({ ...refund, payload: { payment: { entity: { ...refund.payload.payment.entity, amount_refunded: order.total } } } });
    o = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(o.status).toBe("REFUNDED");
  });
});

describe("Stripe", () => {
  async function stripeOrder() {
    const p = await makeProduct({ stock: 10 });
    const user = await makeUser();
    // Create via the demo path, then relabel as a Stripe checkout (no network in tests).
    const key = process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_SECRET_KEY;
    const r = await createCheckout(user, { checkoutKey: randomUUID(), currency: "USD", items: [{ productId: p.id, type: "RETAIL", qty: 1 }], ...shipping, shipCountry: "United Kingdom" }, SITE);
    process.env.STRIPE_SECRET_KEY = key;
    if (!r.ok) throw new Error("checkout failed");
    const sessionId = `cs_test_${randomUUID().slice(0, 10)}`;
    await db.order.update({ where: { id: r.orderId }, data: { provider: "STRIPE" } });
    await db.payment.updateMany({ where: { orderId: r.orderId }, data: { provider: "STRIPE", providerOrderId: sessionId } });
    return { p, order: await db.order.findUniqueOrThrow({ where: { id: r.orderId } }), sessionId };
  }
  const session = (id: string, amount: number, status = "paid") => ({ id, object: "checkout.session", payment_status: status, amount_total: amount, currency: "usd", payment_intent: `pi_${id}` });

  it("rejects an unsigned or wrongly signed event", async () => {
    const res = await stripeWebhook(new Request("http://x", { method: "POST", body: "{}", headers: { "stripe-signature": "t=1,v1=bad" } }));
    expect(res.status).toBe(400);
  });

  it("checkout.session.completed with the right amount pays the order once", async () => {
    const { order, sessionId } = await stripeOrder();
    await stripeEvent("checkout.session.completed", session(sessionId, order.total), "evt_s1");
    const dup = await stripeEvent("checkout.session.completed", session(sessionId, order.total), "evt_s1");
    expect(await dup.json()).toMatchObject({ duplicate: true });
    const o = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(o.status).toBe("PAID");
  });

  it("does not pay on an unpaid (async) completion or a wrong amount", async () => {
    const { order, sessionId } = await stripeOrder();
    await stripeEvent("checkout.session.completed", session(sessionId, order.total, "unpaid"));
    await stripeEvent("checkout.session.completed", session(sessionId, order.total + 1));
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PENDING_PAYMENT");
  });

  it("async failure and expiry release the stock", async () => {
    const a = await stripeOrder();
    await stripeEvent("checkout.session.async_payment_failed", session(a.sessionId, a.order.total, "unpaid"));
    expect((await db.order.findUniqueOrThrow({ where: { id: a.order.id } })).status).toBe("PAYMENT_FAILED");
    expect(await stockOf(a.p.id)).toBe(10);
    const b = await stripeOrder();
    await stripeEvent("checkout.session.expired", session(b.sessionId, b.order.total, "unpaid"));
    expect((await db.order.findUniqueOrThrow({ where: { id: b.order.id } })).status).toBe("EXPIRED");
    expect(await stockOf(b.p.id)).toBe(10);
  });

  it("charge.refunded marks a full refund", async () => {
    const { order, sessionId } = await stripeOrder();
    await stripeEvent("checkout.session.completed", session(sessionId, order.total));
    await stripeEvent("charge.refunded", { id: "ch_1", object: "charge", payment_intent: `pi_${sessionId}`, amount_refunded: order.total });
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("REFUNDED");
  });
});

describe("order status rules", () => {
  it("staff can't mark an order paid or skip steps; cancelling returns stock", async () => {
    const p = await makeProduct({ stock: 10 });
    const { r } = await demoCheckout(p.id, 4);
    if (!r.ok) throw new Error();
    const staff = await makeUser({ role: "STAFF", permissions: ["orders"] });
    expect(await adminTransition(r.orderId, "PAID", staff.id)).toHaveProperty("error");
    const o = await db.order.findUniqueOrThrow({ where: { id: r.orderId } });
    await confirmPayment({ provider: "DEMO", providerOrderId: `demo_${o.id}`, amount: o.total, currency: "INR", source: "test" });
    expect(await adminTransition(o.id, "DELIVERED", staff.id)).toHaveProperty("error");
    expect(await adminTransition(o.id, "PROCESSING", staff.id)).toHaveProperty("ok", true);
    expect(await adminTransition(o.id, "SHIPPED", staff.id)).toHaveProperty("error"); // needs tracking
    expect(await adminTransition(o.id, "SHIPPED", staff.id, "AWB123")).toHaveProperty("ok", true);
    expect(await adminTransition(o.id, "CANCELLED", staff.id)).toHaveProperty("error"); // shipped orders can't be cancelled

    const second = await demoCheckout(p.id, 2);
    if (!second.r.ok) throw new Error();
    const o2 = await db.order.findUniqueOrThrow({ where: { id: second.r.orderId } });
    await confirmPayment({ provider: "DEMO", providerOrderId: `demo_${o2.id}`, amount: o2.total, currency: "INR", source: "test" });
    const before = await stockOf(p.id);
    expect(await adminTransition(o2.id, "CANCELLED", staff.id)).toHaveProperty("ok", true);
    expect(await stockOf(p.id)).toBe(before + 2);
  });

  it("refund totals never exceed the payment", async () => {
    const p = await makeProduct();
    const { r } = await demoCheckout(p.id, 1);
    if (!r.ok) throw new Error();
    const o = await db.order.findUniqueOrThrow({ where: { id: r.orderId } });
    await confirmPayment({ provider: "DEMO", providerOrderId: `demo_${o.id}`, providerPaymentId: `dp_${o.id}`, amount: o.total, currency: "INR", source: "test" });
    await syncRefund("DEMO", { providerPaymentId: `dp_${o.id}` }, o.total * 5);
    const after = await db.order.findUniqueOrThrow({ where: { id: o.id } });
    expect(after.refundedAmount).toBe(o.total);
    expect(after.status).toBe("REFUNDED");
  });
});

describe("database constraints", () => {
  it("stock can never go negative, even with a direct update", async () => {
    const p = await makeProduct({ stock: 1 });
    await expect(db.product.update({ where: { id: p.id }, data: { stock: { decrement: 2 } } })).rejects.toThrow();
  });
});

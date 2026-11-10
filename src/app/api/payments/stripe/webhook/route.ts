import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { stripe } from "@/lib/payments";
import { env } from "@/lib/env";
import { confirmPayment, expireOrder, recordPaymentFailure, syncRefund } from "@/lib/orders";

/**
 * Stripe Dashboard → Developers → Webhooks: https://YOUR_DOMAIN/api/payments/stripe/webhook
 * Events: checkout.session.completed, checkout.session.async_payment_succeeded,
 *         checkout.session.async_payment_failed, checkout.session.expired, charge.refunded
 */
export async function POST(req: Request) {
  const secret = env("STRIPE_WEBHOOK_SECRET");
  if (!secret) return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(raw, req.headers.get("stripe-signature") || "", secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  if (await db.webhookEvent.findUnique({ where: { provider_eventId: { provider: "STRIPE", eventId: event.id } } })) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const s = event.data.object;
      if (s.payment_status === "paid") {
        await confirmPayment({ provider: "STRIPE", providerOrderId: s.id, providerPaymentId: typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id, amount: s.amount_total ?? -1, currency: s.currency ?? "", source: `webhook:${event.type}` });
      }
      break;
    }
    case "checkout.session.async_payment_failed":
      await recordPaymentFailure("STRIPE", event.data.object.id, "Bank payment failed", true);
      break;
    case "checkout.session.expired": {
      const p = await db.payment.findUnique({ where: { providerOrderId: event.data.object.id } });
      if (p) await expireOrder(p.orderId, "Stripe checkout expired");
      break;
    }
    case "charge.refunded": {
      const c = event.data.object;
      const pi = typeof c.payment_intent === "string" ? c.payment_intent : c.payment_intent?.id;
      if (pi) await syncRefund("STRIPE", { providerPaymentId: pi }, c.amount_refunded);
      break;
    }
  }

  await db.webhookEvent.create({ data: { provider: "STRIPE", eventId: event.id, type: event.type } }).catch(() => {});
  return NextResponse.json({ received: true });
}

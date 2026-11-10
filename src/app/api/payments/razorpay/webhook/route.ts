import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { captureRazorpayPayment, verifyRazorpayWebhook } from "@/lib/payments";
import { confirmPayment, recordPaymentFailure, syncRefund } from "@/lib/orders";

/**
 * Razorpay Dashboard → Webhooks: https://YOUR_DOMAIN/api/payments/razorpay/webhook
 * Events: payment.authorized, payment.captured, payment.failed, order.paid, refund.processed
 */
export async function POST(req: Request) {
  const raw = await req.text(); // raw body — required for the signature
  if (!verifyRazorpayWebhook(raw, req.headers.get("x-razorpay-signature") || "")) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  const eventId = req.headers.get("x-razorpay-event-id");
  if (!eventId) return NextResponse.json({ error: "Missing event id" }, { status: 400 });
  if (await db.webhookEvent.findUnique({ where: { provider_eventId: { provider: "RAZORPAY", eventId } } })) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  let evt: { event?: string; payload?: Record<string, { entity?: Record<string, unknown> }> };
  try {
    evt = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }
  const payment = evt.payload?.payment?.entity as { id: string; order_id: string; amount: number; currency: string; status: string; amount_refunded?: number; error_description?: string } | undefined;
  const order = evt.payload?.order?.entity as { id: string } | undefined;

  switch (evt.event) {
    case "payment.captured":
    case "order.paid":
      if (payment?.order_id && payment.status === "captured") {
        await confirmPayment({ provider: "RAZORPAY", providerOrderId: payment.order_id, providerPaymentId: payment.id, amount: payment.amount, currency: payment.currency, source: `webhook:${evt.event}` });
      }
      break;
    case "payment.authorized":
      // Only needed when auto-capture is off in the Razorpay dashboard. Capture triggers payment.captured.
      if (payment?.order_id) {
        const known = await db.payment.findUnique({ where: { providerOrderId: payment.order_id } });
        if (known && known.amount === payment.amount) await captureRazorpayPayment(payment.id, payment.amount).catch(() => {});
      }
      break;
    case "payment.failed":
      if (payment?.order_id) await recordPaymentFailure("RAZORPAY", payment.order_id, payment.error_description || "Payment failed", false);
      break;
    case "refund.processed":
    case "refund.created":
      if (payment?.id && typeof payment.amount_refunded === "number") await syncRefund("RAZORPAY", { providerPaymentId: payment.id, providerOrderId: payment.order_id ?? order?.id }, payment.amount_refunded);
      break;
  }

  await db.webhookEvent.create({ data: { provider: "RAZORPAY", eventId, type: evt.event || "unknown" } }).catch(() => {});
  return NextResponse.json({ received: true });
}

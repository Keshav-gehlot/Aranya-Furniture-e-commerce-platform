import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiUser } from "@/lib/auth";
import { isSameOrigin } from "@/lib/same-origin";
import { captureRazorpayPayment, fetchRazorpayPayment, verifyRazorpayCheckoutSignature } from "@/lib/payments";
import { confirmPayment } from "@/lib/orders";

/**
 * Called by our checkout page after Razorpay's popup reports success. The popup's word is not
 * trusted: we verify the signature AND fetch the payment from Razorpay before confirming.
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const rzOrderId = String(b.razorpay_order_id || "");
  const rzPaymentId = String(b.razorpay_payment_id || "");
  const signature = String(b.razorpay_signature || "");

  const payment = await db.payment.findUnique({ where: { providerOrderId: rzOrderId }, include: { order: true } });
  if (!payment || payment.provider !== "RAZORPAY" || payment.order.userId !== user.id) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (!verifyRazorpayCheckoutSignature(rzOrderId, rzPaymentId, signature)) {
    return NextResponse.json({ error: "Payment verification failed" }, { status: 400 });
  }

  let rp = await fetchRazorpayPayment(rzPaymentId);
  if (rp.order_id !== rzOrderId) return NextResponse.json({ error: "Payment verification failed" }, { status: 400 });
  if (rp.status === "authorized") rp = await captureRazorpayPayment(rp.id, payment.amount);
  if (rp.status !== "captured") return NextResponse.json({ error: "Payment is not complete yet" }, { status: 409 });

  const r = await confirmPayment({ provider: "RAZORPAY", providerOrderId: rzOrderId, providerPaymentId: rp.id, amount: rp.amount, currency: rp.currency, source: "checkout-callback" });
  if (!r.ok) return NextResponse.json({ error: "Payment verification failed" }, { status: 400 });
  return NextResponse.json({ ok: true, orderId: r.orderId });
}

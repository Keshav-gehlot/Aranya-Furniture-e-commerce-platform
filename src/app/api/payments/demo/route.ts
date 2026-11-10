import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiUser } from "@/lib/auth";
import { demoAllowed } from "@/lib/payments";
import { isSameOrigin } from "@/lib/same-origin";
import { confirmPayment } from "@/lib/orders";

/** Simulated payment. Works in local development and on a staging deployment only (see demoAllowed). */
export async function POST(req: Request) {
  if (!demoAllowed()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const { orderId } = await req.json().catch(() => ({}));
  const order = await db.order.findUnique({ where: { id: String(orderId || "") } });
  if (!order || order.userId !== user.id || order.provider !== "DEMO") return NextResponse.json({ error: "Order not found" }, { status: 404 });
  const r = await confirmPayment({ provider: "DEMO", providerOrderId: `demo_${order.id}`, providerPaymentId: `demo_pay_${order.id}`, amount: order.total, currency: order.currency, source: "demo" });
  return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.reason }, { status: 400 });
}

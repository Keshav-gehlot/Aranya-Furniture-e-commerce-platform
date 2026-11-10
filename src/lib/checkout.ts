import "server-only";
import { z } from "zod";
import { db } from "./db";
import { quoteCart } from "./pricing";
import { getSettings } from "./settings";
import { orderNumber } from "./utils";
import { createRazorpayOrder, providerFor, stripe } from "./payments";
import { OutOfStockError, expireOrder, releaseExpiredReservations, reserveStock } from "./orders";
import { site } from "@/config/site";
import { env } from "./env";

export const checkoutSchema = z.object({
  checkoutKey: z.string().uuid("Refresh the page and try again."),
  currency: z.enum(["INR", "USD"]),
  items: z.array(z.object({ productId: z.string().max(40), type: z.enum(["RETAIL", "BUSINESS"]), qty: z.number().int().positive().max(10_000) })).min(1).max(100),
  shipName: z.string().trim().min(2, "Enter the recipient's name.").max(120),
  shipPhone: z.string().trim().min(6, "Enter a phone number.").max(30),
  shipAddress: z.string().trim().min(5, "Enter the delivery address.").max(500),
  shipCity: z.string().trim().min(2, "Enter the city.").max(100),
  shipState: z.string().trim().max(100).optional(),
  shipPostal: z.string().trim().min(3, "Enter the postal / PIN code.").max(20),
  shipCountry: z.string().trim().min(2).max(60),
  companyName: z.string().trim().max(150).optional(),
  taxId: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(1000).optional(),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

type Buyer = { id: string; name: string; email: string };

export type CheckoutResult =
  | { ok: true; orderId: string; provider: "RAZORPAY"; razorpay: Record<string, unknown> }
  | { ok: true; orderId: string; provider: "STRIPE"; url: string }
  | { ok: true; orderId: string; provider: "DEMO" }
  | { ok: false; status: number; error: string };

function razorpayInit(order: { id: string; orderNumber: string; total: number }, providerOrderId: string, user: Buyer, phone: string) {
  return {
    key: env("RAZORPAY_KEY_ID"),
    orderId: providerOrderId,
    amount: order.total,
    currency: "INR",
    name: site.name,
    description: `Order ${order.orderNumber}`,
    prefill: { name: user.name, email: user.email, contact: phone },
  };
}

/**
 * Creates (or, for a repeated submit with the same checkoutKey, returns) a pending order:
 * re-prices the cart, holds the stock, and opens a payment with the provider.
 */
export async function createCheckout(user: Buyer, v: CheckoutInput, siteUrl: string): Promise<CheckoutResult> {
  // Same checkout submitted twice (double click, retry): hand back the same payment.
  const existing = await db.order.findUnique({ where: { checkoutKey: v.checkoutKey }, include: { payments: true } });
  if (existing) {
    if (existing.userId !== user.id) return { ok: false, status: 409, error: "Refresh the page and try again." };
    if (existing.status !== "PENDING_PAYMENT") {
      return existing.status === "PAID" ? { ok: false, status: 409, error: "This order is already paid." } : { ok: false, status: 409, error: "This checkout has ended. Refresh the page to start again." };
    }
    const pay = existing.payments.at(-1);
    if (pay?.provider === "RAZORPAY") return { ok: true, orderId: existing.id, provider: "RAZORPAY", razorpay: razorpayInit(existing, pay.providerOrderId, user, existing.shipPhone) };
    if (pay?.provider === "STRIPE") {
      const s = await stripe().checkout.sessions.retrieve(pay.providerOrderId);
      if (s.status === "open" && s.url) return { ok: true, orderId: existing.id, provider: "STRIPE", url: s.url };
      return { ok: false, status: 409, error: "This checkout has ended. Refresh the page to start again." };
    }
    if (pay?.provider === "DEMO") return { ok: true, orderId: existing.id, provider: "DEMO" };
    return { ok: false, status: 409, error: "Refresh the page and try again." };
  }

  if (v.currency === "INR" && v.shipCountry !== "India") return { ok: false, status: 400, error: "INR orders ship within India. Switch to USD for international delivery." };

  await releaseExpiredReservations();
  const quote = await quoteCart(v.items, v.currency);
  if (quote.errors.length || quote.lines.length === 0) return { ok: false, status: 400, error: quote.errors[0] ?? "Your cart is empty." };
  if (quote.hasBusiness && site.business.requireCompanyForBusiness && !v.companyName) return { ok: false, status: 400, error: "Company name is required for business orders." };

  const provider = providerFor(v.currency);
  if (!provider) return { ok: false, status: 503, error: `Online payment in ${v.currency} isn't available yet. Please contact us to order.` };

  const settings = await getSettings();
  // Stripe Checkout sessions must stay open at least 30 minutes.
  const holdMinutes = provider === "STRIPE" ? Math.max(31, settings.reservationMinutes) : settings.reservationMinutes;
  const reservedUntil = new Date(Date.now() + holdMinutes * 60_000);

  let order;
  try {
    order = await db.$transaction(async (tx) => {
      const o = await tx.order.create({
        data: {
          orderNumber: orderNumber(),
          checkoutKey: v.checkoutKey,
          userId: user.id,
          currency: v.currency,
          provider,
          subtotal: quote.subtotal,
          shipping: quote.shipping,
          tax: quote.tax,
          total: quote.total,
          isBusiness: quote.hasBusiness,
          companyName: v.companyName || null,
          taxId: v.taxId || null,
          shipName: v.shipName,
          shipPhone: v.shipPhone,
          shipAddress: v.shipAddress,
          shipCity: v.shipCity,
          shipState: v.shipState || null,
          shipPostal: v.shipPostal,
          shipCountry: v.shipCountry,
          notes: v.notes || null,
          stockState: "RESERVED",
          reservedUntil,
          items: {
            create: quote.lines.map((l) => ({
              productId: l.productId,
              name: l.name,
              sku: l.sku,
              purchaseType: l.type,
              unitPrice: l.unitPrice,
              quantity: l.qty,
              lineTotal: l.lineTotal,
            })),
          },
        },
        include: { items: true },
      });
      await reserveStock(tx, o.id, o.orderNumber, o.items);
      await tx.orderEvent.create({ data: { orderId: o.id, type: "created", toStatus: "PENDING_PAYMENT", message: `${provider} · ${v.currency}` } });
      return o;
    });
  } catch (e) {
    if (e instanceof OutOfStockError) return { ok: false, status: 409, error: e.message };
    // Unique checkoutKey race: another request created it first — return that one.
    if ((e as { code?: string }).code === "P2002") return createCheckout(user, v, siteUrl);
    throw e;
  }

  try {
    if (provider === "RAZORPAY") {
      const rp = await createRazorpayOrder(order.total, order.orderNumber, { orderId: order.id });
      if (rp.amount !== order.total) throw new Error("Razorpay amount mismatch");
      await db.payment.create({ data: { orderId: order.id, provider, providerOrderId: rp.id, amount: order.total, currency: "INR" } });
      return { ok: true, orderId: order.id, provider, razorpay: razorpayInit(order, rp.id, user, v.shipPhone) };
    }
    if (provider === "STRIPE") {
      const line_items = quote.lines.map((l) => ({
        quantity: l.qty,
        price_data: { currency: "usd", unit_amount: l.unitPrice, product_data: { name: `${l.name}${l.type === "BUSINESS" ? " (business)" : ""}` } },
      }));
      if (quote.shipping > 0) line_items.push({ quantity: 1, price_data: { currency: "usd", unit_amount: quote.shipping, product_data: { name: "Export handling" } } });
      const session = await stripe().checkout.sessions.create(
        {
          mode: "payment",
          line_items,
          customer_email: user.email,
          client_reference_id: order.id,
          metadata: { orderId: order.id, orderNumber: order.orderNumber },
          payment_intent_data: { metadata: { orderId: order.id, orderNumber: order.orderNumber } },
          expires_at: Math.floor(reservedUntil.getTime() / 1000),
          success_url: `${siteUrl}/orders/${order.id}?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${siteUrl}/checkout?cancelled=1`,
        },
        { idempotencyKey: `checkout-${order.id}` },
      );
      if (session.amount_total !== order.total) throw new Error("Stripe amount mismatch");
      await db.payment.create({ data: { orderId: order.id, provider, providerOrderId: session.id, amount: order.total, currency: "USD" } });
      return { ok: true, orderId: order.id, provider, url: session.url! };
    }
    await db.payment.create({ data: { orderId: order.id, provider: "DEMO", providerOrderId: `demo_${order.id}`, amount: order.total, currency: order.currency } });
    return { ok: true, orderId: order.id, provider: "DEMO" };
  } catch (e) {
    console.error(JSON.stringify({ level: "error", msg: "payment_init_failed", orderId: order.id, error: String(e) }));
    await expireOrder(order.id, "Could not start payment with the provider");
    return { ok: false, status: 502, error: "Could not start the payment. Please try again." };
  }
}

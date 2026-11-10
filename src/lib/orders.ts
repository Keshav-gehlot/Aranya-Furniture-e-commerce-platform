import "server-only";
import { db } from "./db";
import { notify } from "./notify";
import type { Prisma } from "@/generated/prisma/client";
import type { OrderStatus, PaymentProvider } from "@/generated/prisma/enums";

type Tx = Prisma.TransactionClient;

/**
 * The only status changes staff may make by hand. Payment-driven states
 * (PAID, PAYMENT_FAILED, EXPIRED, REFUNDED) are set exclusively from verified provider evidence.
 */
export const ADMIN_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  PAID: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
};

export const PAID_STATES: OrderStatus[] = ["PAID", "PROCESSING", "SHIPPED", "DELIVERED", "REFUNDED"];

export class OutOfStockError extends Error {
  constructor(public productName: string) {
    super(`${productName} just sold out or has too little stock left.`);
  }
}

/** Row lock so concurrent webhooks / callbacks for the same order are processed one at a time. */
async function lockOrder(tx: Tx, orderId: string) {
  await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
}

/** Takes stock for each line atomically; the conditional update fails instead of going below zero. */
export async function reserveStock(tx: Tx, orderId: string, orderNumber: string, items: { productId: string | null; name: string; quantity: number }[]) {
  for (const it of items) {
    if (!it.productId) continue;
    const res = await tx.product.updateMany({
      where: { id: it.productId, stock: { gte: it.quantity } },
      data: { stock: { decrement: it.quantity } },
    });
    if (res.count !== 1) throw new OutOfStockError(it.name);
    const p = await tx.product.findUniqueOrThrow({ where: { id: it.productId }, select: { stock: true } });
    await tx.inventoryLog.create({
      data: { productId: it.productId, change: -it.quantity, stockAfter: p.stock, reason: "RESERVE", orderId, note: `Order ${orderNumber}` },
    });
  }
}

async function returnStock(tx: Tx, order: { id: string; orderNumber: string; items: { productId: string | null; quantity: number }[] }, reason: "RELEASE" | "CANCEL", userId?: string) {
  for (const it of order.items) {
    if (!it.productId) continue;
    const p = await tx.product.update({ where: { id: it.productId }, data: { stock: { increment: it.quantity } }, select: { stock: true } });
    await tx.inventoryLog.create({
      data: { productId: it.productId, change: it.quantity, stockAfter: p.stock, reason, orderId: order.id, userId, note: `Order ${order.orderNumber}` },
    });
  }
}

export type ConfirmInput = {
  provider: PaymentProvider;
  providerOrderId: string;
  providerPaymentId?: string | null;
  amount: number;
  currency: string;
  source: string;
};

export type ConfirmResult =
  | { ok: true; orderId: string; alreadyPaid: boolean; needsAttention: boolean }
  | { ok: false; reason: "unknown_payment" | "amount_mismatch" };

/**
 * Marks an order paid from verified provider evidence. Idempotent: running it again for the
 * same payment changes nothing. Checks the amount and currency against what the server charged.
 */
export async function confirmPayment(input: ConfirmInput): Promise<ConfirmResult> {
  const result = await db.$transaction(async (tx): Promise<ConfirmResult> => {
    const payment = await tx.payment.findUnique({ where: { providerOrderId: input.providerOrderId } });
    if (!payment || payment.provider !== input.provider) return { ok: false, reason: "unknown_payment" };
    await lockOrder(tx, payment.orderId);
    const order = await tx.order.findUniqueOrThrow({ where: { id: payment.orderId }, include: { items: true } });

    if (input.amount !== payment.amount || input.currency.toUpperCase() !== payment.currency || payment.amount !== order.total) {
      await tx.order.update({
        where: { id: order.id },
        data: { needsAttention: true, attentionNote: `Payment amount mismatch from ${input.provider}: got ${input.amount} ${input.currency}, expected ${order.total} ${order.currency}.` },
      });
      await tx.orderEvent.create({ data: { orderId: order.id, type: "payment_amount_mismatch", message: `${input.source}: ${input.amount} ${input.currency}` } });
      return { ok: false, reason: "amount_mismatch" };
    }

    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: payment.status === "REFUNDED" || payment.status === "PARTIALLY_REFUNDED" ? payment.status : "SUCCEEDED",
        providerPaymentId: payment.providerPaymentId ?? input.providerPaymentId ?? undefined,
        failureReason: null,
      },
    });

    if (PAID_STATES.includes(order.status)) {
      return { ok: true, orderId: order.id, alreadyPaid: true, needsAttention: order.needsAttention };
    }

    let needsAttention = false;
    let attentionNote: string | undefined;
    if (order.stockState !== "RESERVED") {
      // Reservation had already been released (expired / failed). Try to take the stock again.
      try {
        await reserveStock(tx, order.id, order.orderNumber, order.items);
      } catch (e) {
        if (!(e instanceof OutOfStockError)) throw e;
        needsAttention = true;
        attentionNote = `Paid after the stock hold expired and ${e.productName} no longer has enough stock. Restock and fulfil, or refund the customer.`;
      }
    }

    await tx.order.update({
      where: { id: order.id },
      data: {
        status: "PAID",
        paidAt: new Date(),
        reservedUntil: null,
        stockState: needsAttention ? order.stockState : "COMMITTED",
        needsAttention: needsAttention || order.needsAttention,
        attentionNote: attentionNote ?? order.attentionNote,
      },
    });
    await tx.orderEvent.create({
      data: { orderId: order.id, type: "payment_succeeded", fromStatus: order.status, toStatus: "PAID", message: `${input.provider} via ${input.source}` },
    });
    return { ok: true, orderId: order.id, alreadyPaid: false, needsAttention };
  });

  if (result.ok && !result.alreadyPaid) {
    const o = await db.order.findUnique({ where: { id: result.orderId }, select: { orderNumber: true, total: true, currency: true } });
    if (o) {
      notify(
        `${result.needsAttention ? "ACTION NEEDED: " : ""}Paid order ${o.orderNumber}`,
        `Order ${o.orderNumber} was paid: ${o.currency} ${(o.total / 100).toFixed(2)}.${result.needsAttention ? " It needs attention — open it in the admin panel." : ""}`,
      ).catch(() => {});
    }
  }
  return result;
}

/**
 * Records a failed payment attempt. Razorpay lets a customer retry on the same order, so an
 * individual failure does not end the order unless `final` is true (e.g. Stripe async failure).
 */
export async function recordPaymentFailure(provider: PaymentProvider, providerOrderId: string, reason: string, final: boolean) {
  await db.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({ where: { providerOrderId } });
    if (!payment || payment.provider !== provider) return;
    await lockOrder(tx, payment.orderId);
    const order = await tx.order.findUniqueOrThrow({ where: { id: payment.orderId }, include: { items: true } });
    if (payment.status !== "SUCCEEDED") {
      await tx.payment.update({ where: { id: payment.id }, data: { status: "FAILED", failureReason: reason.slice(0, 300) } });
    }
    await tx.orderEvent.create({ data: { orderId: order.id, type: "payment_failed", message: reason.slice(0, 300) } });
    if (final && order.status === "PENDING_PAYMENT") {
      if (order.stockState === "RESERVED") await returnStock(tx, order, "RELEASE");
      await tx.order.update({ where: { id: order.id }, data: { status: "PAYMENT_FAILED", stockState: order.stockState === "RESERVED" ? "RELEASED" : order.stockState, reservedUntil: null } });
      await tx.orderEvent.create({ data: { orderId: order.id, type: "status_changed", fromStatus: order.status, toStatus: "PAYMENT_FAILED" } });
    }
  });
}

/** Ends an unpaid order and gives its stock back. Safe to repeat. */
export async function expireOrder(orderId: string, why: string) {
  await db.$transaction(async (tx) => {
    await lockOrder(tx, orderId);
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order || order.status !== "PENDING_PAYMENT") return;
    if (order.stockState === "RESERVED") await returnStock(tx, order, "RELEASE");
    await tx.order.update({ where: { id: order.id }, data: { status: "EXPIRED", stockState: order.stockState === "RESERVED" ? "RELEASED" : order.stockState, reservedUntil: null } });
    await tx.payment.updateMany({ where: { orderId: order.id, status: { in: ["CREATED", "PENDING"] } }, data: { status: "CANCELLED" } });
    await tx.orderEvent.create({ data: { orderId: order.id, type: "status_changed", fromStatus: "PENDING_PAYMENT", toStatus: "EXPIRED", message: why } });
  });
}

/** Releases stock held by checkouts that were never paid. Called on checkout and by a scheduled job. */
export async function releaseExpiredReservations(limit = 50) {
  const stale = await db.order.findMany({
    where: { status: "PENDING_PAYMENT", stockState: "RESERVED", reservedUntil: { lt: new Date() } },
    select: { id: true },
    take: limit,
  });
  for (const o of stale) await expireOrder(o.id, "Payment not completed in time");
  return stale.length;
}

/**
 * Applies the provider's *total* refunded amount for a payment. Using absolute totals makes
 * repeated or out-of-order refund notifications harmless. Refunds don't restock automatically —
 * goods may not have come back; use Inventory → Return for that.
 */
export async function syncRefund(provider: PaymentProvider, ref: { providerPaymentId?: string; providerOrderId?: string }, totalRefunded: number, actorId?: string) {
  await db.$transaction(async (tx) => {
    const payment = ref.providerPaymentId
      ? await tx.payment.findUnique({ where: { providerPaymentId: ref.providerPaymentId } })
      : ref.providerOrderId
        ? await tx.payment.findUnique({ where: { providerOrderId: ref.providerOrderId } })
        : null;
    if (!payment || payment.provider !== provider) return;
    await lockOrder(tx, payment.orderId);
    const refunded = Math.min(payment.amount, Math.max(payment.refundedAmount, totalRefunded));
    if (refunded === payment.refundedAmount) return;
    await tx.payment.update({
      where: { id: payment.id },
      data: { refundedAmount: refunded, status: refunded >= payment.amount ? "REFUNDED" : "PARTIALLY_REFUNDED" },
    });
    const order = await tx.order.findUniqueOrThrow({ where: { id: payment.orderId }, include: { payments: true } });
    const orderRefunded = Math.min(order.total, order.payments.reduce((s, p) => s + (p.id === payment.id ? refunded : p.refundedAmount), 0));
    const full = orderRefunded >= order.total;
    await tx.order.update({ where: { id: order.id }, data: { refundedAmount: orderRefunded, status: full ? "REFUNDED" : order.status } });
    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        type: "refund",
        fromStatus: order.status,
        toStatus: full ? "REFUNDED" : order.status,
        message: `Refunded total ${(orderRefunded / 100).toFixed(2)} ${order.currency}`,
        actorId,
      },
    });
  });
}

/** Staff status change with the allowed-transition check. Cancelling a paid order returns its stock. */
export async function adminTransition(orderId: string, to: OrderStatus, actorId: string, trackingNumber?: string | null) {
  return db.$transaction(async (tx) => {
    await lockOrder(tx, orderId);
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order) return { error: "Order not found." };
    const trackingChanged = trackingNumber !== undefined && (trackingNumber || null) !== order.trackingNumber;
    if (to === order.status) {
      if (!trackingChanged) return { error: "Nothing changed." };
    } else if (!(ADMIN_TRANSITIONS[order.status] ?? []).includes(to)) {
      return { error: `An order that is ${order.status.replace("_", " ").toLowerCase()} can't be moved to ${to.toLowerCase()}.` };
    }
    if (to === "SHIPPED" && !(trackingNumber || order.trackingNumber)) return { error: "Add a tracking or B/L number before marking as shipped." };

    let stockState = order.stockState;
    if (to === "CANCELLED" && order.stockState === "COMMITTED") {
      await returnStock(tx, order, "CANCEL", actorId);
      stockState = "RELEASED";
    }
    await tx.order.update({
      where: { id: order.id },
      data: { status: to, stockState, trackingNumber: trackingNumber === undefined ? order.trackingNumber : trackingNumber || null },
    });
    if (to !== order.status) {
      await tx.orderEvent.create({ data: { orderId: order.id, type: "status_changed", fromStatus: order.status, toStatus: to, actorId } });
    }
    if (trackingChanged) {
      await tx.orderEvent.create({ data: { orderId: order.id, type: "tracking_updated", message: trackingNumber || "removed", actorId } });
    }
    return { ok: true as const, from: order.status };
  });
}

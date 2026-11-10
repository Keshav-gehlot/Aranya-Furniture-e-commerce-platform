"use server";
/**
 * Admin server actions. EVERY exported function starts with requirePermission() /
 * requireRecentMfa() — a test (tests/authz-coverage.test.ts) fails the build if one doesn't.
 */
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission, requireRecentMfa } from "@/lib/auth";
import { toMinor } from "@/lib/money";
import { slugify } from "@/lib/utils";
import { audit } from "@/lib/audit";
import { adminTransition, syncRefund } from "@/lib/orders";
import { refundRazorpayPayment, fetchRazorpayPayment, stripe } from "@/lib/payments";
import type { OrderStatus } from "@/generated/prisma/enums";

export type AdminState = { error?: string; ok?: string } | undefined;

// ---------------------------------------------------------------- products

const productSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Name is required.").max(150),
  slug: z.string().trim().max(160).optional(),
  sku: z.string().trim().min(1, "SKU is required.").max(40),
  description: z.string().trim().min(10, "Add a description (10+ characters).").max(10_000),
  material: z.string().trim().max(200).optional(),
  finish: z.string().trim().max(200).optional(),
  dimensions: z.string().trim().max(200).optional(),
  weightKg: z.string().max(20).optional(),
  categoryId: z.string().max(40).optional(),
  priceInr: z.string().min(1, "Retail INR price is required."),
  priceUsd: z.string().min(1, "Retail USD price is required."),
  businessPriceInr: z.string().min(1, "Business INR price is required."),
  businessPriceUsd: z.string().min(1, "Business USD price is required."),
  moq: z.coerce.number().int().min(1, "Minimum quantity must be at least 1.").max(100_000),
  lowStockThreshold: z.coerce.number().int().min(0).max(100_000),
  stock: z.coerce.number().int().min(0).max(1_000_000).optional(),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]),
  images: z.string().max(20_000).default("[]"),
});

function cleanImages(json: string) {
  try {
    const arr = JSON.parse(json);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((x): x is string => typeof x === "string")
      .map((x) => x.trim())
      .filter((x) => x.startsWith("/") || x.startsWith("https://"))
      .slice(0, 12);
  } catch {
    return [];
  }
}

export async function saveProduct(_: AdminState, fd: FormData): Promise<AdminState> {
  const user = await requirePermission("products");
  const parsed = productSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;
  const slug = slugify(v.slug || v.name);
  if (!slug) return { error: "The URL slug is invalid." };
  const data = {
    name: v.name,
    slug,
    sku: v.sku.toUpperCase(),
    description: v.description,
    material: v.material || null,
    finish: v.finish || null,
    dimensions: v.dimensions || null,
    weightKg: v.weightKg ? parseFloat(v.weightKg) || null : null,
    categoryId: v.categoryId || null,
    priceInr: toMinor(v.priceInr),
    priceUsd: toMinor(v.priceUsd),
    businessPriceInr: toMinor(v.businessPriceInr),
    businessPriceUsd: toMinor(v.businessPriceUsd),
    moq: v.moq,
    lowStockThreshold: v.lowStockThreshold,
    images: cleanImages(v.images),
    status: v.status,
    isFeatured: fd.get("isFeatured") === "on",
  };
  if (data.businessPriceInr > data.priceInr || data.businessPriceUsd > data.priceUsd) {
    return { error: "Business prices should not be higher than retail prices." };
  }
  const clash = await db.product.findFirst({ where: { OR: [{ slug }, { sku: data.sku }], NOT: v.id ? { id: v.id } : undefined } });
  if (clash) return { error: clash.sku === data.sku ? "Another product already uses this SKU." : "Another product already uses this URL slug." };

  let id = v.id;
  if (id) {
    const before = await db.product.findUnique({ where: { id } });
    if (!before) return { error: "Product not found." };
    await db.product.update({ where: { id }, data });
    const changed = Object.keys(data).filter((k) => JSON.stringify((before as Record<string, unknown>)[k]) !== JSON.stringify((data as Record<string, unknown>)[k]));
    await audit(user, "product.updated", { type: "Product", id }, { changed });
  } else {
    const opening = v.stock ?? 0;
    const created = await db.$transaction(async (tx) => {
      const p = await tx.product.create({ data: { ...data, stock: opening } });
      if (opening > 0) await tx.inventoryLog.create({ data: { productId: p.id, change: opening, stockAfter: opening, reason: "OPENING", note: "Opening stock", userId: user.id } });
      return p;
    });
    id = created.id;
    await audit(user, "product.created", { type: "Product", id }, { sku: data.sku, opening });
  }
  revalidatePath("/admin/products");
  revalidatePath("/products");
  redirect(`/admin/products/${id}?saved=1`);
}

/** Products that were ever ordered are archived, never deleted, so order history stays intact. */
export async function deleteProduct(fd: FormData) {
  const user = await requirePermission("products");
  const id = String(fd.get("id"));
  const used = await db.orderItem.count({ where: { productId: id } });
  if (used > 0) {
    await db.product.update({ where: { id }, data: { status: "ARCHIVED" } });
    await audit(user, "product.archived", { type: "Product", id });
  } else {
    await db.product.delete({ where: { id } });
    await audit(user, "product.deleted", { type: "Product", id });
  }
  revalidatePath("/admin/products");
  redirect("/admin/products");
}

export async function setProductStatus(fd: FormData) {
  const user = await requirePermission("products");
  const id = String(fd.get("id"));
  const status = String(fd.get("status"));
  if (!["DRAFT", "ACTIVE", "ARCHIVED"].includes(status)) return;
  await db.product.update({ where: { id }, data: { status: status as "DRAFT" | "ACTIVE" | "ARCHIVED" } });
  await audit(user, "product.status_changed", { type: "Product", id }, { status });
  revalidatePath("/admin/products");
}

export async function toggleFeatured(fd: FormData) {
  const user = await requirePermission("products");
  const id = String(fd.get("id"));
  const p = await db.product.findUnique({ where: { id }, select: { isFeatured: true } });
  if (!p) return;
  await db.product.update({ where: { id }, data: { isFeatured: !p.isFeatured } });
  await audit(user, "product.featured_toggled", { type: "Product", id }, { isFeatured: !p.isFeatured });
  revalidatePath("/admin/products");
}

// ---------------------------------------------------------------- categories

export async function saveCategory(_: AdminState, fd: FormData): Promise<AdminState> {
  const user = await requirePermission("products");
  const id = String(fd.get("id") || "");
  const name = String(fd.get("name") || "").trim().slice(0, 100);
  const description = String(fd.get("description") || "").trim().slice(0, 300) || null;
  const parentId = String(fd.get("parentId") || "") || null;
  if (name.length < 2) return { error: "Name is required." };
  if (parentId && parentId === id) return { error: "A category can't be its own parent." };
  if (parentId) {
    const parent = await db.category.findUnique({ where: { id: parentId } });
    if (!parent) return { error: "Parent category not found." };
    if (parent.parentId) return { error: "Subcategories can only go one level deep." };
    if (id && (await db.category.count({ where: { parentId: id } })) > 0) return { error: "This category has subcategories, so it can't become a subcategory itself." };
  }
  const slug = slugify(String(fd.get("slug") || "") || name);
  const clash = await db.category.findFirst({ where: { slug, NOT: id ? { id } : undefined } });
  if (clash) return { error: "A category with this slug already exists." };
  if (id) await db.category.update({ where: { id }, data: { name, slug, description, parentId } });
  else await db.category.create({ data: { name, slug, description, parentId } });
  await audit(user, id ? "category.updated" : "category.created", { type: "Category", id: id || slug }, { name, parentId });
  revalidatePath("/admin/categories");
  return { ok: id ? "Category updated." : "Category added." };
}

export async function deleteCategory(fd: FormData) {
  const user = await requirePermission("products");
  const id = String(fd.get("id"));
  await db.category.delete({ where: { id } });
  await audit(user, "category.deleted", { type: "Category", id });
  revalidatePath("/admin/categories");
}

// ---------------------------------------------------------------- inventory

export async function adjustStock(_: AdminState, fd: FormData): Promise<AdminState> {
  const user = await requirePermission("inventory");
  const productId = String(fd.get("productId"));
  const mode = String(fd.get("mode") || "add");
  const qty = parseInt(String(fd.get("qty") || ""), 10);
  const reasonIn = String(fd.get("reason") || "ADJUSTMENT");
  const reason = (["RESTOCK", "ADJUSTMENT", "RETURN", "DAMAGED"].includes(reasonIn) ? reasonIn : "ADJUSTMENT") as "RESTOCK" | "ADJUSTMENT" | "RETURN" | "DAMAGED";
  const note = String(fd.get("note") || "").trim().slice(0, 300) || null;
  if (!Number.isInteger(qty) || qty < 0 || qty > 1_000_000) return { error: "Enter a whole number." };
  if (mode !== "set" && qty === 0) return { error: "Enter a quantity above zero." };

  const result = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Product" WHERE id = ${productId} FOR UPDATE`;
    const p = await tx.product.findUnique({ where: { id: productId } });
    if (!p) return { error: "Product not found." };
    const change = mode === "set" ? qty - p.stock : mode === "remove" ? -qty : qty;
    if (change === 0) return { error: "Stock is already at that level." };
    if (p.stock + change < 0) return { error: `Only ${p.stock} in stock — you can't remove more than that.` };
    const u = await tx.product.update({ where: { id: productId }, data: { stock: { increment: change } } });
    await tx.inventoryLog.create({ data: { productId, change, stockAfter: u.stock, reason, note, userId: user.id } });
    return { change, after: u.stock };
  });
  if ("error" in result) return { error: result.error };
  await audit(user, "inventory.adjusted", { type: "Product", id: productId }, { change: result.change, after: result.after, reason });
  revalidatePath("/admin/inventory");
  revalidatePath(`/admin/products/${productId}`);
  return { ok: `Stock ${result.change > 0 ? "+" : ""}${result.change} → ${result.after}` };
}

// ---------------------------------------------------------------- orders

export async function updateOrder(_: AdminState, fd: FormData): Promise<AdminState> {
  const user = await requirePermission("orders");
  const id = String(fd.get("id"));
  const to = String(fd.get("status")) as OrderStatus;
  const tracking = String(fd.get("trackingNumber") ?? "").trim().slice(0, 120);
  if (to === "CANCELLED") return { error: "Use the Cancel order button." };
  const r = await adminTransition(id, to, user.id, tracking);
  if ("error" in r) return { error: r.error };
  await audit(user, "order.status_changed", { type: "Order", id }, { from: r.from, to, tracking: tracking || null });
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath("/admin/orders");
  return { ok: "Order updated." };
}

export async function cancelOrder(_: AdminState, fd: FormData): Promise<AdminState> {
  const id = String(fd.get("id"));
  const user = await requireRecentMfa("refunds", `/admin/orders/${id}`);
  const r = await adminTransition(id, "CANCELLED", user.id);
  if ("error" in r) return { error: r.error };
  await audit(user, "order.cancelled", { type: "Order", id }, { from: r.from });
  revalidatePath(`/admin/orders/${id}`);
  return { ok: "Order cancelled and stock returned. Issue a refund below if the customer paid." };
}

export async function refundOrder(_: AdminState, fd: FormData): Promise<AdminState> {
  const id = String(fd.get("id"));
  const user = await requireRecentMfa("refunds", `/admin/orders/${id}`);
  const amountMajor = String(fd.get("amount") || "");
  const amount = toMinor(amountMajor);
  const order = await db.order.findUnique({ where: { id }, include: { payments: { where: { status: { in: ["SUCCEEDED", "PARTIALLY_REFUNDED"] } } } } });
  if (!order) return { error: "Order not found." };
  const pay = order.payments[0];
  if (!pay || !pay.providerPaymentId) return { error: "No captured payment to refund." };
  const refundable = pay.amount - pay.refundedAmount;
  if (amount <= 0 || amount > refundable) return { error: `Enter an amount between 0 and ${(refundable / 100).toFixed(2)}.` };

  try {
    if (pay.provider === "RAZORPAY") {
      await refundRazorpayPayment(pay.providerPaymentId, amount, `${order.orderNumber}-r${Date.now()}`);
      const latest = await fetchRazorpayPayment(pay.providerPaymentId);
      await syncRefund("RAZORPAY", { providerPaymentId: pay.providerPaymentId }, latest.amount_refunded ?? pay.refundedAmount + amount, user.id);
    } else if (pay.provider === "STRIPE") {
      await stripe().refunds.create({ payment_intent: pay.providerPaymentId, amount }, { idempotencyKey: `refund-${pay.id}-${pay.refundedAmount}-${amount}` });
      await syncRefund("STRIPE", { providerPaymentId: pay.providerPaymentId }, pay.refundedAmount + amount, user.id);
    } else {
      await syncRefund("DEMO", { providerPaymentId: pay.providerPaymentId }, pay.refundedAmount + amount, user.id);
    }
  } catch (e) {
    console.error(JSON.stringify({ level: "error", msg: "refund_failed", orderId: id, error: String(e) }));
    return { error: "The payment provider refused the refund. Check its dashboard." };
  }
  await audit(user, "order.refunded", { type: "Order", id }, { amount, currency: order.currency });
  revalidatePath(`/admin/orders/${id}`);
  return { ok: "Refund issued." };
}

export async function resolveAttention(fd: FormData) {
  const user = await requirePermission("orders");
  const id = String(fd.get("id"));
  await db.order.update({ where: { id }, data: { needsAttention: false } });
  await db.orderEvent.create({ data: { orderId: id, type: "attention_resolved", actorId: user.id } });
  await audit(user, "order.attention_resolved", { type: "Order", id });
  revalidatePath(`/admin/orders/${id}`);
}

// ---------------------------------------------------------------- customers

export async function updateCustomer(fd: FormData) {
  const user = await requirePermission("customers");
  const id = String(fd.get("id"));
  const action = String(fd.get("action"));
  const c = await db.user.findUnique({ where: { id } });
  if (!c || c.role !== "CUSTOMER") return; // staff accounts are managed in Settings → Staff
  if (action === "verify") {
    await db.user.update({ where: { id }, data: { businessVerified: !c.businessVerified } });
    await audit(user, c.businessVerified ? "customer.unverified" : "customer.verified", { type: "User", id });
  }
  if (action === "active") {
    await db.user.update({ where: { id }, data: { isActive: !c.isActive, sessionVersion: { increment: 1 } } });
    await audit(user, c.isActive ? "customer.disabled" : "customer.enabled", { type: "User", id });
  }
  revalidatePath("/admin/customers");
}

// ---------------------------------------------------------------- enquiries

export async function updateEnquiry(_: AdminState, fd: FormData): Promise<AdminState> {
  const user = await requirePermission("enquiries");
  const id = String(fd.get("id"));
  const status = String(fd.get("status"));
  if (!["NEW", "IN_PROGRESS", "CLOSED"].includes(status)) return { error: "Invalid status." };
  const followUp = String(fd.get("followUpAt") || "");
  const note = String(fd.get("note") || "").trim().slice(0, 4000);
  await db.$transaction(async (tx) => {
    await tx.enquiry.update({
      where: { id },
      data: { status: status as "NEW" | "IN_PROGRESS" | "CLOSED", followUpAt: followUp ? new Date(followUp) : null },
    });
    if (note) await tx.enquiryNote.create({ data: { enquiryId: id, authorId: user.id, body: note } });
  });
  await audit(user, "enquiry.updated", { type: "Enquiry", id }, { status, followUp: followUp || null, noteAdded: !!note });
  revalidatePath("/admin/enquiries");
  revalidatePath(`/admin/enquiries/${id}`);
  return { ok: "Saved." };
}

export async function deleteEnquiry(fd: FormData) {
  const id = String(fd.get("id"));
  const user = await requireRecentMfa("enquiries", `/admin/enquiries/${id}`);
  await db.enquiry.delete({ where: { id } });
  await audit(user, "enquiry.deleted", { type: "Enquiry", id });
  revalidatePath("/admin/enquiries");
  redirect("/admin/enquiries");
}

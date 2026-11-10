import "server-only";
import { db } from "./db";
import { getSettings } from "./settings";
import type { Currency } from "@/config/site";
import type { CartItem, Quote, QuoteLine } from "./cart-types";

export const MAX_LINE_QTY = 10_000;

/**
 * Re-prices a cart from the database. The browser cart is never trusted —
 * prices, minimum quantities, stock, tax and shipping are always worked out here.
 */
export async function quoteCart(rawItems: CartItem[], currency: Currency): Promise<Quote> {
  const settings = await getSettings();
  const merged = new Map<string, CartItem>();
  for (const it of (rawItems ?? []).slice(0, 100)) {
    if (!it || typeof it.productId !== "string" || it.productId.length > 40) continue;
    const type = it.type === "BUSINESS" ? "BUSINESS" : "RETAIL";
    const qty = Math.min(MAX_LINE_QTY, Math.max(0, Math.floor(Number(it.qty) || 0)));
    if (qty <= 0) continue;
    const k = `${it.productId}:${type}`;
    const prev = merged.get(k);
    merged.set(k, { productId: it.productId, type, qty: Math.min(MAX_LINE_QTY, (prev?.qty ?? 0) + qty) });
  }
  const items = [...merged.values()];
  const products = await db.product.findMany({ where: { id: { in: items.map((i) => i.productId) } } });
  const byId = new Map(products.map((p) => [p.id, p]));

  const requested = new Map<string, number>();
  for (const it of items) requested.set(it.productId, (requested.get(it.productId) ?? 0) + it.qty);

  const errors: string[] = [];
  const lines: QuoteLine[] = [];
  for (const it of items) {
    const p = byId.get(it.productId);
    if (!p || p.status !== "ACTIVE") {
      errors.push("A product in your cart is no longer available and was removed.");
      continue;
    }
    const isBiz = it.type === "BUSINESS";
    const unit = currency === "INR" ? (isBiz ? p.businessPriceInr : p.priceInr) : isBiz ? p.businessPriceUsd : p.priceUsd;
    let error: string | undefined;
    if (isBiz && it.qty < p.moq) error = `Business orders need at least ${p.moq} units.`;
    else if ((requested.get(p.id) ?? 0) > p.stock) error = p.stock > 0 ? `Only ${p.stock} in stock.` : "Out of stock.";
    if (error) errors.push(`${p.name}: ${error}`);
    lines.push({
      productId: p.id,
      name: p.name,
      slug: p.slug,
      sku: p.sku,
      image: p.images[0] ?? null,
      type: it.type,
      qty: it.qty,
      unitPrice: unit,
      lineTotal: unit * it.qty,
      moq: p.moq,
      stock: p.stock,
      error,
    });
  }

  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  let shipping = 0;
  let tax = 0;
  if (currency === "INR") {
    shipping = subtotal === 0 || subtotal >= settings.domesticFreeShippingOver ? 0 : settings.domesticShipping;
    tax = Math.round((subtotal * settings.gstRateBps) / 10_000);
  } else {
    shipping = subtotal === 0 ? 0 : settings.exportHandling;
  }
  return { currency, lines, subtotal, shipping, tax, total: subtotal + shipping + tax, hasBusiness: lines.some((l) => l.type === "BUSINESS"), errors };
}

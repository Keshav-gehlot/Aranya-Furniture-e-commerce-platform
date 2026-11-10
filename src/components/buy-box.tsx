"use client";
import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, Check, FileText, Minus, Plus, Truck } from "lucide-react";
import { useCart } from "./cart-context";
import { formatMoney } from "@/lib/money";
import type { PurchaseType } from "@/lib/cart-types";

type Props = {
  currency: "INR" | "USD";
  initialType: PurchaseType;
  product: { id: string; name: string; moq: number; stock: number; lowStock: number; retail: number; business: number };
};

export function BuyBox({ currency, initialType, product: p }: Props) {
  const { add, items } = useCart();
  const [type, setType] = useState<PurchaseType>(initialType);
  const minQty = type === "BUSINESS" ? p.moq : 1;
  const [qty, setQty] = useState(minQty);
  const [added, setAdded] = useState(0);

  const inCart = items.filter((i) => i.productId === p.id).reduce((s, i) => s + i.qty, 0);
  const available = Math.max(0, p.stock - inCart);
  const unit = type === "BUSINESS" ? p.business : p.retail;
  const savingPct = p.retail > 0 ? Math.round((1 - p.business / p.retail) * 100) : 0;
  const tooFew = qty < minQty;
  const tooMany = qty > available;
  const tax = currency === "INR" ? "+ GST" : "FOB · freight quoted separately";
  const total = formatMoney(unit * Math.max(qty, 0), currency);

  function switchType(t: PurchaseType) {
    setType(t);
    setQty(t === "BUSINESS" ? Math.max(qty, p.moq) : 1);
    setAdded(0);
  }
  function onAdd() {
    if (tooFew || tooMany || qty <= 0) return;
    add(p.id, type, qty);
    setAdded(qty);
  }
  const cta = type === "BUSINESS" ? `Add ${qty} to cart` : qty > 1 ? `Add ${qty} to cart` : "Add to cart";
  const disabled = tooFew || tooMany || qty <= 0;

  return (
    <div className="grid gap-6">
      <div className="ar-price">
        <div className="ar-price__main">
          <span className="t-price-l">{formatMoney(unit, currency)}</span>
          <span className="ar-price__unit">/ unit</span>
          <span className="ar-price__tax">{tax}</span>
        </div>
        {type === "RETAIL" && (
          <p className="text-[15px] leading-[22px] text-ink-2">
            Trade price <strong className="font-semibold text-primary">{formatMoney(p.business, currency)}</strong> from {p.moq} units
            {savingPct > 0 && <span className="ar-price__save"> · save {savingPct}%</span>}
          </p>
        )}
      </div>

      <fieldset className="ar-ptype">
        <legend>How are you buying?</legend>
        <label className="ar-ptype__opt">
          <input type="radio" name="ptype" checked={type === "RETAIL"} onChange={() => switchType("RETAIL")} />
          <span className="ar-ptype__title">For home</span>
          <span className="ar-ptype__price">{formatMoney(p.retail, currency)} / unit</span>
          <span className="ar-ptype__note">Any quantity</span>
        </label>
        <label className="ar-ptype__opt">
          <input type="radio" name="ptype" checked={type === "BUSINESS"} onChange={() => switchType("BUSINESS")} />
          <span className="ar-ptype__title">As a business</span>
          <span className="ar-ptype__price">{formatMoney(p.business, currency)} / unit</span>
          <span className="ar-ptype__note">Minimum {p.moq} units{currency === "INR" ? " · GST invoice" : ""}</span>
        </label>
      </fieldset>

      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div>
          <label className="label" htmlFor="qty">Quantity</label>
          <div className={`ar-stepper ${tooFew ? "is-invalid" : ""}`}>
            <button type="button" onClick={() => setQty((q) => Math.max(minQty, q - 1))} disabled={qty <= minQty} aria-label="Decrease quantity"><Minus size={18} strokeWidth={1.5} aria-hidden /></button>
            <input id="qty" type="number" inputMode="numeric" min={minQty} value={qty} onChange={(e) => setQty(Math.max(0, parseInt(e.target.value || "0", 10)))} />
            <button type="button" onClick={() => setQty((q) => q + 1)} aria-label="Increase quantity"><Plus size={18} strokeWidth={1.5} aria-hidden /></button>
          </div>
        </div>
        <p className="pb-2.5 text-[15px] text-ink-2">
          Total <strong className="t-price text-ink">{total}</strong> {currency === "INR" && <span className="text-sm">+ GST</span>}
        </p>
      </div>

      <div aria-live="polite">
        {tooFew ? (
          <div className="ar-alert ar-alert--warning ar-alert--compact">
            <AlertTriangle strokeWidth={1.5} aria-hidden />
            <p>Add {minQty - qty} more to reach the trade minimum of {p.moq} units.</p>
          </div>
        ) : tooMany ? (
          <div className="ar-alert ar-alert--warning ar-alert--compact">
            <AlertTriangle strokeWidth={1.5} aria-hidden />
            <p>
              {available > 0 ? `Only ${available} more in stock right now.` : "Out of stock right now."}{" "}
              <a href="#quote" className="ar-link">Request a quote</a> for a larger or made-to-order quantity.
            </p>
          </div>
        ) : p.stock <= p.lowStock ? (
          <span className="badge ar-badge--warning"><span className="ar-dot" />Only {p.stock} left</span>
        ) : (
          <span className="badge ar-badge--success"><span className="ar-dot" />In stock · ready to dispatch</span>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={onAdd} disabled={disabled} className="btn-primary ar-btn--l flex-1 sm:flex-none sm:min-w-[240px]">{cta}</button>
        <a href="#quote" className="btn-outline ar-btn--l">Request a quote</a>
      </div>

      {added > 0 && (
        <div className="ar-alert ar-alert--success ar-alert--compact" role="status">
          <Check strokeWidth={1.5} aria-hidden />
          <p>{added} added to your cart. <Link href="/cart" className="ar-link">View cart</Link></p>
        </div>
      )}

      <div className="ar-trust border-t border-line pt-5">
        <div><Truck strokeWidth={1.5} aria-hidden />{currency === "INR" ? "Delivered across India. Shipping is added at checkout; free on larger orders." : "Shipped by sea or air from Mundra or Nhava Sheva. Freight is quoted after packing."}</div>
        <div><FileText strokeWidth={1.5} aria-hidden />{currency === "INR" ? "GST invoice with your company's GSTIN on business orders." : "Commercial invoice, packing list and certificate of origin with every export order."}</div>
      </div>

      <div className="ar-buybar">
        <div>
          <strong>{total}</strong>
          <span>{qty} × {formatMoney(unit, currency)} {currency === "INR" ? "+ GST" : "FOB"}</span>
        </div>
        <button type="button" onClick={onAdd} disabled={disabled} className="btn-primary">{cta}</button>
      </div>
    </div>
  );
}

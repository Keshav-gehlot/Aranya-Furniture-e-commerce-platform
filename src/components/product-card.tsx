import Link from "next/link";
import { formatMoney } from "@/lib/money";
import type { Currency } from "@/config/site";
import { Ph, isPhoto } from "./placeholder";

type P = {
  slug: string;
  name: string;
  images: string[];
  material?: string | null;
  priceInr: number;
  priceUsd: number;
  businessPriceInr: number;
  businessPriceUsd: number;
  moq: number;
  stock: number;
  lowStockThreshold?: number;
  category?: { name: string } | null;
};

/** First word(s) of the material line, e.g. "Solid sheesham" → "Sheesham". */
function timber(material?: string | null) {
  const m = material?.match(/sheesham|mango|acacia|teak|oak/i)?.[0];
  return m ? m[0].toUpperCase() + m.slice(1).toLowerCase() : null;
}

export function ProductCard({ p, currency, emphasizeBusiness = false }: { p: P; currency: Currency; emphasizeBusiness?: boolean }) {
  const retail = currency === "INR" ? p.priceInr : p.priceUsd;
  const biz = currency === "INR" ? p.businessPriceInr : p.businessPriceUsd;
  const tax = currency === "INR" ? " + GST" : "";
  const photos = p.images.filter(isPhoto);
  const low = p.stock > 0 && p.stock <= (p.lowStockThreshold ?? 5);
  const meta = [p.category?.name, timber(p.material)].filter(Boolean).join(" · ");
  return (
    <Link href={`/products/${p.slug}${emphasizeBusiness ? "?buy=business" : ""}`} className="ar-pcard">
      <div className="ar-pcard__media">
        {photos[0] ? <img src={photos[0]} alt={`${p.name}, front three-quarter`} loading="lazy" /> : <Ph shot="card" subject={p.name} />}
        {photos[1] ? <img src={photos[1]} alt="" loading="lazy" /> : !photos[0] ? <Ph shot="cardAlt" subject={p.name} /> : null}
        {emphasizeBusiness && <span className="ar-pcard__flag badge ar-badge--brand">Business price</span>}
      </div>
      <div className="ar-pcard__body">
        {meta && <span className="ar-pcard__cat">{meta}</span>}
        <span className="ar-pcard__name">{p.name}</span>
        {emphasizeBusiness ? (
          <>
            <span className="ar-pcard__price">
              <span>{formatMoney(biz, currency)}</span>
              <span className="ar-pcard__was">{formatMoney(retail, currency)}</span>
            </span>
            <span className="ar-pcard__trade">
              {currency === "INR" ? `Per unit + GST · min ${p.moq}` : `Per unit, FOB · min ${p.moq} · freight quoted`}
            </span>
          </>
        ) : (
          <>
            <span className="ar-pcard__price">{formatMoney(retail, currency)}</span>
            <span className="ar-pcard__trade">
              Trade <strong>{formatMoney(biz, currency)}</strong>{tax} × {p.moq}+
            </span>
          </>
        )}
        <span className="mt-1.5">
          {p.stock <= 0 ? (
            <span className="badge ar-badge--sand">Made to order</span>
          ) : low ? (
            <span className="badge ar-badge--warning"><span className="ar-dot" />Only {p.stock} left</span>
          ) : (
            <span className="badge ar-badge--success"><span className="ar-dot" />In stock</span>
          )}
        </span>
      </div>
    </Link>
  );
}

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { db } from "@/lib/db";
import { getBuyMode, getCurrency } from "@/lib/currency";
import { formatMoney } from "@/lib/money";
import { site } from "@/config/site";
import { ProductCard } from "@/components/product-card";
import { EnquiryForm } from "@/components/enquiry-form";
import { Ph } from "@/components/placeholder";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [currency, mode] = await Promise.all([getCurrency(), getBuyMode()]);
  const [featured, categories, example] = await Promise.all([
    db.product.findMany({ where: { status: "ACTIVE", isFeatured: true }, include: { category: true }, take: 4, orderBy: { createdAt: "asc" } }),
    db.category.findMany({
      where: { parentId: null },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { products: { where: { status: "ACTIVE" } } } } },
    }),
    // A real product for the worked trade example: the one with the most stock.
    db.product.findFirst({ where: { status: "ACTIVE" }, orderBy: { stock: "desc" } }),
  ]);
  const moq = site.business.defaultMoq;
  const tel = site.contact.phone.replace(/\s/g, "");
  const exRetail = example ? (currency === "INR" ? example.priceInr : example.priceUsd) : 0;
  const exTrade = example ? (currency === "INR" ? example.businessPriceInr : example.businessPriceUsd) : 0;

  const ways = [
    { who: "For your home", price: "Retail price, any quantity", how: "Pay by UPI, card or netbanking. Delivered across India.", href: "/products", cta: "Shop furniture" },
    { who: "For your business", price: `Trade price from ${moq} units of a product`, how: "Hotels, cafés, offices and retailers. GST invoice with your GSTIN.", href: "/trade", cta: "See trade pricing" },
    { who: "For importers", price: "USD pricing, FOB", how: "Container loads with export documents, custom finishes and private label.", href: "/trade#export", cta: "Plan an export order" },
  ];

  return (
    <>
      {/* Hero: headline on the grid, photograph bleeding off the right edge */}
      <section className="overflow-hidden pt-12 lg:pt-20">
        <div className="container-x">
          <h1 className="t-display-xl ar-rise max-w-[15ch]">Solid wood furniture, built in Jodhpur.</h1>
        </div>
        <div className="container-x mt-8 grid gap-8 lg:mt-12 lg:grid-cols-12 lg:gap-6">
          <div className="ar-rise lg:col-span-4 lg:pt-2" style={{ animationDelay: "80ms" }}>
            <p className="t-body-l max-w-text text-ink-2">
              Sheesham, mango and acacia, made in our own workshop. Buy one piece for your home, {moq} or more at the trade price, or a container load in USD.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/products" className="btn-primary ar-btn--l">Shop furniture</Link>
              <Link href="/trade" className="btn-outline ar-btn--l">See trade pricing</Link>
            </div>
          </div>
          <div className="ar-rise lg:col-span-8 lg:-mr-[var(--margin)]" style={{ animationDelay: "160ms" }}>
            <Ph shot="hero" subject="Dining room in daylight, table left of centre" style={{ aspectRatio: "16 / 9" }} />
          </div>
        </div>
      </section>

      {/* Ways to buy: a ledger, not three cards */}
      <section className="section">
        <div className="container-x">
          <h2 className="t-h2 max-w-[20ch]">One workshop, three ways to buy</h2>
          <div className="mt-8 border-t border-ink lg:mt-12">
            {ways.map((w) => (
              <div key={w.who} className="grid gap-x-6 gap-y-2 border-b border-line py-6 lg:grid-cols-12 lg:items-baseline">
                <h3 className="t-h3 lg:col-span-3">{w.who}</h3>
                <p className="font-semibold lg:col-span-3">{w.price}</p>
                <p className="text-ink-2 lg:col-span-4">{w.how}</p>
                <p className="lg:col-span-2 lg:text-right">
                  <Link href={w.href} className="ar-arrow">{w.cta}<ArrowRight size={16} strokeWidth={1.5} aria-hidden /></Link>
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured */}
      {featured.length > 0 && (
        <section className="container-x pb-12 lg:pb-24">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="t-h2">In the workshop now</h2>
            <Link href="/products" className="ar-arrow">All furniture<ArrowRight size={16} strokeWidth={1.5} aria-hidden /></Link>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 md:gap-x-6 lg:mt-12 lg:grid-cols-4">
            {featured.map((p) => <ProductCard key={p.id} p={p} currency={currency} emphasizeBusiness={mode === "BUSINESS"} />)}
          </div>
        </section>
      )}

      {/* Trade band — the one inverse band on this page */}
      <section className="bg-inverse text-on-inverse">
        <div className="container-x grid gap-x-6 gap-y-10 py-12 lg:grid-cols-12 lg:py-24">
          <div className="lg:col-span-7">
            <h2 className="t-display-l max-w-[12ch]">Trade pricing from {moq} units</h2>
            <p className="t-body-l mt-6 max-w-text text-neutral-300">
              Every product has a business price. Put {moq} or more of one product in your cart and it applies at checkout. No account approval, no call first.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/register?type=business" className="ar-btn--inverse ar-btn--l">Open a trade account</Link>
              <Link href="/contact?type=BULK" className="ar-btn--ghost-inverse ar-btn--l">Request a quote</Link>
            </div>
          </div>
          {example && (
            <div className="lg:col-span-5 lg:pt-3">
              <p className="t-label text-neutral-300">Worked example</p>
              <p className="t-h3 mt-2">{example.name}</p>
              <dl className="ar-num mt-5 grid grid-cols-[1fr_auto] gap-x-6 border-t border-neutral-700 text-[15px] leading-[22px] [&>dd]:border-b [&>dd]:border-neutral-700 [&>dd]:py-3 [&>dd]:text-right [&>dt]:border-b [&>dt]:border-neutral-700 [&>dt]:py-3 [&>dt]:text-neutral-300">
                <dt>Retail, per unit</dt><dd>{formatMoney(exRetail, currency)}</dd>
                <dt>Trade, per unit from {example.moq}</dt><dd>{formatMoney(exTrade, currency)}</dd>
                <dt>{example.moq} units at trade</dt><dd className="font-semibold">{formatMoney(exTrade * example.moq, currency)}{currency === "INR" ? " + GST" : " FOB"}</dd>
                <dt>Saved against retail</dt><dd className="font-semibold text-accent">{formatMoney((exRetail - exTrade) * example.moq, currency)}</dd>
              </dl>
              <Link href={`/products/${example.slug}?buy=business`} className="ar-arrow mt-5 !text-on-inverse">Open this product<ArrowRight size={16} strokeWidth={1.5} aria-hidden /></Link>
            </div>
          )}
        </div>
      </section>

      {/* Rooms: a typographic index beside one editorial photograph */}
      <section className="section">
        <div className="container-x grid gap-x-6 gap-y-10 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <h2 className="t-h2">Shop by room</h2>
            <ul className="mt-6 border-t border-ink lg:mt-10">
              {categories.map((c) => (
                <li key={c.id} className="border-b border-line">
                  <Link href={`/products?category=${c.slug}`} className="group flex min-h-[64px] items-center justify-between gap-4 py-3">
                    <span className="t-h3 group-hover:underline group-hover:underline-offset-4">{c.name}</span>
                    <span className="ar-num flex items-center gap-3 text-sm text-ink-3">
                      {c._count.products} {c._count.products === 1 ? "product" : "products"}
                      <ArrowRight size={18} strokeWidth={1.5} className="text-ink transition-transform group-hover:translate-x-1" aria-hidden />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="lg:col-span-6 lg:col-start-7 lg:mt-12">
            <Ph shot="editorial" subject="Living room install, wide shot" style={{ aspectRatio: "3 / 2" }} />
            <p className="t-caption mt-3 text-ink-3">Every piece is kiln-dried, finished by hand and checked before it is packed.</p>
          </div>
        </div>
      </section>

      {/* Export: photo across 8 columns, text in 4, offset down */}
      <section className="ar-rings border-t border-line">
        <div className="container-x section grid gap-x-6 gap-y-8 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <Ph shot="editorial" subject="Loaded 40ft container, door open" style={{ aspectRatio: "3 / 2" }} />
          </div>
          <div className="lg:col-span-4 lg:pt-12">
            <h2 className="t-h2">How we pack for a container</h2>
            <table className="ar-spec mt-6">
              <tbody>
                <tr><th>Packing</th><td>Corner protection, 5-ply cartons, palletised for sea freight</td></tr>
                <tr><th>Loads</th><td>FCL and LCL</td></tr>
                <tr><th>Ports</th><td>Mundra, Nhava Sheva, or the port that suits you</td></tr>
                <tr><th>Documents</th><td>Commercial invoice, packing list, certificate of origin, fumigation certificate</td></tr>
                <tr><th>Custom work</th><td>Your sizes, finishes and branding on bulk orders</td></tr>
              </tbody>
            </table>
            <Link href="/trade#export" className="ar-arrow mt-6">Plan an export order<ArrowRight size={16} strokeWidth={1.5} aria-hidden /></Link>
          </div>
        </div>
      </section>

      {/* Enquiry */}
      <section className="section border-t border-line">
        <div className="container-x grid gap-x-6 gap-y-10 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <h2 className="t-h2">Ask the sales team</h2>
            <p className="mt-4 max-w-text text-ink-2">Bulk pricing, a custom size, an export shipment, or a question about one chair. We reply within one working day.</p>
            <dl className="mt-8 grid gap-4 text-[15px]">
              <div><dt className="t-label">Phone</dt><dd><a className="ar-link" href={`tel:${tel}`}>{site.contact.phone}</a></dd></div>
              <div><dt className="t-label">Email</dt><dd><a className="ar-link" href={`mailto:${site.contact.email}`}>{site.contact.email}</a></dd></div>
              <div><dt className="t-label">WhatsApp</dt><dd><a className="ar-link" href={`https://wa.me/${site.contact.whatsapp}`} target="_blank" rel="noreferrer">Message the workshop</a></dd></div>
              <div><dt className="t-label">Hours</dt><dd className="text-ink-2">{site.contact.hours}</dd></div>
            </dl>
          </div>
          <div className="rounded-md bg-sunken p-5 sm:p-8 lg:col-span-7 lg:col-start-6">
            <EnquiryForm compact />
          </div>
        </div>
      </section>
    </>
  );
}

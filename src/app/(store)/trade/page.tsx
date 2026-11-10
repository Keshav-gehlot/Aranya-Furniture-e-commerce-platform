import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrency } from "@/lib/currency";
import { formatMoney } from "@/lib/money";
import { site } from "@/config/site";
import { EnquiryForm } from "@/components/enquiry-form";
import { Ph } from "@/components/placeholder";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Trade, wholesale and export",
  description: `Trade prices on every product from ${site.business.defaultMoq} units, GST invoices for Indian businesses, and container-load export orders in USD.`,
  alternates: { canonical: "/trade" },
};

export default async function TradePage() {
  const currency = await getCurrency();
  const moq = site.business.defaultMoq;
  // Real catalogue rows for the price table: the four products with the most stock.
  const rows = await db.product.findMany({ where: { status: "ACTIVE" }, orderBy: { stock: "desc" }, take: 4 });

  return (
    <>
      <section className="container-x pb-12 pt-10 lg:pb-24 lg:pt-20">
        <div className="grid gap-x-6 gap-y-8 lg:grid-cols-12 lg:items-end">
          <h1 className="t-display-l lg:col-span-8">Trade pricing from {moq} units</h1>
          <p className="t-body-l text-ink-2 lg:col-span-4">
            For hotels, cafés, offices and retailers. The business price is on every product page and applies as soon as a line reaches the minimum.
          </p>
        </div>

        <div className="mt-10 overflow-x-auto border-t border-ink lg:mt-16">
          <table className="ar-num w-full min-w-[640px] border-collapse text-left text-[15px] leading-[22px]">
            <caption className="sr-only">Retail and trade prices for four products</caption>
            <thead>
              <tr className="text-[13px] font-semibold text-ink-2 [&>th]:border-b [&>th]:border-line [&>th]:py-3 [&>th]:font-semibold">
                <th scope="col">Product</th>
                <th scope="col" className="text-right">Retail / unit</th>
                <th scope="col" className="text-right">Trade / unit</th>
                <th scope="col" className="text-right">Minimum</th>
                <th scope="col" className="text-right">Saving</th>
              </tr>
            </thead>
            <tbody className="[&_td]:border-b [&_td]:border-line [&_td]:py-4">
              {rows.map((p) => {
                const r = currency === "INR" ? p.priceInr : p.priceUsd;
                const b = currency === "INR" ? p.businessPriceInr : p.businessPriceUsd;
                return (
                  <tr key={p.id}>
                    <td><Link href={`/products/${p.slug}?buy=business`} className="font-semibold underline-offset-4 hover:underline">{p.name}</Link></td>
                    <td className="text-right text-ink-2">{formatMoney(r, currency)}</td>
                    <td className="text-right font-semibold text-primary">{formatMoney(b, currency)}</td>
                    <td className="text-right">{p.moq} units</td>
                    <td className="text-right font-semibold text-secondary">{r > 0 ? Math.round((1 - b / r) * 100) : 0}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="t-caption mt-3 text-ink-3">{currency === "INR" ? "INR prices before 18% GST." : "USD prices, FOB. Freight is quoted separately."} Switch currency in the header.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/products?view=business" className="btn-primary ar-btn--l">Browse at business prices</Link>
          <Link href="/register?type=business" className="btn-outline ar-btn--l">Open a trade account</Link>
        </div>
      </section>

      <section className="border-t border-line">
        <div className="container-x section grid gap-x-6 gap-y-10 lg:grid-cols-12">
          <h2 className="t-h2 lg:col-span-4">How a trade order works</h2>
          <ol className="lg:col-span-7 lg:col-start-6">
            {[
              ["Choose “As a business” on a product", `The quantity starts at the minimum, usually ${moq} units. Each product has its own minimum on its page.`],
              ["Check out in INR or USD", "INR orders are paid through Razorpay with 18% GST added. USD orders are paid through Stripe and are zero-rated."],
              ["Add your company details", "A company name is required for business orders. Add your GSTIN and it is printed on the invoice."],
              ["We pack and dispatch", "Stock is held for you while you pay. You get the tracking number in your account when the order ships."],
            ].map(([t, d]) => (
              <li key={t} className="grid gap-x-6 gap-y-1 border-b border-line py-5 first:border-t first:border-t-ink sm:grid-cols-5">
                <h3 className="font-semibold sm:col-span-2">{t}</h3>
                <p className="text-ink-2 sm:col-span-3">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="export" className="scroll-mt-24 bg-inverse text-on-inverse">
        <div className="container-x grid gap-x-6 gap-y-10 py-12 lg:grid-cols-12 lg:py-24">
          <div className="lg:col-span-5">
            <h2 className="t-display-l">Export by the container</h2>
            <p className="t-body-l mt-6 max-w-text text-neutral-300">
              For importers, wholesalers and hospitality groups outside India. Send the destination port and quantities; we quote product, packing and freight together.
            </p>
            <dl className="mt-8 grid grid-cols-[auto_1fr] gap-x-6 border-t border-neutral-700 text-[15px] leading-[22px] [&>dd]:border-b [&>dd]:border-neutral-700 [&>dd]:py-3 [&>dt]:border-b [&>dt]:border-neutral-700 [&>dt]:py-3 [&>dt]:text-neutral-300">
              <dt>Currency</dt><dd>USD, FOB</dd>
              <dt>Loads</dt><dd>FCL and LCL</dd>
              <dt>Ports</dt><dd>Mundra, Nhava Sheva, or the port that suits you</dd>
              <dt>Packing</dt><dd>Kiln-dried timber, corner protection, 5-ply cartons, palletised</dd>
              <dt>Documents</dt><dd>Commercial invoice, packing list, certificate of origin, fumigation certificate</dd>
              <dt>Custom work</dt><dd>Your sizes, finishes and branding on bulk orders</dd>
            </dl>
            <a href="#quote" className="ar-btn--inverse ar-btn--l mt-8">Request an export quote</a>
          </div>
          <div className="grid content-start gap-6 lg:col-span-6 lg:col-start-7">
            <Ph dark shot="editorial" subject="Corner guards and labelled cartons" style={{ aspectRatio: "3 / 2" }} />
            <Ph dark shot="editorial" subject="Loaded 40ft container, door open" className="lg:ml-auto lg:w-2/3" style={{ aspectRatio: "3 / 2" }} />
          </div>
        </div>
      </section>

      <section id="quote" className="scroll-mt-24">
        <div className="container-x section grid gap-x-6 gap-y-10 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <h2 className="t-h2">Request a trade or export quote</h2>
            <p className="mt-4 max-w-text text-ink-2">Tell us which products, how many, and the delivery city or destination port. We reply within one working day.</p>
            <Link href="/contact" className="ar-arrow mt-6">Phone, email and WhatsApp<ArrowRight size={16} strokeWidth={1.5} aria-hidden /></Link>
          </div>
          <div className="rounded-md bg-sunken p-5 sm:p-8 lg:col-span-7 lg:col-start-6">
            <EnquiryForm defaultType="BULK" defaultQty={moq} />
          </div>
        </div>
      </section>
    </>
  );
}

import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { getBuyMode, getCurrency } from "@/lib/currency";
import { site } from "@/config/site";
import { BuyBox } from "@/components/buy-box";
import { Gallery } from "@/components/gallery";
import { EnquiryForm } from "@/components/enquiry-form";
import { ProductCard } from "@/components/product-card";
import { isPhoto } from "@/components/placeholder";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await db.product.findUnique({ where: { slug }, select: { name: true, material: true, finish: true, dimensions: true, moq: true } });
  if (!p) return { title: "Product" };
  const facts = [p.material, p.finish && `${p.finish} finish`, p.dimensions].filter(Boolean).join(". ");
  return {
    title: p.name,
    description: `${p.name}. ${facts}. Retail and trade pricing from ${p.moq} units, in INR or USD.`.slice(0, 158),
    alternates: { canonical: `/products/${slug}` },
  };
}

export default async function ProductPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ buy?: string }> }) {
  const [{ slug }, { buy }] = await Promise.all([params, searchParams]);
  const [currency, mode] = await Promise.all([getCurrency(), getBuyMode()]);
  const p = await db.product.findUnique({ where: { slug }, include: { category: true } });
  if (!p || p.status !== "ACTIVE") notFound();
  const related = await db.product.findMany({
    where: { status: "ACTIVE", categoryId: p.categoryId, NOT: { id: p.id } },
    include: { category: true },
    take: 4,
  });

  const specs = [
    ["SKU", <span key="sku" className="ar-mono">{p.sku}</span>],
    ["Timber and materials", p.material],
    ["Finish", p.finish],
    ["Size (W × D × H)", p.dimensions],
    ["Weight", p.weightKg ? `${p.weightKg} kg` : null],
    ["Trade minimum", `${p.moq} units`],
  ].filter(([, v]) => v) as [string, React.ReactNode][];

  const retail = currency === "INR" ? p.priceInr : p.priceUsd;
  const photos = p.images.filter(isPhoto);
  const base = process.env.NEXT_PUBLIC_SITE_URL || "";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    sku: p.sku,
    description: p.description,
    material: p.material ?? undefined,
    image: photos.map((s) => (s.startsWith("http") ? s : base + s)),
    brand: { "@type": "Brand", name: site.name },
    offers: {
      "@type": "Offer",
      price: (retail / 100).toFixed(2),
      priceCurrency: currency,
      availability: p.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/BackOrder",
      url: `${base}/products/${p.slug}`,
    },
  };

  return (
    <div className="container-x pb-28 pt-4 lg:pb-24">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <nav className="ar-crumbs" aria-label="Breadcrumb">
        <ol>
          <li><Link href="/products">Shop</Link></li>
          {p.category && <li><Link href={`/products?category=${p.category.slug}`}>{p.category.name}</Link></li>}
          <li aria-current="page">{p.name}</li>
        </ol>
      </nav>

      <div className="mt-4 grid gap-x-6 gap-y-8 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <Gallery images={p.images} name={p.name} />
        </div>
        <div className="lg:col-span-5 lg:pl-6">
          <h1 className="t-h1">{p.name}</h1>
          {(p.material || p.finish) && <p className="mt-3 text-ink-2">{[p.material, p.finish && `${p.finish} finish`].filter(Boolean).join(" · ")}</p>}
          <div className="mt-6">
            <BuyBox
              currency={currency}
              initialType={buy === "business" || (buy !== "retail" && mode === "BUSINESS") ? "BUSINESS" : "RETAIL"}
              product={{
                id: p.id,
                name: p.name,
                moq: p.moq,
                stock: p.stock,
                lowStock: p.lowStockThreshold,
                retail,
                business: currency === "INR" ? p.businessPriceInr : p.businessPriceUsd,
              }}
            />
          </div>
        </div>
      </div>

      <section className="mt-12 grid gap-x-6 gap-y-8 border-t border-line pt-12 lg:mt-24 lg:grid-cols-12 lg:pt-16">
        <div className="lg:col-span-6">
          <h2 className="t-h2">About this piece</h2>
          <p className="t-body-l mt-5 max-w-text whitespace-pre-line text-ink-2">{p.description}</p>
        </div>
        <div className="lg:col-span-5 lg:col-start-8">
          <h3 className="t-h3">Specifications</h3>
          <table className="ar-spec mt-5">
            <tbody>
              {specs.map(([k, v]) => (
                <tr key={k}><th scope="row">{k}</th><td>{v}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="quote" className="mt-12 grid scroll-mt-28 gap-x-6 gap-y-8 border-t border-line pt-12 lg:mt-24 lg:grid-cols-12 lg:pt-16">
        <div className="lg:col-span-4">
          <h2 className="t-h2">Request a quote for this product</h2>
          <p className="mt-4 max-w-text text-ink-2">For more than we hold in stock, a custom size or finish, or delivery outside India. Tell us the quantity and where it is going, and we reply with a price within one working day.</p>
        </div>
        <div className="rounded-md bg-sunken p-5 sm:p-8 lg:col-span-7 lg:col-start-6">
          <EnquiryForm productId={p.id} productName={p.name} defaultType="BULK" defaultQty={p.moq} compact />
        </div>
      </section>

      {related.length > 0 && (
        <section className="mt-12 border-t border-line pt-12 lg:mt-24 lg:pt-16">
          <h2 className="t-h2">More from {p.category?.name ?? "the workshop"}</h2>
          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 md:gap-x-6 lg:grid-cols-4">
            {related.map((r) => <ProductCard key={r.id} p={r} currency={currency} emphasizeBusiness={mode === "BUSINESS"} />)}
          </div>
        </section>
      )}
    </div>
  );
}

import Link from "next/link";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { categoryOptions } from "@/lib/categories";
import { ProductForm } from "@/components/admin/product-form";
import { PageHeader } from "@/components/admin/ui";

export const metadata = { title: "New product" };

export default async function NewProduct() {
  await requirePermission("products");
  const [categories, count, settings] = await Promise.all([categoryOptions(), db.product.count(), getSettings()]);
  return (
    <>
      <PageHeader title="New product"><Link href="/admin/products" className="btn-ghost">← Back</Link></PageHeader>
      <ProductForm
        categories={categories}
        init={{
          name: "", slug: "", sku: `AF-${1001 + count}`, description: "", material: "", finish: "", dimensions: "", weightKg: "",
          categoryId: "", priceInr: "", priceUsd: "", businessPriceInr: "", businessPriceUsd: "",
          moq: settings.defaultMoq, lowStockThreshold: 5, stock: 0, images: [], status: "DRAFT", isFeatured: false,
        }}
      />
    </>
  );
}

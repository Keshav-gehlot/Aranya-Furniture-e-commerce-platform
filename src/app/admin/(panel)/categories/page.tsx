import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { deleteCategory } from "@/app/actions/admin";
import { PageHeader } from "@/components/admin/ui";
import { CategoryForm } from "@/components/admin/category-form";

export const metadata = { title: "Categories" };

export default async function Categories() {
  await requirePermission("products");
  const cats = await db.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], include: { _count: { select: { products: true } } } });
  const parents = cats.filter((c) => !c.parentId).map((c) => ({ id: c.id, name: c.name }));
  const ordered = cats.filter((c) => !c.parentId).flatMap((p) => [p, ...cats.filter((c) => c.parentId === p.id)]);
  return (
    <>
      <PageHeader title="Categories" sub="Collections and subcategories shown on the store. Subcategories go one level deep." />
      <div className="card p-5"><CategoryForm parents={parents} /></div>
      <ul className="card mt-6 divide-y divide-ink/5">
        {ordered.map((c) => (
          <li key={c.id} className={`flex flex-col gap-2 p-5 lg:flex-row lg:items-center ${c.parentId ? "lg:pl-12" : ""}`}>
            <div className="flex-1">{c.parentId && <p className="mb-1 text-xs text-stone">Subcategory</p>}<CategoryForm c={c} parents={parents} /></div>
            <div className="flex items-center gap-3 text-sm text-stone">
              <span>{c._count.products} products</span>
              <form action={deleteCategory}>
                <input type="hidden" name="id" value={c.id} />
                <button className="text-red-700 hover:underline" title="Its products and subcategories become uncategorised / top level">Delete</button>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

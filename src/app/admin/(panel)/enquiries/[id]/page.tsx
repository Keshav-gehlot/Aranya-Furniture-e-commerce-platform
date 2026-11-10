import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { site } from "@/config/site";
import { deleteEnquiry } from "@/app/actions/admin";
import { PageHeader } from "@/components/admin/ui";
import { StatusBadge } from "@/components/status-badge";
import { EnquiryUpdate } from "@/components/admin/enquiry-update";

export const metadata = { title: "Enquiry" };

export default async function EnquiryDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("enquiries");
  const { id } = await params;
  const e = await db.enquiry.findUnique({ where: { id }, include: { product: true, notes: { orderBy: { createdAt: "desc" }, include: { author: { select: { name: true } } } } } });
  if (!e) notFound();
  const subject = encodeURIComponent(`Re: your ${e.type.toLowerCase()} enquiry — ${site.name}`);
  const wa = e.phone?.replace(/[^\d]/g, "");
  return (
    <>
      <PageHeader title={e.name} sub={`Received ${e.createdAt.toLocaleString("en-IN")}`}>
        <StatusBadge status={e.status} />
        <Link href="/admin/enquiries" className="btn-ghost">← Enquiries</Link>
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card p-6">
            <div className="flex flex-wrap gap-2">
              <span className="badge bg-sand">{e.type}</span>
              {e.quantity ? <span className="badge bg-forest/10 text-forest">Qty {e.quantity}</span> : null}
              {e.product && (can(user, "products") ? <Link href={`/admin/products/${e.product.id}`} className="badge bg-walnut text-linen">{e.product.name}</Link> : <span className="badge bg-walnut text-linen">{e.product.name}</span>)}
            </div>
            <p className="mt-5 whitespace-pre-line leading-relaxed">{e.message}</p>
          </section>
          <section className="card grid gap-4 p-6 text-sm sm:grid-cols-2">
            <div><p className="label">Email</p><p className="select-all break-all">{e.email}</p></div>
            <div><p className="label">Phone</p>{e.phone ?? "—"}</div>
            <div><p className="label">Company</p>{e.company ?? "—"}</div>
            <div><p className="label">Country</p>{e.country ?? "—"}</div>
          </section>
          <div className="flex flex-wrap gap-2">
            <a href={`mailto:${e.email}?subject=${subject}`} className="btn-primary">Reply by email</a>
            {wa && <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className="btn-outline">WhatsApp</a>}
            <form action={deleteEnquiry}><input type="hidden" name="id" value={e.id} /><button className="btn-ghost text-red-700">Delete</button></form>
          </div>
          <section className="card p-6">
            <h2 className="text-lg">Internal notes</h2>
            {e.notes.length === 0 ? <p className="mt-3 text-sm text-stone">No notes yet.</p> : (
              <ul className="mt-4 space-y-4">
                {e.notes.map((n) => (
                  <li key={n.id} className="border-l-2 border-clay pl-4">
                    <p className="whitespace-pre-line text-sm">{n.body}</p>
                    <p className="mt-1 text-xs text-stone">{n.author?.name ?? "Removed user"} · {n.createdAt.toLocaleString("en-IN")}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
        <aside className="card h-fit p-6"><EnquiryUpdate id={e.id} status={e.status} followUpAt={e.followUpAt ? e.followUpAt.toISOString().slice(0, 10) : ""} /></aside>
      </div>
    </>
  );
}

import Link from "next/link";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { ENQUIRY_STATUSES, ENQUIRY_TYPES } from "@/lib/utils";
import { PageHeader, Empty } from "@/components/admin/ui";
import { StatusBadge } from "@/components/status-badge";
import type { Prisma } from "@/generated/prisma/client";

export const metadata = { title: "Enquiries" };

export default async function Enquiries({ searchParams }: { searchParams: Promise<{ status?: string; type?: string }> }) {
  await requirePermission("enquiries");
  const { status, type } = await searchParams;
  const where: Prisma.EnquiryWhereInput = {};
  if (status && (ENQUIRY_STATUSES as readonly string[]).includes(status)) where.status = status as (typeof ENQUIRY_STATUSES)[number];
  if (type && (ENQUIRY_TYPES as readonly string[]).includes(type)) where.type = type as (typeof ENQUIRY_TYPES)[number];
  const list = await db.enquiry.findMany({ where, orderBy: { createdAt: "desc" }, take: 300, include: { product: { select: { name: true } } } });
  return (
    <>
      <PageHeader title="Enquiries" sub="Messages from the contact form, homepage and product quote requests." />
      <form className="mb-4 flex flex-wrap gap-2">
        <select name="status" defaultValue={status ?? ""} className="input w-40">
          <option value="">All statuses</option>
          {ENQUIRY_STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
        </select>
        <select name="type" defaultValue={type ?? ""} className="input w-40">
          <option value="">All types</option>
          {ENQUIRY_TYPES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <button className="btn-outline">Filter</button>
      </form>
      <div className="card overflow-x-auto">
        {list.length === 0 ? <Empty>No enquiries yet.</Empty> : (
          <table className="table-x">
            <thead><tr><th>From</th><th>Type</th><th>Message</th><th>Received</th><th>Follow up</th><th>Status</th></tr></thead>
            <tbody>
              {list.map((e) => (
                <tr key={e.id} className={e.status === "NEW" ? "bg-walnut/[0.03]" : ""}>
                  <td><Link href={`/admin/enquiries/${e.id}`} className="font-semibold hover:text-forest">{e.name}</Link><p className="text-xs text-stone">{e.company ? `${e.company} · ` : ""}{e.country ?? ""}</p></td>
                  <td><span className="badge bg-sand">{e.type}</span>{e.quantity ? <p className="mt-1 text-xs text-stone">Qty {e.quantity}</p> : null}</td>
                  <td className="max-w-sm"><p className="truncate">{e.product ? <span className="font-medium">[{e.product.name}] </span> : null}{e.message}</p></td>
                  <td className="whitespace-nowrap text-stone">{e.createdAt.toLocaleDateString("en-IN")}</td>
                  <td className={`whitespace-nowrap ${e.followUpAt && e.followUpAt < new Date() && e.status !== "CLOSED" ? "font-semibold text-red-700" : "text-stone"}`}>{e.followUpAt ? e.followUpAt.toLocaleDateString("en-IN") : "—"}</td>
                  <td><StatusBadge status={e.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

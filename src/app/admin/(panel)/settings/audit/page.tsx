import Link from "next/link";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { PageHeader, Empty } from "@/components/admin/ui";
import type { Prisma } from "@/generated/prisma/client";

export const metadata = { title: "Audit log" };
const PAGE = 100;

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ q?: string; action?: string; page?: string }> }) {
  await requirePermission("audit");
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page || "1", 10) || 1);
  const where: Prisma.AuditLogWhereInput = {};
  if (sp.action) where.action = { startsWith: sp.action };
  if (sp.q) where.OR = [{ actorEmail: { contains: sp.q, mode: "insensitive" } }, { targetId: sp.q }, { ip: sp.q }];
  const [rows, total] = await Promise.all([
    db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, take: PAGE, skip: (page - 1) * PAGE }),
    db.auditLog.count({ where }),
  ]);
  const groups = ["auth", "staff", "settings", "order", "product", "inventory", "customer", "enquiry", "category"];
  const qs = (p: number) => `/admin/settings/audit?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(sp.action ? { action: sp.action } : {}), page: String(p) })}`;
  return (
    <>
      <PageHeader title="Audit log" sub={`${total.toLocaleString("en-IN")} entries · sign-ins, staff changes, settings, refunds and every admin edit`} />
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={sp.q} placeholder="Email, record id or IP" className="input max-w-xs" aria-label="Search" />
        <select name="action" defaultValue={sp.action ?? ""} className="input w-44" aria-label="Area">
          <option value="">All areas</option>
          {groups.map((g) => <option key={g} value={`${g}.`}>{g}</option>)}
        </select>
        <button className="btn-outline">Filter</button>
      </form>
      <div className="card overflow-x-auto">
        {rows.length === 0 ? <Empty>No entries.</Empty> : (
          <table className="table-x">
            <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Record</th><th>Details</th><th>IP</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap text-stone">{r.createdAt.toLocaleString("en-IN")}</td>
                  <td className="whitespace-nowrap">{r.actorEmail ?? "system"}</td>
                  <td><code className="text-xs">{r.action}</code></td>
                  <td className="text-xs text-stone">{r.targetType ? `${r.targetType} ${r.targetId ?? ""}` : "—"}</td>
                  <td className="max-w-xs"><code className="block truncate text-xs text-stone" title={r.details ? JSON.stringify(r.details) : ""}>{r.details ? JSON.stringify(r.details) : ""}</code></td>
                  <td className="whitespace-nowrap text-xs text-stone">{r.ip ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="mt-4 flex justify-between text-sm">
        {page > 1 ? <Link href={qs(page - 1)} className="btn-outline">← Newer</Link> : <span />}
        {page * PAGE < total ? <Link href={qs(page + 1)} className="btn-outline">Older →</Link> : <span />}
      </div>
    </>
  );
}

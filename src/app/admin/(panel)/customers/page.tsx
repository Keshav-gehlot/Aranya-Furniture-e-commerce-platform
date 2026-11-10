import { db } from "@/lib/db";
import { updateCustomer } from "@/app/actions/admin";
import { requirePermission } from "@/lib/auth";
import { PageHeader, Empty } from "@/components/admin/ui";
import type { Prisma } from "@/generated/prisma/client";

export const metadata = { title: "Customers" };

export default async function Customers({ searchParams }: { searchParams: Promise<{ q?: string; type?: string }> }) {
  await requirePermission("customers");
  const { q, type } = await searchParams;
  const where: Prisma.UserWhereInput = { role: "CUSTOMER" };
  if (type === "business") where.accountType = "BUSINESS";
  if (type === "retail") where.accountType = "RETAIL";
  if (type === "unverified") Object.assign(where, { accountType: "BUSINESS", businessVerified: false });
  if (q) where.OR = [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { companyName: { contains: q, mode: "insensitive" } }];
  const users = await db.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 300,
    select: { id: true, name: true, email: true, phone: true, accountType: true, businessVerified: true, companyName: true, taxId: true, country: true, isActive: true, createdAt: true, _count: { select: { orders: { where: { status: { in: ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"] } } } } } },
  });

  return (
    <>
      <PageHeader title="Customers" sub={`${users.length} accounts · staff accounts are in Settings → Staff & access`} />
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Name, email or company" className="input max-w-xs" aria-label="Search" />
        <select name="type" defaultValue={type ?? ""} className="input w-48" aria-label="Type">
          <option value="">All customers</option>
          <option value="business">Business buyers</option>
          <option value="unverified">Business · not verified</option>
          <option value="retail">Retail</option>
        </select>
        <button className="btn-outline">Filter</button>
      </form>
      <div className="card overflow-x-auto">
        {users.length === 0 ? <Empty>No customers match.</Empty> : (
          <table className="table-x">
            <thead><tr><th>Name</th><th>Type</th><th>Country</th><th>Paid orders</th><th>Joined</th><th>Actions</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className={u.isActive ? "" : "opacity-50"}>
                  <td><p className="font-medium">{u.name}</p><p className="text-xs text-stone">{u.email}{u.phone ? ` · ${u.phone}` : ""}</p></td>
                  <td>
                    {u.accountType === "BUSINESS" ? (
                      <><span className="badge bg-forest/10 text-forest">Business</span>{u.businessVerified && <span className="badge ml-1 bg-emerald-100 text-emerald-800">Verified</span>}<p className="mt-1 text-xs text-stone">{u.companyName}{u.taxId ? ` · ${u.taxId}` : ""}</p></>
                    ) : <span className="badge bg-sand">Retail</span>}
                  </td>
                  <td>{u.country}</td>
                  <td className="tabular-nums">{u._count.orders}</td>
                  <td className="whitespace-nowrap text-stone">{u.createdAt.toLocaleDateString("en-IN")}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {u.accountType === "BUSINESS" && <Act id={u.id} action="verify" label={u.businessVerified ? "Unverify" : "Verify business"} />}
                      <Act id={u.id} action="active" label={u.isActive ? "Disable" : "Enable"} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function Act({ id, action, label }: { id: string; action: string; label: string }) {
  return (
    <form action={updateCustomer}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="action" value={action} />
      <button className="rounded-full border border-ink/15 px-2.5 py-1 text-xs font-medium hover:border-ink/40">{label}</button>
    </form>
  );
}

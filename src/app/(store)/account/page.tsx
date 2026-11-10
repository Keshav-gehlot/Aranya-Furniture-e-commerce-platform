import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { logoutAction } from "@/app/actions/auth";
import { StatusBadge } from "@/components/status-badge";
import { ProfileForm } from "@/components/profile-form";

export const metadata = { title: "My account" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireUser("/account");
  const orders = await db.order.findMany({
    where: { userId: user.id, status: { notIn: ["PENDING_PAYMENT", "EXPIRED", "PAYMENT_FAILED"] } },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { items: true } } },
  });

  return (
    <div className="container-x pb-12 pt-8 lg:pb-24 lg:pt-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{user.accountType === "BUSINESS" ? `Trade account${user.companyName ? ` · ${user.companyName}` : ""}` : "My account"}</p>
          <h1 className="mt-2 t-h1">Hello, {user.name.split(" ")[0]}</h1>
        </div>
        <div className="flex gap-2">
          {user.role !== "CUSTOMER" && <Link href="/admin" className="btn-primary">Admin panel</Link>}
          <form action={logoutAction}><button className="btn-outline">Sign out</button></form>
        </div>
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <h2 className="t-h3">Orders</h2>
          {orders.length === 0 ? (
            <div className="card mt-4 p-10 text-center">
              <p className="text-stone">No orders yet.</p>
              <Link href="/products" className="btn-primary mt-4">Start shopping</Link>
            </div>
          ) : (
            <div className="card mt-4 overflow-x-auto">
              <table className="table-x">
                <thead><tr><th>Order</th><th>Date</th><th>Items</th><th>Status</th><th className="text-right">Total</th></tr></thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td><Link href={`/orders/${o.id}`} className="font-semibold text-forest hover:underline">{o.orderNumber}</Link></td>
                      <td className="text-stone">{o.createdAt.toLocaleDateString("en-IN")}</td>
                      <td>{o._count.items}</td>
                      <td><StatusBadge status={o.status} /></td>
                      <td className="text-right font-medium">{formatMoney(o.total, o.currency as "INR" | "USD")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <section>
          <h2 className="t-h3">Profile</h2>
          <div className="card mt-4 p-6">
            <ProfileForm user={user} />
          </div>
        </section>
      </div>
    </div>
  );
}

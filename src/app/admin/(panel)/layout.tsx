import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { logoutAction } from "@/app/actions/auth";
import { LogoMark } from "@/components/logo";
import { site } from "@/config/site";
import { AdminNav, type NavItem } from "@/components/admin/nav";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: { default: "Admin", template: "%s · Admin" }, robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireStaff();
  const [newEnquiries, toShip, attention] = await Promise.all([
    can(user, "enquiries") ? db.enquiry.count({ where: { status: "NEW" } }) : 0,
    can(user, "orders") ? db.order.count({ where: { status: { in: ["PAID", "PROCESSING"] } } }) : 0,
    can(user, "orders") ? db.order.count({ where: { needsAttention: true } }) : 0,
  ]);
  const all: (NavItem & { perm: Parameters<typeof can>[1] })[] = [
    { href: "/admin", label: "Dashboard", icon: "dashboard", exact: true, perm: "dashboard" },
    { href: "/admin/orders", label: "Orders", icon: "orders", section: "Sales", badge: toShip + attention, perm: "orders" },
    { href: "/admin/products", label: "Products", icon: "products", section: "Catalogue", perm: "products" },
    { href: "/admin/categories", label: "Categories", icon: "categories", perm: "products" },
    { href: "/admin/inventory", label: "Inventory", icon: "inventory", perm: "inventory" },
    { href: "/admin/customers", label: "Customers", icon: "customers", perm: "customers" },
    { href: "/admin/enquiries", label: "Enquiries", icon: "enquiries", badge: newEnquiries, perm: "enquiries" },
    { href: "/admin/settings", label: "Settings", icon: "settings", section: "Store", perm: "settings" },
    { href: "/admin/settings/staff", label: "Staff and access", icon: "staff", perm: "staff" },
    { href: "/admin/settings/audit", label: "Audit log", icon: "audit", perm: "audit" },
  ];
  const items = all.filter((i) => can(user, i.perm)).map(({ perm: _perm, ...i }) => i);

  return (
    <div className="ar-admin min-h-screen lg:flex">
      <aside className="ar-side border-b border-line lg:fixed lg:inset-y-0 lg:flex lg:w-[248px] lg:flex-col lg:border-b-0">
        <div className="ar-side__brand justify-between">
          <Link href="/admin" className="flex items-center gap-3 text-primary" aria-label="Admin dashboard">
            <LogoMark size={28} />
            <span className="text-[15px] text-ink">{site.shortName} admin</span>
          </Link>
          <span className="badge">{user.role === "ADMIN" ? "Admin" : "Staff"}</span>
        </div>
        <AdminNav items={items} />
        <div className="hidden border-t border-line p-4 text-[13px] leading-[18px] text-ink-2 lg:mt-auto lg:block">
          <p className="truncate font-semibold text-ink">{user.name}</p>
          <p className="truncate">{user.email}</p>
          <div className="mt-3 flex gap-4">
            <Link href="/" className="font-semibold hover:text-ink">View store</Link>
            <form action={logoutAction}><button className="font-semibold hover:text-ink">Sign out</button></form>
          </div>
        </div>
      </aside>
      <div className="min-w-0 flex-1 lg:pl-[248px]">
        <div className="mx-auto max-w-admin px-4 py-6 sm:px-6 lg:py-8">{children}</div>
      </div>
    </div>
  );
}

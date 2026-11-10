"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, FolderTree, LayoutDashboard, MessageSquare, Package, ScrollText, Settings, ShieldCheck, ShoppingBag, Store, Users } from "lucide-react";

const icons = {
  dashboard: LayoutDashboard,
  orders: ShoppingBag,
  products: Package,
  categories: FolderTree,
  inventory: Boxes,
  customers: Users,
  enquiries: MessageSquare,
  settings: Settings,
  staff: ShieldCheck,
  audit: ScrollText,
} as const;

export type NavItem = { href: string; label: string; exact?: boolean; badge?: number; icon?: keyof typeof icons; section?: string };

export function AdminNav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  // Most specific match wins, so "/admin/settings/staff" doesn't also highlight "/admin/settings".
  const active = items
    .filter((i) => (i.exact ? path === i.href : path === i.href || path.startsWith(i.href + "/")))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  return (
    <nav className="ar-side__nav flex gap-0.5 overflow-x-auto p-2 lg:flex-col lg:overflow-visible" aria-label="Admin">
      {items.map((i) => {
        const Icon = i.icon ? icons[i.icon] : null;
        return (
          <div key={i.href} className="contents">
            {i.section && <p className="ar-side__section hidden lg:block">{i.section}</p>}
            <Link href={i.href} aria-current={active === i.href ? "page" : undefined}>
              {Icon && <Icon strokeWidth={1.5} aria-hidden />}
              {i.label}
              {!!i.badge && <span className="ar-navcount">{i.badge}</span>}
            </Link>
          </div>
        );
      })}
      <Link href="/" className="lg:!hidden"><Store strokeWidth={1.5} aria-hidden />Store</Link>
    </nav>
  );
}

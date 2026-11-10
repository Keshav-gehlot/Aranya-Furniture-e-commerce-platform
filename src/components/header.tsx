import Link from "next/link";
import { site } from "@/config/site";
import { getCurrentUser } from "@/lib/auth";
import { getBuyMode, getCurrency } from "@/lib/currency";
import { CartButton, HeaderNav, MobileMenu, PricingSwitches } from "./header-client";
import { Logo } from "./logo";
import { User } from "lucide-react";

const links = [
  { href: "/products", label: "Shop" },
  { href: "/trade", label: "Trade & wholesale" },
  { href: "/trade#export", label: "Export" },
  { href: "/contact", label: "Contact" },
];

export async function Header() {
  const [user, currency, mode] = await Promise.all([getCurrentUser(), getCurrency(), getBuyMode()]);
  const accountHref = !user ? "/login" : user.role === "CUSTOMER" ? "/account" : "/admin";
  const accountLabel = !user ? "Sign in" : user.role === "CUSTOMER" ? "My account" : "Admin panel";
  const tel = site.contact.phone.replace(/\s/g, "");

  return (
    <>
      <div className="ar-strip">
        <span>Trade prices from {site.business.defaultMoq} units · GST invoices · Export in USD</span>
        <span className="hidden sm:inline">
          <a href={`tel:${tel}`}>{site.contact.phone}</a> · <Link href="/account">Track an order</Link>
        </span>
      </div>
      <header className="ar-header">
        <div className="ar-header__bar">
          <Link href="/" aria-label={`${site.name} — home`} className="shrink-0">
            <span className="hidden sm:block"><Logo /></span>
            <span className="sm:hidden"><Logo compact /></span>
          </Link>
          <HeaderNav links={links} />
          <div className="ar-header__tools">
            <div className="hidden items-center gap-2 xl:flex">
              <PricingSwitches currency={currency} mode={mode} />
            </div>
            <Link href={accountHref} className="ar-iconbtn hidden sm:inline-grid" aria-label={accountLabel} title={accountLabel}>
              <User size={20} strokeWidth={1.5} aria-hidden />
            </Link>
            <CartButton />
            <MobileMenu links={links} accountHref={accountHref} accountLabel={accountLabel} currency={currency} mode={mode} />
          </div>
        </div>
      </header>
    </>
  );
}

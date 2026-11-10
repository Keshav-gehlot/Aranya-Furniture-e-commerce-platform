"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, ShoppingCart, X } from "lucide-react";
import { useCart } from "./cart-context";

type Currency = "INR" | "USD";
type Mode = "RETAIL" | "BUSINESS";
const setCookie = (k: string, v: string) => (document.cookie = `${k}=${v}; path=/; max-age=31536000; samesite=lax`);

/** Retail ⇄ Business and INR ⇄ USD. A trade buyer sees trade pricing everywhere after one click. */
export function PricingSwitches({ currency, mode }: { currency: Currency; mode: Mode }) {
  const router = useRouter();
  const set = (k: string, v: string) => {
    setCookie(k, v);
    router.refresh();
  };
  return (
    <>
      <div className="ar-seg" role="group" aria-label="Pricing">
        <button type="button" aria-pressed={mode === "RETAIL"} onClick={() => set("buymode", "RETAIL")}>Retail</button>
        <button type="button" aria-pressed={mode === "BUSINESS"} onClick={() => set("buymode", "BUSINESS")}>Business</button>
      </div>
      <div className="ar-seg" role="group" aria-label="Currency">
        <button type="button" aria-pressed={currency === "INR"} onClick={() => set("currency", "INR")}>₹ INR</button>
        <button type="button" aria-pressed={currency === "USD"} onClick={() => set("currency", "USD")}>$ USD</button>
      </div>
    </>
  );
}

export function HeaderNav({ links }: { links: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <nav className="ar-header__nav" aria-label="Main">
      {links.map((l) => {
        const base = l.href.split("#")[0];
        const current = !l.href.includes("#") && (path === base || path.startsWith(base + "/"));
        return (
          <Link key={l.href} href={l.href} aria-current={current ? "page" : undefined}>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function CartButton() {
  const { count, ready } = useCart();
  const n = ready ? count : 0;
  return (
    <Link href="/cart" className="ar-iconbtn" aria-label={n > 0 ? `Cart, ${n} items` : "Cart"}>
      <ShoppingCart size={20} strokeWidth={1.5} aria-hidden />
      {n > 0 && <span className="ar-count">{n > 99 ? "99+" : n}</span>}
    </Link>
  );
}

export function MobileMenu({
  links,
  accountHref,
  accountLabel,
  currency,
  mode,
}: {
  links: { href: string; label: string }[];
  accountHref: string;
  accountLabel: string;
  currency: Currency;
  mode: Mode;
}) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  return (
    <div className="xl:hidden">
      <button type="button" onClick={() => setOpen(!open)} className="ar-iconbtn" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open}>
        {open ? <X size={20} strokeWidth={1.5} aria-hidden /> : <Menu size={20} strokeWidth={1.5} aria-hidden />}
      </button>
      {open && (
        <div className="absolute inset-x-0 top-full border-b border-line bg-page shadow-sm">
          <div className="container-x grid gap-5 py-5">
            <div className="flex flex-wrap gap-3">
              <PricingSwitches currency={currency} mode={mode} />
            </div>
            <nav className="grid lg:hidden" aria-label="Main, mobile" onClick={() => setOpen(false)}>
              {links.map((l) => (
                <Link key={l.href} href={l.href} className="flex min-h-[44px] items-center border-t border-divider text-[17px] font-semibold">
                  {l.label}
                </Link>
              ))}
              <Link href={accountHref} className="flex min-h-[44px] items-center border-t border-divider text-[17px] font-semibold sm:hidden">
                {accountLabel}
              </Link>
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}

import Link from "next/link";
import { site } from "@/config/site";
import { Logo } from "./logo";

export function Footer() {
  const tel = site.contact.phone.replace(/\s/g, "");
  return (
    <footer className="ar-footer">
      <div className="ar-footer__grid">
        <div className="grid content-start gap-5">
          <Logo light />
          <p className="max-w-sm text-[15px] leading-6 text-neutral-300">
            Solid-wood furniture made in our own workshop in Jodhpur. Sold to homes in India, at trade prices to businesses from {site.business.defaultMoq} units, and by the container to importers.
          </p>
        </div>
        <div>
          <h3>Shop</h3>
          <ul>
            <li><Link href="/products">All furniture</Link></li>
            <li><Link href="/cart">Cart</Link></li>
            <li><Link href="/account">Orders and account</Link></li>
          </ul>
        </div>
        <div>
          <h3>Trade and export</h3>
          <ul>
            <li><Link href="/trade">Trade pricing</Link></li>
            <li><Link href="/trade#export">Export orders</Link></li>
            <li><Link href="/register?type=business">Open a trade account</Link></li>
            <li><Link href="/contact?type=BULK">Request a quote</Link></li>
          </ul>
        </div>
        <div>
          <h3>Workshop</h3>
          <ul>
            <li className="text-neutral-300">{site.contact.address}</li>
            <li><a href={`tel:${tel}`}>{site.contact.phone}</a></li>
            <li><a href={`mailto:${site.contact.email}`}>{site.contact.email}</a></li>
            <li className="text-neutral-300">{site.contact.hours}</li>
          </ul>
        </div>
      </div>
      <div className="ar-footer__legal">
        <span>© {new Date().getFullYear()} {site.name}</span>
        <span>INR prices are shown before GST unless marked. Export freight is quoted separately.</span>
      </div>
    </footer>
  );
}

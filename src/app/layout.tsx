import type { Metadata, Viewport } from "next";
import "@fontsource-variable/anek-latin/wdth.css";
import "@fontsource/ibm-plex-sans/latin-400.css";
import "@fontsource/ibm-plex-sans/latin-600.css";
import "@fontsource/ibm-plex-sans/latin-ext-400.css";
import "@fontsource/ibm-plex-sans/latin-ext-600.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "./globals.css";
import { site } from "@/config/site";
import { isStaging, siteUrl } from "@/lib/env";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: `${site.name} — ${site.tagline}`, template: `%s · ${site.name}` },
  description: site.description,
  applicationName: site.name,
  icons: { icon: "/brand/favicon.svg" },
  openGraph: { type: "website", siteName: site.name, title: site.name, description: site.description, locale: "en_IN" },
  twitter: { card: "summary" },
  // A staging deployment must never be indexed.
  robots: isStaging() ? { index: false, follow: false } : undefined,
};
// Rendered per request: on Prisma Compute the settings (staging flag, site URL) exist only at run time.
export const dynamic = "force-dynamic";
export const viewport: Viewport = { themeColor: "#8b1c22", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" suppressHydrationWarning>
      <body className="min-h-screen" suppressHydrationWarning>
        {isStaging() && (
          <p className="bg-warning-subtle px-4 py-2 text-center text-[13px] leading-[18px] text-warning-text" role="note">
            Staging preview. Products, prices and contact details are samples, and payments are simulated: no money moves and no order is fulfilled.
          </p>
        )}
        {children}
      </body>
    </html>
  );
}

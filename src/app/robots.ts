import type { MetadataRoute } from "next";
import { isStaging, siteUrl } from "@/lib/env";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  // Staging is never crawled. In production, keep private and transactional pages out of the index.
  if (isStaging()) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/account", "/checkout", "/orders", "/cart", "/login", "/register", "/invite"] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}

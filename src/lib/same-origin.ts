import "server-only";

/**
 * CSRF guard for state-changing API routes called from our own pages (not webhooks).
 * Browsers always send Origin on cross-site POSTs; we require it to match this site.
 */
export function isSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  const allowed = new Set<string>();
  if (process.env.NEXT_PUBLIC_SITE_URL) allowed.add(new URL(process.env.NEXT_PUBLIC_SITE_URL).origin);
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || new URL(req.url).protocol.replace(":", "");
  if (host) allowed.add(`${proto}://${host}`);
  return allowed.has(origin);
}

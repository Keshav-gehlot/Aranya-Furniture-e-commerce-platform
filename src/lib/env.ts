import "./platform";
/**
 * Reads an optional setting. Secrets Manager placeholders created by Terraform hold "unset"
 * until someone stores the real value, so treat that as missing.
 */
export function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v !== "unset" ? v : undefined;
}

/**
 * A staging deployment (DEPLOYMENT_STAGE=staging): shows a banner on every page, is hidden from
 * search engines, and is the only kind of production build that may use simulated payments.
 */
export const isStaging = () => process.env.DEPLOYMENT_STAGE === "staging";

/** Public origin of this deployment, without a trailing slash. */
export function siteUrl() {
  const explicit = env("NEXT_PUBLIC_SITE_URL");
  if (explicit) return explicit.replace(/\/$/, "");
  // Vercel sets this to the production domain of the project (no protocol).
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  // Prisma Compute: no fixed public URL is known at build time; set NEXT_PUBLIC_SITE_URL once the site has its address.
  return "http://localhost:3000";
}

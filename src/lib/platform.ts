/**
 * Prisma Compute passes the database and the app's settings through the Composer service
 * (src/service.ts), not through environment variables. This module copies them into process.env
 * once, at first import, so the rest of the app reads its settings the same way on every host
 * (Prisma Compute, `prisma dev`, Vercel, Docker, plain `next dev`, tests).
 *
 * Import it for its side effect from any module that reads process.env.
 */
import service from "../service";

function isLocalDatabase(url: string) {
  try {
    return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

function apply() {
  // Composer sets COMPOSER_INPUT for a running service. Anywhere else there is nothing to do.
  if (!process.env.COMPOSER_INPUT) return;
  const set = (name: string, value: string | undefined) => {
    if (value !== undefined && value !== "") process.env[name] = value;
  };
  const { db } = service.load();
  const input = service.input();
  // Queries still run through the Prisma 7 client, which connects with this URL.
  set("DATABASE_URL", db.url);
  // `prisma dev` stands in for the database with a single-session emulator (PGlite): two connections
  // at once share that one session and mix up each other's statements. One connection keeps it correct.
  // Real Prisma Postgres is ordinary PostgreSQL and uses the normal pool.
  if (isLocalDatabase(db.url) && !process.env.DATABASE_POOL_MAX) process.env.DATABASE_POOL_MAX = "1";
  set("JWT_SECRET", input.jwtSecret.expose());
  set("MFA_ENCRYPTION_KEY", input.mfaEncryptionKey.expose());
  set("CRON_SECRET", input.cronSecret.expose());
  set("STORAGE_DRIVER", input.storageDriver);
  set("DEPLOYMENT_STAGE", input.deploymentStage);
  set("ALLOW_DEMO_PAYMENTS", input.allowDemoPayments);
  set("NEXT_PUBLIC_SITE_URL", input.siteUrl);
  // Only read by the first-start bootstrap (src/lib/bootstrap.ts).
  set("ADMIN_EMAIL", input.adminEmail);
  set("ADMIN_PASSWORD", input.adminPassword?.expose());
  set("SEED_SAMPLE_PRODUCTS", input.seedSampleProducts);
}

const g = globalThis as { __platformConfigApplied?: boolean };
if (!g.__platformConfigApplied) {
  g.__platformConfigApplied = true;
  apply();
}

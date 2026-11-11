import "./platform";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * DATABASE_SSL:
 *   "true"    — encrypted and verified against the system CAs (plus NODE_EXTRA_CA_CERTS; the Docker image adds the AWS RDS bundle).
 *               Set DATABASE_CA_CERT to a PEM certificate to verify against that CA instead (e.g. Supabase's root CA).
 *   "require" — encrypted, certificate not verified. For a staging database whose CA is not publicly trusted
 *               and has not been supplied. Do not use for production.
 */
export function sslOptions() {
  const mode = process.env.DATABASE_SSL;
  if (mode === "true") {
    const ca = process.env.DATABASE_CA_CERT?.replace(/\\n/g, "\n");
    return ca ? { rejectUnauthorized: true, ca } : { rejectUnauthorized: true };
  }
  if (mode === "require") return { rejectUnauthorized: false };
  return undefined;
}

function makeClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const adapter = new PrismaPg({
    connectionString,
    ssl: sslOptions(),
    max: Number(process.env.DATABASE_POOL_MAX || (process.env.VERCEL ? 3 : 10)),
    idleTimeoutMillis: process.env.VERCEL ? 5_000 : 30_000,
    connectionTimeoutMillis: 10_000,
  });
  return new PrismaClient({ adapter });
}

const g = globalThis as unknown as { prisma?: PrismaClient };

function client() {
  if (!g.prisma) g.prisma = makeClient();
  return g.prisma;
}

/**
 * The client is created on first use, not on import: `next build` loads every route module,
 * and a build machine (GitHub Actions for Prisma Compute) has no database settings.
 */
export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const real = client();
    const value = Reflect.get(real, prop, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

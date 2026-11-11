import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import { seedStore } from "../src/lib/seed-store.ts";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
const db = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : process.env.DATABASE_SSL === "require" ? { rejectUnauthorized: false } : undefined,
  }),
});

seedStore(db, {
  adminEmail: process.env.ADMIN_EMAIL || "admin@example.com",
  adminPassword: process.env.ADMIN_PASSWORD || (process.env.NODE_ENV === "production" ? "" : "Admin@12345-dev"),
  sampleProducts: process.env.SEED_SAMPLE_PRODUCTS !== "false",
  log: console.log,
})
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

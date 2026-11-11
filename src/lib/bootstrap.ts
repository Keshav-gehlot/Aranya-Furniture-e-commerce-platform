/**
 * First-start bootstrap. Hosts with a shell run `npm run db:seed`. Prisma Compute has no shell,
 * so on start the app creates the first admin account itself, once, when both ADMIN_EMAIL and
 * ADMIN_PASSWORD are set and the database has no admin yet. After that these settings are ignored
 * (changing ADMIN_PASSWORD later does not change anyone's password), and they can be removed.
 */
import "./platform";
import { seedStore } from "./seed-store";

export async function bootstrapStore() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword || !process.env.DATABASE_URL) return;
  try {
    const { db } = await import("./db");
    if ((await db.user.count({ where: { role: "ADMIN" } })) > 0) return;
    await seedStore(db, {
      adminEmail,
      adminPassword,
      sampleProducts: process.env.SEED_SAMPLE_PRODUCTS !== "false",
      log: (line) => console.log(`[bootstrap] ${line}`),
    });
  } catch (e) {
    // Never stop the site from starting: a second instance may have seeded at the same moment,
    // or the database may not be reachable yet. The next start tries again.
    console.error("[bootstrap] first-run setup did not finish:", e instanceof Error ? e.message : e);
  }
}

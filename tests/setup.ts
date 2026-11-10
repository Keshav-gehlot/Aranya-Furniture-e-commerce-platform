// Tests run against a real PostgreSQL database (TEST_DATABASE_URL). The schema is rebuilt from
// the committed migration before the run, so tests also prove the migration works.
import "dotenv/config";
import fs from "fs";
import path from "path";
import { Client } from "pg";
import { beforeAll } from "vitest";

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error("Set TEST_DATABASE_URL to a disposable PostgreSQL database.");
process.env.DATABASE_URL = url;
process.env.JWT_SECRET ||= "test-secret-that-is-at-least-32-characters-long";
process.env.MFA_ENCRYPTION_KEY ||= Buffer.alloc(32, 7).toString("base64");
process.env.RAZORPAY_WEBHOOK_SECRET = "rzp_whsec_test";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret";
process.env.STRIPE_SECRET_KEY = "sk_test_dummy";

let done = false;
beforeAll(async () => {
  if (done) return;
  done = true;
  const c = new Client({ connectionString: url });
  await c.connect();
  await c.query("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;");
  const dir = path.resolve(__dirname, "../prisma/migrations");
  for (const m of fs.readdirSync(dir).filter((d) => fs.statSync(path.join(dir, d)).isDirectory()).sort()) {
    await c.query(fs.readFileSync(path.join(dir, m, "migration.sql"), "utf8"));
  }
  await c.end();
});

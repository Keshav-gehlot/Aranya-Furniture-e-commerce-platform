// Tests run against a real PostgreSQL database (TEST_DATABASE_URL). The schema is rebuilt from
// the committed migrations (migrations/, applied with `prisma db migrate`) before the run,
// so tests also prove the migrations work.
import "dotenv/config";
import { execSync } from "child_process";
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
  // prisma_contract is where Prisma 8 records which migrations a database has had.
  await c.query("DROP SCHEMA IF EXISTS prisma_contract CASCADE; DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;");
  await c.end();
  execSync("npx prisma db migrate", {
    cwd: path.resolve(__dirname, ".."),
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });
});

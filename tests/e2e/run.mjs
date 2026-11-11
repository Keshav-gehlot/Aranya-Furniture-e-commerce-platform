// End-to-end checks against a production build (`next build` first).
// Needs: E2E_DATABASE_URL (disposable PostgreSQL). Starts the app on :3100 and a mock Razorpay API on :4010.
import { spawn, execSync } from "child_process";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import pg from "pg";
import { chromium } from "playwright";
import * as OTPAuth from "otpauth";
import { startMockRazorpay } from "./mock-razorpay.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const BASE = "http://localhost:3100";
const DB = process.env.E2E_DATABASE_URL;
const OUT = path.join(ROOT, "tests/e2e/output");
fs.mkdirSync(OUT, { recursive: true });
if (!DB) throw new Error("Set E2E_DATABASE_URL");

const results = [];
const check = (name, ok, extra = "") => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? ` — ${extra}` : ""}`); };

// 1. fresh database from the committed migrations (migrations/) + seed
const c = new pg.Client({ connectionString: DB });
await c.connect();
await c.query("DROP SCHEMA IF EXISTS prisma_contract CASCADE; DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;");
await c.end();
const env = {
  ...process.env,
  NODE_ENV: "production",
  DATABASE_URL: DB,
  JWT_SECRET: "e2e-secret-that-is-at-least-32-characters-long",
  MFA_ENCRYPTION_KEY: Buffer.alloc(32, 3).toString("base64"),
  CRON_SECRET: "e2e-cron",
  RAZORPAY_KEY_ID: "rzp_test_e2e",
  RAZORPAY_KEY_SECRET: "rzp_e2e_secret",
  RAZORPAY_WEBHOOK_SECRET: "rzp_e2e_webhook",
  PAYMENT_API_OVERRIDE_FOR_TESTS: "true",
  RAZORPAY_API_BASE: "http://127.0.0.1:4010",
  ADMIN_EMAIL: "owner@example.com",
  ADMIN_PASSWORD: "Owner-Password-123",
  UPLOAD_DIR: path.join(OUT, "uploads"),
};
execSync("npx prisma db migrate", { cwd: ROOT, env, stdio: "inherit" });
execSync("npx tsx prisma/seed.ts", { cwd: ROOT, env, stdio: "inherit" });

// 2. servers
const rzp = startMockRazorpay(4010);
const app = spawn("node", [path.join(ROOT, "node_modules/next/dist/bin/next"), "start", "-p", "3100"], { cwd: ROOT, env, stdio: ["ignore", "pipe", "pipe"] });
app.stderr.on("data", (d) => process.stderr.write(`[app] ${d}`));
try {
  await fetch(`${BASE}/api/health`);
  throw new Error("Port 3100 is already in use — stop the other server first.");
} catch (e) {
  if (String(e).includes("already in use")) throw e;
}
for (let i = 0; i < 60; i++) {
  try { if ((await fetch(`${BASE}/api/health`)).ok) break; } catch {}
  await new Promise((r) => setTimeout(r, 500));
}

const browser = await chromium.launch();
const totp = (secret) => new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret) }).generate();

async function signIn(page, email, password) {
  await page.goto(`${BASE}/login`);
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.getByRole("button", { name: "Sign in" }).click();
}
async function enrolMfa(page) {
  await page.waitForURL(/\/admin\/mfa\/setup/);
  await page.getByRole("button", { name: "Show my QR code" }).click();
  const secret = (await page.locator("span.select-all").innerText()).trim();
  await page.fill("#code", totp(secret));
  await page.getByRole("button", { name: "Turn on two-step sign-in" }).click();
  await page.getByText("Save your recovery codes").waitFor();
  return secret;
}

try {
  // ---- platform basics
  const home = await fetch(`${BASE}/`);
  check("security headers on every page", !!home.headers.get("content-security-policy") && home.headers.get("x-frame-options") === "DENY" && !!home.headers.get("strict-transport-security"));
  check("health check", (await fetch(`${BASE}/api/health`)).status === 200);
  check("demo payments are off in production", (await fetch(`${BASE}/api/payments/demo`, { method: "POST" })).status === 404);
  check("cron endpoint needs its secret", (await fetch(`${BASE}/api/cron/release-reservations`, { method: "POST" })).status === 401);
  check("cron endpoint works with its secret", (await fetch(`${BASE}/api/cron/release-reservations`, { method: "POST", headers: { authorization: "Bearer e2e-cron" } })).status === 200);

  // ---- anonymous + customer can't reach admin
  const anon = await (await browser.newContext()).newPage();
  await anon.goto(`${BASE}/admin/orders`);
  check("signed-out visitor is sent to sign-in", anon.url().includes("/login"));

  const custCtx = await browser.newContext();
  const cust = await custCtx.newPage();
  await cust.goto(`${BASE}/register`);
  await cust.fill("#name", "Riya Buyer");
  await cust.fill("#email", "riya@example.com");
  await cust.fill("#password", "Customer-pass-1");
  await cust.getByRole("button", { name: "Create account" }).click();
  await cust.waitForURL(/\/account/);
  await cust.goto(`${BASE}/admin`);
  check("customer cannot open the admin panel", !cust.url().includes("/admin"));
  const up = await cust.evaluate(async () => (await fetch("/api/admin/upload", { method: "POST", body: new FormData() })).status);
  check("customer cannot use the admin upload API", up === 403, `status ${up}`);

  // ---- admin: forced MFA enrolment
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await signIn(admin, "owner@example.com", "Owner-Password-123");
  await admin.waitForURL(/mfa\/setup/);
  await admin.goto(`${BASE}/admin/products`);
  check("admin without MFA is held at MFA setup", admin.url().includes("/admin/mfa/setup"));
  const adminSecret = await enrolMfa(admin);
  await admin.goto(`${BASE}/admin`);
  check("admin reaches dashboard after MFA", (await admin.locator("h1").innerText()) === "Dashboard");

  // second sign-in requires the code
  const admin2 = await (await browser.newContext()).newPage();
  await signIn(admin2, "owner@example.com", "Owner-Password-123");
  await admin2.waitForURL(/login\/mfa/);
  await admin2.fill("#code", "000000");
  await admin2.getByRole("button", { name: "Verify and sign in" }).click();
  await admin2.getByText("That code didn't work").waitFor();
  check("wrong MFA code is refused", admin2.url().includes("/login/mfa"));
  await admin2.fill("#code", totp(adminSecret));
  await admin2.getByRole("button", { name: "Verify and sign in" }).click();
  await admin2.waitForURL(/\/admin$/);
  check("correct MFA code signs in", true);

  // ---- invite a staff member with Orders only
  await admin.goto(`${BASE}/admin/settings/staff`);
  await admin.fill("#inv-name", "Sam Staff");
  await admin.fill("#inv-email", "sam@example.com");
  await admin.locator('input[name="permissions"][value="dashboard"]').uncheck();
  await admin.getByRole("button", { name: "Send invitation" }).click();
  const link = (await admin.locator("p.font-mono").innerText()).trim();
  check("invite link created (email not configured)", link.includes("/invite/"));
  await admin.screenshot({ path: path.join(OUT, "staff.png"), fullPage: true });

  const staffCtx = await browser.newContext();
  const staff = await staffCtx.newPage();
  await staff.goto(link.replace(/^https?:\/\/[^/]+/, BASE));
  await staff.fill("#password", "Staff-password-123");
  await staff.fill("#confirm", "Staff-password-123");
  await staff.getByRole("button", { name: "Create my account" }).click();
  await enrolMfa(staff);
  await staff.goto(`${BASE}/admin`);
  check("staff without dashboard lands on their module", staff.url().includes("/admin/orders"));
  await staff.goto(`${BASE}/admin/products`);
  check("staff blocked from products", staff.url().includes("/admin/forbidden"));
  await staff.goto(`${BASE}/admin/settings/staff`);
  check("staff blocked from staff settings", staff.url().includes("/admin/forbidden"));
  await staff.goto(`${BASE}/admin/orders`);
  const navText = await staff.locator("nav[aria-label=Admin]").innerText();
  check("staff menu shows only granted modules", navText.includes("Orders") && !navText.includes("Products") && !navText.includes("Settings"));
  const staffUpload = await staff.evaluate(async () => (await fetch("/api/admin/upload", { method: "POST", body: new FormData() })).status);
  check("staff without Products cannot upload images", staffUpload === 403);

  // invite link can't be reused
  const reuse = await (await browser.newContext()).newPage();
  await reuse.goto(link.replace(/^https?:\/\/[^/]+/, BASE));
  check("invite link works only once", (await reuse.locator("h1").innerText()).includes("isn't valid"));

  // ---- Razorpay checkout: client-side "success" alone can't mark paid
  const product = await (await fetch(`${BASE}/products/ladder-back-dining-chair`)).text();
  check("product page renders", product.includes("Ladder-Back Dining Chair"));
  const pc = new pg.Client({ connectionString: DB });
  await pc.connect();
  const { rows: [chair] } = await pc.query(`SELECT id, stock FROM "Product" WHERE slug='ladder-back-dining-chair'`);
  const checkout = await cust.evaluate(async (pid) => {
    const r = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkoutKey: crypto.randomUUID(), currency: "INR", items: [{ productId: pid, type: "BUSINESS", qty: 10 }], shipName: "Riya", shipPhone: "9876543210", shipAddress: "12 MG Road", shipCity: "Jaipur", shipPostal: "302001", shipCountry: "India", companyName: "Riya Interiors" }),
    });
    return { status: r.status, body: await r.json() };
  }, chair.id);
  check("checkout creates a Razorpay order", checkout.status === 200 && checkout.body.provider === "RAZORPAY", JSON.stringify(checkout.body).slice(0, 120));
  const rzOrder = checkout.body.razorpay.orderId;
  const { rows: [held] } = await pc.query(`SELECT stock FROM "Product" WHERE id=$1`, [chair.id]);
  check("stock is held during payment", held.stock === chair.stock - 10);

  rzp.pay(rzOrder, "pay_e2e_1");
  const forged = await cust.evaluate(async (o) => (await fetch("/api/payments/razorpay/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ razorpay_order_id: o, razorpay_payment_id: "pay_e2e_1", razorpay_signature: "forged" }) })).status, rzOrder);
  const { rows: [stillPending] } = await pc.query(`SELECT status FROM "Order" WHERE id=$1`, [checkout.body.orderId]);
  check("forged success signature is rejected", forged === 400 && stillPending.status === "PENDING_PAYMENT");

  const xorigin = await fetch(`${BASE}/api/checkout`, { method: "POST", headers: { origin: "https://evil.example", "content-type": "application/json" }, body: "{}" });
  check("cross-site checkout request blocked", xorigin.status === 403);

  const sig = crypto.createHmac("sha256", "rzp_e2e_secret").update(`${rzOrder}|pay_e2e_1`).digest("hex");
  const verified = await cust.evaluate(async ([o, s]) => (await fetch("/api/payments/razorpay/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ razorpay_order_id: o, razorpay_payment_id: "pay_e2e_1", razorpay_signature: s }) })).status, [rzOrder, sig]);
  const { rows: [paid] } = await pc.query(`SELECT status, total FROM "Order" WHERE id=$1`, [checkout.body.orderId]);
  check("genuine signature + Razorpay confirmation marks the order paid", verified === 200 && paid.status === "PAID");

  // webhook replay over HTTP
  const hook = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_e2e_1", order_id: rzOrder, amount: Number(paid.total), currency: "INR", status: "captured" } } } });
  const hsig = crypto.createHmac("sha256", "rzp_e2e_webhook").update(hook).digest("hex");
  const h1 = await fetch(`${BASE}/api/payments/razorpay/webhook`, { method: "POST", body: hook, headers: { "x-razorpay-signature": hsig, "x-razorpay-event-id": "evt_e2e_1" } });
  const h2 = await fetch(`${BASE}/api/payments/razorpay/webhook`, { method: "POST", body: hook, headers: { "x-razorpay-signature": hsig, "x-razorpay-event-id": "evt_e2e_1" } });
  const { rows: [after] } = await pc.query(`SELECT stock FROM "Product" WHERE id=$1`, [chair.id]);
  const { rows: [{ count }] } = await pc.query(`SELECT count(*) FROM "OrderEvent" WHERE "orderId"=$1 AND type='payment_succeeded'`, [checkout.body.orderId]);
  check("webhook after callback + replay: paid once, stock taken once", h1.status === 200 && (await h2.json()).duplicate === true && after.stock === chair.stock - 10 && Number(count) === 1);
  const badHook = await fetch(`${BASE}/api/payments/razorpay/webhook`, { method: "POST", body: hook, headers: { "x-razorpay-signature": "bad", "x-razorpay-event-id": "evt_x" } });
  check("unsigned webhook rejected", badHook.status === 400);

  // ---- staff works the order; admin revokes staff
  await staff.goto(`${BASE}/admin/orders/${checkout.body.orderId}`);
  await staff.selectOption("#status", "PROCESSING");
  await staff.getByRole("button", { name: "Update order" }).click();
  await staff.getByText("Order updated.").waitFor();
  check("staff with Orders can move an order to processing", true);
  const refundVisible = await staff.getByRole("heading", { name: "Refund" }).count();
  check("staff without Refunds sees no refund controls", refundVisible === 0);
  await staff.screenshot({ path: path.join(OUT, "order-staff.png"), fullPage: true });

  await admin.goto(`${BASE}/admin/settings/staff`);
  const row = admin.locator("form", { hasText: "sam@example.com" });
  await row.getByRole("button", { name: "Disable access" }).click();
  await admin.getByText("can no longer sign in").waitFor();
  await staff.goto(`${BASE}/admin/orders`);
  check("disabled staff is signed out immediately", staff.url().includes("/login"));

  // ---- audit trail
  const { rows: audit } = await pc.query(`SELECT action FROM "AuditLog"`);
  const actions = new Set(audit.map((a) => a.action));
  check("audit log records sign-ins, MFA, invites, order changes, revocation",
    ["auth.login", "auth.mfa_enabled", "staff.invited", "staff.invite_accepted", "order.status_changed", "staff.disabled", "auth.mfa_failed"].every((a) => actions.has(a)), [...actions].join(","));
  await admin.goto(`${BASE}/admin/settings/audit`);
  await admin.screenshot({ path: path.join(OUT, "audit.png"), fullPage: true });
  await admin.goto(`${BASE}/admin/orders/${checkout.body.orderId}`);
  await admin.screenshot({ path: path.join(OUT, "order-admin.png"), fullPage: true });
  await pc.end();
} catch (e) {
  console.error(e);
  check("e2e run completed without crashing", false, String(e).slice(0, 200));
} finally {
  await browser.close();
  app.kill();
  rzp.server.close();
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);

import { chromium } from "playwright";
import * as OTPAuth from "otpauth";
// Browser walk-through of the redesigned store: business purchase, simulated payment, admin two-step setup, photo upload.
// Needs a running app on a freshly seeded database: BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD. Screenshots go to tests/e2e/output.
import fs from "fs";
const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = "tests/e2e/output";
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ channel: process.env.PW_CHANNEL || undefined, args: ["--no-sandbox"] });
const results = [];
const check = (name, ok, extra = "") => { results.push(ok); console.log(ok ? "PASS" : "FAIL", name, extra); };
const shot = (p, n, full = true) => p.screenshot({ path: `${OUT}/${n}.png`, fullPage: full });
const errs = [];
const watch = (p, tag) => { p.on("pageerror", (e) => errs.push(tag + " " + e.message.slice(0, 160))); p.on("console", (m) => m.type() === "error" && errs.push(tag + " " + m.text().slice(0, 160))); };

// ---------- customer: product → cart → checkout → simulated payment ----------
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage(); watch(p, "store");
await p.goto(BASE + "/products/ladder-back-dining-chair", { waitUntil: "networkidle" });
check("product page has name, price and trade line", (await p.locator("h1").innerText()).includes("Ladder-Back") && (await p.locator("body").innerText()).includes("Trade price"));
await shot(p, "product");
await p.getByText("As a business").click();
check("business sets quantity to the minimum", (await p.inputValue("#qty")) === "10");
check("CTA says how many", (await p.locator("button.btn-primary").first().innerText()) === "Add 10 to cart");
await p.fill("#qty", "6");
check("below-minimum warning appears", (await p.locator("body").innerText()).includes("Add 4 more to reach the trade minimum"));
check("add is disabled below minimum", await p.locator("button.btn-primary").first().isDisabled());
await p.fill("#qty", "10");
await p.locator("button.btn-primary").first().click();
await p.waitForSelector("text=10 added to your cart");
await p.goto(BASE + "/cart", { waitUntil: "networkidle" });
await p.waitForSelector(".ar-line");
check("cart shows business line and total incl. GST", (await p.locator("body").innerText()).includes("Business price · min 10") && (await p.locator("body").innerText()).includes("Total incl. GST"));
await shot(p, "cart");
// header switch: business mode on listing
await p.goto(BASE + "/products", { waitUntil: "networkidle" });
await p.locator('header .ar-seg button:has-text("Business")').click();
await p.waitForSelector(".ar-pcard__flag");
check("header Business switch shows business prices on cards", (await p.locator(".ar-pcard__flag").count()) === 10);
await p.locator('header .ar-seg button:has-text("$ USD")').click();
await p.waitForFunction(() => document.querySelector(".ar-pcard__price")?.textContent?.includes("$"));
check("currency switch shows USD", true);
await p.locator('header .ar-seg button:has-text("₹ INR")').click();
await p.waitForFunction(() => document.querySelector(".ar-pcard__price")?.textContent?.includes("₹"));
// register as business
const email = `buyer${Date.now()}@example.com`;
await p.goto(BASE + "/register?type=business&next=/checkout", { waitUntil: "networkidle" });
await shot(p, "register");
await p.fill("#name", "Riya Sharma"); await p.fill("#email", email); await p.fill("#phone", "9876543210");
if (await p.locator("#companyName").count()) await p.fill("#companyName", "Riya Interiors");
await p.fill("#password", "Buyer-Pass-2026!");
await p.locator('button:has-text("Create account")').click();
await p.waitForURL("**/checkout**");
await p.waitForSelector("text=Delivery details");
await p.fill('[name="shipAddress"]', "12 MG Road"); await p.fill('[name="shipCity"]', "Jaipur"); await p.fill('[name="shipPostal"]', "302001");
if (!(await p.inputValue('[name="shipPhone"]'))) await p.fill('[name="shipPhone"]', "9876543210");
if (!(await p.inputValue('[name="companyName"]'))) await p.fill('[name="companyName"]', "Riya Interiors");
await shot(p, "checkout");
await p.locator('button:has-text("Pay ")').click();
await p.waitForSelector("text=Complete test payment");
check("staging checkout offers a clearly labelled test payment", (await p.locator("body").innerText()).includes("No money moves"));
await p.locator('button:has-text("Complete test payment")').click();
await p.waitForURL("**/orders/**");
await p.waitForSelector("text=Payment received");
check("order page confirms payment", (await p.locator("body").innerText()).includes("Paid"));
await shot(p, "order");
const orderUrl = p.url();
await p.goto(BASE + "/account", { waitUntil: "networkidle" }); await shot(p, "account");

// a signed-in customer must not reach, or even be shown, the admin panel
const ADMIN_PATHS = ["/admin", "/admin/orders", "/admin/products", "/admin/customers", "/admin/settings", "/admin/settings/staff", "/admin/settings/audit", "/admin/mfa/setup", "/admin/reauth"];
check("customer account page has no link to the admin panel", (await p.locator('a[href^="/admin"]').count()) === 0);
for (const path of ADMIN_PATHS) {
  await p.goto(BASE + path, { waitUntil: "networkidle" });
  const u = new URL(p.url());
  check(`customer is turned away from ${path}`, !u.pathname.startsWith("/admin") && !(await p.locator("body").innerText()).includes("Audit log"), u.pathname);
}
check("customer storefront has no link to the admin panel", (await p.locator('a[href^="/admin"]').count()) === 0);
const upCustomer = await p.evaluate(async () => { const fd = new FormData(); fd.append("files", new Blob(["x"], { type: "image/png" }), "x.png"); return (await fetch("/api/admin/upload", { method: "POST", body: fd })).status; });
check("customer cannot use the admin upload API", upCustomer === 403, String(upCustomer));
await p.goto(BASE + "/", { waitUntil: "networkidle" }); await shot(p, "home");
await p.goto(BASE + "/products", { waitUntil: "networkidle" }); await shot(p, "products");
await p.goto(BASE + "/trade", { waitUntil: "networkidle" }); await shot(p, "trade");
await ctx.close();

// another visitor must not see that order
const anon = await b.newContext(); const ap = await anon.newPage();
const r = await ap.goto(orderUrl); check("a signed-out visitor cannot open someone's order", !ap.url().includes("/orders/") || r.status() === 404, ap.url());
const ar = await ap.goto(BASE + "/admin"); check("admin redirects signed-out visitors to sign-in", ap.url().includes("/login"), ap.url());
for (const path of ADMIN_PATHS.slice(1)) {
  await ap.goto(BASE + path);
  check(`signed-out visitor is sent to sign-in from ${path}`, new URL(ap.url()).pathname === "/login", new URL(ap.url()).pathname);
}
check("signed-out storefront has no link to the admin panel", (await (await ap.goto(BASE + "/"), ap).locator('a[href^="/admin"]').count()) === 0);
const upAnon = await ap.evaluate(async () => { const fd = new FormData(); fd.append("files", new Blob(["x"], { type: "image/png" }), "x.png"); return (await fetch("/api/admin/upload", { method: "POST", body: fd })).status; });
check("signed-out visitor cannot use the admin upload API", upAnon === 403, String(upAnon));
await anon.close();

// ---------- admin: sign in, set up two-step, browse panel ----------
const actx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const a = await actx.newPage(); watch(a, "admin");
await a.goto(BASE + "/login?next=/admin", { waitUntil: "networkidle" });
await shot(a, "login");
await a.fill("#email", process.env.ADMIN_EMAIL || "admin@example.com"); await a.fill("#password", process.env.ADMIN_PASSWORD || "");
await a.locator('button:has-text("Sign in")').click();
await a.waitForURL(/mfa/);
if (a.url().includes("/setup")) {
  await a.locator('button:has-text("Show my QR code")').click();
  await a.waitForSelector(".select-all");
  await shot(a, "mfa-setup");
  const secret = (await a.locator(".select-all").innerText()).trim();
  await a.fill("#code", new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret) }).generate());
  await a.locator('button:has-text("Turn on two-step sign-in")').click();
  await a.waitForSelector("text=Save your recovery codes");
  check("recovery codes are shown once after setup", (await a.locator("ul.font-mono li").count()) >= 8);
  await a.goto(BASE + "/admin", { waitUntil: "networkidle" });
} else { console.log("MFA already set up; cannot continue admin shots without the secret"); }
check("admin dashboard loads", (await a.locator("h1").first().innerText()).length > 0 && a.url().endsWith("/admin"), a.url());
for (const [n, path] of [["admin-dashboard", "/admin"], ["admin-orders", "/admin/orders"], ["admin-products", "/admin/products"], ["admin-product-new", "/admin/products/new"], ["admin-inventory", "/admin/inventory"], ["admin-customers", "/admin/customers"], ["admin-enquiries", "/admin/enquiries"], ["admin-settings", "/admin/settings"], ["admin-staff", "/admin/settings/staff"], ["admin-audit", "/admin/settings/audit"], ["admin-categories", "/admin/categories"]]) {
  const res = await a.goto(BASE + path, { waitUntil: "networkidle" });
  check(`${path} renders`, res.status() === 200 && !a.url().includes("/login") && !a.url().includes("/reauth") , `${res.status()} ${a.url().replace(BASE, "")}`);
  await shot(a, n);
}
// tax details: filled in once by the admin, then shown as the seller on orders
await a.goto(BASE + "/admin/settings", { waitUntil: "networkidle" });
await a.fill("#tax-gstin", "08ABCDE1234F1Z");
await a.locator('button:has-text("Save tax details")').click();
await a.waitForSelector("text=GSTIN must be 15 characters");
check("a malformed GSTIN is refused and what was typed is kept", (await a.inputValue("#tax-gstin")) === "08ABCDE1234F1Z");
await a.fill("#tax-legalName", "Aranya Furniture Co. (sample)"); await a.fill("#tax-gstin", "08abcde1234f1z5"); await a.fill("#tax-hsnCode", "9403");
await a.fill("#tax-address", "Plot 00, Industrial Area\nJodhpur, Rajasthan 342001");
await a.locator('button:has-text("Save tax details")').click();
await a.waitForSelector("text=Tax details saved");
await a.reload({ waitUntil: "networkidle" });
check("tax details are saved and the state is read from the GSTIN", (await a.inputValue("#tax-gstin")) === "08ABCDE1234F1Z5" && (await a.locator("body").innerText()).includes("Registered in Rajasthan (08)"));
await shot(a, "admin-settings-tax");
await a.goto(BASE + "/admin/orders", { waitUntil: "networkidle" });
await a.locator("table a").first().click(); await a.waitForURL(/admin\/orders\/.+/); await a.waitForLoadState("networkidle"); await shot(a, "admin-order");
check("the order shows the seller's tax details", (await a.locator("[data-seller-tax]").innerText()).includes("08ABCDE1234F1Z5") && (await a.locator("[data-seller-tax]").innerText()).includes("9403"));
// image upload through the database driver
await a.goto(BASE + "/admin/products", { waitUntil: "networkidle" });
await a.locator("table a").first().click(); await a.waitForURL(/admin\/products\/.+/); await a.waitForLoadState("networkidle");
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
await a.setInputFiles('input[type="file"]', { name: "photo.png", mimeType: "image/png", buffer: png });
await a.waitForSelector('img[src^="/api/uploads/"]', { timeout: 15000 });
const src = await a.locator('img[src^="/api/uploads/"]').first().getAttribute("src");
const img = await a.request.get(BASE + src);
check("uploaded photo is stored and served back", img.status() === 200 && img.headers()["content-type"] === "image/png" && (await img.body()).equals(png), src);
await shot(a, "admin-product-edit");
await actx.close();

// mobile
const m = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const mp = await m.newPage(); watch(mp, "mobile");
for (const [n, path] of [["m-product", "/products/ladder-back-dining-chair"], ["m-products", "/products"], ["m-trade", "/trade"]]) {
  await mp.goto(BASE + path, { waitUntil: "networkidle" });
  const o = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(`${path} has no sideways scroll at 390px`, o <= 0, "overflow " + o);
  await shot(mp, n, false);
}
await m.close();
await b.close();
console.log(errs.length ? "CONSOLE ERRORS:\n" + [...new Set(errs)].join("\n") : "no console errors");
console.log(`${results.filter(Boolean).length}/${results.length} checks passed`);
process.exit(results.every(Boolean) && !errs.length ? 0 : 1);

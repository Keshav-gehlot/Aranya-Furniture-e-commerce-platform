// Guards against the most common access-control bug: a new admin page, action or API route
// that forgets the server-side permission check. Fails the build if one is missing.
import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../src/app");
const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));

describe("authorization coverage", () => {
  it("every exported admin server action checks permission first", () => {
    for (const file of ["actions/admin.ts", "actions/admin-settings.ts"]) {
      const src = fs.readFileSync(path.join(root, file), "utf8");
      const fns = [...src.matchAll(/export async function (\w+)\([^)]*\)[^{]*\{([\s\S]*?)\n\}/g)];
      expect(fns.length).toBeGreaterThan(3);
      for (const [, name, body] of fns) {
        const firstAwait = body.split("\n").find((l) => l.includes("await "));
        expect(firstAwait, `${file} ${name}`).toMatch(/await (requirePermission|requireRecentMfa)\(/);
      }
    }
  });

  it("every admin panel page checks permission or staff status", () => {
    const pages = walk(path.join(root, "admin")).filter((f) => f.endsWith("page.tsx"));
    expect(pages.length).toBeGreaterThan(10);
    for (const p of pages) {
      expect(fs.readFileSync(p, "utf8"), p).toMatch(/await (requirePermission|requireStaff)\(/);
    }
  });

  it("every admin API route checks permission", () => {
    const routes = walk(path.join(root, "api/admin")).filter((f) => f.endsWith("route.ts"));
    for (const r of routes) expect(fs.readFileSync(r, "utf8"), r).toMatch(/apiPermission\(/);
  });

  it("payment webhooks verify signatures before doing anything", () => {
    const rzp = fs.readFileSync(path.join(root, "api/payments/razorpay/webhook/route.ts"), "utf8");
    expect(rzp.indexOf("verifyRazorpayWebhook")).toBeLessThan(rzp.indexOf("JSON.parse"));
    const stripe = fs.readFileSync(path.join(root, "api/payments/stripe/webhook/route.ts"), "utf8");
    expect(stripe).toMatch(/constructEvent\(raw/);
  });

  it("public registration can only create CUSTOMER accounts", () => {
    const src = fs.readFileSync(path.join(root, "actions/auth.ts"), "utf8");
    const reg = src.slice(src.indexOf("export async function registerAction"), src.indexOf("// ------", src.indexOf("export async function registerAction")));
    expect(reg).toContain('role: "CUSTOMER"');
    expect(reg).not.toMatch(/fd\.get\("role"\)/);
  });
});

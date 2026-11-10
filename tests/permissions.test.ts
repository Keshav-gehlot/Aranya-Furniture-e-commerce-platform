import { describe, expect, it } from "vitest";
import { can, sanitizePermissions } from "@/lib/permissions";

const admin = { role: "ADMIN", permissions: [] };
const staffOrders = { role: "STAFF", permissions: ["orders"] };
const customer = { role: "CUSTOMER", permissions: ["orders", "settings"] };

describe("role-based permissions", () => {
  it("gives ADMIN everything", () => {
    for (const p of ["dashboard", "orders", "refunds", "settings", "staff", "audit"] as const) expect(can(admin, p)).toBe(true);
  });
  it("limits STAFF to granted modules and never admin-only ones", () => {
    expect(can(staffOrders, "orders")).toBe(true);
    expect(can(staffOrders, "products")).toBe(false);
    expect(can(staffOrders, "refunds")).toBe(false);
    expect(can({ role: "STAFF", permissions: ["settings", "staff", "audit"] }, "settings")).toBe(false);
    expect(can({ role: "STAFF", permissions: ["settings", "staff", "audit"] }, "staff")).toBe(false);
  });
  it("gives customers nothing, even with stray permission data", () => {
    expect(can(customer, "orders")).toBe(false);
    expect(can(customer, "settings")).toBe(false);
    expect(can(null, "dashboard")).toBe(false);
  });
  it("denies disabled accounts", () => {
    expect(can({ ...admin, isActive: false }, "dashboard")).toBe(false);
  });
  it("drops unknown and admin-only permissions when saving staff access", () => {
    expect(sanitizePermissions(["orders", "orders", "settings", "staff", "hack", 5])).toEqual(["orders"]);
  });
});

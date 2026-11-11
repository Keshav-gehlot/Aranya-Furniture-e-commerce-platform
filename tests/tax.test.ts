import { describe, expect, it } from "vitest";
import { taxSchema, gstinState } from "@/lib/tax-rules";
import { getTaxSettings, saveTaxSettings } from "@/lib/tax";
import { db } from "@/lib/db";

const blank = { legalName: "", gstin: "", pan: "", address: "", iec: "", hsnCode: "", invoiceNote: "" };
const parse = (v: Partial<typeof blank>) => taxSchema.safeParse({ ...blank, ...v });

describe("seller tax details", () => {
  it("accepts everything empty: every field is optional", () => {
    expect(parse({}).success).toBe(true);
  });

  it("tidies what was typed and reads the state from the GSTIN", () => {
    const r = parse({ gstin: " 08abcde1234f1z5 ", pan: "abcde1234f", hsnCode: "9403" });
    expect(r.success && r.data.gstin).toBe("08ABCDE1234F1Z5");
    expect(r.success && r.data.pan).toBe("ABCDE1234F");
    expect(gstinState("08ABCDE1234F1Z5")).toBe("Rajasthan (08)");
    expect(gstinState("99ABCDE1234F1Z5")).toBeNull();
  });

  it("refuses a malformed GSTIN, an unknown state code, a PAN that does not match, and a bad HSN code", () => {
    expect(parse({ gstin: "08ABCDE1234F1Z" }).success).toBe(false);
    expect(parse({ gstin: "99ABCDE1234F1Z5" }).success).toBe(false);
    expect(parse({ gstin: "08ABCDE1234F1Z5", pan: "ZZZZZ9999Z" }).success).toBe(false);
    expect(parse({ hsnCode: "94A3" }).success).toBe(false);
    expect(parse({ hsnCode: "94031" }).success).toBe(false);
    expect(parse({ iec: "123" }).success).toBe(false);
  });

  it("saves one row and overwrites it on the next save", async () => {
    const admin = await db.user.create({ data: { name: "Tax Admin", email: `tax${Date.now()}@example.com`, passwordHash: "x", role: "ADMIN" } });
    const first = parse({ legalName: "Aranya Furniture Co.", gstin: "08ABCDE1234F1Z5", hsnCode: "9403" });
    if (!first.success) throw new Error("fixture");
    await saveTaxSettings(first.data, admin.id);
    const second = parse({ legalName: "Aranya Exports LLP", gstin: "08ABCDE1234F1Z5", iec: "ABCDE1234F" });
    if (!second.success) throw new Error("fixture");
    await saveTaxSettings(second.data, admin.id);
    const rows = await db.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM "TaxSettings"`;
    expect(Number(rows[0].n)).toBe(1);
    const row = await db.$queryRaw<{ legalName: string; hsnCode: string | null; iec: string }[]>`SELECT "legalName", "hsnCode", "iec" FROM "TaxSettings"`;
    expect(row[0]).toEqual({ legalName: "Aranya Exports LLP", hsnCode: null, iec: "ABCDE1234F" });
    expect((await getTaxSettings()).legalName).toBeTruthy();
  });
});

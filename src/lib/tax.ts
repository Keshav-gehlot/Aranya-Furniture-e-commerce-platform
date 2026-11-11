import "server-only";
import { cache } from "react";
import { db } from "./db";
import type { TaxInput } from "./tax-rules";

export type TaxSettings = {
  legalName: string | null;
  gstin: string | null;
  pan: string | null;
  address: string | null;
  iec: string | null;
  hsnCode: string | null;
  invoiceNote: string | null;
};

const EMPTY: TaxSettings = { legalName: null, gstin: null, pan: null, address: null, iec: null, hsnCode: null, invoiceNote: null };

/**
 * The seller's tax details (single row, filled in Admin → Settings). Cached per request.
 * Uses SQL because the Prisma 7 client was generated before the TaxSettings table existed.
 * A database that has not had the tax_settings migration yet reads as "nothing filled in".
 */
export const getTaxSettings = cache(async (): Promise<TaxSettings> => {
  try {
    const rows = await db.$queryRaw<TaxSettings[]>`
      SELECT "legalName", "gstin", "pan", "address", "iec", "hsnCode", "invoiceNote" FROM "TaxSettings" WHERE "id" = 1`;
    return rows[0] ?? EMPTY;
  } catch (e) {
    if (String((e as { message?: string }).message).includes("42P01")) return EMPTY;
    throw e;
  }
});

export async function saveTaxSettings(v: TaxInput, userId: string) {
  const n = (s: string) => (s === "" ? null : s);
  await db.$executeRaw`
    INSERT INTO "TaxSettings" ("id", "legalName", "gstin", "pan", "address", "iec", "hsnCode", "invoiceNote", "updatedAt", "updatedById")
    VALUES (1, ${n(v.legalName)}, ${n(v.gstin)}, ${n(v.pan)}, ${n(v.address)}, ${n(v.iec)}, ${n(v.hsnCode)}, ${n(v.invoiceNote)}, now(), ${userId})
    ON CONFLICT ("id") DO UPDATE SET
      "legalName" = EXCLUDED."legalName", "gstin" = EXCLUDED."gstin", "pan" = EXCLUDED."pan", "address" = EXCLUDED."address",
      "iec" = EXCLUDED."iec", "hsnCode" = EXCLUDED."hsnCode", "invoiceNote" = EXCLUDED."invoiceNote",
      "updatedAt" = now(), "updatedById" = EXCLUDED."updatedById"`;
}

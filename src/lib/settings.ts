import "server-only";
import { cache } from "react";
import { db } from "./db";

export type Settings = {
  gstRateBps: number;
  domesticShipping: number;
  domesticFreeShippingOver: number;
  exportHandling: number;
  defaultMoq: number;
  reservationMinutes: number;
  notifyEmail: string | null;
};

/** Store settings (single row). Created with defaults on first read. Cached per request. */
export const getSettings = cache(async (): Promise<Settings> => {
  const s = await db.storeSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  return s;
});

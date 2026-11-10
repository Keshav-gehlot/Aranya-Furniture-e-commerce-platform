import "server-only";
import { cookies } from "next/headers";
import type { Currency } from "@/config/site";

export async function getCurrency(): Promise<Currency> {
  const c = (await cookies()).get("currency")?.value;
  return c === "USD" ? "USD" : "INR";
}

export type BuyMode = "RETAIL" | "BUSINESS";
/** Header switch: show retail prices or trade (business) prices across listings. */
export async function getBuyMode(): Promise<BuyMode> {
  return (await cookies()).get("buymode")?.value === "BUSINESS" ? "BUSINESS" : "RETAIL";
}

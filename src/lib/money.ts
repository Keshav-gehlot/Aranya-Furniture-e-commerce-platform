import type { Currency } from "@/config/site";

/** Format an amount stored in the smallest unit (paise/cents). */
export function formatMoney(minor: number, currency: Currency) {
  const value = minor / 100;
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

/** Parse a user-entered major-unit amount ("1499.50") into minor units. */
export function toMinor(major: string | number) {
  const n = typeof major === "number" ? major : parseFloat(String(major).replace(/,/g, ""));
  if (!isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

export function toMajor(minor: number) {
  return (minor / 100).toString();
}

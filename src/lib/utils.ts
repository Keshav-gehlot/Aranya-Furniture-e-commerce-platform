export function slugify(s: string) {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function orderNumber() {
  const d = new Date();
  const stamp = `${d.getFullYear().toString().slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `ORD-${stamp}-${rand}`;
}

export function cn(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export const ENQUIRY_TYPES = ["EXPORT", "DOMESTIC", "BULK", "CUSTOM", "GENERAL"] as const;
export const ENQUIRY_STATUSES = ["NEW", "IN_PROGRESS", "CLOSED"] as const;

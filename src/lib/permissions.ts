/** Admin modules that can be granted to STAFF. ADMIN always has all of these plus the admin-only ones. */
export const STAFF_PERMISSIONS = {
  dashboard: "Dashboard",
  products: "Products & categories",
  inventory: "Inventory",
  orders: "Orders & fulfilment",
  refunds: "Refunds & cancellations",
  customers: "Customers",
  enquiries: "Enquiries",
} as const;

/** Only ADMIN can use these. */
export const ADMIN_ONLY = {
  settings: "Store settings",
  staff: "Staff & access",
  audit: "Audit log",
} as const;

export type StaffPermission = keyof typeof STAFF_PERMISSIONS;
export type Permission = StaffPermission | keyof typeof ADMIN_ONLY;

export function isPrivileged(role: string) {
  return role === "ADMIN" || role === "STAFF";
}

export function can(user: { role: string; permissions: string[]; isActive?: boolean } | null | undefined, perm: Permission) {
  if (!user || user.isActive === false) return false;
  if (user.role === "ADMIN") return true;
  if (user.role !== "STAFF") return false;
  if (perm in ADMIN_ONLY) return false;
  return user.permissions.includes(perm);
}

export function sanitizePermissions(input: unknown): StaffPermission[] {
  const list = Array.isArray(input) ? input : [];
  return [...new Set(list.filter((p): p is StaffPermission => typeof p === "string" && p in STAFF_PERMISSIONS))];
}

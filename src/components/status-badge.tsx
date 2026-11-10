import { AlertCircle, Check, Clock, PackageCheck, RotateCcw, Truck, X } from "lucide-react";

/** Every status has a colour, a word and an icon, so it never relies on colour alone. */
const map: Record<string, { tone: string; label: string; Icon: typeof Check }> = {
  PENDING_PAYMENT: { tone: "ar-badge--warning", label: "Pending payment", Icon: Clock },
  PAYMENT_FAILED: { tone: "ar-badge--danger", label: "Payment failed", Icon: AlertCircle },
  FAILED: { tone: "ar-badge--danger", label: "Failed", Icon: AlertCircle },
  EXPIRED: { tone: "", label: "Expired", Icon: Clock },
  REFUNDED: { tone: "ar-badge--info", label: "Refunded", Icon: RotateCcw },
  PAID: { tone: "ar-badge--success", label: "Paid", Icon: Check },
  PROCESSING: { tone: "ar-badge--info", label: "Processing", Icon: PackageCheck },
  SHIPPED: { tone: "ar-badge--info", label: "Shipped", Icon: Truck },
  DELIVERED: { tone: "ar-badge--success", label: "Delivered", Icon: Check },
  CANCELLED: { tone: "", label: "Cancelled", Icon: X },
  NEW: { tone: "ar-badge--brand", label: "New", Icon: AlertCircle },
  IN_PROGRESS: { tone: "ar-badge--info", label: "In progress", Icon: Clock },
  CLOSED: { tone: "", label: "Closed", Icon: Check },
};

export function StatusBadge({ status }: { status: string }) {
  const m = map[status];
  const label = m?.label ?? status.replaceAll("_", " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());
  const Icon = m?.Icon;
  return (
    <span className={`badge ${m?.tone ?? ""}`}>
      {Icon && <Icon size={14} strokeWidth={1.5} aria-hidden />}
      {label}
    </span>
  );
}

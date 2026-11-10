import { site } from "@/config/site";

/** Growth-rings mark: an off-centre heartwood with four rings, as in a cut log. */
export function LogoMark({ size = 36, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" stroke="currentColor" aria-hidden className={className}>
      <circle cx="20" cy="20" r="18.5" strokeWidth="1.8" />
      <ellipse cx="18.6" cy="20.6" rx="13.6" ry="13.2" strokeWidth="1.6" />
      <ellipse cx="17.2" cy="21.2" rx="9" ry="8.6" strokeWidth="1.6" />
      <ellipse cx="16" cy="21.8" rx="4.8" ry="4.5" strokeWidth="1.6" />
      <circle cx="15.2" cy="22.2" r="1.7" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function Logo({ light = false, compact = false }: { light?: boolean; compact?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-3 ${light ? "text-white" : "text-primary"}`}>
      <LogoMark size={compact ? 28 : 36} />
      <span className="grid leading-none">
        <span className="text-[20px] font-semibold uppercase tracking-[0.2em]" style={{ fontStretch: "110%" }}>{site.shortName}</span>
        {!compact && <span className="mt-1 text-[9px] font-semibold uppercase tracking-[0.22em] opacity-80">Furniture Co. · Jodhpur</span>}
      </span>
    </span>
  );
}

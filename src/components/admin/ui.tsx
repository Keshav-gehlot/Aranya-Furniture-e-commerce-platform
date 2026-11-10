export function PageHeader({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1>{title}</h1>
        {sub && <p className="mt-1 text-sm text-ink-2">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: string; tone?: "warn" }) {
  return (
    <div className="card ar-stat">
      <p className="ar-stat__label">{label}</p>
      <p className={`ar-stat__value ${tone === "warn" ? "text-warning-text" : ""}`}>{value}</p>
      {hint && <p className="ar-stat__trend">{hint}</p>}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-12 text-center text-sm text-ink-2">{children}</div>;
}

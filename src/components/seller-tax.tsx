import type { TaxSettings } from "@/lib/tax";
import { gstinState } from "@/lib/tax-rules";

/** The seller's tax details on an order: what a GST invoice has to carry. Renders nothing until they are filled in. */
export function SellerTax({ tax, currency }: { tax: TaxSettings; currency: "INR" | "USD" }) {
  if (!tax.legalName && !tax.gstin) return null;
  const rows: [string, string | null][] = [
    ["GSTIN", tax.gstin],
    ["Place of supply from", gstinState(tax.gstin)],
    ["PAN", tax.pan],
    ["IEC", currency === "USD" ? tax.iec : null],
    ["HSN code", tax.hsnCode],
  ];
  return (
    <div data-seller-tax>
      <p className="label mt-4">Sold by</p>
      {tax.legalName && <p>{tax.legalName}</p>}
      {tax.address && <p className="whitespace-pre-line text-ink-2">{tax.address}</p>}
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        {rows.filter(([, v]) => v).map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-ink-2">{k}</dt>
            <dd className={k === "Place of supply from" ? "" : "ar-mono"}>{v}</dd>
          </div>
        ))}
      </dl>
      {tax.invoiceNote && <p className="mt-2 text-sm text-ink-2">{tax.invoiceNote}</p>}
    </div>
  );
}

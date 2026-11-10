"use client";
import { useActionState } from "react";
import { submitEnquiry } from "@/app/actions/enquiry";
import { COUNTRIES } from "@/lib/countries";

const TYPES = [
  { v: "EXPORT", l: "Export order" },
  { v: "DOMESTIC", l: "Domestic order (India)" },
  { v: "BULK", l: "Bulk / wholesale pricing" },
  { v: "CUSTOM", l: "Custom design or finish" },
  { v: "GENERAL", l: "General question" },
];

export function EnquiryForm({
  productId,
  productName,
  defaultType = "GENERAL",
  defaultQty,
  compact = false,
}: {
  productId?: string;
  productName?: string;
  defaultType?: string;
  defaultQty?: number;
  compact?: boolean;
}) {
  const [state, action, pending] = useActionState(submitEnquiry, undefined);
  if (state?.ok) {
    return (
      <div className="ar-alert ar-alert--success" role="status">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 6 9 17l-5-5" /></svg>
        <div>
          <p className="ar-alert__title">We have your enquiry</p>
          <p>Our sales team replies within one working day.</p>
        </div>
      </div>
    );
  }
  return (
    <form action={action} className="grid gap-5">
      {productId && <input type="hidden" name="productId" value={productId} />}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      {productName && (
        <p className="rounded-sm bg-sunken px-4 py-3 text-[15px]">
          Enquiring about <strong className="font-semibold">{productName}</strong>
        </p>
      )}
      <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="eq-name">Name</label>
          <input id="eq-name" name="name" className="input" required />
        </div>
        <div>
          <label className="label" htmlFor="eq-email">Email</label>
          <input id="eq-email" name="email" type="email" className="input" required />
        </div>
        <div>
          <label className="label" htmlFor="eq-phone">Phone or WhatsApp <span className="font-normal text-ink-3">(optional)</span></label>
          <input id="eq-phone" name="phone" type="tel" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="eq-company">Company <span className="font-normal text-ink-3">(optional)</span></label>
          <input id="eq-company" name="company" className="input" />
        </div>
        {!compact && (
          <div>
            <label className="label" htmlFor="eq-country">Country</label>
            <select id="eq-country" name="country" className="input" defaultValue="India">
              {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="label" htmlFor="eq-type">What is it about?</label>
          <select id="eq-type" name="type" className="input" defaultValue={defaultType}>
            {TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
          </select>
        </div>
        {(productId || !compact) && (
          <div>
            <label className="label" htmlFor="eq-qty">Approximate quantity</label>
            <input id="eq-qty" name="quantity" type="number" min={0} className="input" defaultValue={defaultQty} />
          </div>
        )}
      </div>
      <div>
        <label className="label" htmlFor="eq-msg">Message</label>
        <textarea id="eq-msg" name="message" rows={compact ? 3 : 5} className="input" required placeholder="Products, quantities, destination city or port, and when you need them." />
      </div>
      {state?.error && <p className="ar-error" role="alert">{state.error}</p>}
      <div><button className="btn-primary ar-btn--l" disabled={pending}>{pending ? "Sending…" : "Send enquiry"}</button></div>
    </form>
  );
}

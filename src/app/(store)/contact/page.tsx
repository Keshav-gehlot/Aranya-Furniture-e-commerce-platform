import { site } from "@/config/site";
import { EnquiryForm } from "@/components/enquiry-form";

export const metadata = {
  title: "Contact and quotes",
  description: "Ask for bulk pricing, a custom size or finish, or an export quote. The sales team replies within one working day.",
  alternates: { canonical: "/contact" },
};

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type } = await searchParams;
  const valid = ["EXPORT", "DOMESTIC", "BULK", "CUSTOM", "GENERAL"];
  const tel = site.contact.phone.replace(/\s/g, "");
  return (
    <div className="container-x pb-12 pt-8 lg:pb-24 lg:pt-16">
      <div className="grid gap-x-6 gap-y-10 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <h1 className="t-h1 max-w-[14ch]">Talk to the sales team</h1>
          <p className="t-body-l mt-5 max-w-text text-ink-2">
            One room, a hotel fit-out or a container. Tell us the products, the quantity and where it is going, and we reply with pricing within one working day.
          </p>
          <table className="ar-spec mt-10">
            <tbody>
              <tr><th scope="row">Phone</th><td><a className="ar-link" href={`tel:${tel}`}>{site.contact.phone}</a></td></tr>
              <tr><th scope="row">Email</th><td><a className="ar-link" href={`mailto:${site.contact.email}`}>{site.contact.email}</a></td></tr>
              <tr><th scope="row">WhatsApp</th><td><a className="ar-link" href={`https://wa.me/${site.contact.whatsapp}`} target="_blank" rel="noreferrer">Message the workshop</a></td></tr>
              <tr><th scope="row">Workshop and showroom</th><td>{site.contact.address}</td></tr>
              <tr><th scope="row">Hours</th><td>{site.contact.hours}</td></tr>
            </tbody>
          </table>
        </div>
        <div className="rounded-md bg-sunken p-5 sm:p-8 lg:col-span-6 lg:col-start-7">
          <h2 className="t-h3">Send an enquiry</h2>
          <div className="mt-6">
            <EnquiryForm defaultType={type && valid.includes(type) ? type : "GENERAL"} />
          </div>
        </div>
      </div>
    </div>
  );
}

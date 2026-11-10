/**
 * ─────────────────────────────────────────────────────────────
 *  BRANDING & BUSINESS SETTINGS — edit this one file to rebrand.
 * ─────────────────────────────────────────────────────────────
 */
export const site = {
  name: "Aranya Furniture Co.",
  shortName: "Aranya",
  tagline: "Solid-wood furniture, built in Jodhpur",
  description:
    "Sheesham, mango and acacia furniture made in our own workshop in Jodhpur. Retail in INR, trade prices from 10 units with GST invoices, and container-load export in USD.",
  contact: {
    email: "sales@example.com",
    phone: "+91 98765 43210",
    whatsapp: "919876543210", // digits only, with country code
    address: "Plot 00, Industrial Area, Jodhpur, Rajasthan 342001, India",
    hours: "Mon–Sat, 10:00–19:00 IST",
  },
  social: {
    instagram: "",
    linkedin: "",
  },
  business: {
    /** Default minimum order quantity for business (wholesale) purchases. */
    defaultMoq: 10,
    /** Require a company name at checkout when the cart has business items. */
    requireCompanyForBusiness: true,
  },
  pricing: {
    /** GST applied to INR (domestic) orders. Export (USD) orders are zero-rated. */
    gstRate: 0.18,
    /** Domestic shipping (paise). Free above the threshold. */
    domesticShipping: 150000, // ₹1,500
    domesticFreeShippingOver: 5000000, // ₹50,000
    /** Export freight is quoted separately; flat handling fee in cents. */
    exportHandling: 0,
  },
};

export type Currency = "INR" | "USD";

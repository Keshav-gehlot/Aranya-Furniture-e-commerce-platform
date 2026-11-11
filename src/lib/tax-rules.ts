/** Format rules for the seller's Indian tax details. No database access: safe to use anywhere. */
import { z } from "zod";

/** GST state codes: the first two digits of a GSTIN. */
export const GST_STATES: Record<string, string> = {
  "01": "Jammu and Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh", "05": "Uttarakhand",
  "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh", "10": "Bihar", "11": "Sikkim",
  "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur", "15": "Mizoram", "16": "Tripura", "17": "Meghalaya",
  "18": "Assam", "19": "West Bengal", "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh",
  "24": "Gujarat", "26": "Dadra and Nagar Haveli and Daman and Diu", "27": "Maharashtra", "29": "Karnataka", "30": "Goa",
  "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry", "35": "Andaman and Nicobar Islands",
  "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh",
};

/** "Rajasthan (08)" for a valid GSTIN, otherwise null. */
export function gstinState(gstin?: string | null) {
  const code = gstin?.slice(0, 2);
  return code && GST_STATES[code] ? `${GST_STATES[code]} (${code})` : null;
}

const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

/** Uppercase and strip spaces, so "08 abcde 1234 f 1 z 5" is accepted as typed. */
const code = (max: number) => z.string().max(max + 10).transform((s) => s.replace(/\s+/g, "").toUpperCase());
const text = (max: number) => z.string().trim().max(max, `Keep this under ${max} characters.`);

/** Every field is optional: an empty field is stored as "not set". */
export const taxSchema = z
  .object({
    legalName: text(160),
    gstin: code(15).refine((v) => v === "" || (GSTIN.test(v) && !!GST_STATES[v.slice(0, 2)]), "GSTIN must be 15 characters, like 08ABCDE1234F1Z5, starting with a valid state code."),
    pan: code(10).refine((v) => v === "" || PAN.test(v), "PAN must be 10 characters, like ABCDE1234F."),
    address: text(400),
    iec: code(10).refine((v) => v === "" || /^[A-Z0-9]{10}$/.test(v), "IEC must be 10 letters or digits."),
    hsnCode: code(8).refine((v) => v === "" || /^[0-9]{4}([0-9]{2}){0,2}$/.test(v), "HSN code must be 4, 6 or 8 digits."),
    invoiceNote: text(300),
  })
  .refine((v) => !v.gstin || !v.pan || v.gstin.slice(2, 12) === v.pan, { message: "PAN does not match the GSTIN: characters 3 to 12 of a GSTIN are the PAN.", path: ["pan"] });

export type TaxInput = z.infer<typeof taxSchema>;

"use server";
import { z } from "zod";
import { db } from "@/lib/db";
import { notify } from "@/lib/notify";
import { ENQUIRY_TYPES } from "@/lib/utils";

export type EnquiryState = { error?: string; ok?: boolean } | undefined;

const schema = z.object({
  name: z.string().trim().min(2, "Please enter your name."),
  email: z.string().trim().email("Please enter a valid email."),
  phone: z.string().trim().max(30).optional(),
  company: z.string().trim().max(120).optional(),
  country: z.string().trim().max(60).optional(),
  type: z.enum(ENQUIRY_TYPES).default("GENERAL"),
  productId: z.string().optional(),
  quantity: z.coerce.number().int().min(0).max(1_000_000).optional(),
  message: z.string().trim().min(10, "Tell us a little more (at least 10 characters).").max(5000),
  website: z.string().optional(), // honeypot
});

export async function submitEnquiry(_: EnquiryState, fd: FormData): Promise<EnquiryState> {
  const raw = Object.fromEntries([...fd.entries()].filter(([, v]) => v !== ""));
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;
  if (v.website) return { ok: true }; // bot
  let productId: string | null = null;
  if (v.productId) {
    const p = await db.product.findUnique({ where: { id: v.productId }, select: { id: true } });
    productId = p?.id ?? null;
  }
  const e = await db.enquiry.create({
    data: {
      name: v.name,
      email: v.email,
      phone: v.phone || null,
      company: v.company || null,
      country: v.country || null,
      type: v.type,
      productId,
      quantity: v.quantity || null,
      message: v.message,
    },
  });
  notify(
    `New ${v.type.toLowerCase()} enquiry from ${v.name}`,
    `${v.name} <${v.email}> ${v.phone ?? ""}\nCompany: ${v.company ?? "-"} · Country: ${v.country ?? "-"}\nQty: ${v.quantity ?? "-"}\n\n${v.message}\n\nEnquiry ID: ${e.id}`,
  ).catch(() => {});
  return { ok: true };
}

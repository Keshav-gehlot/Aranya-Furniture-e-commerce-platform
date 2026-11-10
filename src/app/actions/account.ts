"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export type ProfileState = { ok?: string; error?: string } | undefined;

export async function updateProfile(_: ProfileState, fd: FormData): Promise<ProfileState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in again." };
  const name = String(fd.get("name") || "").trim();
  if (name.length < 2) return { error: "Name is too short." };
  const isBiz = fd.get("accountType") === "BUSINESS";
  const companyName = String(fd.get("companyName") || "").trim();
  if (isBiz && companyName.length < 2) return { error: "Company name is required for business accounts." };
  await db.user.update({
    where: { id: user.id },
    data: {
      name,
      phone: String(fd.get("phone") || "").trim() || null,
      address: String(fd.get("address") || "").trim() || null,
      country: String(fd.get("country") || user.country),
      accountType: isBiz ? "BUSINESS" : "RETAIL",
      companyName: isBiz ? companyName : null,
      taxId: isBiz ? String(fd.get("taxId") || "").trim() || null : null,
    },
  });
  revalidatePath("/account");
  return { ok: "Profile saved." };
}

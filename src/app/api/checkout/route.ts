import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth";
import { isSameOrigin } from "@/lib/same-origin";
import { checkoutSchema, createCheckout } from "@/lib/checkout";

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Please sign in to check out." }, { status: 401 });
  const parsed = checkoutSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const r = await createCheckout(user, parsed.data, siteUrl);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json(r);
}

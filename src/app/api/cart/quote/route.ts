import { NextResponse } from "next/server";
import { quoteCart } from "@/lib/pricing";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const currency = body.currency === "USD" ? "USD" : "INR";
  const items = Array.isArray(body.items) ? body.items.slice(0, 100) : [];
  return NextResponse.json(await quoteCart(items, currency));
}

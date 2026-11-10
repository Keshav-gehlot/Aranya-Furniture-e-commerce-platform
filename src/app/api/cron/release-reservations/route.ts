import { NextResponse } from "next/server";
import { safeEqual } from "@/lib/crypto";
import { releaseExpiredReservations } from "@/lib/orders";

/**
 * Gives stock back from checkouts that were never paid. Requires "Authorization: Bearer $CRON_SECRET".
 * AWS: POST every 5 minutes from EventBridge Scheduler (see infra/). Vercel: GET from Vercel Cron (vercel.json).
 * Checkout also releases expired holds itself before reserving, so a slow schedule never oversells.
 */
async function run(req: Request) {
  const secret = process.env.CRON_SECRET;
  const got = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!secret || !safeEqual(secret, got)) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const released = await releaseExpiredReservations(200);
  return NextResponse.json({ released });
}

export const POST = run;
export const GET = run;
export const dynamic = "force-dynamic";

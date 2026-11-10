import { NextResponse } from "next/server";
import { apiPermission } from "@/lib/auth";
import { isSameOrigin } from "@/lib/same-origin";
import { MAX_IMAGE_BYTES, storeProductImage } from "@/lib/storage";
import { audit } from "@/lib/audit";

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  const user = await apiPermission("products");
  if (!user) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const len = Number(req.headers.get("content-length") || 0);
  if (len > MAX_IMAGE_BYTES * 10 + 100_000) return NextResponse.json({ error: "Upload too large" }, { status: 413 });

  const fd = await req.formData();
  const files = fd.getAll("files").filter((f): f is File => f instanceof File).slice(0, 10);
  if (!files.length) return NextResponse.json({ error: "No files" }, { status: 400 });
  const urls: string[] = [];
  for (const f of files) {
    if (f.size > MAX_IMAGE_BYTES) return NextResponse.json({ error: `${f.name} is larger than 5 MB` }, { status: 400 });
    try {
      urls.push(await storeProductImage(Buffer.from(await f.arrayBuffer())));
    } catch (e) {
      return NextResponse.json({ error: `${f.name}: ${(e as Error).message}` }, { status: 400 });
    }
  }
  await audit(user, "product.images_uploaded", { type: "Product" }, { count: urls.length });
  return NextResponse.json({ urls });
}

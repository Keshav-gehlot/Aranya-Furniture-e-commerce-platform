import "server-only";
import { randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { db } from "./db";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Identifies the real file type from its first bytes. The browser-supplied type is not trusted. SVG is refused. */
export function sniffImage(buf: Buffer): { ext: string; mime: string } | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: "jpg", mime: "image/jpeg" };
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: "png", mime: "image/png" };
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return { ext: "webp", mime: "image/webp" };
  if (buf.subarray(0, 4).toString("ascii") === "GIF8") return { ext: "gif", mime: "image/gif" };
  if (buf.subarray(4, 12).toString("ascii") === "ftypavif") return { ext: "avif", mime: "image/avif" };
  return null;
}

/**
 * STORAGE_DRIVER:
 *   "s3"    — S3 bucket behind CloudFront (the AWS production setup).
 *   "db"    — image bytes in the PostgreSQL table "StoredImage", served by /api/uploads/[name] with a one-year cache.
 *             For hosts with no writable disk (Vercel). Fine for a staging catalogue; move to object storage as it grows.
 *   "local" — ./uploads on disk (development).
 */
const driver = () => (process.env.STORAGE_DRIVER === "s3" ? "s3" : process.env.STORAGE_DRIVER === "db" ? "db" : "local");
/** Vercel rejects request bodies over 4.5 MB before they reach the app. */
const maxBytes = () => (driver() === "db" ? 4 * 1024 * 1024 : MAX_IMAGE_BYTES);
let s3: S3Client | null = null;

/** Stores a validated image and returns its public URL. */
export async function storeProductImage(buf: Buffer) {
  if (buf.length > maxBytes()) throw new Error(`Image is larger than ${maxBytes() / 1024 / 1024} MB.`);
  const type = sniffImage(buf);
  if (!type) throw new Error("Only JPG, PNG, WEBP, AVIF or GIF images are allowed.");
  const name = `${randomUUID()}.${type.ext}`;

  if (driver() === "s3") {
    const bucket = process.env.S3_BUCKET;
    const base = process.env.ASSET_BASE_URL;
    if (!bucket || !base) throw new Error("S3_BUCKET and ASSET_BASE_URL must be set when STORAGE_DRIVER=s3.");
    s3 ??= new S3Client({ region: process.env.AWS_REGION });
    const key = `products/${name}`;
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buf,
        ContentType: type.mime,
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
    return `${base.replace(/\/$/, "")}/${key}`;
  }

  if (driver() === "db") {
    await db.$executeRaw`INSERT INTO "StoredImage" ("name", "mime", "data") VALUES (${name}, ${type.mime}, ${buf})`;
    return `/api/uploads/${name}`;
  }

  const dir = path.resolve(process.env.UPLOAD_DIR || "uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), buf);
  return `/api/uploads/${name}`;
}

/** Reads an image stored by the "local" or "db" driver. The name is validated, so it cannot escape the upload folder. */
export async function readLocalUpload(name: string) {
  if (!/^[a-f0-9-]+\.(jpg|png|webp|avif|gif)$/.test(name)) return null;
  if (driver() === "db") {
    const rows = await db.$queryRaw<{ data: Uint8Array }[]>`SELECT "data" FROM "StoredImage" WHERE "name" = ${name} LIMIT 1`;
    return rows[0] ? Buffer.from(rows[0].data) : null;
  }
  try {
    return await readFile(path.join(path.resolve(process.env.UPLOAD_DIR || "uploads"), name));
  } catch {
    return null;
  }
}

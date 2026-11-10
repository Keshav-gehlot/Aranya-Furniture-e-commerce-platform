import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
const db = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : process.env.DATABASE_SSL === "require" ? { rejectUnauthorized: false } : undefined,
  }),
});

const categories = [
  { name: "Living Room", slug: "living-room", description: "Sofas, armchairs and coffee tables." },
  { name: "Dining", slug: "dining", description: "Dining tables, chairs and benches." },
  { name: "Dining Chairs", slug: "dining-chairs", description: "Side chairs and armchairs for dining.", parent: "dining" },
  { name: "Bedroom", slug: "bedroom", description: "Beds and bedside storage." },
  { name: "Storage", slug: "storage", description: "Sideboards, bookshelves and cabinets." },
  { name: "Office & Hospitality", slug: "office-hospitality", description: "Desks, stools and contract furniture." },
];

// prices in major units here; converted to paise / cents below
const products = [
  { name: "Thar Three-Seater Sofa", cat: "living-room", img: "sofa", inr: 64999, usd: 899, bInr: 52000, bUsd: 720, stock: 40, featured: true, material: "Sheesham wood frame, linen upholstery", finish: "Natural oil", dimensions: "210 × 90 × 85 cm", weight: 62 },
  { name: "Marwar Lounge Armchair", cat: "living-room", img: "armchair", inr: 24999, usd: 349, bInr: 19500, bUsd: 275, stock: 65, featured: true, material: "Mango wood, cotton canvas", finish: "Walnut stain", dimensions: "78 × 82 × 88 cm", weight: 21 },
  { name: "Oval Mango Coffee Table", cat: "living-room", img: "coffee-table", inr: 15999, usd: 219, bInr: 12400, bUsd: 170, stock: 120, featured: false, material: "Solid mango wood", finish: "Honey matte", dimensions: "120 × 60 × 42 cm", weight: 18 },
  { name: "Jodhpur Six-Seater Dining Table", cat: "dining", img: "dining-table", inr: 48999, usd: 679, bInr: 39000, bUsd: 540, stock: 30, featured: true, material: "Solid sheesham", finish: "Natural oil", dimensions: "180 × 90 × 76 cm", weight: 55 },
  { name: "Ladder-Back Dining Chair", cat: "dining-chairs", img: "dining-chair", inr: 6999, usd: 95, bInr: 5200, bUsd: 72, stock: 400, featured: true, material: "Acacia wood", finish: "Dark walnut", dimensions: "45 × 50 × 92 cm", weight: 6 },
  { name: "Haveli Queen Bed", cat: "bedroom", img: "bed", inr: 54999, usd: 769, bInr: 44000, bUsd: 610, stock: 25, featured: true, material: "Sheesham with cane headboard", finish: "Teak tone", dimensions: "165 × 215 × 105 cm", weight: 80 },
  { name: "Four-Door Sideboard", cat: "storage", img: "sideboard", inr: 38999, usd: 539, bInr: 31000, bUsd: 430, stock: 3, featured: false, material: "Mango wood, brass handles", finish: "Natural", dimensions: "160 × 45 × 80 cm", weight: 48 },
  { name: "Open Bookshelf", cat: "storage", img: "bookshelf", inr: 21999, usd: 299, bInr: 17200, bUsd: 235, stock: 55, featured: false, material: "Acacia wood", finish: "Smoked", dimensions: "90 × 35 × 180 cm", weight: 34 },
  { name: "Studio Writing Desk", cat: "office-hospitality", img: "desk", inr: 27999, usd: 389, bInr: 22000, bUsd: 305, stock: 70, featured: false, material: "Sheesham, iron accents", finish: "Natural oil", dimensions: "130 × 60 × 76 cm", weight: 30 },
  { name: "Café Bar Stool", cat: "office-hospitality", img: "stool", inr: 5499, usd: 75, bInr: 3900, bUsd: 54, stock: 600, featured: false, material: "Mango wood", finish: "Black wash", dimensions: "40 × 40 × 75 cm", weight: 5 },
];

const slug = (s: string) => s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function main() {
  const email = (process.env.ADMIN_EMAIL || "admin@example.com").toLowerCase();
  const password = process.env.ADMIN_PASSWORD || (process.env.NODE_ENV === "production" ? "" : "Admin@12345-dev");
  if (password.length < 12) throw new Error("Set ADMIN_PASSWORD (12+ characters) before seeding.");
  await db.user.upsert({
    where: { email },
    update: {},
    create: { name: "Store Admin", email, passwordHash: await bcrypt.hash(password, 12), role: "ADMIN" },
  });
  console.log(`Admin ready: ${email} — they must set up two-step sign-in at first login.`);

  await db.storeSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

  if (process.env.SEED_SAMPLE_PRODUCTS === "false") return;

  const catIds: Record<string, string> = {};
  for (const c of categories) {
    const { parent, ...data } = c as typeof c & { parent?: string };
    const row = await db.category.upsert({ where: { slug: c.slug }, update: {}, create: { ...data, parentId: parent ? catIds[parent] : null } });
    catIds[c.slug] = row.id;
  }

  let i = 0;
  for (const p of products) {
    i++;
    const s = slug(p.name);
    const exists = await db.product.findUnique({ where: { slug: s } });
    if (exists) continue;
    const created = await db.product.create({
      data: {
        name: p.name,
        slug: s,
        sku: `AF-${String(1000 + i)}`,
        description: `${p.material}, ${p.finish.toLowerCase()} finish. ${p.dimensions}, ${p.weight} kg.\n\nThe timber is kiln-dried, the piece is finished by hand and checked before it is packed. Custom sizes and finishes are available on orders of 10 or more.`,
        material: p.material,
        finish: p.finish,
        dimensions: p.dimensions,
        weightKg: p.weight,
        images: [], // real photographs are uploaded in Admin → Products; the storefront shows labelled placeholders until then
        priceInr: p.inr * 100,
        priceUsd: p.usd * 100,
        businessPriceInr: p.bInr * 100,
        businessPriceUsd: p.bUsd * 100,
        moq: 10,
        stock: p.stock,
        isFeatured: p.featured,
        categoryId: catIds[p.cat],
      },
    });
    await db.inventoryLog.create({
      data: { productId: created.id, change: p.stock, stockAfter: p.stock, reason: "OPENING", note: "Opening stock" },
    });
  }
  console.log(`Seeded ${categories.length} categories and ${products.length} products.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

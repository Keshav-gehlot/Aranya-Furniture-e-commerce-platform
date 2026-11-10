import "server-only";
import { db } from "./db";

/** Categories as "Parent › Child" options, parents first. */
export async function categoryOptions() {
  const cats = await db.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], include: { parent: true } });
  return cats
    .map((c) => ({ id: c.id, name: c.parent ? `${c.parent.name} › ${c.name}` : c.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

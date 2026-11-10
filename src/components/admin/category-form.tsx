"use client";
import { useActionState } from "react";
import { saveCategory } from "@/app/actions/admin";

type C = { id: string; name: string; slug: string; description: string | null; parentId: string | null };

export function CategoryForm({ c, parents }: { c?: C; parents: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(saveCategory, undefined);
  return (
    <form action={action} className="flex flex-wrap items-start gap-2">
      {c && <input type="hidden" name="id" value={c.id} />}
      <input name="name" defaultValue={c?.name} placeholder="Name" className="input w-44 py-2" required aria-label="Name" />
      <input name="slug" defaultValue={c?.slug} placeholder="slug (auto)" className="input w-36 py-2" aria-label="Slug" />
      <select name="parentId" defaultValue={c?.parentId ?? ""} className="input w-44 py-2" aria-label="Parent category">
        <option value="">Top level</option>
        {parents.filter((p) => p.id !== c?.id).map((p) => <option key={p.id} value={p.id}>Inside {p.name}</option>)}
      </select>
      <input name="description" defaultValue={c?.description ?? ""} placeholder="Short description" className="input min-w-[180px] flex-1 py-2" aria-label="Description" />
      <button className={c ? "btn-outline py-2" : "btn-primary py-2"} disabled={pending}>{c ? "Save" : "Add category"}</button>
      {state?.error && <p className="w-full text-xs text-red-700">{state.error}</p>}
      {state?.ok && <p className="w-full text-xs text-emerald-700">{state.ok}</p>}
    </form>
  );
}

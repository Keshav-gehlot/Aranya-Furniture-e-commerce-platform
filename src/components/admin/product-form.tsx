"use client";
import { useActionState, useState } from "react";
import { saveProduct } from "@/app/actions/admin";

type Cat = { id: string; name: string };
export type ProductInit = {
  id?: string; name: string; slug: string; sku: string; description: string; material: string; finish: string;
  dimensions: string; weightKg: string; categoryId: string; priceInr: string; priceUsd: string;
  businessPriceInr: string; businessPriceUsd: string; moq: number; lowStockThreshold: number; stock: number;
  images: string[]; status: "DRAFT" | "ACTIVE" | "ARCHIVED"; isFeatured: boolean;
};

export function ProductForm({ init, categories }: { init: ProductInit; categories: Cat[] }) {
  const [state, action, pending] = useActionState(saveProduct, undefined);
  const [images, setImages] = useState<string[]>(init.images);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [url, setUrl] = useState("");

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setUploadErr(null);
    // One file per request: some hosts (Vercel) reject request bodies over 4.5 MB.
    for (const f of [...files].slice(0, 10)) {
      const fd = new FormData();
      fd.append("files", f);
      try {
        const r = await fetch("/api/admin/upload", { method: "POST", body: fd });
        const d = await r.json().catch(() => ({}));
        if (r.ok) setImages((x) => [...x, ...d.urls]);
        else {
          setUploadErr(r.status === 413 ? `${f.name} is too large to upload. Use an image under 4 MB.` : d.error || `${f.name} could not be uploaded.`);
          break;
        }
      } catch {
        setUploadErr(`${f.name} could not be uploaded. Check your connection and try again.`);
        break;
      }
    }
    setUploading(false);
  }
  const move = (i: number, d: number) =>
    setImages((x) => {
      const n = [...x];
      const j = i + d;
      if (j < 0 || j >= n.length) return n;
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-3">
      {init.id && <input type="hidden" name="id" value={init.id} />}
      <input type="hidden" name="images" value={JSON.stringify(images)} />

      <div className="space-y-6 lg:col-span-2">
        <section className="card space-y-4 p-6">
          <h2 className="text-lg">Details</h2>
          <F label="Product name" name="name" defaultValue={init.name} required />
          <div className="grid gap-4 sm:grid-cols-2">
            <F label="SKU" name="sku" defaultValue={init.sku} required />
            <F label="URL slug (auto if empty)" name="slug" defaultValue={init.slug} />
          </div>
          <div>
            <label className="label" htmlFor="description">Description</label>
            <textarea id="description" name="description" rows={6} className="input" defaultValue={init.description} required />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <F label="Material" name="material" defaultValue={init.material} />
            <F label="Finish" name="finish" defaultValue={init.finish} />
            <F label="Dimensions (W × D × H)" name="dimensions" defaultValue={init.dimensions} />
            <F label="Weight (kg)" name="weightKg" defaultValue={init.weightKg} type="number" step="0.1" min="0" />
          </div>
        </section>

        <section className="card space-y-4 p-6">
          <h2 className="text-lg">Images</h2>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {images.map((src, i) => (
              <div key={src + i} className="group relative aspect-square overflow-hidden rounded-sm bg-sand">
                <img src={src} alt="" className="h-full w-full object-cover" />
                {i === 0 && <span className="badge absolute left-1 top-1 bg-ink text-linen">Main</span>}
                <div className="absolute inset-x-1 bottom-1 flex justify-between opacity-0 transition group-hover:opacity-100">
                  <button type="button" onClick={() => move(i, -1)} className="rounded bg-white/90 px-1.5 text-xs">←</button>
                  <button type="button" onClick={() => setImages((x) => x.filter((_, j) => j !== i))} className="rounded bg-red-600 px-1.5 text-xs text-white">✕</button>
                  <button type="button" onClick={() => move(i, 1)} className="rounded bg-white/90 px-1.5 text-xs">→</button>
                </div>
              </div>
            ))}
            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-sm border-2 border-dashed border-ink/15 text-center text-xs text-stone hover:border-forest hover:text-forest">
              {uploading ? "Uploading…" : <>＋<br />Upload</>}
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
            </label>
          </div>
          {uploadErr && <p className="text-sm text-red-700">{uploadErr}</p>}
          <div className="flex gap-2">
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="…or paste an image URL" className="input" />
            <button type="button" className="btn-outline" onClick={() => { const u = url.trim(); if (u.startsWith("https://") || u.startsWith("/")) { setImages((x) => [...x, u]); setUrl(""); setUploadErr(null); } else setUploadErr("Image links must start with https://"); }}>Add</button>
          </div>
          <p className="text-xs text-stone">JPG, PNG, WEBP, AVIF or GIF up to 5 MB each. The first image is the main photo.</p>
        </section>
      </div>

      <div className="space-y-6">
        <section className="card space-y-4 p-6">
          <h2 className="text-lg">Pricing</h2>
          <p className="-mt-2 text-xs text-stone">Excluding GST. Enter whole amounts (e.g. 24999).</p>
          <div className="grid grid-cols-2 gap-3">
            <F label="Retail ₹" name="priceInr" defaultValue={init.priceInr} type="number" step="0.01" min="0" required />
            <F label="Retail $" name="priceUsd" defaultValue={init.priceUsd} type="number" step="0.01" min="0" required />
          </div>
          <div className="rounded-sm bg-forest/5 p-3">
            <p className="mb-3 text-xs font-semibold text-forest">Business / wholesale</p>
            <div className="grid grid-cols-2 gap-3">
              <F label="Business ₹" name="businessPriceInr" defaultValue={init.businessPriceInr} type="number" step="0.01" min="0" required />
              <F label="Business $" name="businessPriceUsd" defaultValue={init.businessPriceUsd} type="number" step="0.01" min="0" required />
              <div className="col-span-2"><F label="Minimum business quantity" name="moq" defaultValue={String(init.moq)} type="number" min="1" required /></div>
            </div>
          </div>
        </section>

        <section className="card space-y-4 p-6">
          <h2 className="text-lg">Organise</h2>
          <div>
            <label className="label" htmlFor="categoryId">Category</label>
            <select id="categoryId" name="categoryId" defaultValue={init.categoryId} className="input">
              <option value="">— None —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {!init.id && <F label="Opening stock" name="stock" defaultValue={String(init.stock)} type="number" min="0" />}
          <F label="Low-stock alert at" name="lowStockThreshold" defaultValue={String(init.lowStockThreshold)} type="number" min="0" />
          <div>
            <label className="label" htmlFor="status">Status</label>
            <select id="status" name="status" defaultValue={init.status} className="input">
              <option value="ACTIVE">Live in store</option>
              <option value="DRAFT">Draft (hidden)</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isFeatured" defaultChecked={init.isFeatured} className="h-4 w-4 accent-forest" /> Feature on homepage</label>
        </section>

        {state?.error && <p className="rounded-sm bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
        <button className="btn-primary w-full py-3" disabled={pending || uploading}>{pending ? "Saving…" : init.id ? "Save changes" : "Create product"}</button>
      </div>
    </form>
  );
}

function F({ label, name, ...rest }: { label: string; name: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input id={name} name={name} className="input" {...rest} />
    </div>
  );
}

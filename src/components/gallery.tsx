"use client";
import { useState } from "react";
import { Ph, isPhoto } from "./placeholder";

/** Sharp-edged photographs; thumbnails get the 2px radius. Falls back to labelled placeholders. */
export function Gallery({ images, name }: { images: string[]; name: string }) {
  const photos = images.filter(isPhoto);
  const [i, setI] = useState(0);
  if (photos.length === 0) {
    return (
      <div className="grid gap-4 lg:sticky lg:top-24 lg:self-start">
        <Ph shot="product" subject={name} style={{ aspectRatio: "1 / 1" }} />
        <div className="grid grid-cols-2 gap-4">
          <Ph shot="cardAlt" style={{ aspectRatio: "4 / 5" }} />
          <Ph shot="card" style={{ aspectRatio: "4 / 5" }} />
        </div>
      </div>
    );
  }
  return (
    <div className="lg:sticky lg:top-24 lg:self-start">
      <div className="aspect-square overflow-hidden bg-sunken">
        <img src={photos[i]} alt={`${name}, photo ${i + 1} of ${photos.length}`} className="h-full w-full object-cover" />
      </div>
      {photos.length > 1 && (
        <div className="mt-4 grid grid-cols-5 gap-3">
          {photos.map((src, idx) => (
            <button
              key={src + idx}
              type="button"
              onClick={() => setI(idx)}
              aria-label={`Show photo ${idx + 1}`}
              aria-pressed={idx === i}
              className={`aspect-square overflow-hidden rounded-xs bg-sunken ${idx === i ? "shadow-[0_0_0_2px_#fff,0_0_0_4px_#1f1716]" : ""}`}
            >
              <img src={src} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

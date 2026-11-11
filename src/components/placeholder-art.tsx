/**
 * Sample line drawings that stand in for photographs until the client's photography exists.
 * One 200 × 160 canvas, floor at y = 134. Colours come from CSS (.ar-ph__art in globals.css):
 *   f = timber   u = upholstery / paper   a = accent   k = metal   g = ground line
 */
import type { ReactNode } from "react";

export type ArtKind =
  | "sofa" | "armchair" | "coffee-table" | "dining-table" | "chair" | "bed" | "sideboard" | "bookshelf" | "desk" | "stool"
  | "dining-room" | "living-room" | "container" | "cartons" | "workshop";

const sofa = (
  <>
    <rect className="u" x="30" y="62" width="140" height="46" rx="6" />
    <path d="M77 66v24M123 66v24" />
    <rect className="u" x="38" y="90" width="124" height="24" rx="4" />
    <path d="M79.3 92v20M120.7 92v20" />
    <rect className="u" x="22" y="78" width="18" height="42" rx="6" />
    <rect className="u" x="160" y="78" width="18" height="42" rx="6" />
    <rect className="f" x="30" y="114" width="140" height="8" />
    <path className="f" d="M36 122h8l-2 12h-4zM156 122h8l-2 12h-4z" />
  </>
);

const ART: Record<ArtKind, ReactNode> = {
  sofa,
  armchair: (
    <>
      <rect className="u" x="62" y="50" width="76" height="58" rx="8" />
      <rect className="u" x="66" y="92" width="68" height="20" rx="4" />
      <rect className="f" x="52" y="84" width="10" height="34" rx="3" />
      <rect className="f" x="138" y="84" width="10" height="34" rx="3" />
      <rect className="f" x="56" y="112" width="88" height="6" />
      <path className="f" d="M60 118h8l-5 16h-5zM132 118h8l2 16h-5z" />
    </>
  ),
  "coffee-table": (
    <>
      <path className="f" d="M84 101l-3 33h4l5-33zM116 101l3 33h-4l-5-33z" />
      <path className="f" d="M54 99l-9 35h5l11-34zM146 99l9 35h-5l-11-34z" />
      <ellipse className="f" cx="100" cy="92" rx="70" ry="10" />
      <rect className="a" x="78" y="80" width="26" height="5" />
      <rect className="u" x="81" y="75" width="20" height="5" />
      <path className="u" d="M112 78h22q-1 8-11 8t-11-8z" />
    </>
  ),
  "dining-table": (
    <>
      <rect className="f" x="36" y="78" width="128" height="9" />
      <rect className="f" x="36" y="87" width="8" height="47" />
      <rect className="f" x="156" y="87" width="8" height="47" />
      <rect className="f" x="24" y="70" width="152" height="8" rx="1" />
      <path className="u" d="M86 62h28q-1 8-14 8t-14-8z" />
    </>
  ),
  chair: (
    <>
      <rect className="f" x="74" y="32" width="6" height="102" />
      <rect className="f" x="120" y="32" width="6" height="102" />
      <rect className="f" x="80" y="40" width="40" height="7" />
      <rect className="f" x="80" y="54" width="40" height="7" />
      <rect className="f" x="80" y="68" width="40" height="7" />
      <rect className="f" x="80" y="114" width="40" height="4" />
      <rect className="u" x="68" y="88" width="64" height="9" rx="2" />
    </>
  ),
  bed: (
    <>
      <rect className="f" x="40" y="40" width="120" height="62" rx="3" />
      <rect className="u" x="50" y="48" width="100" height="30" />
      <path d="M50 58h100M50 68h100M70 48v30M90 48v30M110 48v30M130 48v30" className="g" />
      <rect className="u" x="52" y="76" width="42" height="20" rx="6" />
      <rect className="u" x="106" y="76" width="42" height="20" rx="6" />
      <rect className="u" x="36" y="92" width="128" height="22" rx="5" />
      <path className="a" d="M36 101h128v8a5 5 0 0 1-5 5H41a5 5 0 0 1-5-5z" />
      <rect className="f" x="34" y="114" width="132" height="8" />
      <rect className="f" x="38" y="122" width="7" height="12" />
      <rect className="f" x="155" y="122" width="7" height="12" />
    </>
  ),
  sideboard: (
    <>
      <rect className="u" x="52" y="42" width="11" height="20" rx="4" />
      <path d="M57.5 42v-10M57.5 36l-6-5M57.5 38l6-6" />
      <rect className="a" x="118" y="56" width="28" height="6" />
      <rect className="u" x="122" y="51" width="22" height="5" />
      <rect className="f" x="26" y="68" width="148" height="52" />
      <path d="M63 72v44M100 72v44M137 72v44" />
      <circle className="k" cx="58" cy="94" r="1.8" />
      <circle className="k" cx="68" cy="94" r="1.8" />
      <circle className="k" cx="132" cy="94" r="1.8" />
      <circle className="k" cx="142" cy="94" r="1.8" />
      <rect className="f" x="22" y="62" width="156" height="6" />
      <rect className="f" x="34" y="120" width="6" height="14" />
      <rect className="f" x="160" y="120" width="6" height="14" />
    </>
  ),
  bookshelf: (
    <>
      <rect className="a" x="75" y="27" width="5" height="17" />
      <rect className="u" x="80" y="30" width="4" height="14" />
      <rect className="f" x="84" y="26" width="6" height="18" />
      <rect className="u" x="90" y="31" width="5" height="13" />
      <path className="u" d="M104 58h20q-1 12-10 12t-10-12z" />
      <rect className="u" x="74" y="92" width="26" height="4" />
      <rect className="a" x="77" y="88" width="20" height="4" />
      <rect className="u" x="104" y="80" width="5" height="16" />
      <rect className="f" x="109" y="78" width="5" height="18" />
      <rect className="u" x="76" y="104" width="24" height="18" />
      <path d="M84 110h8" />
      <rect className="f" x="64" y="18" width="6" height="116" />
      <rect className="f" x="130" y="18" width="6" height="116" />
      <rect className="f" x="64" y="18" width="72" height="5" />
      <rect className="f" x="70" y="44" width="60" height="5" />
      <rect className="f" x="70" y="70" width="60" height="5" />
      <rect className="f" x="70" y="96" width="60" height="5" />
      <rect className="f" x="70" y="122" width="60" height="5" />
    </>
  ),
  desk: (
    <>
      <path d="M142 70V48l-16-10" />
      <path className="a" d="M114 32l14 9-5 8-14-9z" />
      <rect className="u" x="52" y="62" width="30" height="8" rx="1" />
      <rect className="k" x="36" y="77" width="5" height="57" />
      <rect className="k" x="159" y="77" width="5" height="57" />
      <path d="M41 120h118" />
      <rect className="f" x="44" y="77" width="52" height="15" />
      <path className="g" d="M62 84.5h16" />
      <rect className="f" x="30" y="70" width="140" height="7" />
    </>
  ),
  stool: (
    <>
      <path className="f" d="M80 60l-10 74h5l13-74zM120 60l10 74h-5l-13-74z" />
      <rect className="f" x="76" y="104" width="48" height="4" />
      <rect className="f" x="80" y="78" width="40" height="3" />
      <rect className="f" x="72" y="52" width="56" height="9" rx="3" />
    </>
  ),
  "dining-room": (
    <>
      <rect className="u" x="10" y="12" width="40" height="42" />
      <path d="M30 12v42M10 33h40" />
      <path d="M110 0v28" />
      <path className="a" d="M94 44q16-26 32 0z" />
      <rect className="f" x="34" y="58" width="5" height="76" />
      <rect className="f" x="34" y="98" width="32" height="5" />
      <rect className="f" x="61" y="103" width="5" height="31" />
      <rect className="f" x="181" y="58" width="5" height="76" />
      <rect className="f" x="154" y="98" width="32" height="5" />
      <rect className="f" x="154" y="103" width="5" height="31" />
      <path className="u" d="M98 76h24q-1 8-12 8t-12-8z" />
      <rect className="f" x="54" y="84" width="112" height="7" rx="1" />
      <rect className="f" x="70" y="91" width="7" height="43" />
      <rect className="f" x="143" y="91" width="7" height="43" />
    </>
  ),
  "living-room": (
    <>
      <rect className="u" x="50" y="20" width="32" height="26" />
      <path className="g" d="M55 40l8-9 6 5 5-7 4 11z" />
      <rect className="u" x="90" y="26" width="20" height="20" />
      <g transform="translate(-2 26.8) scale(.8)">{sofa}</g>
      <path d="M176 52v82" />
      <path d="M166 134h20" />
      <path className="a" d="M163 52l5-20h16l5 20z" />
    </>
  ),
  container: (
    <>
      <path className="a" d="M40 30L16 38v102l24-6zM160 30l24 8v102l-24-6z" />
      <path d="M22 60v52M178 60v52" className="g" />
      <rect className="u" x="40" y="30" width="120" height="104" />
      {[0, 1, 2, 3].flatMap((r) =>
        [0, 1, 2, 3].map((c) => (
          <g key={`${r}-${c}`}>
            <rect className="f" x={46 + c * 27} y={38 + r * 24} width="27" height="24" />
            <path className="g" d={`M${59.5 + c * 27} ${38 + r * 24}v7`} />
          </g>
        )),
      )}
    </>
  ),
  cartons: (
    <>
      <rect className="f" x="74" y="46" width="52" height="38" />
      <path className="g" d="M100 46v9" />
      <rect className="u" x="84" y="62" width="18" height="12" />
      <rect className="f" x="48" y="84" width="52" height="40" />
      <path className="g" d="M74 84v9" />
      <rect className="u" x="58" y="100" width="18" height="12" />
      <rect className="f" x="100" y="84" width="52" height="40" />
      <path className="g" d="M126 84v9" />
      <rect className="u" x="110" y="100" width="18" height="12" />
      <path className="a" d="M48 84h9v4h-5v6h-4zM152 84h-9v4h5v6h4zM74 46h9v4h-5v6h-4zM126 46h-9v4h5v6h4z" />
      <rect className="f" x="40" y="124" width="120" height="4" />
      <rect className="f" x="44" y="128" width="10" height="6" />
      <rect className="f" x="95" y="128" width="10" height="6" />
      <rect className="f" x="146" y="128" width="10" height="6" />
    </>
  ),
  workshop: (
    <>
      <rect className="f" x="30" y="26" width="13" height="18" rx="3" />
      <path className="u" d="M43 28h44l-7 14H43z" />
      <rect className="f" x="103" y="22" width="6" height="18" rx="1" />
      <rect className="k" x="104.5" y="40" width="3" height="15" />
      <rect className="f" x="124" y="22" width="20" height="11" rx="2" />
      <rect className="f" x="132" y="33" width="4" height="24" />
      <path className="u" d="M158 22v32h20v-5h-15V22z" />
      <rect className="a" x="62" y="81" width="42" height="11" rx="2" />
      <circle className="f" cx="71" cy="77" r="4" />
      <path className="f" d="M92 81q1-11 9-9v9z" />
      <rect className="f" x="116" y="85" width="44" height="7" rx="3" />
      <rect className="f" x="26" y="92" width="148" height="8" />
      <rect className="f" x="38" y="100" width="8" height="34" />
      <rect className="f" x="154" y="100" width="8" height="34" />
      <rect className="f" x="46" y="116" width="108" height="4" />
    </>
  ),
};

/** Picks the drawing from what the slot is for: the product's name, or the scene the page asks for. */
export function artFor(subject: string | undefined, fallback: ArtKind): ArtKind {
  const s = (subject ?? "").toLowerCase();
  const has = (...words: string[]) => words.some((w) => s.includes(w));
  if (has("container")) return "container";
  if (has("carton", "corner guard", "packing", "crate")) return "cartons";
  if (has("workshop", "tools", "joinery")) return "workshop";
  if (has("living room")) return "living-room";
  if (has("dining room")) return "dining-room";
  if (has("sofa", "couch", "settee", "loveseat")) return "sofa";
  if (has("armchair", "lounge", "recliner")) return "armchair";
  if (has("coffee table", "side table", "centre table", "center table")) return "coffee-table";
  if (has("stool")) return "stool";
  if (has("chair", "bench")) return "chair";
  if (has("bed", "cot")) return "bed";
  if (has("sideboard", "cabinet", "console", "wardrobe", "chest", "dresser")) return "sideboard";
  if (has("bookshelf", "bookcase", "shelf", "shelving", "rack")) return "bookshelf";
  if (has("desk")) return "desk";
  if (has("table")) return "dining-table";
  return fallback;
}

export function PlaceholderArt({ kind }: { kind: ArtKind }) {
  return (
    <svg className="ar-ph__art" viewBox="0 0 200 160" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
      <path className="g" d="M6 134h188" />
      {ART[kind]}
    </svg>
  );
}

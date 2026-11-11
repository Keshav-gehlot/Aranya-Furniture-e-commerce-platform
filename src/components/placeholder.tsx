/**
 * Sample image for a slot that has no photograph yet. It shows a line drawing chosen from the
 * product's name (or the scene the page asks for) and says "Sample image", so nobody mistakes it
 * for the real piece. Upload a photo in Admin → Products and the drawing is replaced.
 * The shot each slot needs is kept in its tooltip for the photographer.
 */
import { PlaceholderArt, artFor, type ArtKind } from "./placeholder-art";

const SHOTS = {
  card: ["4:5", "Card primary — front three-quarter, styled room", "armchair"],
  cardAlt: ["4:5", "Card hover — joint, edge or grain close-up", "armchair"],
  product: ["1:1", "Product cut-out on white sweep", "armchair"],
  hero: ["16:9", "Hero room — daylight, one hero piece off-centre", "dining-room"],
  editorial: ["3:2", "Workshop, packing or project install", "workshop"],
} as const satisfies Record<string, readonly [string, string, ArtKind]>;

export function Ph({ shot, subject, dark = false, bare = false, detail = shot === "cardAlt", className = "", style }: {
  shot: keyof typeof SHOTS;
  /** Product name or scene: decides which drawing is shown. */
  subject?: string;
  dark?: boolean;
  /** Thumbnail size: no caption. */
  bare?: boolean;
  /** Close-up crop of the same drawing (the card's hover image). */
  detail?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [ratio, text, fallback] = SHOTS[shot];
  return (
    <div
      className={`ar-ph ${dark ? "ar-ph--dark" : ""} ${bare ? "ar-ph--bare" : ""} ${detail ? "ar-ph--detail" : ""} ${className}`}
      style={style}
      role="img"
      aria-label={`Sample image${subject ? `: ${subject}` : ""}`}
      title={`Photo to come (${ratio}): ${text}`}
    >
      <PlaceholderArt kind={artFor(subject, fallback)} />
      {!bare && <span className="ar-ph__cap">Sample image</span>}
    </div>
  );
}

/** True for a real uploaded photo (the old sample illustrations are no longer shown). */
export const isPhoto = (src?: string | null): src is string => !!src && !src.startsWith("/illustrations/");

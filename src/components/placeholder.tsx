/**
 * Labelled image placeholder. The design system forbids stock photos and furniture illustrations:
 * until the client's photography exists, every image slot states the crop and the shot it needs.
 */
const SHOTS = {
  card: ["4:5", "Card primary — front three-quarter, styled room"],
  cardAlt: ["4:5", "Card hover — joint, edge or grain close-up"],
  product: ["1:1", "Product cut-out on white sweep"],
  hero: ["16:9", "Hero room — daylight, one hero piece off-centre"],
  editorial: ["3:2", "Workshop, packing or project install"],
} as const;

export function Ph({ shot, subject, dark = false, bare = false, className = "", style }: { shot: keyof typeof SHOTS; subject?: string; dark?: boolean; /** thumbnail size: no label */ bare?: boolean; className?: string; style?: React.CSSProperties }) {
  const [ratio, text] = SHOTS[shot];
  return (
    <div className={`ar-ph ${dark ? "ar-ph--dark" : ""} ${className}`} style={style} role="img" aria-label={`Photo to come: ${subject ? subject + ", " : ""}${text}`}>
      {!bare && (
        <span className="ar-ph__label">
          {subject && <b>{subject}</b>}
          {ratio} · {text}
        </span>
      )}
    </div>
  );
}

/** True for a real uploaded photo (the old sample illustrations are no longer shown). */
export const isPhoto = (src?: string | null): src is string => !!src && !src.startsWith("/illustrations/");

// Brand mark + tone placeholder for Tania Madi Photography.
export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className="brand" style={{ cursor: "default" }}>
      <span className="n" style={light ? { color: "#fff" } : undefined}>
        Tania <i>Madi</i>
      </span>
      <span className="s">Photography</span>
    </span>
  );
}

// Placeholder photography, themed by category. Real client photos will replace these later.
// LoremFlickr serves keyword-matched stock photos; the tonal gradient stays behind as a
// graceful fallback if an image is slow or fails to load.
const KEYWORD: Record<string, string> = {
  "g-wed": "wedding", "g-weddings": "wedding,bride",
  "g-couple": "couple,love", "g-couples": "couple,love",
  "g-mat": "maternity,pregnant", "g-newborn": "newborn,baby",
  "g-birthday": "birthday,cake", "g-birthdays": "birthday,cake",
  "g-gender": "baby,balloons", "g-gender-reveals": "baby,balloons",
  "g-family": "family,portrait", "g-families": "family,portrait",
  "g-food": "food,restaurant", "g-products-food": "food,restaurant",
  "g-video": "cinematography,camera",
};
function hashStr(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffff;
  return h;
}
export function Tone({ tone, label, className = "", style, onClick, seed, w = 640, h = 800, img, pos }: { tone: string; label?: string; className?: string; style?: React.CSSProperties; onClick?: () => void; seed?: number | string; w?: number; h?: number; img?: string; pos?: string }) {
  const kw = KEYWORD[tone] || "photography";
  const lock = seed != null ? (typeof seed === "number" ? seed : hashStr(seed)) : hashStr(tone + (label || ""));
  const src = img || `https://loremflickr.com/${w}/${h}/${encodeURIComponent(kw)}?lock=${lock}`;
  return (
    <div className={`ph ${tone} ${className}`} style={onClick ? { cursor: "zoom-in", ...style } : style} onClick={onClick}>
      <img className="ph-img" src={src} alt={label || ""} loading="lazy" style={pos ? { objectPosition: pos } : undefined} />
      {label && <span className="plabel">{label}</span>}
    </div>
  );
}

export function Check() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

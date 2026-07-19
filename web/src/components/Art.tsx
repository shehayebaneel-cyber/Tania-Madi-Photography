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
export function Tone({ tone, label, className = "", style, onClick, seed, w = 640, h = 800, img, pos, kw }: { tone: string; label?: string; className?: string; style?: React.CSSProperties; onClick?: () => void; seed?: number | string; w?: number; h?: number; img?: string; pos?: string; kw?: string }) {
  const keyword = kw || KEYWORD[tone] || "photography";
  const lock = seed != null ? (typeof seed === "number" ? seed : hashStr(seed)) : hashStr(tone + (label || ""));
  const src = img || `https://loremflickr.com/${w}/${h}/${encodeURIComponent(keyword)}?lock=${lock}`;
  return (
    <div className={`ph ${tone} ${className}`} style={onClick ? { cursor: "zoom-in", ...style } : style} onClick={onClick}>
      <img className="ph-img" src={src} alt={label || ""} loading="lazy" style={pos ? { objectPosition: pos } : undefined} />
      {label && <span className="plabel">{label}</span>}
    </div>
  );
}

// Product-photo keyword so the shop shows the product (frame/canvas/album), not people.
export function productKeyword(categorySlug?: string) {
  switch (categorySlug) {
    case "frames": return "frame";
    case "premium-frames": return "frame";
    case "canvas": return "canvas";
    case "albums": return "album";
    case "prints": return "print";
    case "gifts": return "gift";
    default: return "frame";
  }
}

function frameColor(colors: string[] = [], name = "") {
  const s = ((colors[0] || "") + " " + name).toLowerCase();
  if (s.includes("black")) return { c: "#262626", e: "#111" };
  if (s.includes("white")) return { c: "#ECECEC", e: "#d4d4d4" };
  if (s.includes("walnut")) return { c: "#5B3B2A", e: "#3f2a1d" };
  if (s.includes("gold") || s.includes("champagne")) return { c: "#C7A24E", e: "#a9853a" };
  if (s.includes("grey") || s.includes("gray") || s.includes("green")) return { c: "#9a978f", e: "#7c7970" };
  return { c: "#C69A6B", e: "#a97e52" }; // wood / oak / natural / pine / birch
}

// Clean, reliable product graphics — a stand-in for real product photos.
export function ProductMock({ category, colors = [], name = "", className = "", style, onClick }: { category?: string; colors?: string[]; name?: string; className?: string; style?: React.CSSProperties; onClick?: () => void }) {
  const f = frameColor(colors, name);
  let art: JSX.Element;
  if (category === "canvas") {
    art = (<g filter="url(#sh)"><rect x="27" y="22" width="46" height="56" rx="1" fill="#efe3dc" /><rect x="27" y="22" width="46" height="56" fill="url(#cv)" /><rect x="71" y="22" width="2.5" height="56" fill="#d8c8bf" /><rect x="27" y="76" width="46" height="2.5" fill="#e6d7ce" /></g>);
  } else if (category === "albums") {
    const cov = frameColor(colors, name).c;
    art = (<g filter="url(#sh)"><rect x="29" y="22" width="42" height="56" rx="2" fill={cov} /><rect x="29" y="22" width="6" height="56" fill="rgba(0,0,0,.16)" /><rect x="44" y="43" width="18" height="13" rx="1.5" fill="rgba(255,255,255,.45)" /></g>);
  } else if (category === "prints") {
    art = (<g filter="url(#sh)" transform="rotate(-2 50 50)"><rect x="30" y="20" width="40" height="54" fill="#fff" /><rect x="33.5" y="23.5" width="33" height="40" fill="#d9d9dc" /></g>);
  } else if (category === "gifts") {
    art = (<g filter="url(#sh)"><rect x="31" y="42" width="38" height="30" rx="1" fill={f.c} /><rect x="31" y="35" width="38" height="8" rx="1" fill={f.e} /><rect x="46.5" y="35" width="7" height="37" fill="#C7A24E" /><path d="M50 35c-5-6-13-2-8 3M50 35c5-6 13-2 8 3" fill="none" stroke="#C7A24E" strokeWidth="2.4" /></g>);
  } else {
    const ornate = category === "premium-frames";
    const col = ornate ? { c: "#C7A24E", e: "#a9853a" } : f;
    art = (<g filter="url(#sh)">
      <rect x="30" y="12" width="40" height="76" rx="1.5" fill={col.c} stroke={col.e} strokeWidth="0.8" />
      {ornate && <rect x="33" y="15" width="34" height="70" rx="1" fill="none" stroke="#e6cf94" strokeWidth="0.7" />}
      <rect x="34.5" y="16.5" width="31" height="67" fill="#fbfbf9" />
      <rect x="41" y="26" width="18" height="48" fill="#dcdce0" />
    </g>);
  }
  return (
    <div className={`ph pm ${className}`} style={onClick ? { cursor: "pointer", ...style } : style} onClick={onClick}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" width="100%" height="100%">
        <defs>
          <filter id="sh" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="1.4" stdDeviation="1.6" floodColor="#3a2a2a" floodOpacity="0.22" /></filter>
          <linearGradient id="cv" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f0dcd6" /><stop offset="0.55" stopColor="#d6b3b0" /><stop offset="1" stopColor="#b1888c" /></linearGradient>
        </defs>
        <rect width="100" height="100" fill="#f3f1ec" />
        {art}
      </svg>
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

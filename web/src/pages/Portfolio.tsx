import { useEffect, useRef, useState } from "react";
import { api, type PortfolioItem } from "../lib/api";
import { Tone } from "../components/Art";

const FILTERS = [
  { slug: "all", label: "All" }, { slug: "weddings", label: "Weddings" }, { slug: "couples", label: "Couples" },
  { slug: "maternity", label: "Maternity" }, { slug: "newborn", label: "Newborn" }, { slug: "birthdays", label: "Birthdays" },
  { slug: "gender-reveals", label: "Gender Reveals" }, { slug: "families", label: "Families" },
  { slug: "products-food", label: "Products & Food" }, { slug: "videography", label: "Videography" },
];

export default function Portfolio() {
  const [cat, setCat] = useState("all");
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [idx, setIdx] = useState<number | null>(null);
  const touchX = useRef<number | null>(null);

  useEffect(() => {
    setLoading(true);
    api.portfolio({ category: cat }).then(setItems).catch(() => setItems([])).finally(() => setLoading(false));
  }, [cat]);

  const open = idx !== null;
  const cur = open ? items[idx] : null;
  const go = (d: number) => setIdx((n) => (n === null ? n : (n + d + items.length) % items.length));
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "ArrowRight") go(1); else if (e.key === "ArrowLeft") go(-1); else if (e.key === "Escape") setIdx(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, items.length]);

  const span = (i: number) => (i % 7 === 0 ? "tall" : i % 5 === 0 ? "wide" : "");

  return (
    <>
      <div className="pagehead"><p className="eyebrow">Selected work</p><h1>Portfolio</h1><p>Browse by category, then tap any photo to open the full-screen gallery — swipe or use the arrows to move through.</p></div>
      <section>
        <div className="wrap">
          <div className="pfilters">
            {FILTERS.map((f) => <button key={f.slug} className={cat === f.slug ? "on" : ""} onClick={() => setCat(f.slug)}>{f.label}</button>)}
          </div>
          {loading ? <div className="spinner" /> : items.length === 0 ? <div className="empty"><h3>No photos in this category yet</h3></div> : (
            <div className="pgrid">
              {items.map((p, i) => <Tone key={p.id} tone={p.tone} className={`cell ${span(i)}`} label={p.category.replace(/-/g, " ")} onClick={() => setIdx(i)} />)}
            </div>
          )}
        </div>
      </section>

      {cur && (
        <div className="lb" onClick={() => setIdx(null)}
          onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => { if (touchX.current == null) return; const dx = e.changedTouches[0].clientX - touchX.current; if (Math.abs(dx) > 45) go(dx < 0 ? 1 : -1); touchX.current = null; }}>
          <button className="cls" aria-label="Close" onClick={(e) => { e.stopPropagation(); setIdx(null); }}><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
          {items.length > 1 && <span className="count">{idx! + 1} / {items.length}</span>}
          <Tone tone={cur.tone} className="media" label={cur.category.replace(/-/g, " ")} />
          {items.length > 1 && <>
            <button className="nav prev" aria-label="Previous" onClick={(e) => { e.stopPropagation(); go(-1); }}><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg></button>
            <button className="nav next" aria-label="Next" onClick={(e) => { e.stopPropagation(); go(1); }}><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 6l6 6-6 6" /></svg></button>
          </>}
        </div>
      )}
    </>
  );
}

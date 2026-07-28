import { useEffect, useRef, useState } from "react";
import { api, mediaUrl, type PortfolioItem, type PortfolioCategory } from "../lib/api";
import { Tone } from "../components/Art";

// Turn a YouTube/Vimeo link into an embeddable player URL (null = play as a file).
function embedUrl(url: string): string | null {
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/))([\w-]{11})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return null;
}

export default function Portfolio() {
  const [cat, setCat] = useState("all");
  const [cats, setCats] = useState<PortfolioCategory[]>([]);
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [idx, setIdx] = useState<number | null>(null);
  const touchX = useRef<number | null>(null);

  useEffect(() => { api.portfolioCategories().then(setCats).catch(() => setCats([])); }, []);
  const FILTERS = [{ slug: "all", label: "All" }, ...cats.map((c) => ({ slug: c.slug, label: c.name }))];

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
              {items.map((p, i) => p.mediaType === "video" ? (
                <button key={p.id} className={`ph ${p.tone} cell ${span(i)}`} style={{ cursor: "zoom-in", position: "relative", border: 0, padding: 0 }} onClick={() => setIdx(i)} aria-label="Play video">
                  {p.imageUrl ? <img className="ph-img" src={mediaUrl(p.imageUrl)} alt={p.title || ""} loading="lazy" /> : null}
                  <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: 34, color: "#fff", textShadow: "0 2px 10px rgba(0,0,0,.65)" }}>▶</span>
                </button>
              ) : (
                <Tone key={p.id} tone={p.tone} img={p.imageUrl ? mediaUrl(p.imageUrl) : undefined} className={`cell ${span(i)}`} label={p.category.replace(/-/g, " ")} seed={p.id} onClick={() => setIdx(i)} />
              ))}
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
          {cur.mediaType === "video" ? (
            (() => { const emb = embedUrl(cur.videoUrl || ""); return emb
              ? <iframe className="media" src={emb} title={cur.title || "Video"} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen onClick={(e) => e.stopPropagation()} style={{ border: 0, width: "min(92vw,1100px)", aspectRatio: "16/9", borderRadius: 8 }} />
              : <video className="media" src={mediaUrl(cur.videoUrl || "")} controls autoPlay onClick={(e) => e.stopPropagation()} style={{ maxWidth: "92vw", maxHeight: "85vh", borderRadius: 8 }} />; })()
          ) : (
            <Tone tone={cur.tone} img={cur.imageUrl ? mediaUrl(cur.imageUrl) : undefined} className="media" label={cur.category.replace(/-/g, " ")} seed={cur.id} w={1200} h={800} />
          )}
          {items.length > 1 && <>
            <button className="nav prev" aria-label="Previous" onClick={(e) => { e.stopPropagation(); go(-1); }}><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg></button>
            <button className="nav next" aria-label="Next" onClick={(e) => { e.stopPropagation(); go(1); }}><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 6l6 6-6 6" /></svg></button>
          </>}
        </div>
      )}
    </>
  );
}

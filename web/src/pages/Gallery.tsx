import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, mediaUrl, thumbUrl } from "../lib/api";

type Photo = { id: number; imageUrl: string };

export default function Gallery() {
  const { token = "" } = useParams();
  const [state, setState] = useState<"loading" | "pin" | "ready" | "error">("loading");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [errMsg, setErrMsg] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [lb, setLb] = useState<number | null>(null);

  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "photo";
  const dlUrl = (p: Photo, i: number) => `${mediaUrl(p.imageUrl)}?dl=${slug}-${String(i + 1).padStart(2, "0")}.webp`;

  const open = useCallback(async (code: string) => {
    setBusy(true); setErrMsg("");
    try {
      const d = await api.galleryOpen(token, code);
      setTitle(d.title); setMessage(d.message || ""); setPhotos(d.photos || []); setState("ready");
    } catch (e: any) {
      const m = e?.message || "";
      if (/code/i.test(m)) { setErrMsg("That access code didn't match. Please try again."); setState("pin"); }
      else { setErrMsg(m || "This gallery isn't available."); setState("error"); }
    } finally { setBusy(false); }
  }, [token]);

  useEffect(() => {
    api.galleryInfo(token)
      .then((info) => { setTitle(info.title); if (info.needsPin) setState("pin"); else open(""); })
      .catch((e: any) => { setErrMsg(e?.message || "This gallery isn't available."); setState("error"); });
  }, [token, open]);

  // lightbox keyboard nav
  useEffect(() => {
    if (lb === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLb(null);
      if (e.key === "ArrowRight") setLb((i) => (i === null ? i : (i + 1) % photos.length));
      if (e.key === "ArrowLeft") setLb((i) => (i === null ? i : (i - 1 + photos.length) % photos.length));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lb, photos.length]);

  function downloadAll() {
    photos.forEach((p, i) => {
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = dlUrl(p, i); a.download = "";
        document.body.appendChild(a); a.click(); a.remove();
      }, i * 400); // stagger so the browser doesn't block the batch
    });
  }

  if (state === "loading") return <div className="spinner" />;

  if (state === "error") return (
    <div className="pagehead"><p className="eyebrow">Client gallery</p><h1>Gallery unavailable</h1><p>{errMsg}</p></div>
  );

  if (state === "pin") return (
    <>
      <div className="pagehead"><p className="eyebrow">Private gallery</p><h1>{title || "Your photos"}</h1><p>Enter the access code Tania shared with you to view your gallery.</p></div>
      <section>
        <div className="wrap" style={{ maxWidth: 420 }}>
          <form className="form-card" onSubmit={(e) => { e.preventDefault(); if (pin.trim()) open(pin.trim()); }}>
            <div className="field"><label>Access code</label><input value={pin} onChange={(e) => setPin(e.target.value)} autoFocus inputMode="numeric" placeholder="e.g. 1234" /></div>
            {errMsg && <div className="notice err" style={{ marginTop: 10 }}>{errMsg}</div>}
            <button className="btn btn-gold" style={{ marginTop: 16, width: "100%" }} disabled={busy || !pin.trim()}>{busy ? "Checking…" : "View my gallery"}</button>
          </form>
        </div>
      </section>
    </>
  );

  // ready
  return (
    <>
      <div className="pagehead">
        <p className="eyebrow">Your gallery</p>
        <h1>{title}</h1>
        {message ? <p style={{ whiteSpace: "pre-line" }}>{message}</p> : <p>{photos.length} {photos.length === 1 ? "photo" : "photos"}, ready to view and download.</p>}
      </div>
      <section>
        <div className="wrap">
          {photos.length === 0 ? (
            <p className="muted" style={{ textAlign: "center" }}>Your photos are being prepared — please check back soon.</p>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
                <span className="muted">{photos.length} {photos.length === 1 ? "photo" : "photos"}</span>
                <button className="btn btn-dark btn-sm" onClick={downloadAll}>Download all</button>
              </div>
              <div className="gallery-grid">
                {photos.map((p, i) => (
                  <button key={p.id} onClick={() => setLb(i)} aria-label={`Open photo ${i + 1}`}>
                    <img src={thumbUrl(p.imageUrl)} alt={`${title} — ${i + 1}`} loading="lazy" />
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {lb !== null && photos[lb] && (
        <div className="lb" onClick={() => setLb(null)}>
          <span className="count">{lb + 1} / {photos.length}</span>
          <img className="lb-img" src={mediaUrl(photos[lb].imageUrl)} alt={`${title} — ${lb + 1}`} onClick={(e) => e.stopPropagation()} />
          <a className="dl" href={dlUrl(photos[lb], lb)} onClick={(e) => e.stopPropagation()} aria-label="Download this photo">↓</a>
          <button className="cls" onClick={() => setLb(null)} aria-label="Close">✕</button>
          {photos.length > 1 && <>
            <button className="nav prev" onClick={(e) => { e.stopPropagation(); setLb((i) => (i === null ? i : (i - 1 + photos.length) % photos.length)); }} aria-label="Previous">‹</button>
            <button className="nav next" onClick={(e) => { e.stopPropagation(); setLb((i) => (i === null ? i : (i + 1) % photos.length)); }} aria-label="Next">›</button>
          </>}
        </div>
      )}
    </>
  );
}

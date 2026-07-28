import { useCallback, useEffect, useRef, useState } from "react";
import { api, uploadMedia, thumbUrl, type PortfolioItem, type PortfolioCategory } from "../lib/api";
import { ImagePicker } from "./Media";

const ORIENTATIONS = ["portrait", "landscape", "square"];

export function PortfolioAdmin() {
  const [cats, setCats] = useState<PortfolioCategory[]>([]);
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [activeCat, setActiveCat] = useState("all");
  const [editItem, setEditItem] = useState<PortfolioItem | null>(null);
  const [editCat, setEditCat] = useState<PortfolioCategory | "new" | null>(null);
  const [showCats, setShowCats] = useState(true);
  const [uploadMsg, setUploadMsg] = useState("");
  const [pct, setPct] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadCats = useCallback(() => api.adminPortfolioCategories().then(setCats).catch(() => {}), []);
  const loadItems = useCallback(() => api.adminPortfolio().then(setItems).catch(() => {}), []);
  useEffect(() => { loadCats(); loadItems(); }, [loadCats, loadItems]);

  const shown = items.filter((it) => activeCat === "all" || it.category === activeCat || (it.extraCategories ?? []).includes(activeCat));

  // reorder: swap two display-adjacent items in the full list, persist global order
  async function move(item: PortfolioItem, dir: -1 | 1) {
    const di = shown.findIndex((x) => x.id === item.id);
    const neighbour = shown[di + dir]; if (!neighbour) return;
    const full = [...items];
    const a = full.findIndex((x) => x.id === item.id), b = full.findIndex((x) => x.id === neighbour.id);
    [full[a], full[b]] = [full[b], full[a]];
    setItems(full);
    await api.adminReorderPortfolio(full.map((x) => x.id)).catch(() => {});
  }
  async function toggle(item: PortfolioItem, patch: Partial<PortfolioItem>) {
    setItems((cur) => cur.map((x) => (x.id === item.id ? { ...x, ...patch } : x)));
    await api.adminUpdatePortfolio(item.id, patch).catch(() => {});
  }
  async function del(item: PortfolioItem) {
    if (!confirm("Delete this portfolio item? (The photo stays in your Media Library.)")) return;
    await api.adminDeletePortfolio(item.id); loadItems(); loadCats();
  }

  // bulk add: upload many photos → create one item each in the active category
  async function bulkUpload(files: File[]) {
    if (!files.length) return;
    const cat = activeCat !== "all" ? activeCat : cats[0]?.slug;
    if (!cat) { setUploadMsg("Create a category first."); return; }
    setPct(0); setUploadMsg("");
    try {
      const r = await uploadMedia(files, { category: cat, onProgress: setPct });
      const urls = [...r.created, ...r.duplicates].map((m) => "/uploads/" + m.id);
      await api.adminBulkPortfolio(cat, urls);
      setUploadMsg(`${urls.length} photo(s) added to ${cats.find((c) => c.slug === cat)?.name || cat}.`);
      loadItems(); loadCats();
    } catch (e) { setUploadMsg(e instanceof Error ? e.message : "Upload failed."); }
    finally { setPct(null); setTimeout(() => setUploadMsg(""), 4000); }
  }

  return (
    <>
      <div className="ahead">
        <div><h1>Portfolio</h1><p className="muted">Manage your galleries, categories, order and videos.</p></div>
        <a className="btn btn-sm" href="/portfolio" target="_blank" rel="noreferrer">Preview gallery ↗</a>
      </div>

      {/* ---- categories manager ---- */}
      <div className="panel" style={{ padding: 16, marginBottom: 14 }}>
        <div className="ahead" style={{ marginBottom: showCats ? 12 : 0 }}>
          <h2 style={{ fontSize: 16, margin: 0 }}>Categories <span className="muted" style={{ fontWeight: 400 }}>({cats.length})</span></h2>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-sm" onClick={() => setShowCats((v) => !v)}>{showCats ? "Hide" : "Show"}</button>
            <button className="btn btn-dark btn-sm" onClick={() => setEditCat("new")}>+ Add category</button>
          </div>
        </div>
        {showCats && (cats.length === 0 ? <p className="muted" style={{ fontSize: 13 }}>No categories yet. Add your first.</p> : (
          <div style={{ display: "grid", gap: 8 }}>
            {cats.map((c, i) => (
              <div key={c.slug} style={{ display: "flex", alignItems: "center", gap: 10, border: "1px solid var(--line)", borderRadius: 10, padding: 8, background: "var(--card)" }}>
                <div style={{ width: 46, height: 46, borderRadius: 8, overflow: "hidden", background: "var(--beige)", flex: "0 0 auto" }}>{c.coverImageUrl && <img src={thumbUrl(c.coverImageUrl)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ fontSize: 14 }}>{c.name}</b>{!c.isActive && <span className="pill CANCELLED" style={{ marginLeft: 6 }}>Hidden</span>}
                  <div className="muted" style={{ fontSize: 12 }}>{c.count} photo{c.count === 1 ? "" : "s"} · /{c.slug}</div>
                </div>
                <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
                  <button className="icon-act" title="Move up" disabled={i === 0} onClick={async () => { const n = [...cats]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; setCats(n); await api.adminReorderPortfolioCategories(n.map((x) => x.slug)); }}>↑</button>
                  <button className="icon-act" title="Move down" disabled={i === cats.length - 1} onClick={async () => { const n = [...cats]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; setCats(n); await api.adminReorderPortfolioCategories(n.map((x) => x.slug)); }}>↓</button>
                  <button className="icon-act" onClick={() => setEditCat(c)}>Edit</button>
                  <button className="icon-act" style={{ color: "var(--crit)" }} onClick={async () => { if (confirm(`Delete category "${c.name}"? Photos stay but lose this category.`)) { await api.adminDeletePortfolioCategory(c.slug); loadCats(); loadItems(); } }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* ---- photos manager ---- */}
      <div className="panel" style={{ padding: 16 }}>
        <div className="chip-row" style={{ marginBottom: 12 }}>
          <button className={`chip ${activeCat === "all" ? "on" : ""}`} onClick={() => setActiveCat("all")}>All ({items.length})</button>
          {cats.map((c) => <button key={c.slug} className={`chip ${activeCat === c.slug ? "on" : ""}`} onClick={() => setActiveCat(c.slug)}>{c.name} ({c.count})</button>)}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <button className="btn btn-gold btn-sm" onClick={() => fileRef.current?.click()} disabled={pct !== null}>{pct !== null ? `Uploading… ${pct}%` : `+ Add photos${activeCat !== "all" ? " to " + (cats.find((c) => c.slug === activeCat)?.name || "") : ""}`}</button>
          <button className="btn btn-dark btn-sm" onClick={() => setEditItem({ id: 0, category: activeCat !== "all" ? activeCat : cats[0]?.slug || "", extraCategories: [], title: "", description: "", tone: "g-family", imageUrl: "", videoUrl: "", mediaType: "video", orientation: "landscape", isFeatured: false, isActive: true } as PortfolioItem)}>+ Add video</button>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { bulkUpload(Array.from(e.target.files || [])); e.target.value = ""; }} />
        </div>
        {uploadMsg && <p style={{ color: "var(--good)", fontWeight: 700, fontSize: 13, marginBottom: 10 }}>{uploadMsg}</p>}
        {pct !== null && <div className="uprog" style={{ marginBottom: 10 }}><i style={{ width: pct + "%" }} /></div>}

        {shown.length === 0 ? <p className="muted" style={{ padding: 24, textAlign: "center" }}>No photos here yet. Use “Add photos” above.</p> : (
          <div className="media-grid">
            {shown.map((it, i) => (
              <div key={it.id} className="media-cell" style={{ cursor: "default" }}>
                <div style={{ position: "relative" }}>
                  {it.mediaType === "video"
                    ? <div className="thumb" style={{ position: "relative", display: "grid", placeItems: "center" }}>{it.imageUrl ? <img src={thumbUrl(it.imageUrl)} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} /> : null}<span style={{ position: "relative", fontSize: 26, color: "#fff", textShadow: "0 1px 6px rgba(0,0,0,.6)" }}>▶</span></div>
                    : <img className="thumb" src={it.imageUrl ? thumbUrl(it.imageUrl) : ""} alt={it.title} loading="lazy" />}
                  {it.isFeatured && <span className="media-badge used">★</span>}
                  {!it.isActive && <span className="media-badge hid">Hidden</span>}
                </div>
                <div className="cap">
                  <b>{it.title || (it.mediaType === "video" ? "Video" : "Photo")}</b><span>{it.category}</span>
                  <div style={{ display: "flex", gap: 2, marginTop: 6, flexWrap: "wrap" }}>
                    <button className="icon-act" title="Move up" disabled={i === 0} onClick={() => move(it, -1)}>↑</button>
                    <button className="icon-act" title="Move down" disabled={i === shown.length - 1} onClick={() => move(it, 1)}>↓</button>
                    <button className="icon-act" title="Featured" onClick={() => toggle(it, { isFeatured: !it.isFeatured })}>{it.isFeatured ? "★" : "☆"}</button>
                    <button className="icon-act" title={it.isActive ? "Hide" : "Show"} onClick={() => toggle(it, { isActive: !it.isActive })}>{it.isActive ? "Hide" : "Show"}</button>
                    <button className="icon-act" onClick={() => setEditItem(it)}>Edit</button>
                    <button className="icon-act" style={{ color: "var(--crit)" }} onClick={() => del(it)}>✕</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editCat && <CategoryModal cat={editCat} onClose={() => setEditCat(null)} onSaved={() => { setEditCat(null); loadCats(); }} />}
      {editItem && <ItemModal item={editItem} cats={cats} onClose={() => setEditItem(null)} onSaved={() => { setEditItem(null); loadItems(); loadCats(); }} />}
    </>
  );
}


function CategoryModal({ cat, onClose, onSaved }: { cat: PortfolioCategory | "new"; onClose: () => void; onSaved: () => void }) {
  const isNew = cat === "new";
  const [f, setF] = useState<any>(isNew ? { name: "", blurb: "", coverImageUrl: "", isActive: true } : { ...cat });
  const [saving, setSaving] = useState(false); const [err, setErr] = useState("");
  const set = (p: any) => setF((c: any) => ({ ...c, ...p }));
  async function save() {
    if (!f.name.trim()) { setErr("Name is required."); return; }
    setSaving(true); setErr("");
    try {
      if (isNew) await api.adminCreatePortfolioCategory({ name: f.name, blurb: f.blurb, coverImageUrl: f.coverImageUrl, isActive: f.isActive });
      else await api.adminUpdatePortfolioCategory(f.slug, { name: f.name, blurb: f.blurb, coverImageUrl: f.coverImageUrl, isActive: f.isActive });
      onSaved();
    } catch (e) { setErr(e instanceof Error ? e.message : "Could not save."); } finally { setSaving(false); }
  }
  return (
    <div className="modal-back" onClick={onClose}><div className="modal-card sm" onClick={(e) => e.stopPropagation()}>
      <div className="ahead"><h1 style={{ fontSize: 20 }}>{isNew ? "Add" : "Edit"} category</h1><button className="icon-act" onClick={onClose}>Close</button></div>
      <div style={{ display: "grid", gap: 12 }}>
        <ImagePicker value={f.coverImageUrl || ""} onChange={(u) => set({ coverImageUrl: u })} label="Cover image" />
        <div className="field"><label>Name</label><input value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Weddings" /></div>
        <div className="field"><label>Short description (optional)</label><textarea rows={2} value={f.blurb || ""} onChange={(e) => set({ blurb: e.target.value })} /></div>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13.5 }}><input type="checkbox" style={{ width: "auto" }} checked={f.isActive !== false} onChange={(e) => set({ isActive: e.target.checked })} /> Visible on the website</label>
        {err && <p style={{ color: "var(--crit)", fontSize: 13 }}>{err}</p>}
        <button className="btn btn-gold btn-sm" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save category"}</button>
      </div>
    </div></div>
  );
}

function ItemModal({ item, cats, onClose, onSaved }: { item: PortfolioItem; cats: PortfolioCategory[]; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<any>({ ...item, extraCategories: item.extraCategories ?? [] });
  const [saving, setSaving] = useState(false); const [err, setErr] = useState("");
  const set = (p: any) => setF((c: any) => ({ ...c, ...p }));
  const isVideo = f.mediaType === "video";
  async function save() {
    if (!f.category) { setErr("Choose a category."); return; }
    if (isVideo && !f.videoUrl?.trim()) { setErr("Add the video link."); return; }
    if (!isVideo && !f.imageUrl) { setErr("Choose a photo."); return; }
    setSaving(true); setErr("");
    const body = { category: f.category, extraCategories: (f.extraCategories || []).filter((s: string) => s !== f.category), title: f.title || "", description: f.description || "", imageUrl: f.imageUrl || "", videoUrl: isVideo ? f.videoUrl : "", mediaType: f.mediaType || "photo", orientation: f.orientation || "portrait", isFeatured: !!f.isFeatured, isActive: f.isActive !== false, hasConsent: true, tone: f.tone || "g-family" };
    try { if (f.id) await api.adminUpdatePortfolio(f.id, body); else await api.adminCreatePortfolio(body); onSaved(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Could not save."); } finally { setSaving(false); }
  }
  const toggleExtra = (slug: string) => set({ extraCategories: (f.extraCategories || []).includes(slug) ? f.extraCategories.filter((s: string) => s !== slug) : [...(f.extraCategories || []), slug] });
  return (
    <div className="modal-back" onClick={onClose}><div className="modal-card sm" onClick={(e) => e.stopPropagation()}>
      <div className="ahead"><h1 style={{ fontSize: 20 }}>{f.id ? "Edit" : "Add"} {isVideo ? "video" : "photo"}</h1><button className="icon-act" onClick={onClose}>Close</button></div>
      <div style={{ display: "grid", gap: 12 }}>
        <div className="chip-row">
          <button className={`chip ${!isVideo ? "on" : ""}`} onClick={() => set({ mediaType: "photo" })}>Photo</button>
          <button className={`chip ${isVideo ? "on" : ""}`} onClick={() => set({ mediaType: "video" })}>Video</button>
        </div>
        {isVideo
          ? <><div className="field"><label>Video link (YouTube / Vimeo / direct)</label><input value={f.videoUrl || ""} onChange={(e) => set({ videoUrl: e.target.value })} placeholder="https://youtu.be/…" /></div><ImagePicker value={f.imageUrl || ""} onChange={(u) => set({ imageUrl: u })} label="Poster image (optional)" /></>
          : <ImagePicker value={f.imageUrl || ""} onChange={(u) => set({ imageUrl: u })} label="Photo" />}
        <div className="field"><label>Primary category</label><select value={f.category} onChange={(e) => set({ category: e.target.value })}><option value="">— choose —</option>{cats.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select></div>
        {cats.length > 1 && <div className="field"><label>Also show in (optional)</label><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{cats.filter((c) => c.slug !== f.category).map((c) => <button key={c.slug} type="button" className={`chip ${(f.extraCategories || []).includes(c.slug) ? "on" : ""}`} onClick={() => toggleExtra(c.slug)}>{c.name}</button>)}</div></div>}
        <div className="field"><label>Title (optional)</label><input value={f.title || ""} onChange={(e) => set({ title: e.target.value })} /></div>
        <div className="field"><label>Description (optional)</label><textarea rows={2} value={f.description || ""} onChange={(e) => set({ description: e.target.value })} /></div>
        <div className="field"><label>Shape</label><select value={f.orientation} onChange={(e) => set({ orientation: e.target.value })}>{ORIENTATIONS.map((o) => <option key={o}>{o}</option>)}</select></div>
        <div style={{ display: "flex", gap: 18 }}>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13.5 }}><input type="checkbox" style={{ width: "auto" }} checked={!!f.isFeatured} onChange={(e) => set({ isFeatured: e.target.checked })} /> Featured</label>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13.5 }}><input type="checkbox" style={{ width: "auto" }} checked={f.isActive !== false} onChange={(e) => set({ isActive: e.target.checked })} /> Visible</label>
        </div>
        {err && <p style={{ color: "var(--crit)", fontSize: 13 }}>{err}</p>}
        <button className="btn btn-gold btn-sm" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
      </div>
    </div></div>
  );
}

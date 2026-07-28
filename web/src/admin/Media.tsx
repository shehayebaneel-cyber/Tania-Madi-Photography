import { useCallback, useEffect, useRef, useState } from "react";
import { api, uploadMedia, mediaUrl, thumbUrl, type Media } from "../lib/api";

// ── shared upload area (works from phone gallery AND camera) ──────────────────
function UploadArea({ category, onDone, compact }: { category?: string; onDone: (r: { created: Media[]; duplicates: Media[] }) => void; compact?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  const [err, setErr] = useState("");
  const [drag, setDrag] = useState(false);
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const send = useCallback(async (files: File[]) => {
    if (!files.length || busy) return;
    setErr(""); setBusy(true); setPct(0);
    try {
      const r = await uploadMedia(files, { category, onProgress: setPct });
      onDone(r);
    } catch (e) { setErr(e instanceof Error ? e.message : "Upload failed."); }
    finally { setBusy(false); setPct(0); }
  }, [busy, category, onDone]);

  return (
    <div>
      <div
        className={`dropzone ${drag ? "drag" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); send(Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"))); }}
        onClick={() => galleryRef.current?.click()}
        style={compact ? { padding: 16 } : undefined}
      >
        {busy ? (
          <div>
            <b style={{ color: "var(--ink)" }}>Uploading… {pct}%</b>
            <div className="uprog"><i style={{ width: pct + "%" }} /></div>
          </div>
        ) : (
          <>
            <b style={{ color: "var(--ink)", fontSize: 14 }}>Drop photos here, or choose</b>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 10, flexWrap: "wrap" }}>
              <button type="button" className="btn btn-dark btn-sm" onClick={(e) => { e.stopPropagation(); galleryRef.current?.click(); }}>📁 From gallery</button>
              <button type="button" className="btn btn-gold btn-sm" onClick={(e) => { e.stopPropagation(); cameraRef.current?.click(); }}>📷 Take photo</button>
            </div>
            <p className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>JPG, PNG, WebP or HEIC · optimised to WebP automatically · you can select many at once</p>
          </>
        )}
      </div>
      {err && <p style={{ color: "var(--crit)", fontSize: 13, marginTop: 8 }}>{err}</p>}
      <input ref={galleryRef} type="file" accept="image/*" multiple hidden onChange={(e) => { send(Array.from(e.target.files || [])); e.target.value = ""; }} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { send(Array.from(e.target.files || [])); e.target.value = ""; }} />
    </div>
  );
}

// ── a media thumbnail grid ────────────────────────────────────────────────────
function MediaGrid({ items, onPick, selectedId, showBadges }: { items: Media[]; onPick: (m: Media) => void; selectedId?: string; showBadges?: boolean }) {
  return (
    <div className="media-grid">
      {items.map((m) => (
        <button key={m.id} type="button" className={`media-cell ${selectedId === m.id ? "sel" : ""}`} onClick={() => onPick(m)}>
          <img className="thumb" src={thumbUrl("/uploads/" + m.id)} alt={m.alt || m.title} loading="lazy" />
          {showBadges && m.isArchived && <span className="media-badge hid">Hidden</span>}
          {showBadges && (m.used ? <span className="media-badge used">In use</span> : <span className="media-badge">Unused</span>)}
          <div className="cap"><b>{m.title || m.originalName || "Untitled"}</b><span>{m.category || "—"} · {m.width}×{m.height}</span></div>
        </button>
      ))}
    </div>
  );
}

// ── edit one media item (title / alt / caption / category / focal / hide / delete)
function MediaEditModal({ media, onClose, onChanged, onDeleted }: { media: Media; onClose: () => void; onChanged: (m: Media) => void; onDeleted: (id: string) => void }) {
  const [m, setM] = useState<Media>(media);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const set = (patch: Partial<Media>) => setM((c) => ({ ...c, ...patch }));

  async function save() {
    setSaving(true); setMsg("");
    try {
      const up = await api.adminUpdateMedia(m.id, { title: m.title, alt: m.alt, caption: m.caption, category: m.category, focalX: m.focalX, focalY: m.focalY, isArchived: m.isArchived });
      onChanged({ ...m, ...up }); setMsg("Saved ✓");
    } catch (e) { setMsg(e instanceof Error ? e.message : "Could not save."); }
    finally { setSaving(false); }
  }
  async function del() {
    if (!confirm("Delete this image permanently? This cannot be undone.")) return;
    try {
      const r = await api.adminDeleteMedia(m.id);
      if (r.ok) { onDeleted(m.id); return; }
    } catch (e) {
      const emsg = e instanceof Error ? e.message : "";
      if (/in use/i.test(emsg) && confirm("This image is still used on the website. Delete anyway? It will disappear from those places.")) {
        const r = await api.adminDeleteMedia(m.id, true); if (r.ok) onDeleted(m.id);
      } else setMsg(emsg || "Could not delete.");
    }
  }

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="ahead"><h1 style={{ fontSize: 20 }}>Edit image</h1><button className="icon-act" onClick={onClose}>Close</button></div>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.1fr)", gap: 18 }} className="media-edit-grid">
          <div>
            <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", border: "1px solid var(--line)", cursor: "crosshair" }}
              onClick={(e) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); set({ focalX: +((e.clientX - r.left) / r.width).toFixed(3), focalY: +((e.clientY - r.top) / r.height).toFixed(3) }); }}>
              <img src={mediaUrl("/uploads/" + m.id)} alt={m.alt} style={{ width: "100%", display: "block" }} />
              <span className="focalpt" style={{ left: (m.focalX * 100) + "%", top: (m.focalY * 100) + "%" }} />
            </div>
            <p className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>Click the image to set the focal point (kept in view when cropped). {m.width}×{m.height} · {(m.bytes / 1024).toFixed(0)} KB</p>
            {m.usedIn && m.usedIn.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <b style={{ fontSize: 12 }}>Used in {m.usedIn.length} place(s):</b>
                <ul style={{ margin: "4px 0 0 16px", fontSize: 12, color: "var(--ink-2)" }}>{m.usedIn.map((u, i) => <li key={i}>{u}</li>)}</ul>
              </div>
            )}
          </div>
          <div style={{ display: "grid", gap: 10, alignContent: "start" }}>
            <div className="field"><label>Title</label><input value={m.title} onChange={(e) => set({ title: e.target.value })} /></div>
            <div className="field"><label>Alt text (for SEO / accessibility)</label><input value={m.alt} onChange={(e) => set({ alt: e.target.value })} placeholder="Describe the photo" /></div>
            <div className="field"><label>Caption</label><textarea value={m.caption} onChange={(e) => set({ caption: e.target.value })} rows={2} /></div>
            <div className="field"><label>Category / folder</label><input value={m.category} onChange={(e) => set({ category: e.target.value })} placeholder="e.g. weddings, hero, about" /></div>
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13.5 }}><input type="checkbox" style={{ width: "auto" }} checked={m.isArchived} onChange={(e) => set({ isArchived: e.target.checked })} /> Hidden (kept in library, not shown in pickers)</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
              <button className="btn btn-gold btn-sm" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
              <button className="btn btn-sm" style={{ border: "1px solid var(--crit)", color: "var(--crit)" }} onClick={del}>Delete</button>
              {msg && <span className="muted" style={{ fontSize: 12.5 }}>{msg}</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── the full Media Library tab ────────────────────────────────────────────────
export function MediaLibrary() {
  const [items, setItems] = useState<Media[]>([]);
  const [cats, setCats] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [showHidden, setShowHidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<Media | null>(null);
  const [flash, setFlash] = useState("");
  const pageSize = 24;

  const load = useCallback(() => {
    setLoading(true);
    api.adminMedia({ q, category, page, includeArchived: showHidden })
      .then((r) => { setItems(r.items); setCats(r.categories); setTotal(r.total); })
      .catch(() => {}).finally(() => setLoading(false));
  }, [q, category, page, showHidden]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [q, category, showHidden]);

  const openEdit = async (m: Media) => { try { setEdit(await api.adminMediaItem(m.id)); } catch { setEdit(m); } };
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <>
      <div className="ahead"><div><h1>Media Library</h1><p className="muted">Every photo used on the website. {total} image{total === 1 ? "" : "s"}.</p></div></div>

      <div className="panel" style={{ padding: 16, marginBottom: 14 }}>
        <UploadArea onDone={(r) => {
          setFlash(`${r.created.length} added${r.duplicates.length ? ` · ${r.duplicates.length} already existed (skipped)` : ""}.`);
          setPage(1); load(); setTimeout(() => setFlash(""), 4000);
        }} />
        {flash && <p style={{ color: "var(--good)", fontWeight: 700, fontSize: 13, marginTop: 8 }}>{flash}</p>}
      </div>

      <div className="panel" style={{ padding: 14 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
          <input placeholder="Search title, alt, caption…" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: "1 1 200px", padding: "8px 11px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--card)", color: "var(--ink)" }} />
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--card)", color: "var(--ink)", fontWeight: 700 }}>
            <option value="">All folders</option>
            {cats.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}><input type="checkbox" style={{ width: "auto" }} checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} /> Show hidden</label>
        </div>

        {loading ? <p className="muted" style={{ padding: 20, textAlign: "center" }}>Loading…</p>
          : items.length === 0 ? <p className="muted" style={{ padding: 30, textAlign: "center" }}>No images yet. Upload your first photos above.</p>
            : <MediaGrid items={items} onPick={openEdit} showBadges />}

        {pages > 1 && (
          <div style={{ display: "flex", gap: 8, justifyContent: "center", alignItems: "center", marginTop: 14 }}>
            <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Prev</button>
            <span className="muted" style={{ fontSize: 13 }}>Page {page} of {pages}</span>
            <button className="btn btn-sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next →</button>
          </div>
        )}
      </div>

      {edit && <MediaEditModal media={edit} onClose={() => setEdit(null)} onChanged={(m) => { setEdit(null); setItems((cur) => cur.map((x) => (x.id === m.id ? { ...x, ...m } : x))); load(); }} onDeleted={() => { setEdit(null); load(); }} />}
    </>
  );
}

// ── reusable image picker (pick from library OR upload) ───────────────────────
export function ImagePicker({ value, onChange, label = "Image" }: { value: string; onChange: (url: string) => void; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--ink-2)", marginBottom: 5 }}>{label}</label>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <div style={{ width: 84, height: 84, borderRadius: 10, border: "1px solid var(--line)", overflow: "hidden", background: "var(--beige)", flex: "0 0 auto", display: "grid", placeItems: "center" }}>
          {value ? <img src={thumbUrl(value)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span className="muted" style={{ fontSize: 11 }}>No image</span>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <button type="button" className="btn btn-dark btn-sm" onClick={() => setOpen(true)}>{value ? "Change image" : "Choose image"}</button>
          {value && <button type="button" className="icon-act" onClick={() => onChange("")}>Remove</button>}
        </div>
      </div>
      {open && <ImagePickerModal onClose={() => setOpen(false)} onSelect={(m) => { onChange("/uploads/" + m.id); setOpen(false); }} />}
    </div>
  );
}

function ImagePickerModal({ onClose, onSelect }: { onClose: () => void; onSelect: (m: Media) => void }) {
  const [tab, setTab] = useState<"library" | "upload">("library");
  const [items, setItems] = useState<Media[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => { setLoading(true); api.adminMedia({ q, page: 1 }).then((r) => setItems(r.items)).catch(() => {}).finally(() => setLoading(false)); }, [q]);
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [load]);

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="ahead">
          <div className="chip-row">
            <button className={`chip ${tab === "library" ? "on" : ""}`} onClick={() => setTab("library")}>Library</button>
            <button className={`chip ${tab === "upload" ? "on" : ""}`} onClick={() => setTab("upload")}>Upload new</button>
          </div>
          <button className="icon-act" onClick={onClose}>Close</button>
        </div>
        {tab === "upload" ? (
          <UploadArea onDone={(r) => { const first = r.created[0] || r.duplicates[0]; if (first) onSelect(first); else { setTab("library"); load(); } }} />
        ) : (
          <>
            <input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: "100%", padding: "8px 11px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--card)", color: "var(--ink)", marginBottom: 12 }} />
            {loading ? <p className="muted" style={{ padding: 20, textAlign: "center" }}>Loading…</p>
              : items.length === 0 ? <p className="muted" style={{ padding: 20, textAlign: "center" }}>No images. Switch to “Upload new”.</p>
                : <MediaGrid items={items} onPick={onSelect} />}
          </>
        )}
      </div>
    </div>
  );
}

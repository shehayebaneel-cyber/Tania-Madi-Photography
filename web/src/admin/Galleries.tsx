import { useEffect, useRef, useState } from "react";
import { api, uploadMedia, thumbUrl } from "../lib/api";
import { ImagePicker } from "./Media";

const clientLink = (token: string) => `${location.origin}/g/${token}`;

export function GalleriesAdmin() {
  const [rows, setRows] = useState<any[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const load = () => api.adminGalleries().then(setRows).catch(() => setRows([]));
  useEffect(() => { load(); }, []);

  return (
    <>
      <div className="ahead"><div><h1>Client galleries</h1><p className="muted">Deliver a session's photos privately — share a link (and optional access code) over WhatsApp.</p></div><button className="btn btn-dark btn-sm" onClick={() => setCreating(true)}>+ New gallery</button></div>
      <div className="panel">
        <div className="table-scroll"><table>
          <thead><tr><th>Gallery</th><th>Client</th><th>Photos</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {!rows ? <tr><td colSpan={5} className="muted">Loading…</td></tr>
              : rows.length === 0 ? <tr><td colSpan={5} className="muted">No galleries yet. Create one to deliver photos to a client.</td></tr>
                : rows.map((g) => (
                  <tr key={g.id}>
                    <td><button className="linklike" onClick={() => setOpenId(g.id)}>{g.title}</button></td>
                    <td>{g.customerName || <span className="muted">—</span>}</td>
                    <td>{g._count?.photos ?? 0}</td>
                    <td>{g.isPublished ? <span className="pill" style={{ background: "var(--good-bg)", color: "var(--good)" }}>Live</span> : <span className="pill">Draft</span>}</td>
                    <td style={{ whiteSpace: "nowrap" }}><button className="icon-act" onClick={() => setOpenId(g.id)}>Open</button></td>
                  </tr>
                ))}
          </tbody>
        </table></div>
      </div>
      {creating && <CreateGallery onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); load(); setOpenId(id); }} />}
      {openId != null && <GalleryDetail id={openId} onClose={() => { setOpenId(null); load(); }} />}
    </>
  );
}

function CreateGallery({ onClose, onCreated }: { onClose: () => void; onCreated: (id: number) => void }) {
  const [title, setTitle] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  async function save() {
    if (title.trim().length < 2) return setErr("Give the gallery a title.");
    setBusy(true); setErr("");
    try { const g = await api.adminCreateGallery({ title, customerName, pin }); onCreated(g.id); }
    catch (e: any) { setErr(e?.message || "Could not create."); setBusy(false); }
  }
  return (
    <div className="modal-back" onClick={onClose}><div className="modal-card sm" onClick={(e) => e.stopPropagation()}>
      <div className="ahead"><h1 style={{ fontSize: 20 }}>New gallery</h1><button className="icon-act" onClick={onClose}>Close</button></div>
      <div style={{ display: "grid", gap: 10 }}>
        <div className="field"><label>Title</label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Sara & Karim — Wedding" autoFocus /></div>
        <div className="field"><label>Client name (optional)</label><input value={customerName} onChange={(e) => setCustomerName(e.target.value)} /></div>
        <div className="field"><label>Access code / PIN (optional)</label><input value={pin} onChange={(e) => setPin(e.target.value)} placeholder="Leave blank for a link-only gallery" /></div>
        {err && <p style={{ color: "var(--crit)", fontSize: 13, margin: 0 }}>{err}</p>}
        <div><button className="btn btn-gold btn-sm" disabled={busy} onClick={save}>{busy ? "Creating…" : "Create gallery"}</button></div>
      </div>
    </div></div>
  );
}

function GalleryDetail({ id, onClose }: { id: number; onClose: () => void }) {
  const [g, setG] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [pct, setPct] = useState(0);
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const load = () => api.adminGallery(id).then(setG).catch(() => {});
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!g) return <div className="modal-back" onClick={onClose}><div className="modal-card" onClick={(e) => e.stopPropagation()}><div className="spinner" /></div></div>;

  const link = clientLink(g.token);
  const save = async (patch: any) => { const u = await api.adminUpdateGallery(id, patch); setG((p: any) => ({ ...p, ...u })); };

  async function onFiles(files: FileList | null) {
    if (!files || !files.length) return;
    setUploading(true); setPct(0);
    try {
      const { created, duplicates } = await uploadMedia(Array.from(files), { category: "gallery", onProgress: setPct });
      const urls = [...created, ...duplicates].map((m: any) => `/uploads/${m.id}`);
      if (urls.length) { await api.adminAddGalleryPhotos(id, urls); await load(); }
    } catch (e: any) { setMsg(e?.message || "Upload failed."); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  }
  async function addFromLibrary(url: string) {
    if (!url) return;
    await api.adminAddGalleryPhotos(id, [url]); await load();
  }
  async function removePhoto(pid: number) { await api.adminDeleteGalleryPhoto(pid); await load(); }

  const waShare = `https://wa.me/?text=${encodeURIComponent(`Your photos are ready 💛\n${g.title}\n${link}${g.pin ? `\nAccess code: ${g.pin}` : ""}`)}`;

  return (
    <div className="modal-back" onClick={onClose}><div className="modal-card" onClick={(e) => e.stopPropagation()}>
      <div className="ahead">
        <div><h1 style={{ fontSize: 21 }}>{g.title}</h1>{g.customerName && <p className="muted" style={{ margin: 0 }}>{g.customerName}</p>}</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className={`btn btn-sm ${g.isPublished ? "btn-outline" : "btn-gold"}`} onClick={() => save({ isPublished: !g.isPublished })}>{g.isPublished ? "Unpublish" : "Publish"}</button>
          <button className="icon-act" onClick={onClose}>Close</button>
        </div>
      </div>

      {/* Share */}
      <div className="panel" style={{ padding: 14, marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span className="pill" style={{ background: g.isPublished ? "var(--good-bg)" : "var(--warn-bg)", color: g.isPublished ? "var(--good)" : "var(--warn)" }}>{g.isPublished ? "Live — clients can open this link" : "Draft — publish before sharing"}</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
          <input readOnly value={link} className="field" style={{ flex: "1 1 260px", minWidth: 0 }} onFocus={(e) => e.target.select()} />
          <button className="btn btn-sm" onClick={() => { navigator.clipboard?.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? "Copied ✓" : "Copy link"}</button>
          <a className="btn btn-gold btn-sm" href={waShare} target="_blank" rel="noreferrer">Share on WhatsApp</a>
        </div>
        <div className="grid2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
          <div className="field"><label>Access code / PIN</label><input defaultValue={g.pin} onBlur={(e) => e.target.value !== g.pin && save({ pin: e.target.value })} placeholder="blank = no code" /></div>
          <div className="field"><label>Expires on (optional)</label><input type="date" defaultValue={g.expiresAt ? g.expiresAt.slice(0, 10) : ""} onBlur={(e) => save({ expiresAt: e.target.value || null })} /></div>
        </div>
        <div className="field" style={{ marginTop: 10 }}><label>Welcome note (shown to the client)</label><textarea rows={2} defaultValue={g.message} onBlur={(e) => e.target.value !== g.message && save({ message: e.target.value })} placeholder="Thank you for trusting me with your day…" /></div>
      </div>

      {/* Photos */}
      <div className="panel" style={{ padding: 14 }}>
        <div className="ahead" style={{ marginBottom: 10 }}>
          <h2 style={{ fontSize: 15, margin: 0 }}>Photos <span className="muted">· {g.photos.length}</span></h2>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
            <button className="btn btn-dark btn-sm" disabled={uploading} onClick={() => fileRef.current?.click()}>{uploading ? `Uploading ${pct}%…` : "Upload photos"}</button>
          </div>
        </div>
        <div style={{ marginBottom: 12 }}><ImagePicker value="" onChange={addFromLibrary} label="…or add from your media library" /></div>
        {msg && <p style={{ color: "var(--crit)", fontSize: 13 }}>{msg}</p>}
        {g.photos.length === 0 ? <p className="muted" style={{ fontSize: 13 }}>No photos yet. Upload the finished session photos above.</p> : (
          <div className="gal-admin-grid">
            {g.photos.map((p: any) => (
              <div key={p.id} className="gal-admin-cell">
                <img src={thumbUrl(p.imageUrl)} alt="" loading="lazy" />
                <button className="gal-admin-del" onClick={() => removePhoto(p.id)} aria-label="Remove photo">✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
        <button className="btn btn-sm" style={{ color: "var(--crit)", borderColor: "var(--crit)" }} onClick={async () => { if (confirm("Delete this gallery and all its photos? The client link will stop working.")) { await api.adminDeleteGallery(id); onClose(); } }}>Delete gallery</button>
      </div>
    </div></div>
  );
}

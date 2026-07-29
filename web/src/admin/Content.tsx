import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";

const openPreview = (path: string) => window.open(path + (path.includes("?") ? "&" : "?") + "preview=1", "_blank");

type Field = { n: string; l: string; t?: "text" | "textarea" | "bool" };
const SECTIONS: { key: string; title: string; preview: string; fields: Field[] }[] = [
  { key: "contact", title: "Contact & studio info", preview: "/contact", fields: [
    { n: "phone", l: "Phone" }, { n: "whatsapp", l: "WhatsApp" }, { n: "email", l: "Email" },
    { n: "instagram", l: "Instagram handle" }, { n: "instagramUrl", l: "Instagram URL" },
    { n: "address", l: "Studio address", t: "textarea" }, { n: "hours", l: "Working hours" }, { n: "mapUrl", l: "Google Maps link" } ] },
  { key: "home", title: "Homepage text", preview: "/", fields: [
    { n: "heroTitle", l: "Hero heading", t: "textarea" }, { n: "heroSubtitle", l: "Hero subheading", t: "textarea" },
    { n: "aboutTitle", l: "About heading" }, { n: "aboutBody", l: "About text", t: "textarea" } ] },
  { key: "promo", title: "Promotional banner", preview: "/", fields: [
    { n: "active", l: "Show the banner on the homepage", t: "bool" }, { n: "title", l: "Title" },
    { n: "text", l: "Text", t: "textarea" }, { n: "ctaLabel", l: "Button label" }, { n: "ctaHref", l: "Button link (e.g. /book)" } ] },
  { key: "policies", title: "Policies", preview: "/", fields: [{ n: "text", l: "Policies text", t: "textarea" }] },
  { key: "bookingInfo", title: "Booking instructions", preview: "/book", fields: [{ n: "text", l: "Booking instructions", t: "textarea" }] },
];

export function WebsiteContent() {
  const [data, setData] = useState<{ published: Record<string, any>; drafts: Record<string, any> } | null>(null);
  const load = useCallback(() => api.adminContent().then(setData).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);
  if (!data) return <div className="spinner" />;
  return (
    <>
      <div className="ahead"><div><h1>Website Content</h1><p className="muted">Edit your site's text and info. Save a draft, preview it, then publish when you're happy.</p></div>
        <button className="btn btn-sm" onClick={() => openPreview("/")}>Preview site ↗</button></div>
      {SECTIONS.map((s) => <Section key={s.key} sec={s} published={data.published[s.key] || {}} draft={data.drafts[s.key]} onChanged={load} />)}
      <Testimonials />
    </>
  );
}

function Section({ sec, published, draft, onChanged }: { sec: any; published: any; draft: any; onChanged: () => void }) {
  const [v, setV] = useState<any>({ ...(draft ?? published) });
  const [msg, setMsg] = useState("");
  const hasDraft = draft !== undefined;
  const set = (n: string, val: any) => setV((c: any) => ({ ...c, [n]: val }));
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 2500); };
  async function saveDraft() { await api.adminSaveDraft(sec.key, v); flash("Draft saved"); onChanged(); }
  async function publish() { await api.adminSaveDraft(sec.key, v); await api.adminPublishContent(sec.key); flash("Published ✓"); onChanged(); }
  async function discard() { await api.adminDiscardContent(sec.key); setV({ ...published }); onChanged(); }
  return (
    <div className="panel" style={{ padding: 16, marginBottom: 14 }}>
      <div className="ahead" style={{ marginBottom: 10 }}>
        <h2 style={{ fontSize: 15, margin: 0, display: "flex", gap: 8, alignItems: "center" }}>{sec.title}{hasDraft && <span style={{ background: "var(--warn-bg)", color: "var(--warn)", fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 999 }}>Draft — not published</span>}</h2>
        <button className="btn btn-sm" onClick={() => openPreview(sec.preview)}>Preview ↗</button>
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        {sec.fields.map((f: Field) => f.t === "bool"
          ? <label key={f.n} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13.5 }}><input type="checkbox" style={{ width: "auto" }} checked={!!v[f.n]} onChange={(e) => set(f.n, e.target.checked)} /> {f.l}</label>
          : <div className="field" key={f.n}><label>{f.l}</label>{f.t === "textarea" ? <textarea rows={2} value={v[f.n] || ""} onChange={(e) => set(f.n, e.target.value)} /> : <input value={v[f.n] || ""} onChange={(e) => set(f.n, e.target.value)} />}</div>)}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12 }}>
        <button className="btn btn-sm" onClick={saveDraft}>Save draft</button>
        <button className="btn btn-gold btn-sm" onClick={publish}>Publish</button>
        {hasDraft && <button className="icon-act" onClick={discard}>Discard draft</button>}
        {msg && <span style={{ color: "var(--good)", fontSize: 12.5, fontWeight: 700 }}>{msg}</span>}
      </div>
    </div>
  );
}

function Testimonials() {
  const [rows, setRows] = useState<any[]>([]);
  const [edit, setEdit] = useState<any | null>(null);
  const load = () => api.adminTestimonials().then(setRows).catch(() => {});
  useEffect(() => { load(); }, []);
  return (
    <div className="panel" style={{ padding: 16 }}>
      <div className="ahead" style={{ marginBottom: 10 }}><h2 style={{ fontSize: 15, margin: 0 }}>Testimonials</h2><button className="btn btn-dark btn-sm" onClick={() => setEdit({ name: "", sessionType: "", text: "", rating: 5, isActive: true })}>+ Add</button></div>
      {rows.length === 0 ? <p className="muted" style={{ fontSize: 13 }}>No testimonials yet.</p> : (
        <div style={{ display: "grid", gap: 8 }}>{rows.map((t) => (
          <div key={t.id} style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "8px 12px", display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ flex: 1, minWidth: 0 }}><b style={{ fontSize: 13.5 }}>{t.name}</b> <span className="muted" style={{ fontSize: 12 }}>· {t.sessionType} · {"★".repeat(t.rating)}</span>{!t.isActive && <span className="pill CANCELLED" style={{ marginLeft: 6 }}>Hidden</span>}<div className="muted" style={{ fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.text}</div></div>
            <button className="icon-act" onClick={() => setEdit(t)}>Edit</button>
            <button className="icon-act" style={{ color: "var(--crit)" }} onClick={async () => { if (confirm("Delete this testimonial?")) { await api.adminDeleteTestimonial(t.id); load(); } }}>Delete</button>
          </div>))}</div>
      )}
      {edit && <TestimonialForm t={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
    </div>
  );
}

function TestimonialForm({ t, onClose, onSaved }: { t: any; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<any>({ ...t });
  const [saving, setSaving] = useState(false);
  const set = (p: any) => setF((c: any) => ({ ...c, ...p }));
  async function save() { if (!f.name?.trim() || !f.text?.trim()) return; setSaving(true); try { if (f.id) await api.adminUpdateTestimonial(f.id, f); else await api.adminCreateTestimonial(f); onSaved(); } finally { setSaving(false); } }
  return (
    <div className="modal-back" onClick={onClose}><div className="modal-card sm" onClick={(e) => e.stopPropagation()}>
      <div className="ahead"><h1 style={{ fontSize: 20 }}>{f.id ? "Edit" : "Add"} testimonial</h1><button className="icon-act" onClick={onClose}>Close</button></div>
      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="field"><label>Name</label><input value={f.name || ""} onChange={(e) => set({ name: e.target.value })} /></div>
          <div className="field"><label>Session type</label><input value={f.sessionType || ""} onChange={(e) => set({ sessionType: e.target.value })} placeholder="Wedding, Newborn…" /></div>
        </div>
        <div className="field"><label>Rating</label><select value={f.rating} onChange={(e) => set({ rating: Number(e.target.value) })}>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{"★".repeat(n)}</option>)}</select></div>
        <div className="field"><label>Text</label><textarea rows={3} value={f.text || ""} onChange={(e) => set({ text: e.target.value })} /></div>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13.5 }}><input type="checkbox" style={{ width: "auto" }} checked={f.isActive !== false} onChange={(e) => set({ isActive: e.target.checked })} /> Show on the website</label>
        <button className="btn btn-gold btn-sm" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
      </div>
    </div></div>
  );
}

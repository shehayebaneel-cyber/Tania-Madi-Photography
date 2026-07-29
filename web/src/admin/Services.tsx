import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";

export function ServicesAdmin() {
  const [services, setServices] = useState<any[]>([]);
  const [editSvc, setEditSvc] = useState<any | null>(null);
  const load = useCallback(() => api.adminServices().then(setServices).catch(() => {}), []);
  const [full, setFull] = useState<any[]>([]);
  // public endpoint returns packages nested; admin list doesn't — fetch public for packages
  useEffect(() => { load(); api.services().then(setFull).catch(() => {}); }, [load]);
  const reload = () => { load(); api.services().then(setFull).catch(() => {}); };
  const pkgOf = (slug: string) => full.find((s) => s.slug === slug)?.packages || [];

  return (
    <>
      <div className="ahead"><div><h1>Services &amp; Packages</h1><p className="muted">Edit what you offer, descriptions, "starting from" prices and packages.</p></div>
        <button className="btn btn-sm" onClick={() => window.open("/services?preview=1", "_blank")}>Preview ↗</button></div>
      <div style={{ display: "grid", gap: 12 }}>
        {services.map((s) => (
          <div key={s.slug} className="panel" style={{ padding: 16 }}>
            <div className="ahead" style={{ marginBottom: 8 }}>
              <div><h2 style={{ fontSize: 16, margin: 0 }}>{s.name}{!s.isActive && <span className="pill CANCELLED" style={{ marginLeft: 8 }}>Hidden</span>}</h2>
                <p className="muted" style={{ fontSize: 12.5, margin: "2px 0 0" }}>{s.tagline}{s.startingPrice ? ` · from $${s.startingPrice}` : ""}</p></div>
              <button className="btn btn-sm" onClick={() => setEditSvc(s)}>Edit service</button>
            </div>
            <PackagesManager slug={s.slug} packages={pkgOf(s.slug)} onChanged={reload} />
          </div>
        ))}
      </div>
      {editSvc && <ServiceModal svc={editSvc} onClose={() => setEditSvc(null)} onSaved={() => { setEditSvc(null); reload(); }} />}
    </>
  );
}

function PackagesManager({ slug, packages, onChanged }: { slug: string; packages: any[]; onChanged: () => void }) {
  const [edit, setEdit] = useState<any | null>(null);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <b style={{ fontSize: 13 }}>Packages ({packages.length})</b>
        <button className="btn btn-dark btn-sm" onClick={() => setEdit({ serviceSlug: slug, name: "", price: "", requestPricing: false, durationText: "", editedPhotos: "", outfits: "", features: [], deposit: 0, deliveryDays: "", revisions: 1, isActive: true })}>+ Add package</button>
      </div>
      {packages.length === 0 ? <p className="muted" style={{ fontSize: 12.5 }}>No packages yet.</p> : (
        <div style={{ display: "grid", gap: 6 }}>{packages.map((p) => (
          <div key={p.id} style={{ display: "flex", gap: 10, alignItems: "center", border: "1px solid var(--line)", borderRadius: 8, padding: "7px 10px" }}>
            <div style={{ flex: 1, minWidth: 0 }}><b style={{ fontSize: 13.5 }}>{p.name}</b> <span className="muted" style={{ fontSize: 12 }}>· {p.requestPricing ? "on request" : "$" + p.price}{p.durationText ? ` · ${p.durationText}` : ""}{p.deposit ? ` · dep $${p.deposit}` : ""}</span></div>
            <button className="icon-act" onClick={() => setEdit({ ...p, serviceSlug: slug })}>Edit</button>
            <button className="icon-act" style={{ color: "var(--crit)" }} onClick={async () => { if (confirm(`Delete package "${p.name}"?`)) { await api.adminDeletePackage(p.id); onChanged(); } }}>Delete</button>
          </div>))}</div>
      )}
      {edit && <PackageModal pkg={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); onChanged(); }} />}
    </div>
  );
}

function ServiceModal({ svc, onClose, onSaved }: { svc: any; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<any>({ ...svc, includes: svc.includes || [], faqs: svc.faqs || [] });
  const [saving, setSaving] = useState(false);
  const set = (p: any) => setF((c: any) => ({ ...c, ...p }));
  async function save() {
    setSaving(true);
    try { await api.adminUpdateService(f.slug, { name: f.name, tagline: f.tagline, description: f.description, startingPrice: f.startingPrice, durationMinutes: Number(f.durationMinutes) || 0, durationText: f.durationText, locationText: f.locationText, isActive: f.isActive, includes: f.includes.filter((x: string) => x.trim()), faqs: f.faqs.filter((q: any) => q.q?.trim()) }); onSaved(); }
    finally { setSaving(false); }
  }
  return (
    <div className="modal-back" onClick={onClose}><div className="modal-card" onClick={(e) => e.stopPropagation()}>
      <div className="ahead"><h1 style={{ fontSize: 20 }}>Edit service</h1><button className="icon-act" onClick={onClose}>Close</button></div>
      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="field"><label>Name</label><input value={f.name || ""} onChange={(e) => set({ name: e.target.value })} /></div>
          <div className="field"><label>Tagline</label><input value={f.tagline || ""} onChange={(e) => set({ tagline: e.target.value })} /></div>
        </div>
        <div className="field"><label>Description</label><textarea rows={3} value={f.description || ""} onChange={(e) => set({ description: e.target.value })} /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <div className="field"><label>Starting price $</label><input type="number" value={f.startingPrice ?? ""} onChange={(e) => set({ startingPrice: e.target.value })} placeholder="leave blank = on request" /></div>
          <div className="field"><label>Duration (min)</label><input type="number" value={f.durationMinutes ?? ""} onChange={(e) => set({ durationMinutes: e.target.value })} /></div>
          <div className="field"><label>Location text</label><input value={f.locationText || ""} onChange={(e) => set({ locationText: e.target.value })} placeholder="Studio / outdoor" /></div>
        </div>
        <ListEditor label="What's included" items={f.includes} onChange={(items) => set({ includes: items })} placeholder="e.g. 1 hour session" />
        <FaqEditor faqs={f.faqs} onChange={(faqs) => set({ faqs })} />
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13.5 }}><input type="checkbox" style={{ width: "auto" }} checked={f.isActive !== false} onChange={(e) => set({ isActive: e.target.checked })} /> Show on the website</label>
        <button className="btn btn-gold btn-sm" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save service"}</button>
      </div>
    </div></div>
  );
}

function PackageModal({ pkg, onClose, onSaved }: { pkg: any; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<any>({ ...pkg, features: pkg.features || [] });
  const [saving, setSaving] = useState(false);
  const set = (p: any) => setF((c: any) => ({ ...c, ...p }));
  async function save() {
    if (!f.name?.trim()) return;
    setSaving(true);
    const body = { serviceSlug: f.serviceSlug, name: f.name, price: f.price, requestPricing: !!f.requestPricing, durationText: f.durationText, editedPhotos: f.editedPhotos, outfits: f.outfits, features: (f.features || []).filter((x: string) => x.trim()), deposit: Number(f.deposit || 0), deliveryDays: f.deliveryDays, revisions: Number(f.revisions || 1), isActive: f.isActive !== false };
    try { if (f.id) await api.adminUpdatePackage(f.id, body); else await api.adminCreatePackage(body); onSaved(); } finally { setSaving(false); }
  }
  return (
    <div className="modal-back" onClick={onClose}><div className="modal-card sm" onClick={(e) => e.stopPropagation()}>
      <div className="ahead"><h1 style={{ fontSize: 20 }}>{f.id ? "Edit" : "Add"} package</h1><button className="icon-act" onClick={onClose}>Close</button></div>
      <div style={{ display: "grid", gap: 10 }}>
        <div className="field"><label>Package name</label><input value={f.name || ""} onChange={(e) => set({ name: e.target.value })} /></div>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13.5 }}><input type="checkbox" style={{ width: "auto" }} checked={!!f.requestPricing} onChange={(e) => set({ requestPricing: e.target.checked })} /> Price on request (hide the number)</label>
        {!f.requestPricing && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}><div className="field"><label>Price $</label><input type="number" value={f.price ?? ""} onChange={(e) => set({ price: e.target.value })} /></div><div className="field"><label>Deposit $</label><input type="number" value={f.deposit ?? ""} onChange={(e) => set({ deposit: e.target.value })} /></div></div>}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="field"><label>Duration</label><input value={f.durationText || ""} onChange={(e) => set({ durationText: e.target.value })} placeholder="e.g. 2 hours" /></div>
          <div className="field"><label>Edited photos</label><input value={f.editedPhotos || ""} onChange={(e) => set({ editedPhotos: e.target.value })} placeholder="e.g. 30 edited" /></div>
          <div className="field"><label>Outfits</label><input value={f.outfits || ""} onChange={(e) => set({ outfits: e.target.value })} /></div>
          <div className="field"><label>Delivery days</label><input value={f.deliveryDays || ""} onChange={(e) => set({ deliveryDays: e.target.value })} /></div>
        </div>
        <ListEditor label="Features" items={f.features} onChange={(items) => set({ features: items })} placeholder="e.g. Online gallery" />
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13.5 }}><input type="checkbox" style={{ width: "auto" }} checked={f.isActive !== false} onChange={(e) => set({ isActive: e.target.checked })} /> Available</label>
        <button className="btn btn-gold btn-sm" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save package"}</button>
      </div>
    </div></div>
  );
}

function ListEditor({ label, items, onChange, placeholder }: { label: string; items: string[]; onChange: (i: string[]) => void; placeholder?: string }) {
  return (
    <div><label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--ink-2)", marginBottom: 5 }}>{label}</label>
      <div style={{ display: "grid", gap: 5 }}>
        {items.map((it, i) => <div key={i} style={{ display: "flex", gap: 6 }}><input value={it} onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} placeholder={placeholder} style={{ flex: 1 }} className="field" /><button className="icon-act" onClick={() => onChange(items.filter((_, j) => j !== i))}>✕</button></div>)}
        <button className="icon-act" style={{ justifySelf: "start" }} onClick={() => onChange([...items, ""])}>+ Add line</button>
      </div>
    </div>
  );
}

function FaqEditor({ faqs, onChange }: { faqs: { q: string; a: string }[]; onChange: (f: { q: string; a: string }[]) => void }) {
  return (
    <div><label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--ink-2)", marginBottom: 5 }}>FAQs</label>
      <div style={{ display: "grid", gap: 8 }}>
        {faqs.map((f, i) => <div key={i} style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 8, display: "grid", gap: 5 }}>
          <div style={{ display: "flex", gap: 6 }}><input value={f.q} onChange={(e) => onChange(faqs.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))} placeholder="Question" className="field" style={{ flex: 1 }} /><button className="icon-act" onClick={() => onChange(faqs.filter((_, j) => j !== i))}>✕</button></div>
          <textarea value={f.a} onChange={(e) => onChange(faqs.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))} placeholder="Answer" rows={2} className="field" />
        </div>)}
        <button className="icon-act" style={{ justifySelf: "start" }} onClick={() => onChange([...faqs, { q: "", a: "" }])}>+ Add FAQ</button>
      </div>
    </div>
  );
}

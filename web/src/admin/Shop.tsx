import { useCallback, useEffect, useState } from "react";
import { api, thumbUrl, mediaUrl } from "../lib/api";
import { ImagePicker } from "./Media";

const ORDER_STATUSES = ["NEW", "AWAITING_PHOTO_REVIEW", "PHOTO_APPROVED", "AWAITING_PAYMENT", "PRINTING", "FRAMING", "READY", "OUT_FOR_DELIVERY", "COMPLETED", "CANCELLED"];
const EDITING_STATUSES = ["NEW", "REVIEW", "QUOTED", "AWAITING_APPROVAL", "AWAITING_PAYMENT", "EDITING", "PREVIEW", "REVISION", "APPROVED", "DELIVERED", "CANCELLED"];
const lbl = (s: string) => s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
const sel: React.CSSProperties = { padding: "7px 9px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--card)", color: "var(--ink)", fontWeight: 700, fontSize: 12.5 };
const money = (n: any) => (n == null || n === "" ? "$0" : "$" + n);

// ═══════════════════ PRODUCTS ═══════════════════
export function ProductsAdmin() {
  const [rows, setRows] = useState<any[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const [edit, setEdit] = useState<any | null>(null);
  const load = useCallback(() => api.adminProducts().then(setRows).catch(() => {}), []);
  useEffect(() => { load(); api.adminProductCategories().then(setCats).catch(() => {}); }, [load]);
  const blank = { categorySlug: cats[0]?.slug || "", name: "", description: "", images: [], price: 0, material: "", style: "", mount: "both", glassOption: false, orientation: "any", colors: [], sizes: [], stock: 0, madeToOrder: false, prepTime: "", isActive: true, isFeatured: false };
  return (
    <>
      <div className="ahead"><div><h1>Products</h1><p className="muted">Frames &amp; prints in your shop.</p></div><button className="btn btn-dark btn-sm" onClick={() => setEdit(blank)}>+ Add product</button></div>
      <div className="panel"><div className="table-scroll"><table>
        <thead><tr><th>Photo</th><th>Name</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th></th></tr></thead>
        <tbody>{rows.length === 0 ? <tr><td colSpan={7} className="muted" style={{ textAlign: "center", padding: 20 }}>No products yet.</td></tr> : rows.map((p) => (
          <tr key={p.id}>
            <td><div style={{ width: 46, height: 46, borderRadius: 8, overflow: "hidden", border: "1px solid var(--line)", background: "var(--beige)" }}>{p.images?.[0] && <img src={thumbUrl(p.images[0])} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}</div></td>
            <td>{p.name}</td><td className="muted">{p.category?.name}</td><td>{money(p.price)}</td>
            <td>{p.madeToOrder ? "Made to order" : p.stock}</td>
            <td><span className={`pill ${p.isActive ? "CONFIRMED" : "CANCELLED"}`}>{p.isActive ? "Live" : "Hidden"}</span></td>
            <td><div style={{ display: "flex", gap: 6 }}><button className="icon-act" onClick={() => setEdit({ ...p, categorySlug: p.category?.slug || p.categorySlug })}>Edit</button><button className="icon-act" style={{ color: "var(--crit)" }} onClick={async () => { if (confirm(`Delete "${p.name}"?`)) { await api.adminDeleteProduct(p.id); load(); } }}>Delete</button></div></td>
          </tr>))}</tbody>
      </table></div></div>
      {edit && <ProductForm p={edit} cats={cats} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
    </>
  );
}

function ProductForm({ p, cats, onClose, onSaved }: { p: any; cats: any[]; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<any>({ ...p, images: p.images || [], colors: p.colors || [], sizes: p.sizes || [] });
  const [saving, setSaving] = useState(false); const [err, setErr] = useState("");
  const set = (x: any) => setF((c: any) => ({ ...c, ...x }));
  async function save() {
    if (!f.name.trim() || !f.categorySlug) { setErr("Name and category are required."); return; }
    setSaving(true); setErr("");
    const body = { categorySlug: f.categorySlug, name: f.name, description: f.description || "", images: f.images, price: Number(f.price) || 0, material: f.material || "", style: f.style || "", mount: f.mount || "both", glassOption: !!f.glassOption, orientation: f.orientation || "any", colors: (f.colors || []).filter((x: string) => x.trim()), sizes: (f.sizes || []).filter((s: any) => s.label?.trim()).map((s: any) => ({ label: s.label, priceDelta: Number(s.priceDelta) || 0 })), stock: Number(f.stock) || 0, madeToOrder: !!f.madeToOrder, prepTime: f.prepTime || "", isActive: f.isActive !== false, isFeatured: !!f.isFeatured };
    try { if (f.id) await api.adminUpdateProduct(f.id, body); else await api.adminCreateProduct(body); onSaved(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Could not save."); } finally { setSaving(false); }
  }
  return (
    <div className="modal-back" onClick={onClose}><div className="modal-card" onClick={(e) => e.stopPropagation()}>
      <div className="ahead"><h1 style={{ fontSize: 20 }}>{f.id ? "Edit" : "Add"} product</h1><button className="icon-act" onClick={onClose}>Close</button></div>
      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="field"><label>Name</label><input value={f.name} onChange={(e) => set({ name: e.target.value })} /></div>
          <div className="field"><label>Category</label><select value={f.categorySlug} onChange={(e) => set({ categorySlug: e.target.value })}><option value="">—</option>{cats.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select></div>
        </div>
        <div className="field"><label>Description</label><textarea rows={2} value={f.description || ""} onChange={(e) => set({ description: e.target.value })} /></div>
        {/* images */}
        <div><label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--ink-2)", marginBottom: 5 }}>Photos</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>{f.images.map((u: string, i: number) => (
            <div key={i} style={{ position: "relative", width: 70, height: 70, borderRadius: 8, overflow: "hidden", border: "1px solid var(--line)" }}><img src={thumbUrl(u)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /><button onClick={() => set({ images: f.images.filter((_: any, j: number) => j !== i) })} style={{ position: "absolute", top: 2, right: 2, background: "rgba(0,0,0,.6)", color: "#fff", border: 0, borderRadius: 999, width: 18, height: 18, cursor: "pointer", fontSize: 11 }}>✕</button></div>))}</div>
          <ImagePicker value="" onChange={(u) => u && set({ images: [...f.images, u] })} label="" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <div className="field"><label>Base price $</label><input type="number" value={f.price} onChange={(e) => set({ price: e.target.value })} /></div>
          <div className="field"><label>Stock</label><input type="number" value={f.stock} onChange={(e) => set({ stock: e.target.value })} disabled={f.madeToOrder} /></div>
          <div className="field"><label>Mount</label><select value={f.mount} onChange={(e) => set({ mount: e.target.value })}><option value="both">Both</option><option value="tabletop">Tabletop</option><option value="wall">Wall</option></select></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <div className="field"><label>Material</label><input value={f.material || ""} onChange={(e) => set({ material: e.target.value })} /></div>
          <div className="field"><label>Style</label><input value={f.style || ""} onChange={(e) => set({ style: e.target.value })} /></div>
          <div className="field"><label>Orientation</label><select value={f.orientation} onChange={(e) => set({ orientation: e.target.value })}><option value="any">Any</option><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></div>
        </div>
        <ListEditor label="Colours" items={f.colors} onChange={(colors) => set({ colors })} placeholder="e.g. Oak" />
        {/* sizes */}
        <div><label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--ink-2)", marginBottom: 5 }}>Sizes (with price difference)</label>
          <div style={{ display: "grid", gap: 5 }}>{(f.sizes || []).map((s: any, i: number) => (
            <div key={i} style={{ display: "flex", gap: 6 }}><input value={s.label} onChange={(e) => set({ sizes: f.sizes.map((x: any, j: number) => (j === i ? { ...x, label: e.target.value } : x)) })} placeholder="e.g. 20×30 cm" className="field" style={{ flex: 1 }} /><input type="number" value={s.priceDelta} onChange={(e) => set({ sizes: f.sizes.map((x: any, j: number) => (j === i ? { ...x, priceDelta: e.target.value } : x)) })} placeholder="+$" className="field" style={{ width: 90 }} /><button className="icon-act" onClick={() => set({ sizes: f.sizes.filter((_: any, j: number) => j !== i) })}>✕</button></div>))}
            <button className="icon-act" style={{ justifySelf: "start" }} onClick={() => set({ sizes: [...(f.sizes || []), { label: "", priceDelta: 0 }] })}>+ Add size</button></div>
        </div>
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13.5 }}><input type="checkbox" style={{ width: "auto" }} checked={!!f.madeToOrder} onChange={(e) => set({ madeToOrder: e.target.checked })} /> Made to order</label>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13.5 }}><input type="checkbox" style={{ width: "auto" }} checked={!!f.glassOption} onChange={(e) => set({ glassOption: e.target.checked })} /> Glass option</label>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13.5 }}><input type="checkbox" style={{ width: "auto" }} checked={!!f.isFeatured} onChange={(e) => set({ isFeatured: e.target.checked })} /> Featured</label>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13.5 }}><input type="checkbox" style={{ width: "auto" }} checked={f.isActive !== false} onChange={(e) => set({ isActive: e.target.checked })} /> Live in shop</label>
        </div>
        {err && <p style={{ color: "var(--crit)", fontSize: 13 }}>{err}</p>}
        <button className="btn btn-gold btn-sm" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save product"}</button>
      </div>
    </div></div>
  );
}

// ═══════════════════ ORDERS ═══════════════════
export function OrdersAdmin() {
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  const load = useCallback(() => api.adminOrders().then(setRows).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);
  return (
    <>
      <div className="ahead"><h1>Frame &amp; print orders</h1></div>
      <div className="panel"><div className="table-scroll"><table>
        <thead><tr><th>Ref</th><th>Customer</th><th>Items</th><th>Total</th><th>Paid</th><th>Status</th></tr></thead>
        <tbody>{rows.length === 0 ? <tr><td colSpan={6} className="muted" style={{ textAlign: "center", padding: 20 }}>No orders yet.</td></tr> : rows.map((o) => (
          <tr key={o.id} style={{ cursor: "pointer" }} onClick={() => setOpen(o.id)}>
            <td style={{ fontWeight: 700, fontSize: 12.5 }}>{o.reference}</td>
            <td>{o.customerName}<div className="muted" style={{ fontSize: 12 }}>{o.phone}</div></td>
            <td className="muted" style={{ fontSize: 12.5 }}>{o.items?.map((i: any) => `${i.name}${i.needsEditing ? " (edit)" : ""} ×${i.qty}`).join(", ")}</td>
            <td>{money(o.total)}</td><td className={o.amountPaid >= o.total ? "" : "muted"}>{money(o.amountPaid)}</td>
            <td><span className={`pill ${o.status}`}>{lbl(o.status)}</span></td>
          </tr>))}</tbody>
      </table></div></div>
      {open != null && <OrderDetail id={open} onClose={() => setOpen(null)} onChanged={load} />}
    </>
  );
}

function OrderDetail({ id, onClose, onChanged }: { id: number; onClose: () => void; onChanged: () => void }) {
  const [o, setO] = useState<any>(null);
  const load = useCallback(() => api.adminOrder(id).then(setO).catch(() => {}), [id]);
  useEffect(() => { load(); }, [load]);
  if (!o) return <div className="modal-back" onClick={onClose}><div className="modal-card" onClick={(e) => e.stopPropagation()}><p className="muted">Loading…</p></div></div>;
  const patch = async (d: any) => { const u = await api.adminUpdateOrder(id, d); setO((c: any) => ({ ...c, ...u })); onChanged(); };
  const setItem = async (itemId: number, d: any) => { await api.adminUpdateOrderItem(itemId, d); load(); };
  const balance = (o.total || 0) - (o.amountPaid || 0);
  return (
    <div className="modal-back" onClick={onClose}><div className="modal-card" onClick={(e) => e.stopPropagation()}>
      <div className="ahead"><h1 style={{ fontSize: 20 }}>{o.reference} <span className="muted" style={{ fontSize: 13, fontWeight: 400 }}>· {o.customerName}</span></h1><button className="icon-act" onClick={onClose}>Close</button></div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
        <select value={o.status} onChange={(e) => patch({ status: e.target.value })} style={sel}>{ORDER_STATUSES.map((s) => <option key={s} value={s}>{lbl(s)}</option>)}</select>
        <a className="btn btn-gold btn-sm" href={`https://wa.me/${String(o.phone).replace(/\D/g, "")}`} target="_blank" rel="noreferrer">WhatsApp</a>
        <span className="muted" style={{ fontSize: 12.5 }}>{o.fulfilment} · {o.paymentMethod}{o.town ? ` · ${o.town}` : ""}</span>
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {o.items.map((it: any) => (
          <div key={it.id} style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 10, display: "flex", gap: 12 }}>
            {it.uploadUrl && <div style={{ width: 70, height: 70, borderRadius: 8, overflow: "hidden", border: "1px solid var(--line)", flex: "0 0 auto" }}><a href={mediaUrl(it.uploadUrl)} target="_blank" rel="noreferrer"><img src={thumbUrl(it.uploadUrl)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /></a></div>}
            <div style={{ flex: 1, minWidth: 0 }}>
              <b style={{ fontSize: 13.5 }}>{it.name} ×{it.qty}</b> <span className="muted" style={{ fontSize: 12 }}>{money(it.price)}{it.needsEditing ? " · needs editing" : ""}</span>
              {it.instructions && <div className="muted" style={{ fontSize: 12.5 }}>{it.instructions}</div>}
              {it.uploadUrl && <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center" }}>
                <span className="muted" style={{ fontSize: 11.5 }}>Photo quality:</span>
                <button className="icon-act" style={{ color: it.photoStatus === "approved" ? "var(--good)" : undefined, fontWeight: it.photoStatus === "approved" ? 800 : 400 }} onClick={() => setItem(it.id, { photoStatus: "approved" })}>Approve</button>
                <button className="icon-act" style={{ color: it.photoStatus === "rejected" ? "var(--crit)" : undefined, fontWeight: it.photoStatus === "rejected" ? 800 : 400 }} onClick={() => setItem(it.id, { photoStatus: "rejected" })}>Reject</button>
                {it.photoStatus && <span className="pill" style={{ background: it.photoStatus === "approved" ? "var(--good-bg)" : "var(--crit-bg)", color: it.photoStatus === "approved" ? "var(--good)" : "var(--crit)" }}>{it.photoStatus}</span>}
              </div>}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 12 }}>
        <div style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 8 }}><div className="muted" style={{ fontSize: 11 }}>Total</div><b>{money(o.total)}</b></div>
        <div className="field" style={{ margin: 0 }}><label>Amount paid $</label><input type="number" value={o.amountPaid ?? 0} onChange={(e) => setO({ ...o, amountPaid: e.target.value })} onBlur={() => patch({ amountPaid: o.amountPaid })} /></div>
        <div style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 8 }}><div className="muted" style={{ fontSize: 11 }}>Balance</div><b style={{ color: balance > 0 ? "var(--warn)" : "var(--good)" }}>{money(balance)}</b></div>
      </div>
      <div className="field" style={{ marginTop: 10 }}><label>Internal notes</label><textarea rows={2} value={o.adminNotes || ""} onChange={(e) => setO({ ...o, adminNotes: e.target.value })} onBlur={() => patch({ adminNotes: o.adminNotes })} /></div>
    </div></div>
  );
}

// ═══════════════════ EDITING REQUESTS ═══════════════════
export function EditingAdmin() {
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState<any | null>(null);
  const load = useCallback(() => api.adminEditing().then(setRows).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);
  return (
    <>
      <div className="ahead"><h1>Photo editing requests</h1></div>
      <div className="panel"><div className="table-scroll"><table>
        <thead><tr><th>Ref</th><th>Service</th><th>Customer</th><th>Photos</th><th>Quote</th><th>Status</th></tr></thead>
        <tbody>{rows.length === 0 ? <tr><td colSpan={6} className="muted" style={{ textAlign: "center", padding: 20 }}>No editing requests yet.</td></tr> : rows.map((r) => (
          <tr key={r.id} style={{ cursor: "pointer" }} onClick={() => setOpen(r)}>
            <td style={{ fontWeight: 700, fontSize: 12.5 }}>{r.reference}</td>
            <td>{r.serviceName}<div className="muted" style={{ fontSize: 12 }}>{r.complexity} · {r.speed}</div></td>
            <td>{r.customerName}<div className="muted" style={{ fontSize: 12 }}>{r.phone}</div></td>
            <td>{r.photoCount}</td><td>{r.quote ? money(r.quote) : "—"}</td>
            <td><span className={`pill ${r.status}`}>{lbl(r.status)}</span></td>
          </tr>))}</tbody>
      </table></div></div>
      {open && <EditingDetail req={open} onClose={() => setOpen(null)} onChanged={load} />}
    </>
  );
}

function EditingDetail({ req, onClose, onChanged }: { req: any; onClose: () => void; onChanged: () => void }) {
  const [r, setR] = useState<any>({ ...req });
  const patch = async (d: any) => { const u = await api.adminUpdateEditing(r.id, d); setR((c: any) => ({ ...c, ...u })); onChanged(); };
  const uploads: string[] = Array.isArray(r.uploadUrls) ? r.uploadUrls : [];
  const balance = (r.quote || 0) - (r.amountPaid || 0);
  return (
    <div className="modal-back" onClick={onClose}><div className="modal-card" onClick={(e) => e.stopPropagation()}>
      <div className="ahead"><h1 style={{ fontSize: 20 }}>{r.reference} <span className="muted" style={{ fontSize: 13, fontWeight: 400 }}>· {r.customerName}</span></h1><button className="icon-act" onClick={onClose}>Close</button></div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
        <select value={r.status} onChange={(e) => patch({ status: e.target.value })} style={sel}>{EDITING_STATUSES.map((s) => <option key={s} value={s}>{lbl(s)}</option>)}</select>
        <a className="btn btn-gold btn-sm" href={`https://wa.me/${String(r.whatsapp || r.phone).replace(/\D/g, "")}`} target="_blank" rel="noreferrer">WhatsApp</a>
        <span className="muted" style={{ fontSize: 12.5 }}>{r.serviceName} · {r.complexity} · {r.speed} · {r.photoCount} photo(s)</span>
      </div>
      {r.instructions && <p style={{ fontSize: 13, background: "var(--beige)", borderRadius: 8, padding: "8px 10px" }}>{r.instructions}</p>}
      {uploads.length > 0 && <div style={{ marginBottom: 10 }}><b style={{ fontSize: 13 }}>Customer photos</b><div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>{uploads.map((u, i) => <a key={i} href={mediaUrl(u)} target="_blank" rel="noreferrer" style={{ width: 64, height: 64, borderRadius: 8, overflow: "hidden", border: "1px solid var(--line)" }}><img src={thumbUrl(u)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /></a>)}</div></div>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <ImagePicker value={r.previewUrl || ""} onChange={(u) => patch({ previewUrl: u })} label="Watermarked preview" />
        <ImagePicker value={r.finalUrl || ""} onChange={(u) => patch({ finalUrl: u })} label="Final file" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginTop: 12 }}>
        <div className="field" style={{ margin: 0 }}><label>Quote $</label><input type="number" value={r.quote ?? ""} onChange={(e) => setR({ ...r, quote: e.target.value })} onBlur={() => patch({ quote: r.quote })} /></div>
        <div className="field" style={{ margin: 0 }}><label>Paid $</label><input type="number" value={r.amountPaid ?? 0} onChange={(e) => setR({ ...r, amountPaid: e.target.value })} onBlur={() => patch({ amountPaid: r.amountPaid })} /></div>
        <div style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 8 }}><div className="muted" style={{ fontSize: 11 }}>Balance</div><b style={{ color: balance > 0 ? "var(--warn)" : "var(--good)" }}>{money(balance)}</b></div>
        <div className="field" style={{ margin: 0 }}><label>Revisions used</label><input type="number" value={r.revisionsUsed ?? 0} onChange={(e) => setR({ ...r, revisionsUsed: e.target.value })} onBlur={() => patch({ revisionsUsed: r.revisionsUsed })} /></div>
      </div>
      <div className="field" style={{ marginTop: 10 }}><label>Internal notes</label><textarea rows={2} value={r.adminNotes || ""} onChange={(e) => setR({ ...r, adminNotes: e.target.value })} onBlur={() => patch({ adminNotes: r.adminNotes })} /></div>
    </div></div>
  );
}

function ListEditor({ label, items, onChange, placeholder }: { label: string; items: string[]; onChange: (i: string[]) => void; placeholder?: string }) {
  return (
    <div><label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--ink-2)", marginBottom: 5 }}>{label}</label>
      <div style={{ display: "grid", gap: 5 }}>
        {items.map((it, i) => <div key={i} style={{ display: "flex", gap: 6 }}><input value={it} onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} placeholder={placeholder} className="field" style={{ flex: 1 }} /><button className="icon-act" onClick={() => onChange(items.filter((_, j) => j !== i))}>✕</button></div>)}
        <button className="icon-act" style={{ justifySelf: "start" }} onClick={() => onChange([...items, ""])}>+ Add</button>
      </div>
    </div>
  );
}

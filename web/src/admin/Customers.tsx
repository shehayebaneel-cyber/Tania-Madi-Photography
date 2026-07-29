import { useCallback, useEffect, useState } from "react";
import { api, mediaUrl } from "../lib/api";
import { Pill } from "./Bookings";

const money = (n: any) => (n == null || n === "" ? "$0" : "$" + n);

export function CustomersAdmin() {
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);
  const pageSize = 20;

  const load = useCallback(() => { setLoading(true); api.adminCustomers({ q, page }).then((r) => { setRows(r.items); setTotal(r.total); }).catch(() => {}).finally(() => setLoading(false)); }, [q, page]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [q]);
  const pages = Math.max(1, Math.ceil(total / pageSize));

  async function rebuild() { setRebuilding(true); try { const r = await api.adminRebuildCustomers(); load(); alert(`Linked ${r.linked} past booking/order/editing to customers.`); } finally { setRebuilding(false); } }

  return (
    <>
      <div className="ahead"><div><h1>Customers</h1><p className="muted">{total} customer{total === 1 ? "" : "s"}. Returning clients are matched by phone or email automatically.</p></div>
        <div style={{ display: "flex", gap: 8 }}><button className="btn btn-sm" onClick={rebuild} disabled={rebuilding}>{rebuilding ? "Linking…" : "Link past records"}</button><button className="btn btn-dark btn-sm" onClick={() => setAdding(true)}>+ Add customer</button></div></div>

      <div className="panel" style={{ padding: 14, marginBottom: 14 }}>
        <input placeholder="Search name, phone, email, Instagram…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--card)", color: "var(--ink)" }} />
      </div>

      <div className="panel"><div className="table-scroll"><table>
        <thead><tr><th>Name</th><th>Contact</th><th>Bookings</th><th>Orders</th><th>Editing</th><th>Since</th></tr></thead>
        <tbody>
          {loading ? <tr><td colSpan={6} className="muted" style={{ textAlign: "center", padding: 24 }}>Loading…</td></tr>
            : rows.length === 0 ? <tr><td colSpan={6} className="muted" style={{ textAlign: "center", padding: 24 }}>No customers found.</td></tr>
              : rows.map((c) => (
                <tr key={c.id} style={{ cursor: "pointer" }} onClick={() => setOpen(c.id)}>
                  <td>{c.name}{c.registered && <span className="pill CONFIRMED" style={{ marginLeft: 6 }}>account</span>}</td>
                  <td className="muted" style={{ fontSize: 12.5 }}>{c.phone}{c.email ? ` · ${c.email}` : ""}{c.instagram ? ` · @${c.instagram.replace(/^@/, "")}` : ""}</td>
                  <td>{c.bookings || "—"}</td><td>{c.orders || "—"}</td><td>{c.editing || "—"}</td>
                  <td className="muted" style={{ fontSize: 12.5 }}>{new Date(c.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
        </tbody>
      </table></div>
        {pages > 1 && <div style={{ display: "flex", gap: 8, justifyContent: "center", alignItems: "center", padding: 12 }}>
          <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Prev</button>
          <span className="muted" style={{ fontSize: 13 }}>Page {page} of {pages}</span>
          <button className="btn btn-sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next →</button>
        </div>}
      </div>

      {open != null && <CustomerDetail id={open} onClose={() => setOpen(null)} onChanged={load} />}
      {adding && <CustomerForm onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load(); }} />}
    </>
  );
}

function CustomerDetail({ id, onClose, onChanged }: { id: number; onClose: () => void; onChanged: () => void }) {
  const [c, setC] = useState<any>(null);
  const [edit, setEdit] = useState(false);
  const load = useCallback(() => api.adminCustomer(id).then(setC).catch(() => {}), [id]);
  useEffect(() => { load(); }, [load]);
  if (!c) return <div className="modal-back" onClick={onClose}><div className="modal-card" onClick={(e) => e.stopPropagation()}><p className="muted">Loading…</p></div></div>;

  const set = (p: any) => setC((x: any) => ({ ...x, ...p }));
  async function save() { const u = await api.adminUpdateCustomer(id, { name: c.name, phone: c.phone, email: c.email, whatsapp: c.whatsapp, instagram: c.instagram, address: c.address, notes: c.notes }); setC((x: any) => ({ ...x, ...u })); setEdit(false); onChanged(); }
  const s = c.summary || {};
  const wa = `https://wa.me/${String(c.whatsapp || c.phone || "").replace(/\D/g, "")}`;

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => <div style={{ marginTop: 14 }}><h3 style={{ fontSize: 13.5, margin: "0 0 6px" }}>{title}</h3>{children}</div>;

  return (
    <div className="modal-back" onClick={onClose}><div className="modal-card" onClick={(e) => e.stopPropagation()}>
      <div className="ahead"><h1 style={{ fontSize: 20 }}>{c.name}{c.passwordHash ? <span className="pill CONFIRMED" style={{ marginLeft: 8, verticalAlign: "middle" }}>has account</span> : null}</h1><button className="icon-act" onClick={onClose}>Close</button></div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <a className="btn btn-gold btn-sm" href={wa} target="_blank" rel="noreferrer">💬 WhatsApp</a>
        {c.email && <a className="btn btn-sm" href={`mailto:${c.email}`}>✉ Email</a>}
        <button className="btn btn-sm" onClick={() => setEdit((v) => !v)}>{edit ? "Done" : "Edit contact"}</button>
      </div>

      {/* payment summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 8, marginBottom: 6 }}>
        {[["Sessions value", money(s.bookingsTotal)], ["Deposits paid", money(s.depositsPaid)], ["Outstanding", money(s.bookingsOutstanding)], ["Shop orders", money(s.ordersTotal)]].map(([l, v]) => <div key={l} style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "8px 10px" }}><div className="muted" style={{ fontSize: 11 }}>{l}</div><b style={{ fontSize: 15 }}>{v}</b></div>)}
      </div>

      {edit ? (
        <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div className="field"><label>Name</label><input value={c.name || ""} onChange={(e) => set({ name: e.target.value })} /></div>
            <div className="field"><label>Phone</label><input value={c.phone || ""} onChange={(e) => set({ phone: e.target.value })} /></div>
            <div className="field"><label>WhatsApp</label><input value={c.whatsapp || ""} onChange={(e) => set({ whatsapp: e.target.value })} /></div>
            <div className="field"><label>Email</label><input value={c.email || ""} onChange={(e) => set({ email: e.target.value })} /></div>
            <div className="field"><label>Instagram</label><input value={c.instagram || ""} onChange={(e) => set({ instagram: e.target.value })} /></div>
            <div className="field"><label>Address</label><input value={c.address || ""} onChange={(e) => set({ address: e.target.value })} /></div>
          </div>
          <div className="field"><label>Internal notes</label><textarea rows={2} value={c.notes || ""} onChange={(e) => set({ notes: e.target.value })} /></div>
          <button className="btn btn-gold btn-sm" onClick={save}>Save</button>
        </div>
      ) : (
        <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 6 }}>
          {c.phone && <>📞 {c.phone} </>}{c.whatsapp && <>· WA {c.whatsapp} </>}{c.email && <>· ✉ {c.email} </>}{c.instagram && <>· @{c.instagram.replace(/^@/, "")} </>}{c.address && <>· {c.address}</>}
          {c.notes && <div style={{ marginTop: 8, background: "var(--beige)", borderRadius: 8, padding: "8px 10px" }}><span className="muted" style={{ fontSize: 11 }}>Notes</span><div style={{ fontSize: 13 }}>{c.notes}</div></div>}
        </div>
      )}

      <Section title={`Bookings (${c.bookings?.length || 0})`}>
        {c.bookings?.length ? <div style={{ display: "grid", gap: 5 }}>{c.bookings.map((b: any) => (
          <div key={b.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, border: "1px solid var(--line)", borderRadius: 8, padding: "7px 10px", fontSize: 13 }}>
            <span>{b.serviceName || "—"} <span className="muted">· {b.date || b.preferredDate || "no date"}</span></span>
            <span style={{ display: "flex", gap: 8, alignItems: "center" }}>{b.price ? money(b.price) : ""} <Pill status={b.status} /></span>
          </div>))}</div> : <p className="muted" style={{ fontSize: 13 }}>None.</p>}
      </Section>

      {c.orders?.length > 0 && <Section title={`Frame & print orders (${c.orders.length})`}>
        <div style={{ display: "grid", gap: 5 }}>{c.orders.map((o: any) => <div key={o.id} style={{ display: "flex", justifyContent: "space-between", border: "1px solid var(--line)", borderRadius: 8, padding: "7px 10px", fontSize: 13 }}><span>{o.reference} <span className="muted">· {o.items?.map((i: any) => i.name).join(", ")}</span></span><span>{money(o.total)} <span className="muted">· {o.status}</span></span></div>)}</div>
      </Section>}

      {c.editing?.length > 0 && <Section title={`Editing requests (${c.editing.length})`}>
        <div style={{ display: "grid", gap: 5 }}>{c.editing.map((e: any) => <div key={e.id} style={{ display: "flex", justifyContent: "space-between", border: "1px solid var(--line)", borderRadius: 8, padding: "7px 10px", fontSize: 13 }}><span>{e.serviceName} <span className="muted">· {e.photoCount} photo(s)</span></span><span className="muted">{e.status}</span></div>)}</div>
      </Section>}

      {s.files?.length > 0 && <Section title={`Uploaded files (${s.files.length})`}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{s.files.map((f: string, i: number) => <a key={i} href={mediaUrl(f)} target="_blank" rel="noreferrer" className="icon-act" style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "6px 10px" }}>File {i + 1} ↗</a>)}</div>
      </Section>}
    </div></div>
  );
}

function CustomerForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<any>({ name: "", phone: "", whatsapp: "", email: "", instagram: "", address: "", notes: "" });
  const [saving, setSaving] = useState(false); const [err, setErr] = useState("");
  const set = (p: any) => setF((c: any) => ({ ...c, ...p }));
  async function save() { if (!f.name.trim()) { setErr("Name is required."); return; } setSaving(true); setErr(""); try { await api.adminCreateCustomer(f); onSaved(); } catch (e) { setErr(e instanceof Error ? e.message : "Could not save."); } finally { setSaving(false); } }
  return (
    <div className="modal-back" onClick={onClose}><div className="modal-card sm" onClick={(e) => e.stopPropagation()}>
      <div className="ahead"><h1 style={{ fontSize: 20 }}>Add customer</h1><button className="icon-act" onClick={onClose}>Close</button></div>
      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="field"><label>Name *</label><input value={f.name} onChange={(e) => set({ name: e.target.value })} /></div>
          <div className="field"><label>Phone</label><input value={f.phone} onChange={(e) => set({ phone: e.target.value })} /></div>
          <div className="field"><label>WhatsApp</label><input value={f.whatsapp} onChange={(e) => set({ whatsapp: e.target.value })} /></div>
          <div className="field"><label>Email</label><input value={f.email} onChange={(e) => set({ email: e.target.value })} /></div>
          <div className="field"><label>Instagram</label><input value={f.instagram} onChange={(e) => set({ instagram: e.target.value })} /></div>
          <div className="field"><label>Address</label><input value={f.address} onChange={(e) => set({ address: e.target.value })} /></div>
        </div>
        <div className="field"><label>Internal notes</label><textarea rows={2} value={f.notes} onChange={(e) => set({ notes: e.target.value })} /></div>
        {err && <p style={{ color: "var(--crit)", fontSize: 13 }}>{err}</p>}
        <p className="muted" style={{ fontSize: 12 }}>If someone with the same phone or email already exists, they'll be reused (no duplicate).</p>
        <button className="btn btn-gold btn-sm" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save customer"}</button>
      </div>
    </div></div>
  );
}

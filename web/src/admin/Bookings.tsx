import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { ConflictBanner } from "./Availability";
import { SendMessageModal } from "./Notifications";

// ── 15 statuses (owner-facing labels + colour group) ─────────────────────────
export const STATUSES = [
  { v: "NEW", l: "New Request", g: "new" }, { v: "CONTACTED", l: "Contacted", g: "prog" },
  { v: "QUOTED", l: "Quotation Sent", g: "prog" }, { v: "AWAITING_APPROVAL", l: "Awaiting Approval", g: "prog" },
  { v: "AWAITING_DEPOSIT", l: "Awaiting Deposit", g: "warn" }, { v: "CONFIRMED", l: "Confirmed", g: "ok" },
  { v: "PREP", l: "Preparation Required", g: "ok" }, { v: "COMPLETED", l: "Session Completed", g: "ok" },
  { v: "EDITING", l: "Photos Being Edited", g: "prog" }, { v: "PREVIEW", l: "Preview Ready", g: "prog" },
  { v: "DELIVERED", l: "Final Photos Delivered", g: "done" }, { v: "RESCHEDULE", l: "Rescheduling Required", g: "warn" },
  { v: "CANCELLED", l: "Cancelled", g: "dead" }, { v: "DECLINED", l: "Declined", g: "dead" }, { v: "NO_SHOW", l: "No-show", g: "dead" },
];
const sLabel = (v: string) => STATUSES.find((s) => s.v === v)?.l || v;
const sGroup = (v: string) => STATUSES.find((s) => s.v === v)?.g || "prog";
const GCOL: Record<string, [string, string]> = { new: ["var(--gold)", "#fff"], prog: ["var(--sand)", "var(--ink)"], warn: ["var(--warn-bg)", "var(--warn)"], ok: ["var(--good-bg)", "var(--good)"], done: ["var(--good)", "#fff"], dead: ["var(--crit-bg)", "var(--crit)"] };
export function Pill({ status }: { status: string }) {
  const [bg, c] = GCOL[sGroup(status)];
  return <span style={{ background: bg, color: c, fontSize: 11, fontWeight: 800, padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap" }}>{sLabel(status)}</span>;
}
const effDate = (b: any) => b.date || b.preferredDate || "";
const money = (n: any) => (n == null || n === "" ? "—" : "$" + n);
const waLink = (b: any) => `https://wa.me/${String(b.whatsapp || b.phone || "").replace(/\D/g, "")}`;

// ─────────────────────────────────────────────────────────────────────────────
export function BookingsAdmin() {
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("");
  const [status, setStatus] = useState("");
  const [payment, setPayment] = useState("");
  const [services, setServices] = useState<any[]>([]);
  const [service, setService] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  const pageSize = 20;

  const load = useCallback(() => {
    setLoading(true);
    api.adminBookings({ q, filter, status, payment, service, page }).then((r) => { setRows(r.items); setTotal(r.total); }).catch(() => {}).finally(() => setLoading(false));
  }, [q, filter, status, payment, service, page]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [q, filter, status, payment, service]);
  useEffect(() => { api.services().then(setServices).catch(() => {}); }, []);

  const FILTERS = [["", "All"], ["new", "New requests"], ["today", "Today"], ["week", "This week"], ["month", "This month"], ["upcoming", "Upcoming"], ["past", "Past"], ["awaiting_deposit", "Awaiting deposit"], ["confirmed", "Confirmed"], ["completed", "Completed"], ["cancelled", "Cancelled"]];
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <>
      <div className="ahead"><div><h1>Bookings</h1><p className="muted">{total} booking{total === 1 ? "" : "s"}. Requests from the website land here automatically.</p></div>
        <button className="btn btn-dark btn-sm" onClick={() => setAdding(true)}>+ Add booking</button></div>

      <div className="panel" style={{ padding: 14, marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
          <input placeholder="Search name, phone, email, ref…" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: "1 1 220px", padding: "8px 11px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--card)", color: "var(--ink)" }} />
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={selStyle}><option value="">Any status</option>{STATUSES.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}</select>
          <select value={service} onChange={(e) => setService(e.target.value)} style={selStyle}><option value="">Any service</option>{services.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}</select>
          <select value={payment} onChange={(e) => setPayment(e.target.value)} style={selStyle}><option value="">Any payment</option><option value="paid">Deposit paid</option><option value="unpaid">Deposit unpaid</option></select>
        </div>
        <div className="chip-row">{FILTERS.map(([v, l]) => <button key={v} className={`chip ${filter === v ? "on" : ""}`} onClick={() => setFilter(v)}>{l}</button>)}</div>
      </div>

      <div className="panel"><div className="table-scroll"><table>
        <thead><tr><th>Ref</th><th>Customer</th><th>Service</th><th>Date</th><th>Status</th><th>Price</th><th></th></tr></thead>
        <tbody>
          {loading ? <tr><td colSpan={7} className="muted" style={{ textAlign: "center", padding: 24 }}>Loading…</td></tr>
            : rows.length === 0 ? <tr><td colSpan={7} className="muted" style={{ textAlign: "center", padding: 24 }}>No bookings match.</td></tr>
              : rows.map((b) => (
                <tr key={b.id} style={{ cursor: "pointer" }} onClick={() => setOpen(b.id)}>
                  <td style={{ fontWeight: 700, fontSize: 12.5 }}>{b.reference}</td>
                  <td>{b.customerName}<div className="muted" style={{ fontSize: 12 }}>{b.phone}</div></td>
                  <td>{b.serviceName || "—"}</td>
                  <td>{effDate(b) || "—"}<div className="muted" style={{ fontSize: 12 }}>{b.startTime || b.preferredTime}</div></td>
                  <td><Pill status={b.status} /></td>
                  <td className="tabular">{money(b.price ?? b.quote)}{b.depositPaid ? <div style={{ fontSize: 11, color: "var(--good)" }}>deposit paid</div> : b.deposit ? <div className="muted" style={{ fontSize: 11 }}>dep {money(b.deposit)}</div> : null}</td>
                  <td onClick={(e) => e.stopPropagation()}><a className="icon-act" href={waLink(b)} target="_blank" rel="noreferrer">WhatsApp</a></td>
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

      {open != null && <BookingDetail id={open} services={services} onClose={() => setOpen(null)} onChanged={load} />}
      {adding && <BookingForm services={services} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load(); }} />}
    </>
  );
}

const selStyle: React.CSSProperties = { padding: "8px 10px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--card)", color: "var(--ink)", fontWeight: 600, fontSize: 13 };
const fieldRow = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 } as React.CSSProperties;

// ── booking detail: all info + workflow + timeline + actions ─────────────────
function BookingDetail({ id, services, onClose, onChanged }: { id: number; services: any[]; onClose: () => void; onChanged: () => void }) {
  const [b, setB] = useState<any>(null);
  const [note, setNote] = useState("");
  const [edit, setEdit] = useState(false);
  const [sendMsg, setSendMsg] = useState(false);
  const load = useCallback(() => api.adminBooking(id).then(setB).catch(() => {}), [id]);
  useEffect(() => { load(); }, [load]);
  if (!b) return <div className="modal-back" onClick={onClose}><div className="modal-card" onClick={(e) => e.stopPropagation()}><p className="muted">Loading…</p></div></div>;

  const patch = async (data: any) => { await api.adminUpdateBooking(id, data); await load(); onChanged(); };
  const addNote = async () => { if (!note.trim()) return; await api.adminBookingNote(id, note.trim()); setNote(""); load(); };
  const balance = (b.price || 0) - (b.depositPaid ? (b.deposit || 0) : 0);
  const svc = services.find((s) => s.slug === b.serviceSlug);
  const ex = Array.isArray(b.extras) ? b.extras : [];

  const Row = ({ k, v }: { k: string; v: any }) => v ? <div style={{ display: "flex", gap: 8, fontSize: 13, padding: "2px 0" }}><span className="muted" style={{ minWidth: 130 }}>{k}</span><span>{v}</span></div> : null;

  return (
    <div className="modal-back" onClick={onClose}><div className="modal-card" onClick={(e) => e.stopPropagation()}>
      <div className="ahead" style={{ alignItems: "flex-start" }}>
        <div><h1 style={{ fontSize: 20 }}>{b.customerName} <span className="muted" style={{ fontSize: 13, fontWeight: 400 }}>· {b.reference}</span></h1>
          <div style={{ marginTop: 6 }}><Pill status={b.status} /></div></div>
        <button className="icon-act" onClick={onClose}>Close</button>
      </div>

      {/* status changer */}
      <div className="field" style={{ marginBottom: 14 }}><label>Status — changing it is saved to the timeline</label>
        <select value={b.status} onChange={(e) => patch({ status: e.target.value })} style={{ ...selStyle, width: "100%", padding: "10px 12px" }}>{STATUSES.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}</select></div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.3fr) minmax(0,1fr)", gap: 18 }} className="bk-grid">
        <div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            <a className="btn btn-gold btn-sm" href={waLink(b)} target="_blank" rel="noreferrer">💬 WhatsApp</a>
            <button className="btn btn-sm" onClick={() => setSendMsg(true)}>✉ Send message</button>
            <button className="btn btn-sm" onClick={() => setEdit((v) => !v)}>{edit ? "Done editing" : "Edit details"}</button>
            <button className="btn btn-sm" onClick={() => window.print()}>Print</button>
            <button className="btn btn-sm" onClick={async () => { await api.adminDuplicateBooking(id); onChanged(); onClose(); }}>Duplicate</button>
            <button className="btn btn-sm" style={{ color: "var(--crit)", borderColor: "var(--crit)" }} onClick={async () => { if (confirm("Delete this booking permanently?")) { await api.adminDeleteBooking(id); onChanged(); onClose(); } }}>Delete</button>
          </div>

          {edit ? (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={fieldRow}>
                <div className="field"><label>Service</label><select value={b.serviceSlug} onChange={(e) => setB({ ...b, serviceSlug: e.target.value, serviceName: services.find((s) => s.slug === e.target.value)?.name || "" })}><option value="">—</option>{services.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}</select></div>
                <div className="field"><label>Package</label><select value={b.packageId || ""} onChange={(e) => setB({ ...b, packageId: e.target.value ? Number(e.target.value) : null })}><option value="">—</option>{(svc?.packages || []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
              </div>
              <div style={fieldRow}>
                <div className="field"><label>Date</label><input type="date" value={b.date || ""} onChange={(e) => setB({ ...b, date: e.target.value })} /></div>
                <div className="field"><label>Setting</label><select value={b.setting || ""} onChange={(e) => setB({ ...b, setting: e.target.value })}><option value="">—</option><option value="studio">Studio</option><option value="outdoor">Outdoor</option></select></div>
              </div>
              <div style={fieldRow}>
                <div className="field"><label>Start</label><input type="time" value={b.startTime || ""} onChange={(e) => setB({ ...b, startTime: e.target.value })} /></div>
                <div className="field"><label>End</label><input type="time" value={b.endTime || ""} onChange={(e) => setB({ ...b, endTime: e.target.value })} /></div>
              </div>
              <ConflictBanner date={b.date} startTime={b.startTime} endTime={b.endTime} serviceSlug={b.serviceSlug} excludeId={id} />
              <div className="field"><label>Location</label><input value={b.locationText || ""} onChange={(e) => setB({ ...b, locationText: e.target.value })} /></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <div className="field"><label>Total price $</label><input type="number" value={b.price ?? ""} onChange={(e) => setB({ ...b, price: e.target.value })} /></div>
                <div className="field"><label>Deposit $</label><input type="number" value={b.deposit ?? ""} onChange={(e) => setB({ ...b, deposit: e.target.value })} /></div>
                <div className="field"><label>Payment</label><select value={b.paymentMethod || ""} onChange={(e) => setB({ ...b, paymentMethod: e.target.value })}><option value="">—</option><option value="cash">Cash</option><option value="whish">Whish</option><option value="other">Other</option></select></div>
              </div>
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13.5 }}><input type="checkbox" style={{ width: "auto" }} checked={!!b.depositPaid} onChange={(e) => setB({ ...b, depositPaid: e.target.checked })} /> Deposit paid</label>
              <button className="btn btn-gold btn-sm" onClick={() => { patch({ serviceSlug: b.serviceSlug, serviceName: b.serviceName, packageId: b.packageId, date: b.date, setting: b.setting, startTime: b.startTime, endTime: b.endTime, locationText: b.locationText, price: b.price, deposit: b.deposit, paymentMethod: b.paymentMethod, depositPaid: b.depositPaid }); setEdit(false); }}>Save details</button>
            </div>
          ) : (
            <div style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 12 }}>
              <Row k="Service" v={b.serviceName} /><Row k="Package" v={(svc?.packages || []).find((p: any) => p.id === b.packageId)?.name || b.packagePref} />
              <Row k="Date" v={effDate(b)} /><Row k="Time" v={[b.startTime || b.preferredTime, b.endTime].filter(Boolean).join(" – ")} />
              <Row k="Alt date" v={b.altDate} /><Row k="Setting" v={b.setting} /><Row k="Location" v={b.locationText} />
              <Row k="People" v={b.people} /><Row k="Video" v={b.withVideo ? "Yes" : ""} />
              <Row k="Total price" v={money(b.price ?? b.quote)} /><Row k="Deposit" v={b.deposit ? `${money(b.deposit)} ${b.depositPaid ? "(paid)" : "(unpaid)"}` : ""} />
              <Row k="Balance" v={b.price ? money(balance) : ""} /><Row k="Payment" v={b.paymentMethod} />
              <Row k="Phone" v={b.phone} /><Row k="WhatsApp" v={b.whatsapp} /><Row k="Email" v={b.email} /><Row k="Instagram" v={b.instagram} />
              <Row k="Heard from" v={b.heardFrom} /><Row k="Source" v={b.source} />
              {ex.length > 0 && <Row k="Extras" v={ex.map((x: any) => x.name).join(", ")} />}
              {b.description && <div style={{ marginTop: 8 }}><span className="muted" style={{ fontSize: 12 }}>Special requests</span><p style={{ margin: "3px 0 0", fontSize: 13 }}>{b.description}</p></div>}
              <div style={{ marginTop: 8 }}><span className="muted" style={{ fontSize: 12 }}>Submitted</span> <span style={{ fontSize: 13 }}>{new Date(b.createdAt).toLocaleString()}</span></div>
            </div>
          )}

          <div className="field" style={{ marginTop: 12 }}><label>Internal notes (staff only)</label><textarea rows={2} value={b.adminNotes || ""} onChange={(e) => setB({ ...b, adminNotes: e.target.value })} onBlur={() => patch({ adminNotes: b.adminNotes })} /></div>
        </div>

        {/* timeline */}
        <div>
          <h3 style={{ fontSize: 14, margin: "0 0 8px" }}>Timeline</h3>
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            <input placeholder="Add a note…" value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addNote(); }} style={{ flex: 1, padding: "7px 10px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--card)", color: "var(--ink)", fontSize: 13 }} />
            <button className="btn btn-dark btn-sm" onClick={addNote}>Add</button>
          </div>
          <div style={{ display: "grid", gap: 8, maxHeight: 360, overflow: "auto" }}>
            {(b.events || []).map((ev: any) => (
              <div key={ev.id} style={{ borderLeft: "2px solid var(--line)", paddingLeft: 10 }}>
                <div style={{ fontSize: 12.5 }}>{ev.type === "status" ? <>Status → <b>{sLabel(ev.toStatus)}</b>{ev.fromStatus && <span className="muted"> (from {sLabel(ev.fromStatus)})</span>}</> : ev.type === "created" ? <b>{ev.note || "Created"}</b> : ev.note}</div>
                <div className="muted" style={{ fontSize: 11 }}>{new Date(ev.createdAt).toLocaleString()}</div>
              </div>
            ))}
            {(!b.events || b.events.length === 0) && <p className="muted" style={{ fontSize: 12.5 }}>No history yet.</p>}
          </div>
        </div>
      </div>
      {sendMsg && <SendMessageModal booking={b} onClose={() => setSendMsg(false)} />}
    </div></div>
  );
}

// ── manual add booking (customer search / create) ───────────────────────────
function BookingForm({ services, onClose, onSaved }: { services: any[]; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<any>({ customerName: "", phone: "", whatsapp: "", email: "", instagram: "", serviceSlug: "", packageId: "", date: "", startTime: "", endTime: "", setting: "", locationText: "", people: "", price: "", deposit: "", depositPaid: false, paymentMethod: "", source: "whatsapp", status: "CONFIRMED", description: "", adminNotes: "" });
  const [saving, setSaving] = useState(false); const [err, setErr] = useState("");
  const [matches, setMatches] = useState<any[]>([]);
  const set = (p: any) => setF((c: any) => ({ ...c, ...p }));
  const svc = services.find((s) => s.slug === f.serviceSlug);
  // customer lookup as they type the name/phone
  useEffect(() => { const q = (f.customerName || f.phone || "").trim(); if (q.length < 2 || f.customerId) { setMatches([]); return; } const t = setTimeout(() => api.adminCustomerSearch(q).then(setMatches).catch(() => {}), 300); return () => clearTimeout(t); }, [f.customerName, f.phone, f.customerId]);
  async function save() {
    if (!f.customerName.trim() || !f.phone.trim()) { setErr("Name and phone are required."); return; }
    setSaving(true); setErr("");
    try { await api.adminCreateBooking(f); onSaved(); } catch (e) { setErr(e instanceof Error ? e.message : "Could not save."); } finally { setSaving(false); }
  }
  return (
    <div className="modal-back" onClick={onClose}><div className="modal-card" onClick={(e) => e.stopPropagation()}>
      <div className="ahead"><h1 style={{ fontSize: 20 }}>Add booking</h1><button className="icon-act" onClick={onClose}>Close</button></div>
      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ position: "relative" }}>
          <div style={fieldRow}>
            <div className="field"><label>Customer name *</label><input value={f.customerName} onChange={(e) => set({ customerName: e.target.value, customerId: undefined })} /></div>
            <div className="field"><label>Phone *</label><input value={f.phone} onChange={(e) => set({ phone: e.target.value, customerId: undefined })} /></div>
          </div>
          {matches.length > 0 && <div style={{ position: "absolute", zIndex: 2, background: "var(--card)", border: "1px solid var(--line)", borderRadius: 8, width: "100%", boxShadow: "var(--shadow)", marginTop: 2 }}>
            {matches.map((m) => <button key={m.id} type="button" className="navlink" style={{ width: "100%", textAlign: "left", padding: "7px 10px" }} onClick={() => { set({ customerId: m.id, customerName: m.name, phone: m.phone, whatsapp: m.whatsapp, email: m.email, instagram: m.instagram }); setMatches([]); }}>{m.name} · {m.phone}</button>)}
          </div>}
        </div>
        {f.customerId && <p className="muted" style={{ fontSize: 12 }}>Linked to existing customer #{f.customerId}. <button className="icon-act" onClick={() => set({ customerId: undefined })}>unlink</button></p>}
        <div style={fieldRow}>
          <div className="field"><label>WhatsApp</label><input value={f.whatsapp} onChange={(e) => set({ whatsapp: e.target.value })} /></div>
          <div className="field"><label>Email</label><input value={f.email} onChange={(e) => set({ email: e.target.value })} /></div>
        </div>
        <div style={fieldRow}>
          <div className="field"><label>Service</label><select value={f.serviceSlug} onChange={(e) => set({ serviceSlug: e.target.value, packageId: "" })}><option value="">—</option>{services.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}</select></div>
          <div className="field"><label>Package</label><select value={f.packageId} onChange={(e) => set({ packageId: e.target.value })}><option value="">—</option>{(svc?.packages || []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <div className="field"><label>Date</label><input type="date" value={f.date} onChange={(e) => set({ date: e.target.value })} /></div>
          <div className="field"><label>Start</label><input type="time" value={f.startTime} onChange={(e) => set({ startTime: e.target.value })} /></div>
          <div className="field"><label>End</label><input type="time" value={f.endTime} onChange={(e) => set({ endTime: e.target.value })} /></div>
        </div>
        <ConflictBanner date={f.date} startTime={f.startTime} endTime={f.endTime} serviceSlug={f.serviceSlug} />
        <div style={fieldRow}>
          <div className="field"><label>Setting</label><select value={f.setting} onChange={(e) => set({ setting: e.target.value })}><option value="">—</option><option value="studio">Studio</option><option value="outdoor">Outdoor</option></select></div>
          <div className="field"><label>People</label><input value={f.people} onChange={(e) => set({ people: e.target.value })} /></div>
        </div>
        <div className="field"><label>Location</label><input value={f.locationText} onChange={(e) => set({ locationText: e.target.value })} /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <div className="field"><label>Total price $</label><input type="number" value={f.price} onChange={(e) => set({ price: e.target.value })} /></div>
          <div className="field"><label>Deposit $</label><input type="number" value={f.deposit} onChange={(e) => set({ deposit: e.target.value })} /></div>
          <div className="field"><label>Payment</label><select value={f.paymentMethod} onChange={(e) => set({ paymentMethod: e.target.value })}><option value="">—</option><option value="cash">Cash</option><option value="whish">Whish</option><option value="other">Other</option></select></div>
        </div>
        <div style={fieldRow}>
          <div className="field"><label>Source</label><select value={f.source} onChange={(e) => set({ source: e.target.value })}><option value="whatsapp">WhatsApp</option><option value="instagram">Instagram</option><option value="phone">Phone</option><option value="studio">Studio visit</option><option value="website">Website</option><option value="other">Other</option></select></div>
          <div className="field"><label>Status</label><select value={f.status} onChange={(e) => set({ status: e.target.value })}>{STATUSES.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}</select></div>
        </div>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13.5 }}><input type="checkbox" style={{ width: "auto" }} checked={f.depositPaid} onChange={(e) => set({ depositPaid: e.target.checked })} /> Deposit already paid</label>
        <div className="field"><label>Customer notes / requests</label><textarea rows={2} value={f.description} onChange={(e) => set({ description: e.target.value })} /></div>
        <div className="field"><label>Internal staff notes</label><textarea rows={2} value={f.adminNotes} onChange={(e) => set({ adminNotes: e.target.value })} /></div>
        {err && <p style={{ color: "var(--crit)", fontSize: 13 }}>{err}</p>}
        <button className="btn btn-gold btn-sm" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save booking"}</button>
      </div>
    </div></div>
  );
}

// ── calendar (month / week / day) ────────────────────────────────────────────
export function CalendarAdmin() {
  const [all, setAll] = useState<any[]>([]);
  const [view, setView] = useState<"month" | "week" | "day">("month");
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth(), d: d.getDate() }; });
  const [services, setServices] = useState<any[]>([]);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [open, setOpen] = useState<number | null>(null);

  const load = useCallback(() => api.adminBookings({ pageSize: 1000 }).then((r) => setAll(r.items)).catch(() => {}), []);
  useEffect(() => { load(); api.services().then(setServices).catch(() => {}); api.adminBlackouts().then(setBlocks).catch(() => {}); }, [load]);
  const blockDays = useMemo(() => new Set(blocks.filter((b) => b.allDay).map((b) => b.date)), [blocks]);

  const byDay = useMemo(() => { const m: Record<string, any[]> = {}; for (const b of all) { const d = effDate(b); if (d) (m[d] = m[d] || []).push(b); } return m; }, [all]);
  const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const cur = new Date(cursor.y, cursor.m, cursor.d);
  const monthName = cur.toLocaleString(undefined, { month: "long", year: "numeric" });
  const step = (dir: number) => setCursor((c) => { const d = new Date(c.y, c.m, c.d); if (view === "month") d.setMonth(d.getMonth() + dir); else if (view === "week") d.setDate(d.getDate() + dir * 7); else d.setDate(d.getDate() + dir); return { y: d.getFullYear(), m: d.getMonth(), d: d.getDate() }; });

  // month grid
  const first = new Date(cursor.y, cursor.m, 1);
  const startPad = (first.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(startPad).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const todayIso = iso(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

  // week days
  const weekStart = new Date(cur); weekStart.setDate(cur.getDate() - ((cur.getDay() + 6) % 7));
  const weekDays = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d; });

  const DayList = ({ dateIso }: { dateIso: string }) => (
    <div style={{ display: "grid", gap: 6 }}>
      {(byDay[dateIso] || []).length === 0 ? <p className="muted" style={{ fontSize: 13 }}>No bookings.</p>
        : byDay[dateIso].map((b) => <button key={b.id} className="navlink" style={{ width: "100%", textAlign: "left", display: "flex", justifyContent: "space-between", gap: 8, padding: "8px 10px", border: "1px solid var(--line)", borderRadius: 8 }} onClick={() => setOpen(b.id)}>
          <span>{b.startTime && <b style={{ fontVariantNumeric: "tabular-nums" }}>{b.startTime} </b>}{b.customerName} <span className="muted">· {b.serviceName}</span></span><Pill status={b.status} /></button>)}
    </div>
  );

  return (
    <>
      <div className="ahead"><div><h1>Calendar</h1><p className="muted">Sessions and requests by date.</p></div>
        <div className="chip-row">{(["month", "week", "day"] as const).map((v) => <button key={v} className={`chip ${view === v ? "on" : ""}`} onClick={() => setView(v)}>{v[0].toUpperCase() + v.slice(1)}</button>)}</div></div>

      <div className="panel" style={{ padding: 14 }}>
        <div className="ahead" style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button className="btn btn-sm" onClick={() => step(-1)}>←</button>
            <b style={{ minWidth: 170, textAlign: "center" }}>{view === "day" ? cur.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" }) : view === "week" ? `${weekDays[0].toLocaleDateString(undefined, { day: "numeric", month: "short" })} – ${weekDays[6].toLocaleDateString(undefined, { day: "numeric", month: "short" })}` : monthName}</b>
            <button className="btn btn-sm" onClick={() => step(1)}>→</button>
          </div>
          <button className="btn btn-sm" onClick={() => { const d = new Date(); setCursor({ y: d.getFullYear(), m: d.getMonth(), d: d.getDate() }); }}>Today</button>
        </div>

        {view === "month" && <>
          <div className="cal-head">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d}>{d}</div>)}</div>
          <div className="cal-grid">
            {cells.map((day, i) => {
              const di = day ? iso(cursor.y, cursor.m, day) : "";
              const list = day ? (byDay[di] || []) : [];
              const blocked = day && blockDays.has(di);
              return <div key={i} className={`cal-cell ${day ? "" : "empty"} ${di === todayIso ? "today" : ""} ${blocked ? "blocked" : ""}`} onClick={() => day && (setCursor((c) => ({ ...c, d: day })), setView("day"))}>
                {day && <><span className="d">{day}</span>{blocked && <span className="blk">Blocked</span>}{list.slice(0, 3).map((b) => <span key={b.id} className="ev" style={{ background: GCOL[sGroup(b.status)][0], color: GCOL[sGroup(b.status)][1] }} onClick={(e) => { e.stopPropagation(); setOpen(b.id); }}>{b.startTime ? b.startTime + " " : ""}{b.customerName}</span>)}{list.length > 3 && <span className="more">+{list.length - 3} more</span>}</>}
              </div>;
            })}
          </div>
        </>}
        {view === "week" && <div style={{ display: "grid", gap: 10 }}>{weekDays.map((d) => { const di = iso(d.getFullYear(), d.getMonth(), d.getDate()); return <div key={di}><b style={{ fontSize: 13.5 }}>{d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}{di === todayIso && <span style={{ color: "var(--gold)" }}> · today</span>}</b><div style={{ marginTop: 6 }}><DayList dateIso={di} /></div></div>; })}</div>}
        {view === "day" && <DayList dateIso={iso(cursor.y, cursor.m, cursor.d)} />}
      </div>

      {open != null && <BookingDetail id={open} services={services} onClose={() => setOpen(null)} onChanged={load} />}
    </>
  );
}

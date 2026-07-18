import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { Logo } from "../components/Art";

type Tab = "dashboard" | "bookings" | "orders" | "editing" | "portfolio" | "products";

const BOOKING_STATUSES = ["NEW", "CONTACTED", "QUOTED", "AWAITING_DEPOSIT", "CONFIRMED", "COMPLETED", "CANCELLED", "DECLINED", "RESCHEDULE"];
const EDITING_STATUSES = ["NEW", "REVIEW", "QUOTED", "AWAITING_APPROVAL", "AWAITING_PAYMENT", "EDITING", "PREVIEW", "REVISION", "APPROVED", "DELIVERED", "CANCELLED"];
const ORDER_STATUSES = ["NEW", "AWAITING_PHOTO_REVIEW", "PHOTO_APPROVED", "AWAITING_PAYMENT", "PRINTING", "FRAMING", "READY", "OUT_FOR_DELIVERY", "COMPLETED", "CANCELLED"];

export default function Admin() {
  const nav = useNavigate();
  const [ok, setOk] = useState(false);
  const [name, setName] = useState("");
  const [tab, setTab] = useState<Tab>("dashboard");

  useEffect(() => { api.adminMe().then((u) => { setName(u.name); setOk(true); }).catch(() => nav("/admin/login")); }, [nav]);
  if (!ok) return <div className="spinner" />;

  async function logout() { await api.adminLogout().catch(() => {}); nav("/admin/login"); }
  const nl = (t: Tab, label: string, icon: React.ReactNode) => (
    <button className={`navlink ${tab === t ? "on" : ""}`} onClick={() => setTab(t)}>{icon}{label}</button>
  );

  return (
    <div className="admin">
      <aside className="aside">
        <div className="brand"><Logo light /></div>
        {nl("dashboard", "Dashboard", <Ico d="M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z" />)}
        {nl("bookings", "Bookings", <Ico d="M8 2v3M16 2v3M3 8h18M4 5h16v16H4z" />)}
        {nl("orders", "Orders", <Ico d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0" />)}
        {nl("editing", "Editing", <Ico d="M12 19l7-7 3 3-7 7-3-3zM18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />)}
        {nl("portfolio", "Portfolio", <Ico d="M3 5h18v14H3zM3 15l5-5 4 4 3-3 6 6" />)}
        {nl("products", "Products", <Ico d="M3 7h18M3 12h18M3 17h18" />)}
        <div className="spacer" />
        <button className="navlink" onClick={() => nav("/")}><Ico d="M3 12l9-9 9 9M5 10v10h14V10" />View site</button>
        <button className="navlink" onClick={logout}><Ico d="M16 17l5-5-5-5M21 12H9M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />Sign out</button>
      </aside>
      <main className="amain">
        {tab === "dashboard" && <Dashboard name={name} />}
        {tab === "bookings" && <Bookings />}
        {tab === "orders" && <Orders />}
        {tab === "editing" && <Editing />}
        {tab === "portfolio" && <Portfolio />}
        {tab === "products" && <Products />}
      </main>
    </div>
  );
}
const Ico = ({ d }: { d: string }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">{d.split("M").filter(Boolean).map((seg, i) => <path key={i} d={"M" + seg} />)}</svg>;

function Dashboard({ name }: { name: string }) {
  const [s, setS] = useState<any>(null);
  useEffect(() => { api.adminStats().then(setS).catch(() => {}); }, []);
  if (!s) return <div className="spinner" />;
  return (
    <>
      <div className="ahead"><div><h1>Welcome back, {name.split(" ")[0]}</h1><p className="muted">Here's what's happening at the studio.</p></div></div>
      <div className="stats-row">
        <Stat l="New requests" n={s.newBookings} /><Stat l="Total bookings" n={s.bookings} /><Stat l="Product orders" n={s.orders} /><Stat l="Editing requests" n={s.editing} />
      </div>
      <div className="panel">
        <div className="ph2">Latest booking requests</div>
        <div className="table-scroll"><table>
          <thead><tr><th>Ref</th><th>Service</th><th>Customer</th><th>Date</th><th>Status</th></tr></thead>
          <tbody>
            {s.recentBookings.length === 0 ? <tr><td colSpan={5} className="muted">No bookings yet.</td></tr> : s.recentBookings.map((b: any) => (
              <tr key={b.reference}><td>{b.reference}</td><td>{b.serviceName}</td><td>{b.customerName}<div className="muted" style={{ fontSize: 12 }}>{b.phone}</div></td><td>{b.preferredDate || "—"}</td><td><span className={`pill ${b.status}`}>{b.status}</span></td></tr>
            ))}
          </tbody>
        </table></div>
      </div>
    </>
  );
}
const Stat = ({ l, n }: { l: string; n: number }) => <div className="stat"><div className="l">{l}</div><div className="n">{n}</div></div>;

function Bookings() {
  const [rows, setRows] = useState<any[]>([]);
  const load = () => api.adminBookings().then(setRows).catch(() => {});
  useEffect(() => { load(); }, []);
  return (
    <>
      <div className="ahead"><h1>Bookings</h1></div>
      <div className="panel"><div className="table-scroll"><table>
        <thead><tr><th>Ref</th><th>Service</th><th>Customer</th><th>Details</th><th>Status</th></tr></thead>
        <tbody>
          {rows.length === 0 ? <tr><td colSpan={5} className="muted">No bookings yet.</td></tr> : rows.map((b) => (
            <tr key={b.id}>
              <td>{b.reference}<div className="muted" style={{ fontSize: 12 }}>{new Date(b.createdAt).toLocaleDateString()}</div></td>
              <td>{b.serviceName}{b.withVideo ? " + video" : ""}</td>
              <td>{b.customerName}<div className="muted" style={{ fontSize: 12 }}>{b.phone}{b.email ? ` · ${b.email}` : ""}</div></td>
              <td className="muted" style={{ fontSize: 13, maxWidth: 260 }}>{[b.preferredDate, b.preferredTime, b.setting, b.locationText, b.description].filter(Boolean).join(" · ")}</td>
              <td><select value={b.status} onChange={async (e) => { await api.adminUpdateBooking(b.id, { status: e.target.value }); load(); }} style={sel}>{BOOKING_STATUSES.map((x) => <option key={x} value={x}>{x.replace(/_/g, " ")}</option>)}</select></td>
            </tr>
          ))}
        </tbody>
      </table></div></div>
    </>
  );
}

function Orders() {
  const [rows, setRows] = useState<any[]>([]);
  const load = () => api.adminOrders().then(setRows).catch(() => {});
  useEffect(() => { load(); }, []);
  return (
    <>
      <div className="ahead"><h1>Product orders</h1></div>
      <div className="panel"><div className="table-scroll"><table>
        <thead><tr><th>Ref</th><th>Customer</th><th>Items</th><th>Total</th><th>Fulfilment</th><th>Status</th></tr></thead>
        <tbody>
          {rows.length === 0 ? <tr><td colSpan={6} className="muted">No orders yet.</td></tr> : rows.map((o) => (
            <tr key={o.id}>
              <td>{o.reference}</td>
              <td>{o.customerName}<div className="muted" style={{ fontSize: 12 }}>{o.phone}</div></td>
              <td className="muted" style={{ fontSize: 13 }}>{o.items.map((i: any) => `${i.name}${i.needsEditing ? " (edit)" : ""} ×${i.qty}`).join(", ")}</td>
              <td>${o.total}<div className="muted" style={{ fontSize: 12 }}>{o.paymentMethod}</div></td>
              <td className="muted" style={{ fontSize: 13 }}>{o.fulfilment}{o.town ? ` · ${o.town}` : ""}</td>
              <td><select value={o.status} onChange={async (e) => { await api.adminUpdateOrder(o.id, e.target.value); load(); }} style={sel}>{ORDER_STATUSES.map((x) => <option key={x} value={x}>{x.replace(/_/g, " ")}</option>)}</select></td>
            </tr>
          ))}
        </tbody>
      </table></div></div>
    </>
  );
}

function Editing() {
  const [rows, setRows] = useState<any[]>([]);
  const load = () => api.adminEditing().then(setRows).catch(() => {});
  useEffect(() => { load(); }, []);
  return (
    <>
      <div className="ahead"><h1>Editing requests</h1></div>
      <div className="panel"><div className="table-scroll"><table>
        <thead><tr><th>Ref</th><th>Service</th><th>Customer</th><th>Photos</th><th>Instructions</th><th>Status</th></tr></thead>
        <tbody>
          {rows.length === 0 ? <tr><td colSpan={6} className="muted">No editing requests yet.</td></tr> : rows.map((r) => (
            <tr key={r.id}>
              <td>{r.reference}</td><td>{r.serviceName}<div className="muted" style={{ fontSize: 12 }}>{r.complexity} · {r.speed}</div></td>
              <td>{r.customerName}<div className="muted" style={{ fontSize: 12 }}>{r.phone}</div></td>
              <td>{r.photoCount}</td>
              <td className="muted" style={{ fontSize: 13, maxWidth: 240 }}>{r.instructions}</td>
              <td><select value={r.status} onChange={async (e) => { await api.adminUpdateEditing(r.id, { status: e.target.value }); load(); }} style={sel}>{EDITING_STATUSES.map((x) => <option key={x} value={x}>{x.replace(/_/g, " ")}</option>)}</select></td>
            </tr>
          ))}
        </tbody>
      </table></div></div>
    </>
  );
}

const TONES = ["g-wed", "g-couple", "g-mat", "g-newborn", "g-birthday", "g-gender", "g-family", "g-food", "g-video"];
const PCATS = ["weddings", "couples", "maternity", "newborn", "birthdays", "gender-reveals", "families", "products-food", "videography"];

function Portfolio() {
  const [rows, setRows] = useState<any[]>([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ category: "weddings", tone: "g-wed", title: "", isFeatured: false });
  const load = () => api.adminPortfolio().then(setRows).catch(() => {});
  useEffect(() => { load(); }, []);
  async function create() { await api.adminCreatePortfolio({ ...form, description: "", imageUrl: "", orientation: "portrait", isActive: true, hasConsent: true }); setAdding(false); load(); }
  return (
    <>
      <div className="ahead"><h1>Portfolio</h1><button className="btn btn-dark btn-sm" onClick={() => setAdding((v) => !v)}>+ Add item</button></div>
      {adding && (
        <div className="panel" style={{ padding: 18 }}>
          <div className="form-grid">
            <div className="field"><label>Category</label><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{PCATS.map((c) => <option key={c}>{c}</option>)}</select></div>
            <div className="field"><label>Tone (placeholder)</label><select value={form.tone} onChange={(e) => setForm({ ...form, tone: e.target.value })}>{TONES.map((c) => <option key={c}>{c}</option>)}</select></div>
            <div className="field"><label>Title (optional)</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="field"><label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" style={{ width: "auto" }} checked={form.isFeatured} onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })} /> Featured</label></div>
          </div>
          <button className="btn btn-gold btn-sm" onClick={create}>Save</button>
          <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>Real photo uploads to storage come in the next phase — for now items use tone placeholders.</p>
        </div>
      )}
      <div className="panel"><div className="table-scroll"><table>
        <thead><tr><th>Category</th><th>Title</th><th>Featured</th><th></th></tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.id}><td>{r.category}</td><td>{r.title || "—"}</td><td>{r.isFeatured ? "★" : ""}</td><td><button className="icon-act" onClick={async () => { await api.adminDeletePortfolio(r.id); load(); }}>Delete</button></td></tr>
        ))}</tbody>
      </table></div></div>
    </>
  );
}

function Products() {
  const [rows, setRows] = useState<any[]>([]);
  const load = () => api.adminProducts().then(setRows).catch(() => {});
  useEffect(() => { load(); }, []);
  return (
    <>
      <div className="ahead"><h1>Products</h1></div>
      <div className="panel"><div className="table-scroll"><table>
        <thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th></tr></thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id}><td>{p.name}</td><td className="muted">{p.category?.name}</td><td>${p.price}</td><td>{p.madeToOrder ? "Made to order" : p.stock}</td><td><span className={`pill ${p.isActive ? "CONFIRMED" : "CANCELLED"}`}>{p.isActive ? "Live" : "Hidden"}</span></td></tr>
          ))}
        </tbody>
      </table></div></div>
      <p className="muted" style={{ fontSize: 13 }}>Full product add/edit form comes next; products are currently managed via the seed. Orders and inventory are live above.</p>
    </>
  );
}

const sel: React.CSSProperties = { padding: "7px 9px", borderRadius: 6, border: "1px solid var(--line)", background: "var(--card)", color: "var(--ink)", fontWeight: 700, fontSize: 12.5 };

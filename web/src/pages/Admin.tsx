import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { Logo } from "../components/Art";
import { MediaLibrary } from "../admin/Media";
import { PortfolioAdmin } from "../admin/Portfolio";
import { BookingsAdmin, CalendarAdmin } from "../admin/Bookings";
import { AvailabilityAdmin } from "../admin/Availability";
import { CustomersAdmin } from "../admin/Customers";
import { WebsiteContent } from "../admin/Content";
import { ServicesAdmin } from "../admin/Services";
import { NotificationsAdmin, NotificationBell } from "../admin/Notifications";
import { ProductsAdmin, OrdersAdmin, EditingAdmin } from "../admin/Shop";

type Tab = "dashboard" | "bookings" | "calendar" | "availability" | "customers" | "content" | "services" | "orders" | "editing" | "portfolio" | "media" | "products" | "notifications";

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
        <NotificationBell onOpen={() => setTab("notifications")} />
        {nl("bookings", "Bookings", <Ico d="M8 2v3M16 2v3M3 8h18M4 5h16v16H4z" />)}
        {nl("calendar", "Calendar", <Ico d="M8 2v3M16 2v3M4 5h16v16H4zM3 9h18M8 13h2M14 13h2M8 17h2M14 17h2" />)}
        {nl("availability", "Availability", <Ico d="M12 6v6l4 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z" />)}
        {nl("customers", "Customers", <Ico d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />)}
        {nl("orders", "Orders", <Ico d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0" />)}
        {nl("editing", "Editing", <Ico d="M12 19l7-7 3 3-7 7-3-3zM18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />)}
        {nl("content", "Website Content", <Ico d="M4 6h16M4 12h16M4 18h10M3 3h18v18H3z" />)}
        {nl("services", "Services", <Ico d="M12 2l2.6 6.6L21 9l-5 4.5L17.5 21 12 17l-5.5 4L8 13.5 3 9l6.4-.4z" />)}
        {nl("portfolio", "Portfolio", <Ico d="M3 5h18v14H3zM3 15l5-5 4 4 3-3 6 6" />)}
        {nl("media", "Media Library", <Ico d="M4 4h16v16H4zM4 15l4-4 4 4 3-3 5 5M9 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0" />)}
        {nl("products", "Products", <Ico d="M3 7h18M3 12h18M3 17h18" />)}
        <div className="spacer" />
        <button className="navlink" onClick={() => nav("/")}><Ico d="M3 12l9-9 9 9M5 10v10h14V10" />View site</button>
        <button className="navlink" onClick={logout}><Ico d="M16 17l5-5-5-5M21 12H9M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />Sign out</button>
      </aside>
      <main className="amain">
        {tab === "dashboard" && <Dashboard name={name} />}
        {tab === "bookings" && <BookingsAdmin />}
        {tab === "calendar" && <CalendarAdmin />}
        {tab === "availability" && <AvailabilityAdmin />}
        {tab === "customers" && <CustomersAdmin />}
        {tab === "notifications" && <NotificationsAdmin onNavigate={(t) => setTab(t as Tab)} />}
        {tab === "content" && <WebsiteContent />}
        {tab === "services" && <ServicesAdmin />}
        {tab === "orders" && <OrdersAdmin />}
        {tab === "editing" && <EditingAdmin />}
        {tab === "portfolio" && <PortfolioAdmin />}
        {tab === "media" && <MediaLibrary />}
        {tab === "products" && <ProductsAdmin />}
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
        <Stat l="New requests" n={s.newBookings} /><Stat l="Today's sessions" n={s.todaysBookings ?? 0} /><Stat l="Upcoming" n={s.upcoming ?? 0} /><Stat l="Awaiting deposit" n={s.awaitingDeposits ?? 0} />
      </div>
      <div className="stats-row">
        <Stat l="Confirmed" n={s.confirmed ?? 0} /><Stat l="Completed" n={s.completed ?? 0} /><Stat l="Unpaid balances" n={s.unpaidBalances ?? 0} /><Stat l="Product orders" n={s.orders} />
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


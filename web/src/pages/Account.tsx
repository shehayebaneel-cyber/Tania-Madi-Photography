import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";

interface Me { name: string; email: string; phone: string; bookings: any[]; orders: any[]; editing: any[]; }

export default function Account() {
  const [me, setMe] = useState<Me | null>(null);
  const [checked, setChecked] = useState(false);
  const [tab, setTab] = useState<"login" | "register">("login");
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const load = () => api.me().then((d) => { setMe(d); setChecked(true); }).catch(() => { setMe(null); setChecked(true); });
  useEffect(() => { load(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(""); setBusy(true);
    try {
      if (tab === "register") await api.register(form);
      else await api.login(form.email, form.password);
      await load();
    } catch (err) { setError((err as Error).message); }
    setBusy(false);
  }
  async function logout() { await api.logout().catch(() => {}); setMe(null); }

  if (!checked) return <div className="spinner" />;

  if (!me) return (
    <>
      <div className="pagehead"><p className="eyebrow">My account</p><h1>Sign in</h1><p>Track your bookings, orders, editing requests and private galleries.</p></div>
      <section>
        <div className="wrap auth">
          <div className="tabs">
            <button className={tab === "login" ? "on" : ""} onClick={() => setTab("login")}>Sign in</button>
            <button className={tab === "register" ? "on" : ""} onClick={() => setTab("register")}>Create account</button>
          </div>
          {error && <div className="notice err">{error}</div>}
          <form className="form-card" onSubmit={submit}>
            {tab === "register" && <>
              <div className="field"><label>Full name</label><input value={form.name} onChange={(e) => set("name", e.target.value)} /></div>
              <div className="field"><label>Phone</label><input value={form.phone} onChange={(e) => set("phone", e.target.value)} inputMode="tel" /></div>
            </>}
            <div className="field"><label>Email</label><input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} autoComplete="username" /></div>
            <div className="field"><label>Password</label><input type="password" value={form.password} onChange={(e) => set("password", e.target.value)} autoComplete={tab === "register" ? "new-password" : "current-password"} /></div>
            <button className="btn btn-dark btn-block" disabled={busy}>{busy ? "Please wait…" : tab === "register" ? "Create account" : "Sign in"}</button>
          </form>
          <p className="muted center" style={{ fontSize: 13, marginTop: 14 }}>You can also book or order as a guest — an account just keeps everything in one place.</p>
        </div>
      </section>
    </>
  );

  const Section = ({ title, rows }: { title: string; rows: { ref: string; main: string; status: string }[] }) => (
    <div style={{ marginBottom: 26 }}>
      <h2 style={{ fontSize: 20, marginBottom: 12 }}>{title}</h2>
      {rows.length === 0 ? <p className="muted" style={{ fontSize: 14 }}>Nothing here yet.</p> : rows.map((r) => (
        <div className="acct-item" key={r.ref}>
          <div><b>{r.ref}</b><div className="muted" style={{ fontSize: 13 }}>{r.main}</div></div>
          <span className={`pill ${r.status}`}>{r.status.replace(/_/g, " ")}</span>
        </div>
      ))}
    </div>
  );

  return (
    <>
      <div className="pagehead"><p className="eyebrow">My account</p><h1>Hello, {me.name.split(" ")[0]}</h1></div>
      <section>
        <div className="wrap" style={{ maxWidth: 760 }}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}><button className="icon-act" onClick={logout}>Sign out</button></div>
          <Section title="Photography bookings" rows={me.bookings.map((b) => ({ ref: b.reference, main: `${b.serviceName}${b.preferredDate ? " · " + b.preferredDate : ""}`, status: b.status }))} />
          <Section title="Frame & print orders" rows={me.orders.map((o) => ({ ref: o.reference, main: `$${o.total} · ${o.items.length} item(s)`, status: o.status }))} />
          <Section title="Editing requests" rows={me.editing.map((e) => ({ ref: e.reference, main: e.serviceName, status: e.status }))} />
          <div className="center"><Link className="btn btn-outline" to="/book">Book another session</Link></div>
        </div>
      </section>
    </>
  );
}

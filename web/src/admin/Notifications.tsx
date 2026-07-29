import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api";

// fill {placeholders} from a booking
export function fillTemplate(body: string, b: any): string {
  const map: Record<string, string> = {
    name: (b.customerName || "").split(" ")[0] || b.customerName || "there",
    service: b.serviceName || "your session",
    date: b.date || b.preferredDate || "the agreed date",
    time: b.startTime ? " at " + b.startTime : "",
    price: b.price ? "$" + b.price : b.quote ? "$" + b.quote : "the quoted amount",
    deposit: b.deposit ? "$" + b.deposit : "the deposit",
    ref: b.reference || "",
    studio: "Tania Madi Photography",
  };
  return body.replace(/\{(\w+)\}/g, (_, k) => (map[k] ?? `{${k}}`));
}

// ── used from booking detail: pick a template, review, send ──────────────────
export function SendMessageModal({ booking, onClose }: { booking: any; onClose: () => void }) {
  const [templates, setTemplates] = useState<any[]>([]);
  const [sel, setSel] = useState<any>(null);
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => { api.adminTemplates().then((t) => { setTemplates(t); if (t[0]) { setSel(t[0]); setText(fillTemplate(t[0].body, booking)); } }).catch(() => {}); }, [booking]);
  const pick = (t: any) => { setSel(t); setText(fillTemplate(t.body, booking)); };
  const digits = String(booking.whatsapp || booking.phone || "").replace(/\D/g, "").replace(/^00/, "");
  const wa = digits ? `https://wa.me/${digits.startsWith("961") ? digits : "961" + digits.replace(/^0/, "")}?text=${encodeURIComponent(text)}` : "";
  const mailto = booking.email ? `mailto:${booking.email}?subject=${encodeURIComponent("Tania Madi Photography")}&body=${encodeURIComponent(text)}` : "";
  return (
    <div className="modal-back" onClick={onClose}><div className="modal-card sm" onClick={(e) => e.stopPropagation()}>
      <div className="ahead"><h1 style={{ fontSize: 20 }}>Send a message</h1><button className="icon-act" onClick={onClose}>Close</button></div>
      <div style={{ display: "grid", gap: 10 }}>
        <div className="field"><label>Template</label><select value={sel?.id || ""} onChange={(e) => pick(templates.find((t) => t.id === Number(e.target.value)))}>{templates.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></div>
        <div className="field"><label>Message (edit before sending)</label><textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} /></div>
        <p className="muted" style={{ fontSize: 12 }}>Nothing is sent automatically — this opens WhatsApp or your email with the message ready for you to review and send.</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {wa && <a className="btn btn-gold btn-sm" href={wa} target="_blank" rel="noreferrer">Send on WhatsApp</a>}
          {mailto && <a className="btn btn-sm" href={mailto}>Email</a>}
          <button className="btn btn-sm" onClick={() => { navigator.clipboard?.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? "Copied ✓" : "Copy"}</button>
        </div>
      </div>
    </div></div>
  );
}

// ── sidebar bell with unseen count ───────────────────────────────────────────
export function NotificationBell({ onOpen }: { onOpen: () => void }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const load = () => api.adminNotifications().then((n) => setCount(n.count)).catch(() => {});
    load(); const t = setInterval(load, 60000); return () => clearInterval(t);
  }, []);
  return (
    <button className="navlink" onClick={onOpen} style={{ position: "relative" }}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" /></svg>
      Notifications
      {count > 0 && <span style={{ position: "absolute", left: 30, top: 6, background: "var(--crit)", color: "#fff", fontSize: 10, fontWeight: 800, borderRadius: 999, padding: "1px 6px" }}>{count}</span>}
    </button>
  );
}

// ── Notifications tab: feed + template editor ────────────────────────────────
export function NotificationsAdmin({ onNavigate }: { onNavigate?: (tab: string, id: number) => void }) {
  const [data, setData] = useState<{ count: number; items: any[]; seenAt: string } | null>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const markedRef = useRef(false);
  const loadTpl = useCallback(() => api.adminTemplates().then(setTemplates).catch(() => {}), []);
  useEffect(() => {
    api.adminNotifications().then((n) => { setData(n); if (!markedRef.current) { markedRef.current = true; api.adminMarkNotificationsSeen().catch(() => {}); } }).catch(() => {});
    loadTpl();
  }, [loadTpl]);

  return (
    <>
      <div className="ahead"><div><h1>Notifications &amp; messages</h1><p className="muted">New requests land here. Edit the message templates you send customers.</p></div></div>

      <div className="panel" style={{ padding: 16, marginBottom: 14 }}>
        <h2 style={{ fontSize: 15, margin: "0 0 10px" }}>Recent activity</h2>
        {!data ? <p className="muted">Loading…</p> : data.items.length === 0 ? <p className="muted" style={{ fontSize: 13 }}>Nothing yet.</p> : (
          <div style={{ display: "grid", gap: 6 }}>
            {data.items.map((it) => (
              <button key={it.type + it.id} className="navlink" style={{ textAlign: "left", border: "1px solid var(--line)", borderRadius: 8, padding: "8px 10px", display: "flex", justifyContent: "space-between", gap: 8 }}
                onClick={() => onNavigate?.(it.type === "order" ? "orders" : it.type === "editing" ? "editing" : "bookings", it.id)}>
                <span>{it.isNew && <span style={{ color: "var(--gold)", marginRight: 6 }}>●</span>}{it.title} <span className="muted">· {it.sub}</span></span>
                <span className="muted" style={{ fontSize: 11.5 }}>{new Date(it.at).toLocaleString()}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="panel" style={{ padding: 16 }}>
        <div className="ahead" style={{ marginBottom: 6 }}><h2 style={{ fontSize: 15, margin: 0 }}>Message templates</h2><button className="btn btn-dark btn-sm" onClick={async () => { await api.adminCreateTemplate({ label: "New template", body: "Hi {name}, …" }); loadTpl(); }}>+ Add</button></div>
        <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>Use placeholders: {"{name} {service} {date} {time} {price} {deposit} {ref} {studio}"}</p>
        <div style={{ display: "grid", gap: 10 }}>
          {templates.map((t) => <TemplateRow key={t.id} t={t} onChanged={loadTpl} />)}
        </div>
      </div>
    </>
  );
}

function TemplateRow({ t, onChanged }: { t: any; onChanged: () => void }) {
  const [label, setLabel] = useState(t.label);
  const [body, setBody] = useState(t.body);
  const [msg, setMsg] = useState("");
  return (
    <div style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 10, display: "grid", gap: 6 }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input value={label} onChange={(e) => setLabel(e.target.value)} className="field" style={{ flex: 1, fontWeight: 700 }} />
        <button className="icon-act" style={{ color: "var(--crit)" }} onClick={async () => { if (confirm("Delete this template?")) { await api.adminDeleteTemplate(t.id); onChanged(); } }}>Delete</button>
      </div>
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} className="field" />
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button className="btn btn-gold btn-sm" onClick={async () => { await api.adminUpdateTemplate(t.id, { label, body }); setMsg("Saved ✓"); setTimeout(() => setMsg(""), 1500); onChanged(); }}>Save</button>
        {msg && <span style={{ color: "var(--good)", fontSize: 12.5 }}>{msg}</span>}
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { api } from "../lib/api";

export function SettingsAdmin({ role }: { role: string }) {
  const isOwner = role === "owner";
  return (
    <>
      <div className="ahead"><div><h1>Settings</h1><p className="muted">Your account, your team, and a backup of everything.</p></div></div>
      <AccountPanel />
      {isOwner && <TeamPanel />}
      {isOwner && <BackupPanel />}
      <ActivityPanel />
      {!isOwner && <p className="muted" style={{ fontSize: 13 }}>Team management and backups are available to the studio owner.</p>}
    </>
  );
}

// ── change my own password ───────────────────────────────────────────────────
function AccountPanel() {
  const [cur, setCur] = useState(""); const [next, setNext] = useState(""); const [msg, setMsg] = useState<{ ok?: boolean; t: string } | null>(null);
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true); setMsg(null);
    try { await api.adminChangePassword(cur, next); setMsg({ ok: true, t: "Password updated ✓" }); setCur(""); setNext(""); }
    catch (e: any) { setMsg({ ok: false, t: e?.message || "Could not update password." }); }
    finally { setBusy(false); }
  }
  return (
    <div className="panel" style={{ padding: 16, marginBottom: 16 }}>
      <h2 style={{ fontSize: 15, margin: "0 0 12px" }}>My password</h2>
      <div className="grid2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, maxWidth: 560 }}>
        <div className="field"><label>Current password</label><input type="password" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" /></div>
        <div className="field"><label>New password</label><input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" /></div>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10 }}>
        <button className="btn btn-gold btn-sm" disabled={busy || !cur || next.length < 6} onClick={save}>{busy ? "Saving…" : "Update password"}</button>
        {msg && <span style={{ fontSize: 12.5, color: msg.ok ? "var(--good)" : "var(--crit)" }}>{msg.t}</span>}
      </div>
    </div>
  );
}

// ── team members (owner only) ────────────────────────────────────────────────
function TeamPanel() {
  const [team, setTeam] = useState<any[]>([]);
  const [adding, setAdding] = useState(false);
  const load = () => api.adminTeam().then(setTeam).catch(() => {});
  useEffect(() => { load(); }, []);
  return (
    <div className="panel" style={{ padding: 16, marginBottom: 16 }}>
      <div className="ahead" style={{ marginBottom: 10 }}><h2 style={{ fontSize: 15, margin: 0 }}>Team</h2><button className="btn btn-dark btn-sm" onClick={() => setAdding(true)}>+ Add member</button></div>
      <div className="table-scroll"><table>
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th></th></tr></thead>
        <tbody>
          {team.length === 0 ? <tr><td colSpan={4} className="muted">Loading…</td></tr> : team.map((u) => <TeamRow key={u.id} u={u} onChanged={load} />)}
        </tbody>
      </table></div>
      {adding && <TeamForm onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load(); }} />}
    </div>
  );
}

function TeamRow({ u, onChanged }: { u: any; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  async function del() {
    if (!confirm(`Remove ${u.name || u.email} from the team?`)) return;
    try { await api.adminDeleteTeam(u.id); onChanged(); } catch (e: any) { alert(e?.message || "Could not remove."); }
  }
  return (
    <>
      <tr>
        <td>{u.name || <span className="muted">—</span>}</td>
        <td>{u.email}</td>
        <td><span className="pill" style={{ background: u.role === "owner" ? "var(--good-bg)" : "var(--beige)", color: u.role === "owner" ? "var(--good)" : "var(--ink-2)" }}>{u.role}</span></td>
        <td style={{ whiteSpace: "nowrap" }}>
          <button className="icon-act" onClick={() => setEditing(true)}>Edit</button>{" "}
          <button className="icon-act" style={{ color: "var(--crit)" }} onClick={del}>Remove</button>
        </td>
      </tr>
      {editing && <tr><td colSpan={4} style={{ background: "var(--beige)" }}><TeamForm u={u} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); onChanged(); }} /></td></tr>}
    </>
  );
}

function TeamForm({ u, onClose, onSaved }: { u?: any; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(u?.name || "");
  const [email, setEmail] = useState(u?.email || "");
  const [role, setRole] = useState(u?.role || "staff");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true); setErr("");
    try {
      if (u) await api.adminUpdateTeam(u.id, { name, role, ...(password ? { password } : {}) });
      else await api.adminCreateTeam({ name, email, role, password });
      onSaved();
    } catch (e: any) { setErr(e?.message || "Could not save."); setBusy(false); }
  }
  const body = (
    <div style={{ display: "grid", gap: 10 }}>
      <div className="grid2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div className="field"><label>Name</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="field"><label>Email</label><input value={email} onChange={(e) => setEmail(e.target.value)} disabled={!!u} autoComplete="off" /></div>
      </div>
      <div className="grid2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div className="field"><label>Role</label><select value={role} onChange={(e) => setRole(e.target.value)}><option value="staff">Staff</option><option value="owner">Owner</option></select></div>
        <div className="field"><label>{u ? "New password (optional)" : "Password"}</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" placeholder={u ? "leave blank to keep" : "6+ characters"} /></div>
      </div>
      {err && <p style={{ color: "var(--crit)", fontSize: 13, margin: 0 }}>{err}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-gold btn-sm" disabled={busy} onClick={save}>{busy ? "Saving…" : u ? "Save changes" : "Add member"}</button>
        <button className="btn btn-sm" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
  // inline row-editor when editing an existing member; modal when adding new
  if (u) return <div style={{ padding: "12px 4px" }}>{body}</div>;
  return <div className="modal-back" onClick={onClose}><div className="modal-card sm" onClick={(e) => e.stopPropagation()}><div className="ahead"><h1 style={{ fontSize: 20 }}>Add team member</h1><button className="icon-act" onClick={onClose}>Close</button></div>{body}</div></div>;
}

// ── backup ───────────────────────────────────────────────────────────────────
function BackupPanel() {
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState("");
  async function download() {
    setBusy(true); setMsg("");
    try {
      const data = await api.adminBackup();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `tania-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      setMsg("Downloaded ✓");
    } catch (e: any) { setMsg(e?.message || "Could not create backup."); }
    finally { setBusy(false); }
  }
  return (
    <div className="panel" style={{ padding: 16, marginBottom: 16 }}>
      <h2 style={{ fontSize: 15, margin: "0 0 8px" }}>Backup</h2>
      <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>Download a full copy of your bookings, orders, customers, content and settings as a JSON file. Keep it somewhere safe. (Uploaded photos are stored separately.)</p>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button className="btn btn-dark btn-sm" disabled={busy} onClick={download}>{busy ? "Preparing…" : "Download backup"}</button>
        {msg && <span style={{ fontSize: 12.5, color: /✓/.test(msg) ? "var(--good)" : "var(--crit)" }}>{msg}</span>}
      </div>
    </div>
  );
}

// ── activity log ─────────────────────────────────────────────────────────────
function ActivityPanel() {
  const [rows, setRows] = useState<any[] | null>(null);
  useEffect(() => { api.adminActivity().then(setRows).catch(() => setRows([])); }, []);
  return (
    <div className="panel" style={{ padding: 16 }}>
      <h2 style={{ fontSize: 15, margin: "0 0 10px" }}>Recent changes</h2>
      {!rows ? <p className="muted">Loading…</p> : rows.length === 0 ? <p className="muted" style={{ fontSize: 13 }}>No changes recorded yet.</p> : (
        <div className="table-scroll"><table>
          <thead><tr><th>What</th><th>Who</th><th>When</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}><td>{r.summary}</td><td>{r.adminName || <span className="muted">—</span>}</td><td className="muted" style={{ whiteSpace: "nowrap" }}>{new Date(r.createdAt).toLocaleString()}</td></tr>
            ))}
          </tbody>
        </table></div>
      )}
    </div>
  );
}

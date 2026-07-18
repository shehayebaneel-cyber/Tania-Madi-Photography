import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { Logo } from "../components/Art";

export default function AdminLogin() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(""); setBusy(true);
    try { await api.adminLogin(email, password); nav("/admin"); }
    catch (err) { setError((err as Error).message); setBusy(false); }
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "radial-gradient(120% 90% at 50% -10%, color-mix(in srgb, var(--gold) 12%, var(--paper)), var(--paper))" }}>
      <form className="form-card" style={{ width: "100%", maxWidth: 400 }} onSubmit={submit}>
        <div style={{ textAlign: "center", marginBottom: 8 }}><Logo /></div>
        <h1 style={{ textAlign: "center", fontSize: 22 }}>Studio sign in</h1>
        <p className="muted center" style={{ fontSize: 14, margin: "4px 0 20px" }}>Tania Madi Photography · admin</p>
        {error && <div className="notice err">{error}</div>}
        <div className="field"><label>Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" /></div>
        <div className="field"><label>Password</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></div>
        <button className="btn btn-dark btn-block" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        <p className="center" style={{ marginTop: 14 }}><a onClick={() => nav("/")} style={{ cursor: "pointer", color: "var(--grey)", fontSize: 13 }}>← Back to site</a></p>
      </form>
    </div>
  );
}

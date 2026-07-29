import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";

const DAYS: [string, string][] = [["mon", "Monday"], ["tue", "Tuesday"], ["wed", "Wednesday"], ["thu", "Thursday"], ["fri", "Friday"], ["sat", "Saturday"], ["sun", "Sunday"]];
const fld: React.CSSProperties = { padding: "7px 9px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--card)", color: "var(--ink)", fontSize: 13 };

export function AvailabilityAdmin() {
  const [cfg, setCfg] = useState<any>(null);
  const [blackouts, setBlackouts] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [bo, setBo] = useState<any>({ date: "", allDay: true, startTime: "", endTime: "", reason: "holiday" });
  const [saved, setSaved] = useState("");

  const loadBo = useCallback(() => api.adminBlackouts().then(setBlackouts).catch(() => {}), []);
  useEffect(() => { api.adminAvailability().then(setCfg).catch(() => {}); loadBo(); api.adminServices().then(setServices).catch(() => {}); }, [loadBo]);
  if (!cfg) return <div className="spinner" />;

  const setDay = (k: string, patch: any) => setCfg((c: any) => ({ ...c, workingDays: { ...c.workingDays, [k]: { ...c.workingDays[k], ...patch } } }));
  async function saveCfg() { const v = await api.adminUpdateAvailability(cfg); setCfg(v); flash("Availability saved ✓"); }
  async function saveService(slug: string, durationMinutes: number) { await api.adminUpdateService(slug, { durationMinutes }); flash("Duration saved ✓"); }
  const flash = (m: string) => { setSaved(m); setTimeout(() => setSaved(""), 2500); };
  async function addBlackout() { if (!bo.date) return; await api.adminCreateBlackout(bo); setBo({ date: "", allDay: true, startTime: "", endTime: "", reason: "holiday" }); loadBo(); }

  return (
    <>
      <div className="ahead"><div><h1>Availability</h1><p className="muted">Working hours, blocked days, buffers and booking limits — used to warn you about clashes.</p></div>{saved && <span style={{ color: "var(--good)", fontWeight: 700, fontSize: 13 }}>{saved}</span>}</div>

      {/* working hours */}
      <div className="panel" style={{ padding: 16, marginBottom: 14 }}>
        <h2 style={{ fontSize: 15, margin: "0 0 10px" }}>Working hours</h2>
        <div style={{ display: "grid", gap: 6 }}>
          {DAYS.map(([k, label]) => { const d = cfg.workingDays[k]; return (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <label style={{ display: "flex", gap: 7, alignItems: "center", minWidth: 130, fontSize: 13.5 }}><input type="checkbox" style={{ width: "auto" }} checked={!!d.open} onChange={(e) => setDay(k, { open: e.target.checked })} /> {label}</label>
              {d.open ? <><input type="time" style={fld} value={d.start} onChange={(e) => setDay(k, { start: e.target.value })} /><span className="muted">to</span><input type="time" style={fld} value={d.end} onChange={(e) => setDay(k, { end: e.target.value })} /></> : <span className="muted" style={{ fontSize: 13 }}>Closed</span>}
            </div>
          ); })}
        </div>
      </div>

      {/* rules */}
      <div className="panel" style={{ padding: 16, marginBottom: 14 }}>
        <h2 style={{ fontSize: 15, margin: "0 0 10px" }}>Booking rules</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
          <div className="field"><label>Max bookings per day</label><input type="number" min={1} style={fld} value={cfg.maxPerDay} onChange={(e) => setCfg({ ...cfg, maxPerDay: Number(e.target.value) })} /></div>
          <div className="field"><label>Buffer between sessions (min)</label><input type="number" min={0} step={15} style={fld} value={cfg.bufferMinutes} onChange={(e) => setCfg({ ...cfg, bufferMinutes: Number(e.target.value) })} /></div>
          <div className="field"><label>Default session length (min)</label><input type="number" min={15} step={15} style={fld} value={cfg.defaultDurationMinutes} onChange={(e) => setCfg({ ...cfg, defaultDurationMinutes: Number(e.target.value) })} /></div>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13.5, alignSelf: "end", paddingBottom: 6 }}><input type="checkbox" style={{ width: "auto" }} checked={!!cfg.allowOverlap} onChange={(e) => setCfg({ ...cfg, allowOverlap: e.target.checked })} /> Allow overlapping bookings</label>
        </div>
        <button className="btn btn-gold btn-sm" style={{ marginTop: 12 }} onClick={saveCfg}>Save hours &amp; rules</button>
      </div>

      {/* per-service durations */}
      {services.length > 0 && <div className="panel" style={{ padding: 16, marginBottom: 14 }}>
        <h2 style={{ fontSize: 15, margin: "0 0 4px" }}>Session length per service</h2>
        <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>Used to work out end times and spot clashes.</p>
        <div style={{ display: "grid", gap: 8 }}>
          {services.map((s) => <ServiceDurationRow key={s.slug} s={s} onSave={saveService} />)}
        </div>
      </div>}

      {/* blackouts */}
      <div className="panel" style={{ padding: 16 }}>
        <h2 style={{ fontSize: 15, margin: "0 0 10px" }}>Blocked days &amp; time off</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 12 }}>
          <div className="field" style={{ margin: 0 }}><label>Date</label><input type="date" style={fld} value={bo.date} onChange={(e) => setBo({ ...bo, date: e.target.value })} /></div>
          <label style={{ display: "flex", gap: 7, alignItems: "center", fontSize: 13.5, paddingBottom: 7 }}><input type="checkbox" style={{ width: "auto" }} checked={bo.allDay} onChange={(e) => setBo({ ...bo, allDay: e.target.checked })} /> All day</label>
          {!bo.allDay && <><input type="time" style={fld} value={bo.startTime} onChange={(e) => setBo({ ...bo, startTime: e.target.value })} /><span className="muted">–</span><input type="time" style={fld} value={bo.endTime} onChange={(e) => setBo({ ...bo, endTime: e.target.value })} /></>}
          <select style={fld} value={bo.reason} onChange={(e) => setBo({ ...bo, reason: e.target.value })}><option value="holiday">Holiday</option><option value="closure">Studio closure</option><option value="personal">Personal</option><option value="other">Other</option></select>
          <button className="btn btn-dark btn-sm" onClick={addBlackout}>Block it</button>
        </div>
        {blackouts.length === 0 ? <p className="muted" style={{ fontSize: 13 }}>No blocked days.</p> : (
          <div style={{ display: "grid", gap: 6 }}>
            {blackouts.map((b) => (
              <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 10, border: "1px solid var(--line)", borderRadius: 8, padding: "7px 10px" }}>
                <b style={{ fontSize: 13.5, minWidth: 96 }}>{b.date}</b>
                <span style={{ fontSize: 13 }}>{b.allDay ? "All day" : `${b.startTime}–${b.endTime}`}</span>
                <span className="muted" style={{ fontSize: 12.5, flex: 1 }}>{b.reason}</span>
                <button className="icon-act" style={{ color: "var(--crit)" }} onClick={async () => { await api.adminDeleteBlackout(b.id); loadBo(); }}>Remove</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function ServiceDurationRow({ s, onSave }: { s: any; onSave: (slug: string, m: number) => void }) {
  const [m, setM] = useState<number>(s.durationMinutes || 120);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ flex: 1, fontSize: 13.5 }}>{s.name}</span>
      <input type="number" min={15} step={15} style={{ ...fld, width: 90 }} value={m} onChange={(e) => setM(Number(e.target.value))} />
      <span className="muted" style={{ fontSize: 12 }}>min</span>
      <button className="icon-act" onClick={() => onSave(s.slug, m)}>Save</button>
    </div>
  );
}

// ── reusable conflict warning banner (Add Booking + booking detail) ──────────
export function ConflictBanner({ date, startTime, endTime, serviceSlug, excludeId }: { date?: string; startTime?: string; endTime?: string; serviceSlug?: string; excludeId?: number }) {
  const [warnings, setWarnings] = useState<{ type: string; msg: string }[]>([]);
  useEffect(() => {
    if (!date) { setWarnings([]); return; }
    const t = setTimeout(() => { api.adminCheckConflict({ date, startTime, endTime, serviceSlug, excludeId }).then((r) => setWarnings(r.warnings)).catch(() => setWarnings([])); }, 350);
    return () => clearTimeout(t);
  }, [date, startTime, endTime, serviceSlug, excludeId]);
  if (!warnings.length) return null;
  return (
    <div style={{ background: "var(--warn-bg)", border: "1px solid var(--warn)", borderRadius: 10, padding: "9px 12px" }}>
      <b style={{ color: "var(--warn)", fontSize: 13 }}>⚠ Heads up</b>
      <ul style={{ margin: "4px 0 0 16px", padding: 0, fontSize: 12.5, color: "var(--ink)" }}>{warnings.map((w, i) => <li key={i}>{w.msg}</li>)}</ul>
    </div>
  );
}

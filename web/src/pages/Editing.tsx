import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type EditingService } from "../lib/api";
import { Tone, Check } from "../components/Art";

const COMPLEXITY = ["BASIC", "ADVANCED", "COMPLEX", "CUSTOM"] as const;
const SPEED = [{ v: "STANDARD", l: "Standard" }, { v: "EXPRESS", l: "Express (+)" }, { v: "URGENT", l: "Urgent (++)" }];
const BEFORE_AFTER = [
  { t: "Old photo restoration", a: "g-family", b: "g-wed" },
  { t: "Colour correction", a: "g-video", b: "g-mat" },
  { t: "Background removal", a: "g-couple", b: "g-newborn" },
];

export default function Editing() {
  const nav = useNavigate();
  const [svcs, setSvcs] = useState<EditingService[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState<string[]>([]);
  const [f, setF] = useState({ serviceSlug: "", complexity: "BASIC", speed: "STANDARD", instructions: "", customerName: "", phone: "", whatsapp: "", email: "", deliveryPref: "", notes: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => { api.editingServices().then(setSvcs).catch(() => {}); }, []);

  function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    setFiles(Array.from(e.target.files || []).map((x) => x.name));
  }
  const svc = svcs.find((s) => s.slug === f.serviceSlug);
  const priceText = svc ? (svc.pricingType === "FIXED" ? `$${svc.price} / photo` : svc.pricingType === "STARTING" ? `From $${svc.price} / photo` : "Custom quote after review") : "";

  async function submit() {
    setError("");
    if (!f.serviceSlug) return setError("Please choose an editing service.");
    if (f.customerName.trim().length < 2 || f.phone.trim().length < 4) return setError("Please add your name and phone.");
    setBusy(true);
    try {
      const res = await api.createEditing({ serviceSlug: f.serviceSlug, complexity: f.complexity, speed: f.speed, instructions: f.instructions, photoCount: Math.max(1, files.length), uploadUrls: files, customerName: f.customerName, phone: f.phone, whatsapp: f.whatsapp, email: f.email, deliveryPref: f.deliveryPref, notes: f.notes });
      nav(`/confirm/editing/${res.reference}`);
    } catch (e) { setError((e as Error).message); setBusy(false); }
  }

  return (
    <>
      <div className="pagehead"><p className="eyebrow">Studio service</p><h1>Photo editing &amp; restoration</h1><p>Send us any photograph — even ones we didn't take — for retouching, background changes, object removal, or restoring old and damaged family photos.</p></div>

      <section style={{ paddingBottom: 30 }}>
        <div className="wrap">
          <div className="sec-head"><div className="divider" /><p className="eyebrow" style={{ marginTop: 16 }}>See the difference</p><h2>Before &amp; after</h2></div>
          <div className="grid3">
            {BEFORE_AFTER.map((x) => (
              <div key={x.t} className="card">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                  <Tone tone={x.a} label="Before" style={{ aspectRatio: "1" }} />
                  <Tone tone={x.b} label="After" style={{ aspectRatio: "1" }} />
                </div>
                <div style={{ padding: "12px 16px", fontFamily: "var(--serif)", fontSize: 16 }}>{x.t}</div>
              </div>
            ))}
          </div>
          <p className="muted center" style={{ fontSize: 12, marginTop: 14 }}>Examples for illustration · no client photo is shown publicly without permission.</p>
        </div>
      </section>

      <section style={{ paddingTop: 20 }}>
        <div className="wrap" style={{ maxWidth: 720 }}>
          <div className="sec-head" style={{ marginBottom: 24 }}><h2>Send a photo to edit</h2></div>
          {error && <div className="notice err">{error}</div>}
          <div className="form-card">
            <div className="field">
              <label>1 · Upload your photo(s)</label>
              <label className="upload">
                <input type="file" accept="image/*" multiple onChange={onFiles} style={{ display: "none" }} />
                {files.length ? <span style={{ color: "var(--ink)", fontWeight: 600 }}>{files.length} file(s) selected — tap to change</span> : <span>Tap to choose photos (JPG, PNG, HEIC)</span>}
              </label>
              <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>Max ~25 MB per photo. Your photos are private and never shown publicly.</p>
            </div>

            <div className="field">
              <label>2 · Editing service</label>
              <select value={f.serviceSlug} onChange={(e) => set("serviceSlug", e.target.value)}>
                <option value="">Choose a service…</option>
                {svcs.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
              </select>
              {svc && <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>{svc.description} · <b style={{ color: "var(--gold)" }}>{priceText}</b></p>}
            </div>

            <div className="field"><label>Complexity</label><div className="choices" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>{COMPLEXITY.map((c) => <div key={c} className={`choice ${f.complexity === c ? "on" : ""}`} onClick={() => set("complexity", c)} style={{ textTransform: "capitalize" }}>{c.toLowerCase()}</div>)}</div></div>

            <div className="field"><label>3 · What would you like changed?</label><textarea rows={4} value={f.instructions} onChange={(e) => set("instructions", e.target.value)} placeholder="e.g. Remove the person in the background, brighten the image, soften the skin slightly, keep it natural." /></div>

            <div className="field"><label>4 · Delivery speed</label><div className="choices" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>{SPEED.map((s) => <div key={s.v} className={`choice ${f.speed === s.v ? "on" : ""}`} onClick={() => set("speed", s.v)}>{s.l}</div>)}</div></div>

            <h3 style={{ fontSize: 18, margin: "8px 0 12px" }}>5 · Your details</h3>
            <div className="form-grid">
              <div className="field"><label>Full name</label><input value={f.customerName} onChange={(e) => set("customerName", e.target.value)} /></div>
              <div className="field"><label>Phone</label><input value={f.phone} onChange={(e) => set("phone", e.target.value)} inputMode="tel" /></div>
              <div className="field"><label>WhatsApp</label><input value={f.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} inputMode="tel" /></div>
              <div className="field"><label>Email</label><input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></div>
              <div className="field full"><label>Preferred file delivery</label><input value={f.deliveryPref} onChange={(e) => set("deliveryPref", e.target.value)} placeholder="e.g. WhatsApp, email, account download" /></div>
            </div>

            <div className="callout" style={{ margin: "6px 0 16px" }}>Your photos are submitted for review. We'll contact you with the price and estimated completion time before any editing begins.</div>
            <button className="btn btn-gold btn-block" disabled={busy} onClick={submit}>{busy ? "Submitting…" : "Submit for review"}</button>
          </div>

          <div className="incl" style={{ marginTop: 22 }}>
            <div><Check /> Watermarked preview before you pay</div>
            <div><Check /> Revisions included on every service</div>
            <div><Check /> Combine with a frame or print in one order</div>
          </div>
        </div>
      </section>
    </>
  );
}

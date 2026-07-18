import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, type Service } from "../lib/api";

const HEARD = ["Instagram", "A friend", "Google", "Facebook", "Repeat client", "Other"];

export default function Book() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [services, setServices] = useState<Service[]>([]);
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    serviceSlug: params.get("service") || "", preferredDate: "", altDate: "", preferredTime: "",
    setting: "", locationText: "", people: "", withVideo: false, packagePref: params.get("package") || "",
    description: "", customerName: "", phone: "", whatsapp: "", email: "", instagram: "", heardFrom: "",
    childAge: "", dueDate: "", venue: "",
  });
  useEffect(() => { api.services().then(setServices).catch(() => {}); }, []);
  const set = (k: string, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));
  const svc = services.find((s) => s.slug === f.serviceSlug);

  const extraFields = () => {
    if (["newborn", "first-birthdays"].includes(f.serviceSlug))
      return <div className="field full"><label>Child's age</label><input value={f.childAge} onChange={(e) => set("childAge", e.target.value)} placeholder="e.g. 8 days / 1 year" /></div>;
    if (f.serviceSlug === "maternity")
      return <div className="field full"><label>Baby's due date</label><input value={f.dueDate} onChange={(e) => set("dueDate", e.target.value)} placeholder="Expected due date" /></div>;
    if (f.serviceSlug === "weddings")
      return <div className="field full"><label>Wedding venue</label><input value={f.venue} onChange={(e) => set("venue", e.target.value)} placeholder="Venue / location" /></div>;
    return null;
  };

  function next() {
    setError("");
    if (step === 1 && !f.serviceSlug) return setError("Please choose a service.");
    if (step === 3) {
      if (f.customerName.trim().length < 2) return setError("Please enter your name.");
      if (f.phone.trim().length < 4) return setError("Please enter a phone number.");
    }
    setStep((s) => Math.min(4, s + 1));
  }

  async function submit() {
    setError(""); setBusy(true);
    try {
      const extra: Record<string, string> = {};
      if (f.childAge) extra.childAge = f.childAge;
      if (f.dueDate) extra.dueDate = f.dueDate;
      if (f.venue) extra.venue = f.venue;
      const res = await api.createBooking({
        serviceSlug: f.serviceSlug, preferredDate: f.preferredDate, altDate: f.altDate, preferredTime: f.preferredTime,
        setting: f.setting, locationText: f.locationText, people: f.people, withVideo: f.withVideo, packagePref: f.packagePref,
        description: f.description, extra, customerName: f.customerName, phone: f.phone, whatsapp: f.whatsapp, email: f.email,
        instagram: f.instagram, heardFrom: f.heardFrom,
      });
      nav(`/confirm/booking/${res.reference}`);
    } catch (e) { setError((e as Error).message); setBusy(false); }
  }

  return (
    <>
      <div className="pagehead"><p className="eyebrow">Reserve your date</p><h1>Book a Session</h1><p>Requests aren't charged or auto-confirmed — Tania reviews each one and replies with availability, packages and a deposit.</p></div>
      <section>
        <div className="wrap" style={{ maxWidth: 720 }}>
          <div className="steps-bar">{[1, 2, 3, 4].map((n) => <div key={n} className={n <= step ? "on" : ""} />)}</div>
          {error && <div className="notice err">{error}</div>}
          <div className="form-card">

            {step === 1 && (<>
              <h2 style={{ fontSize: 22, marginBottom: 6 }}>Choose a service</h2>
              <p className="muted" style={{ marginBottom: 16 }}>What would you like photographed?</p>
              <div className="choices">
                {services.map((s) => <div key={s.slug} className={`choice ${f.serviceSlug === s.slug ? "on" : ""}`} onClick={() => set("serviceSlug", s.slug)}>{s.name}</div>)}
                <div className={`choice ${f.serviceSlug === "other" ? "on" : ""}`} onClick={() => set("serviceSlug", "other")}>Other</div>
              </div>
            </>)}

            {step === 2 && (<>
              <h2 style={{ fontSize: 22, marginBottom: 16 }}>Session details{svc ? ` · ${svc.name}` : ""}</h2>
              <div className="form-grid">
                <div className="field"><label>Preferred date</label><input type="date" value={f.preferredDate} onChange={(e) => set("preferredDate", e.target.value)} /></div>
                <div className="field"><label>Alternative date</label><input type="date" value={f.altDate} onChange={(e) => set("altDate", e.target.value)} /></div>
                <div className="field"><label>Preferred time</label><input value={f.preferredTime} onChange={(e) => set("preferredTime", e.target.value)} placeholder="e.g. Morning / 4 PM" /></div>
                <div className="field"><label>Studio or outdoor</label><select value={f.setting} onChange={(e) => set("setting", e.target.value)}><option value="">Either</option><option>Studio</option><option>Outdoor</option></select></div>
                <div className="field"><label>Location (if outdoor/event)</label><input value={f.locationText} onChange={(e) => set("locationText", e.target.value)} placeholder="Where?" /></div>
                <div className="field"><label>Number of people</label><input value={f.people} onChange={(e) => set("people", e.target.value)} placeholder="e.g. 4" /></div>
                <div className="field full"><label style={{ display: "flex", gap: 9, alignItems: "center", cursor: "pointer" }}><input type="checkbox" style={{ width: "auto" }} checked={f.withVideo} onChange={(e) => set("withVideo", e.target.checked)} /> Add videography</label></div>
                {extraFields()}
                <div className="field full"><label>Tell us about your session</label><textarea rows={3} value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="Anything you'd like Tania to know…" /></div>
              </div>
            </>)}

            {step === 3 && (<>
              <h2 style={{ fontSize: 22, marginBottom: 16 }}>Your details</h2>
              <div className="form-grid">
                <div className="field"><label>Full name</label><input value={f.customerName} onChange={(e) => set("customerName", e.target.value)} /></div>
                <div className="field"><label>Phone</label><input value={f.phone} onChange={(e) => set("phone", e.target.value)} inputMode="tel" placeholder="70 000 000" /></div>
                <div className="field"><label>WhatsApp</label><input value={f.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} inputMode="tel" /></div>
                <div className="field"><label>Email</label><input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></div>
                <div className="field"><label>Instagram (optional)</label><input value={f.instagram} onChange={(e) => set("instagram", e.target.value)} placeholder="@username" /></div>
                <div className="field"><label>How did you hear about us?</label><select value={f.heardFrom} onChange={(e) => set("heardFrom", e.target.value)}><option value="">—</option>{HEARD.map((h) => <option key={h}>{h}</option>)}</select></div>
              </div>
            </>)}

            {step === 4 && (<>
              <h2 style={{ fontSize: 22, marginBottom: 16 }}>Review &amp; submit</h2>
              <div className="callout" style={{ marginBottom: 16 }}>
                <b>{svc?.name || f.serviceSlug || "Session"}</b>{f.packagePref ? ` · ${f.packagePref}` : ""}<br />
                {f.preferredDate || "Flexible date"}{f.preferredTime ? ` · ${f.preferredTime}` : ""}{f.setting ? ` · ${f.setting}` : ""}<br />
                {f.customerName} · {f.phone}{f.email ? ` · ${f.email}` : ""}
              </div>
              <p className="muted" style={{ fontSize: 14 }}>By submitting, you're sending a booking request. Tania Madi Photography will contact you to confirm availability, package details and the required deposit.</p>
            </>)}

            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              {step > 1 && <button className="btn btn-outline" onClick={() => setStep((s) => s - 1)}>Back</button>}
              {step < 4 ? <button className="btn btn-dark" style={{ marginLeft: "auto" }} onClick={next}>Continue</button>
                : <button className="btn btn-gold" style={{ marginLeft: "auto" }} disabled={busy} onClick={submit}>{busy ? "Sending…" : "Submit request"}</button>}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api, type Service } from "../lib/api";
import { Tone, Check } from "../components/Art";

export default function ServiceDetail() {
  const { slug } = useParams();
  const nav = useNavigate();
  const [s, setS] = useState<Service | null>(null);
  const [notFound, setNotFound] = useState(false);
  useEffect(() => { setS(null); window.scrollTo(0, 0); api.service(slug!).then(setS).catch(() => setNotFound(true)); }, [slug]);

  if (notFound) return <div className="wrap empty"><h3>Service not found</h3><Link className="btn btn-primary btn-dark" style={{ marginTop: 14 }} to="/services">All services</Link></div>;
  if (!s) return <div className="spinner" />;

  return (
    <>
      <div className="sd-hero">
        <Tone tone={s.heroTone} seed={s.slug} w={1400} h={700} />
        <div className="veil" />
        <div className="inner">
          <p className="eyebrow" style={{ color: "var(--gold-soft)" }}>Photography</p>
          <h1>{s.name}</h1>
          <p style={{ color: "rgba(255,251,248,.9)", marginTop: 8, maxWidth: "48ch" }}>{s.tagline}</p>
        </div>
      </div>
      <section>
        <div className="wrap sd-grid">
          <div>
            <p style={{ color: "var(--ink-2)", fontSize: 17 }}>{s.description}</p>

            {s.includes.length > 0 && (
              <>
                <h2 style={{ fontSize: 24, margin: "30px 0 16px" }}>What's included</h2>
                <div className="incl">{s.includes.map((it) => <div key={it}><Check /> {it}</div>)}</div>
              </>
            )}

            <div style={{ display: "flex", gap: 24, flexWrap: "wrap", margin: "28px 0" }}>
              <div><div className="l muted" style={{ fontSize: 12, letterSpacing: ".1em", textTransform: "uppercase" }}>Duration</div><div style={{ fontWeight: 700 }}>{s.durationText || "Varies"}</div></div>
              <div><div className="l muted" style={{ fontSize: 12, letterSpacing: ".1em", textTransform: "uppercase" }}>Setting</div><div style={{ fontWeight: 700 }}>{s.locationText || "Studio or outdoor"}</div></div>
              <div><div className="l muted" style={{ fontSize: 12, letterSpacing: ".1em", textTransform: "uppercase" }}>Pricing</div><div style={{ fontWeight: 700 }}>{s.startingPrice ? `From $${s.startingPrice}` : "Request pricing"}</div></div>
            </div>

            {s.faqs.length > 0 && (
              <>
                <h2 style={{ fontSize: 24, margin: "10px 0 6px" }}>Frequently asked</h2>
                {s.faqs.map((f, i) => <div key={i} className="faq"><b>{f.q}</b><p>{f.a}</p></div>)}
              </>
            )}
          </div>

          <div>
            {s.packages.length > 0 ? s.packages.map((p) => (
              <div key={p.id} className="pkg">
                <h3>{p.name}</h3>
                <div className="price">{p.requestPricing || p.price == null ? <span style={{ fontSize: 20 }}>Request pricing</span> : `$${p.price}`}</div>
                {p.durationText && <p className="muted" style={{ fontSize: 14 }}>{p.durationText}{p.editedPhotos ? ` · ${p.editedPhotos}` : ""}</p>}
                <ul>{p.features.map((f) => <li key={f}><Check /> {f}</li>)}</ul>
                {p.deposit > 0 && <p className="muted" style={{ fontSize: 13, marginTop: 12 }}>Deposit ${p.deposit} · Delivery {p.deliveryDays}</p>}
                <button className="btn btn-dark btn-block" style={{ marginTop: 16 }} onClick={() => nav(`/book?service=${s.slug}&package=${encodeURIComponent(p.name)}`)}>Book this package</button>
              </div>
            )) : (
              <div className="pkg"><h3>Custom pricing</h3><p className="muted" style={{ fontSize: 14, margin: "10px 0 16px" }}>Every {s.name.toLowerCase()} session is tailored. Send a request and Tania will reply with packages and pricing.</p></div>
            )}
            <button className="btn btn-gold btn-block" onClick={() => nav(`/book?service=${s.slug}`)}>Book this session</button>
          </div>
        </div>
      </section>
    </>
  );
}

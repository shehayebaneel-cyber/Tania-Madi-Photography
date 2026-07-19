import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, type Service, type PortfolioItem, type Testimonial } from "../lib/api";
import { useSite } from "../lib/site";
import { Tone } from "../components/Art";

export default function Home() {
  const nav = useNavigate();
  const { home, waLink, telLink, contact } = useSite();
  const [services, setServices] = useState<Service[]>([]);
  const [featured, setFeatured] = useState<PortfolioItem[]>([]);
  const [tms, setTms] = useState<Testimonial[]>([]);

  useEffect(() => {
    api.services().then(setServices).catch(() => {});
    api.portfolio({ featured: true }).then(setFeatured).catch(() => {});
    api.testimonials().then(setTms).catch(() => {});
  }, []);

  const span = (i: number) => (i === 0 ? "tall" : i === 2 ? "wide" : i === 4 ? "tall" : i === 8 ? "wide" : "");

  return (
    <>
      <section className="hero">
        <Tone tone="g-wed" img="https://images.unsplash.com/photo-1519741497674-611481863552?w=1600&q=80&auto=format&fit=crop" pos="center 35%" />
        <div className="hero-veil" />
        <div className="hero-inner">
          <p className="eyebrow reveal">Aley, Lebanon</p>
          <h1 className="reveal">{home.heroTitle || "Turning life's most beautiful moments into memories"}</h1>
          <p className="sub reveal">{home.heroSubtitle || "Weddings, couples, maternity, newborn, family, birthdays, commercial photography & videography."}</p>
          <div className="hero-cta reveal">
            <Link className="btn btn-light" to="/portfolio">View Portfolio</Link>
            <Link className="btn btn-gold" to="/book">Book a Session</Link>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="sec-head"><div className="divider" /><p className="eyebrow" style={{ marginTop: 16 }}>What we capture</p><h2>Photography &amp; videography</h2><p>Every session is shaped around your story.</p></div>
          <div className="services">
            {services.map((s, i) => (
              <div key={s.slug} className="svc" onClick={() => nav(`/services/${s.slug}`)}>
                <Tone tone={s.heroTone} seed={s.slug} />
                <div className="cap"><span>{String(i + 1).padStart(2, "0")}</span><h3>{s.name}</h3></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="about" id="about">
        <div className="wrap about-grid">
          <Tone tone="g-mat" className="portrait" label="Portrait of Tania" />
          <div>
            <div className="divider" style={{ margin: 0 }} /><p className="eyebrow" style={{ marginTop: 16 }}>Behind the lens</p>
            <h2>{home.aboutTitle || "Hello, I'm Tania"}</h2>
            <div className="body"><p>{home.aboutBody || "For years I've had the privilege of standing beside families across Lebanon on their most meaningful days."}</p></div>
            <p className="sign">— Tania Madi</p>
            <div className="stats"><div><b>7+</b><span>Years</span></div><div><b>1,500+</b><span>Sessions</span></div><div><b>6.1k</b><span>Followers</span></div></div>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="sec-head"><div className="divider" /><p className="eyebrow" style={{ marginTop: 16 }}>Selected work</p><h2>A few favourites</h2></div>
          <div className="pgrid">
            {featured.slice(0, 10).map((p, i) => (
              <Tone key={p.id} tone={p.tone} className={`cell ${span(i)}`} label={p.category.replace(/-/g, " ")} seed={p.id} />
            ))}
          </div>
          <div className="center mt40"><Link className="btn btn-outline" to="/portfolio">Explore full portfolio →</Link></div>
        </div>
      </section>

      <section className="steps-wrap">
        <div className="wrap">
          <div className="sec-head"><div className="divider" /><p className="eyebrow" style={{ marginTop: 16 }}>Simple &amp; personal</p><h2>How booking works</h2></div>
          <div className="steps">
            <div className="step"><div className="no">1</div><h3>Choose a service</h3><p>Pick the session — wedding, newborn, family and more.</p></div>
            <div className="step"><div className="no">2</div><h3>Share your details</h3><p>Tell us your date, location and what you have in mind.</p></div>
            <div className="step"><div className="no">3</div><h3>Get confirmation</h3><p>Tania contacts you with availability, packages and a deposit.</p></div>
          </div>
          <div className="center" style={{ marginTop: 20 }}><Link className="btn btn-gold" to="/book">Request your session →</Link></div>
        </div>
      </section>

      <section>
        <div className="wrap promos">
          <div className="promo"><Tone tone="g-family" kw="frame" seed={4021} w={800} h={600} /><div className="inner"><p className="eyebrow" style={{ color: "var(--gold-soft)" }}>Keepsakes</p><h3>Frames &amp; personalised prints</h3><p>Upload your photo, choose a frame and size — we print, frame and deliver.</p><Link className="btn btn-light" to="/frames">Shop frames &amp; prints</Link></div></div>
          <div className="promo"><Tone tone="g-couple" /><div className="inner"><p className="eyebrow" style={{ color: "var(--gold-soft)" }}>Studio service</p><h3>Photo editing &amp; restoration</h3><p>Retouching, background changes, and reviving old family photographs.</p><Link className="btn btn-light" to="/editing">Send a photo to edit</Link></div></div>
        </div>
      </section>

      {tms.length > 0 && (
        <section>
          <div className="wrap">
            <div className="sec-head"><div className="divider" /><p className="eyebrow" style={{ marginTop: 16 }}>Kind words</p><h2>Loved by families across Aley</h2></div>
            <div className="tgrid">
              {tms.map((t) => (
                <div key={t.id} className="tcard"><div className="stars">{"★".repeat(t.rating)}</div><p>"{t.text}"</p><div className="who"><Tone tone={t.tone} className="av" seed={t.name} w={80} h={80} /><div><b>{t.name}</b><span>{t.sessionType}</span></div></div></div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="about">
        <div className="wrap contact-grid">
          <div className="info-card">
            <div className="divider" style={{ margin: 0 }} /><p className="eyebrow" style={{ marginTop: 16 }}>Come say hello</p>
            <h2 style={{ fontSize: 28, marginTop: 8 }}>Visit the studio</h2>
            <div className="clist">
              <div className="ci"><span className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.4" /></svg></span><div><div className="l">Studio</div><div className="v">{contact.address}</div></div></div>
              <a href={contact.instagramUrl}><span className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" /></svg></span><div><div className="l">Instagram</div><div className="v">@{contact.instagram}</div></div></a>
              <div className="ci"><span className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg></span><div><div className="l">Hours</div><div className="v">{contact.hours}</div></div></div>
            </div>
            <div style={{ display: "flex", gap: 11, flexWrap: "wrap" }}><Link className="btn btn-dark" to="/book">Book a Session</Link><a className="btn btn-wa" href={waLink}>WhatsApp</a>{contact.phone && <a className="btn btn-outline" href={telLink}>Call</a>}</div>
          </div>
          <div className="cmap"><Tone tone="g-family" /><svg className="pin" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a7 7 0 0 0-7 7c0 4.8 7 13 7 13s7-8.2 7-13a7 7 0 0 0-7-7z" /><circle cx="12" cy="9" r="2.6" fill="var(--ink)" /></svg></div>
        </div>
      </section>
    </>
  );
}

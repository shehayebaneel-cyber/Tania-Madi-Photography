import { Link } from "react-router-dom";
import { useSite } from "../lib/site";
import { Tone } from "../components/Art";

export default function About() {
  const { home } = useSite();
  return (
    <>
      <div className="pagehead"><p className="eyebrow">Behind the lens</p><h1>About Tania</h1></div>
      <section>
        <div className="wrap about-grid" style={{ alignItems: "start" }}>
          <Tone tone="g-mat" className="portrait" label="Portrait of Tania" />
          <div>
            <h2 style={{ fontSize: 30 }}>{home.aboutTitle || "Hello, I'm Tania"}</h2>
            <div className="body" style={{ marginTop: 16 }}>
              <p>{home.aboutBody || "For years I've had the privilege of standing beside families in Aley and across Lebanon on their most meaningful days — the nervous minutes before a wedding, the first time a mother holds her newborn, a toddler's joyful first birthday."}</p>
              <p>My style is warm, natural and unhurried. I photograph the real moments between the posed ones, so that years from now you feel exactly what that day felt like. With newborns and children especially, comfort and safety come before every single shot.</p>
              <p>Beyond sessions, my studio also creates frames, albums and prints, and offers professional editing and restoration — so your memories can live on your walls and be brought back to life when they fade.</p>
            </div>
            <p className="sign">— Tania Madi</p>
            <div style={{ display: "flex", gap: 11, flexWrap: "wrap", marginTop: 18 }}>
              <Link className="btn btn-dark" to="/book">Book a Session</Link>
              <Link className="btn btn-outline" to="/portfolio">See the portfolio</Link>
            </div>
          </div>
        </div>
      </section>
      <section className="about">
        <div className="wrap">
          <div className="grid3">
            <div className="info-card"><h3 style={{ fontSize: 20 }}>Warm &amp; natural</h3><p className="muted" style={{ marginTop: 8 }}>Relaxed sessions that feel like you, not stiff poses.</p></div>
            <div className="info-card"><h3 style={{ fontSize: 20 }}>Gentle with little ones</h3><p className="muted" style={{ marginTop: 8 }}>Patient, safety-first newborn and child photography.</p></div>
            <div className="info-card"><h3 style={{ fontSize: 20 }}>A full studio</h3><p className="muted" style={{ marginTop: 8 }}>Photography, videography, frames, prints and editing under one roof.</p></div>
          </div>
        </div>
      </section>
    </>
  );
}

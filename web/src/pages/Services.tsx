import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type Service } from "../lib/api";
import { Tone } from "../components/Art";

export default function Services() {
  const nav = useNavigate();
  const [services, setServices] = useState<Service[]>([]);
  useEffect(() => { api.services().then(setServices).catch(() => {}); }, []);
  return (
    <>
      <div className="pagehead">
        <p className="eyebrow">What we capture</p>
        <h1>Photography &amp; videography services</h1>
        <p>From the biggest day of your life to the first days of a new one — choose a service to see what's included, packages and FAQs.</p>
      </div>
      <section>
        <div className="wrap">
          <div className="services">
            {services.map((s, i) => (
              <div key={s.slug} className="svc" onClick={() => nav(`/services/${s.slug}`)} style={{ aspectRatio: "4/5" }}>
                <Tone tone={s.heroTone} />
                <div className="cap"><span>{String(i + 1).padStart(2, "0")}</span><h3>{s.name}</h3><p style={{ fontSize: 13, color: "rgba(255,251,248,.85)", marginTop: 4 }}>{s.tagline}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

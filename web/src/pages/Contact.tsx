import { Link } from "react-router-dom";
import { useSite } from "../lib/site";
import { Tone } from "../components/Art";

export default function Contact() {
  const { contact, waLink, telLink } = useSite();
  return (
    <>
      <div className="pagehead"><p className="eyebrow">Get in touch</p><h1>Contact the studio</h1><p>Have a question or want to check a date? Reach out any way you like.</p></div>
      <section>
        <div className="wrap contact-grid">
          <div className="info-card">
            <h2 style={{ fontSize: 26 }}>Reach us</h2>
            <div className="clist">
              <div className="ci"><span className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.4" /></svg></span><div><div className="l">Studio</div><div className="v">{contact.address}</div></div></div>
              {contact.phone && <a href={telLink}><span className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 4h4l2 5-3 2a12 12 0 0 0 6 6l2-3 5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 2 6a2 2 0 0 1 2-2z" /></svg></span><div><div className="l">Phone</div><div className="v">{contact.phone}</div></div></a>}
              <a href={`mailto:${contact.email}`}><span className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg></span><div><div className="l">Email</div><div className="v">{contact.email}</div></div></a>
              <a href={contact.instagramUrl}><span className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" /></svg></span><div><div className="l">Instagram</div><div className="v">@{contact.instagram}</div></div></a>
              <div className="ci"><span className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg></span><div><div className="l">Hours</div><div className="v">{contact.hours}</div></div></div>
            </div>
            <div style={{ display: "flex", gap: 11, flexWrap: "wrap" }}>
              <a className="btn btn-wa" href={waLink}>WhatsApp</a>
              <Link className="btn btn-dark" to="/book">Book a Session</Link>
            </div>
          </div>
          <div>
            <div className="cmap" style={{ marginBottom: 20 }}><Tone tone="g-family" /><svg className="pin" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a7 7 0 0 0-7 7c0 4.8 7 13 7 13s7-8.2 7-13a7 7 0 0 0-7-7z" /><circle cx="12" cy="9" r="2.6" fill="var(--ink)" /></svg></div>
            <div className="info-card">
              <h3 style={{ fontSize: 19 }}>Frequently asked</h3>
              <div className="faq"><b>How do I book?</b><p>Use the Book a Session page — it only takes a minute, and Tania replies with availability and pricing.</p></div>
              <div className="faq"><b>Do you travel for shoots?</b><p>Yes — across Aley and Mount Lebanon, and beyond for weddings.</p></div>
              <div className="faq"><b>Can you edit photos I didn't take?</b><p>Absolutely — send them through the Photo Editing page for retouching or restoration.</p></div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

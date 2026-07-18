import { useParams, useNavigate } from "react-router-dom";
import { useSite } from "../lib/site";

const COPY: Record<string, { title: string; body: string }> = {
  booking: { title: "Booking request received!", body: "Tania Madi Photography will contact you to confirm availability, package details and the required deposit." },
  editing: { title: "Photos submitted for review!", body: "We'll contact you with the price and estimated completion time before beginning any editing." },
  order: { title: "Order received!", body: "Thank you! We'll confirm your order and total, review any uploaded photos, and let you know when it's ready." },
};

export default function Confirm() {
  const { kind, ref } = useParams();
  const nav = useNavigate();
  const { waLink } = useSite();
  const c = COPY[kind || "order"] || COPY.order;
  return (
    <section>
      <div className="wrap" style={{ maxWidth: 600 }}>
        <div className="empty" style={{ padding: "70px 20px" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--good)" strokeWidth="1.5" style={{ width: 64, height: 64, margin: "0 auto 16px" }}><circle cx="12" cy="12" r="10" /><path d="M8 12l3 3 5-6" /></svg>
          <h1 style={{ fontSize: 30 }}>{c.title}</h1>
          <p style={{ margin: "10px 0 6px", fontSize: 16 }}>Reference <b>{ref}</b></p>
          <p className="muted" style={{ maxWidth: "34ch", margin: "0 auto 22px" }}>{c.body}</p>
          <div style={{ display: "flex", gap: 11, justifyContent: "center", flexWrap: "wrap" }}>
            <a className="btn btn-wa" href={waLink}>Message on WhatsApp</a>
            <button className="btn btn-outline" onClick={() => nav("/account")}>View in my account</button>
            <button className="btn btn-dark" onClick={() => nav("/")}>Back home</button>
          </div>
        </div>
      </div>
    </section>
  );
}

import { Link } from "react-router-dom";
import { useSite } from "../lib/site";

export default function Policies() {
  const { policies } = useSite();
  return (
    <>
      <div className="pagehead"><p className="eyebrow">Good to know</p><h1>Policies</h1></div>
      <section>
        <div className="wrap" style={{ maxWidth: 720 }}>
          {policies ? (
            <div className="body" style={{ whiteSpace: "pre-line" }}>{policies}</div>
          ) : (
            <div className="body">
              <p className="muted">Our booking, deposit and delivery policies will appear here shortly. In the meantime, please reach out with any questions.</p>
              <div style={{ display: "flex", gap: 11, flexWrap: "wrap", marginTop: 18 }}>
                <Link className="btn btn-dark" to="/contact">Contact us</Link>
                <Link className="btn btn-outline" to="/book">Book a Session</Link>
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

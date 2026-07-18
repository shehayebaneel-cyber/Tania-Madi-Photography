import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "../lib/cart";
import { api } from "../lib/api";

const PAY = [
  { v: "CASH", l: "Cash at the studio" },
  { v: "PICKUP", l: "Cash on pickup" },
  { v: "COD", l: "Cash on delivery" },
  { v: "WHISH", l: "Whish transfer" },
];

export default function Checkout() {
  const nav = useNavigate();
  const { items, subtotal, clear } = useCart();
  const [fulfilment, setFulfilment] = useState<"PICKUP" | "DELIVERY">("PICKUP");
  const [payment, setPayment] = useState("CASH");
  const [f, setF] = useState({ customerName: "", phone: "", email: "", town: "", address: "", note: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => { if (items.length === 0) nav("/cart"); }, [items.length, nav]);
  const deliveryFee = fulfilment === "DELIVERY" ? 3 : 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError("");
    if (f.customerName.trim().length < 2) return setError("Please enter your name.");
    if (f.phone.trim().length < 4) return setError("Please enter a phone number.");
    if (fulfilment === "DELIVERY" && f.address.trim().length < 3) return setError("Please enter a delivery address.");
    setBusy(true);
    try {
      const res = await api.createOrder({
        ...f, fulfilment, paymentMethod: payment,
        items: items.map((i) => ({ productId: i.productId, qty: i.qty, options: i.options, uploadUrl: i.options.photo || "", needsEditing: !!i.needsEditing, instructions: i.instructions || "" })),
      });
      clear();
      nav(`/confirm/order/${res.reference}`);
    } catch (err) { setError((err as Error).message); setBusy(false); }
  }

  return (
    <>
      <div className="pagehead"><p className="eyebrow">Almost there</p><h1>Checkout</h1></div>
      <section>
        <div className="wrap cart-layout">
          <form className="form-card" onSubmit={submit}>
            {error && <div className="notice err">{error}</div>}
            <h3 style={{ fontFamily: "var(--serif)", fontSize: 20, marginBottom: 12 }}>Your details</h3>
            <div className="form-grid">
              <div className="field"><label>Full name</label><input value={f.customerName} onChange={(e) => set("customerName", e.target.value)} /></div>
              <div className="field"><label>Phone / WhatsApp</label><input value={f.phone} onChange={(e) => set("phone", e.target.value)} inputMode="tel" /></div>
              <div className="field full"><label>Email</label><input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></div>
            </div>

            <h3 style={{ fontFamily: "var(--serif)", fontSize: 20, margin: "8px 0 12px" }}>Collection</h3>
            <div className="choices" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: 14 }}>
              <div className={`choice ${fulfilment === "PICKUP" ? "on" : ""}`} onClick={() => setFulfilment("PICKUP")}>Pick up at studio</div>
              <div className={`choice ${fulfilment === "DELIVERY" ? "on" : ""}`} onClick={() => setFulfilment("DELIVERY")}>Delivery (+$3)</div>
            </div>
            {fulfilment === "DELIVERY" && (
              <div className="form-grid">
                <div className="field"><label>Town</label><input value={f.town} onChange={(e) => set("town", e.target.value)} placeholder="e.g. Aley" /></div>
                <div className="field"><label>Address</label><input value={f.address} onChange={(e) => set("address", e.target.value)} placeholder="Street, building…" /></div>
              </div>
            )}

            <h3 style={{ fontFamily: "var(--serif)", fontSize: 20, margin: "8px 0 12px" }}>Payment</h3>
            <div className="choices" style={{ gridTemplateColumns: "repeat(2,1fr)", marginBottom: 12 }}>
              {PAY.map((p) => <div key={p.v} className={`choice ${payment === p.v ? "on" : ""}`} onClick={() => setPayment(p.v)}>{p.l}</div>)}
            </div>
            <div className="field full"><label>Order note (optional)</label><textarea rows={2} value={f.note} onChange={(e) => set("note", e.target.value)} /></div>
            <div className="callout" style={{ marginBottom: 14 }}>Online card payment is coming soon. For now choose cash or Whish — Tania confirms your order and total by phone or WhatsApp.</div>
            <button className="btn btn-gold btn-block" type="submit" disabled={busy}>{busy ? "Placing order…" : "Place order"}</button>
          </form>

          <div className="summary">
            <h3>Order summary</h3>
            {items.map((it, i) => <div className="srow" key={i}><span>{it.name} × {it.qty}</span><span>${it.unitPrice * it.qty}</span></div>)}
            <div className="srow"><span>Delivery</span><span>{deliveryFee ? `$${deliveryFee}` : "Free / pickup"}</span></div>
            <div className="srow total"><span>Total</span><span>${subtotal + deliveryFee}</span></div>
          </div>
        </div>
      </section>
    </>
  );
}

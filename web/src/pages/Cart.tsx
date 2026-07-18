import { useNavigate } from "react-router-dom";
import { useCart } from "../lib/cart";
import { Tone } from "../components/Art";

export default function Cart() {
  const nav = useNavigate();
  const { items, setQty, remove, subtotal } = useCart();

  return (
    <>
      <div className="pagehead"><p className="eyebrow">Your order</p><h1>Cart</h1></div>
      <section>
        <div className="wrap">
          {items.length === 0 ? (
            <div className="empty">
              <h3 style={{ fontSize: 22 }}>Your cart is empty</h3>
              <p style={{ margin: "8px 0 18px" }}>Browse frames, prints and albums to get started.</p>
              <button className="btn btn-dark" onClick={() => nav("/frames")}>Shop frames &amp; prints</button>
            </div>
          ) : (
            <div className="cart-layout">
              <div>
                {items.map((it, i) => (
                  <div className="cart-line" key={i}>
                    <Tone tone={it.tone} className="ph" />
                    <div>
                      <h3 style={{ fontFamily: "var(--serif)", fontSize: 16 }}>{it.name}</h3>
                      <div className="muted" style={{ fontSize: 13 }}>
                        {Object.entries(it.options).filter(([k]) => k !== "photo").map(([k, v]) => `${k}: ${v}`).join(" · ")}
                        {it.options.photo ? ` · photo: ${it.options.photo}` : ""}
                        {it.needsEditing ? " · editing requested" : ""}
                      </div>
                      <div className="qty" style={{ marginTop: 8 }}>
                        <button onClick={() => setQty(i, it.qty - 1)}>−</button><span>{it.qty}</span><button onClick={() => setQty(i, it.qty + 1)}>+</button>
                      </div>
                    </div>
                    <div style={{ textAlign: "end" }}>
                      <div style={{ fontWeight: 700 }}>${it.unitPrice * it.qty}</div>
                      <button className="icon-act" style={{ marginTop: 8, border: 0 }} onClick={() => remove(i)}>Remove</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="summary">
                <h3>Order summary</h3>
                <div className="srow"><span>Subtotal</span><span>${subtotal}</span></div>
                <div className="srow"><span>Delivery</span><span className="muted">Calculated at checkout</span></div>
                <div className="srow total"><span>Total</span><span>${subtotal}</span></div>
                <button className="btn btn-dark btn-block" style={{ marginTop: 14 }} onClick={() => nav("/checkout")}>Checkout</button>
                <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>Uploaded photos are reviewed by Tania before printing.</p>
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, type Product as P } from "../lib/api";
import { useCart } from "../lib/cart";
import { Tone, Check, productKeyword } from "../components/Art";

export default function Product() {
  const { id } = useParams();
  const nav = useNavigate();
  const { add } = useCart();
  const [p, setP] = useState<P | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [size, setSize] = useState("");
  const [color, setColor] = useState("");
  const [orientation, setOrientation] = useState("portrait");
  const [finish, setFinish] = useState("Matte");
  const [needsEditing, setNeedsEditing] = useState(false);
  const [instructions, setInstructions] = useState("");
  const [photo, setPhoto] = useState<{ name: string; url: string } | null>(null);
  const [added, setAdded] = useState(false);

  useEffect(() => { setP(null); window.scrollTo(0, 0); api.product(id!).then((d) => { setP(d); setSize(d.sizes[0]?.label || ""); setColor(d.colors[0] || ""); }).catch(() => setNotFound(true)); }, [id]);

  if (notFound) return <div className="wrap empty"><h3>Product not found</h3><button className="btn btn-dark" style={{ marginTop: 14 }} onClick={() => nav("/frames")}>Back to shop</button></div>;
  if (!p) return <div className="spinner" />;

  const sizeDelta = p.sizes.find((s) => s.label === size)?.priceDelta || 0;
  const unitPrice = p.price + sizeDelta;

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhoto({ name: file.name, url: URL.createObjectURL(file) });
  }

  function addToCart() {
    const options: Record<string, string> = {};
    if (size) options.size = size;
    if (color) options.color = color;
    if (p!.orientation === "any") options.orientation = orientation;
    options.finish = finish;
    if (photo) options.photo = photo.name;
    add({ productId: p!.id, name: p!.name, tone: p!.tone, unitPrice, qty: 1, options, needsEditing, instructions });
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
  }

  return (
    <section>
      <div className="wrap sd-grid">
        <div>
          <div className="cmap" style={{ minHeight: 0, aspectRatio: "1", borderRadius: 6, position: "relative", overflow: "hidden" }}>
            {photo ? <img src={photo.url} alt="Your upload preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Tone tone={p.tone} kw={productKeyword(p.categorySlug)} label={p.category?.name} seed={p.id} w={800} h={800} />}
          </div>
          {photo && <p className="muted center" style={{ fontSize: 12, marginTop: 8 }}>Preview of your photo · Tania reviews every image before printing.</p>}
        </div>

        <div>
          <span className="prod" style={{ display: "none" }} />
          <p className="eyebrow">{p.category?.name}</p>
          <h1 style={{ fontSize: 32, margin: "6px 0 8px", fontFamily: "var(--serif)" }}>{p.name}</h1>
          <div style={{ fontFamily: "var(--serif)", fontSize: 28, margin: "6px 0 14px" }}>${unitPrice}</div>
          {p.description && <p className="muted" style={{ marginBottom: 16 }}>{p.description}</p>}

          {p.sizes.length > 0 && <div className="field"><label>Size</label><div className="choices" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(110px,1fr))" }}>{p.sizes.map((s) => <div key={s.label} className={`choice ${size === s.label ? "on" : ""}`} onClick={() => setSize(s.label)}>{s.label}{s.priceDelta ? ` +$${s.priceDelta}` : ""}</div>)}</div></div>}
          {p.colors.length > 0 && <div className="field"><label>Colour / finish</label><div className="choices" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(110px,1fr))" }}>{p.colors.map((c) => <div key={c} className={`choice ${color === c ? "on" : ""}`} onClick={() => setColor(c)}>{c}</div>)}</div></div>}
          {p.orientation === "any" && <div className="field"><label>Orientation</label><div className="choices" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>{["portrait", "landscape", "square"].map((o) => <div key={o} className={`choice ${orientation === o ? "on" : ""}`} onClick={() => setOrientation(o)} style={{ textTransform: "capitalize" }}>{o}</div>)}</div></div>}

          <div className="field"><label>Print finish</label><div className="choices" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>{["Matte", "Glossy", "Fine-art"].map((o) => <div key={o} className={`choice ${finish === o ? "on" : ""}`} onClick={() => setFinish(o)}>{o}</div>)}</div></div>

          <div className="field">
            <label>Upload your photo</label>
            <label className="upload">
              <input type="file" accept="image/*" onChange={onFile} style={{ display: "none" }} />
              {photo ? <span style={{ color: "var(--ink)", fontWeight: 600 }}>{photo.name} — tap to change</span> : <span>Tap to choose a photo from your gallery or camera</span>}
            </label>
            <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>For best results use the highest-resolution photo you have. Tania will confirm quality before printing and may request the original file.</p>
          </div>

          <label style={{ display: "flex", gap: 9, alignItems: "center", cursor: "pointer", margin: "6px 0 12px" }}><input type="checkbox" style={{ width: "auto" }} checked={needsEditing} onChange={(e) => setNeedsEditing(e.target.checked)} /> I'd like this photo edited/retouched before printing</label>
          {needsEditing && <div className="field"><textarea rows={2} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="What should we edit? (e.g. brighten, remove background)" /></div>}

          {added && <div className="notice ok">Added to your cart.</div>}
          <div style={{ display: "flex", gap: 11, flexWrap: "wrap" }}>
            <button className="btn btn-dark" onClick={addToCart}>Add to cart · ${unitPrice}</button>
            <button className="btn btn-outline" onClick={() => nav("/cart")}>View cart</button>
          </div>

          <div className="incl" style={{ marginTop: 22, borderTop: "1px solid var(--line)", paddingTop: 18 }}>
            <div><Check /> {p.madeToOrder ? `Made to order · ${p.prepTime || "preparation time confirmed at checkout"}` : "In stock"}</div>
            <div><Check /> Pickup at the studio or delivery in Aley &amp; Mount Lebanon</div>
            <div><Check /> Every uploaded photo is reviewed before printing</div>
          </div>
        </div>
      </div>
    </section>
  );
}

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, type Product, type ProductCategory } from "../lib/api";
import { Tone } from "../components/Art";

export default function Frames() {
  const { cat } = useParams();
  const nav = useNavigate();
  const active = cat || "all";
  const [cats, setCats] = useState<ProductCategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { api.productCategories().then(setCats).catch(() => {}); }, []);
  useEffect(() => { setLoading(true); api.products({ category: active }).then(setProducts).catch(() => setProducts([])).finally(() => setLoading(false)); }, [active]);

  return (
    <>
      <div className="pagehead"><p className="eyebrow">Keepsakes</p><h1>Frames &amp; Prints</h1><p>Turn your favourite photos into frames, canvases, albums and prints. Choose a product, upload your photo, and we'll handle printing, framing and delivery.</p></div>
      <section>
        <div className="wrap">
          <div className="pfilters">
            <button className={active === "all" ? "on" : ""} onClick={() => nav("/frames")}>All</button>
            {cats.map((c) => <button key={c.slug} className={active === c.slug ? "on" : ""} onClick={() => nav(`/frames/${c.slug}`)}>{c.name}</button>)}
          </div>
          {loading ? <div className="spinner" /> : products.length === 0 ? <div className="empty"><h3>Nothing here yet</h3></div> : (
            <div className="services" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
              {products.map((p) => (
                <div key={p.id} className="prod" onClick={() => nav(`/product/${p.id}`)}>
                  <Tone tone={p.tone} />
                  <div className="body">
                    <span className="cat">{p.category?.name}</span>
                    <h3>{p.name}</h3>
                    <span className="price">{p.madeToOrder ? "From " : ""}${p.price}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}

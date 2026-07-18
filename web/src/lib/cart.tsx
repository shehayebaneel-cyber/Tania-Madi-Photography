import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export interface CartItem {
  productId: number;
  name: string;
  tone: string;
  unitPrice: number;
  qty: number;
  options: Record<string, string>;
  needsEditing?: boolean;
  instructions?: string;
}
interface CartCtx {
  items: CartItem[];
  count: number;
  subtotal: number;
  add: (item: CartItem) => void;
  setQty: (i: number, qty: number) => void;
  remove: (i: number) => void;
  clear: () => void;
}
const Ctx = createContext<CartCtx | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try { return JSON.parse(localStorage.getItem("tm_cart") || "[]"); } catch { return []; }
  });
  useEffect(() => { localStorage.setItem("tm_cart", JSON.stringify(items)); }, [items]);

  const add = (item: CartItem) => setItems((p) => [...p, item]);
  const setQty = (i: number, qty: number) => setItems((p) => p.map((it, idx) => (idx === i ? { ...it, qty: Math.max(1, qty) } : it)));
  const remove = (i: number) => setItems((p) => p.filter((_, idx) => idx !== i));
  const clear = () => setItems([]);
  const count = items.reduce((s, i) => s + i.qty, 0);
  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.qty, 0);
  return <Ctx.Provider value={{ items, count, subtotal, add, setQty, remove, clear }}>{children}</Ctx.Provider>;
}
export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart within CartProvider");
  return c;
}

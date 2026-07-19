const RAW = import.meta.env.VITE_API_URL || "";
let BASE = RAW && !/^https?:\/\//.test(RAW) ? "https://" + RAW : RAW;
// Self-heal on Render if the build-time API URL was missing: derive the API host from the
// web host (tania-web.onrender.com -> tania-api.onrender.com). Avoids depending on Render's
// fromService env wiring, which can arrive empty.
if (!BASE && typeof location !== "undefined" && location.hostname.endsWith(".onrender.com")) {
  BASE = location.origin.replace("tania-web", "tania-api");
}

export interface Package {
  id: number; name: string; price: number | null; requestPricing: boolean;
  durationText: string; editedPhotos: string; outfits: string; features: string[];
  deposit: number; deliveryDays: string; revisions: number;
}
export interface Service {
  slug: string; name: string; tagline: string; description: string;
  includes: string[]; durationText: string; locationText: string;
  startingPrice: number | null; faqs: { q: string; a: string }[];
  heroTone: string; isActive: boolean; packages: Package[];
}
export interface PortfolioItem {
  id: number; category: string; title: string; description: string;
  tone: string; imageUrl: string; orientation: string; isFeatured: boolean;
}
export interface Testimonial { id: number; name: string; sessionType: string; text: string; rating: number; tone: string; }
export interface ProductCategory { slug: string; name: string; count: number; }
export interface Product {
  id: number; categorySlug: string; category?: { slug: string; name: string };
  name: string; description: string; tone: string; material: string; style: string;
  colors: string[]; sizes: { label: string; priceDelta: number }[]; orientation: string;
  glassOption: boolean; mount: string; price: number; stock: number; madeToOrder: boolean;
  prepTime: string; isFeatured: boolean;
}
export interface EditingService { slug: string; name: string; description: string; pricingType: string; price: number | null; }
export interface Settings { contact?: any; home?: any; [k: string]: any; }

async function req<T>(path: string, options: RequestInit = {}, retries = 2): Promise<T> {
  const init: RequestInit = { credentials: "include", headers: { "Content-Type": "application/json" }, ...options };
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(BASE + path, init);
      if (!res.ok) {
        let msg = "Something went wrong. Please try again.";
        try { const d = await res.json(); if (d?.error) msg = d.error; } catch { /* ignore */ }
        throw new Error(msg);
      }
      return res.json();
    } catch (e) {
      lastErr = e;
      // Only retry network/cold-start failures on idempotent GETs.
      const isGet = !options.method || options.method === "GET";
      if (e instanceof TypeError && isGet && attempt < retries) {
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}
const qs = (o: Record<string, string | undefined>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v) p.set(k, v);
  const s = p.toString();
  return s ? "?" + s : "";
};

export const api = {
  settings: () => req<Settings>("/api/settings"),
  services: () => req<Service[]>("/api/services"),
  service: (slug: string) => req<Service>(`/api/services/${slug}`),
  portfolio: (p?: { category?: string; featured?: boolean }) => req<PortfolioItem[]>("/api/portfolio" + qs({ category: p?.category, featured: p?.featured ? "1" : undefined })),
  testimonials: () => req<Testimonial[]>("/api/testimonials"),
  productCategories: () => req<ProductCategory[]>("/api/product-categories"),
  products: (p?: { category?: string; featured?: boolean }) => req<Product[]>("/api/products" + qs({ category: p?.category, featured: p?.featured ? "1" : undefined })),
  product: (id: number | string) => req<Product>(`/api/products/${id}`),
  editingServices: () => req<EditingService[]>("/api/editing-services"),

  createBooking: (b: unknown) => req<{ ok: true; reference: string }>("/api/bookings", { method: "POST", body: JSON.stringify(b) }),
  createEditing: (b: unknown) => req<{ ok: true; reference: string }>("/api/editing-requests", { method: "POST", body: JSON.stringify(b) }),
  createOrder: (b: unknown) => req<{ ok: true; reference: string; total: number }>("/api/orders", { method: "POST", body: JSON.stringify(b) }),

  // customer account
  register: (b: unknown) => req<{ ok: true; name: string; email: string }>("/api/account/register", { method: "POST", body: JSON.stringify(b) }),
  login: (email: string, password: string) => req<{ ok: true; name: string; email: string }>("/api/account/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  logout: () => req<{ ok: true }>("/api/account/logout", { method: "POST" }),
  me: () => req<{ name: string; email: string; phone: string; bookings: any[]; orders: any[]; editing: any[] }>("/api/account/me"),

  // admin
  adminLogin: (email: string, password: string) => req<{ ok: true; name: string }>("/api/admin/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  adminLogout: () => req<{ ok: true }>("/api/admin/logout", { method: "POST" }),
  adminMe: () => req<{ name: string; email: string }>("/api/admin/me"),
  adminStats: () => req<any>("/api/admin/stats"),
  adminBookings: () => req<any[]>("/api/admin/bookings"),
  adminUpdateBooking: (id: number, b: unknown) => req<any>(`/api/admin/bookings/${id}`, { method: "PATCH", body: JSON.stringify(b) }),
  adminOrders: () => req<any[]>("/api/admin/orders"),
  adminUpdateOrder: (id: number, status: string) => req<any>(`/api/admin/orders/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
  adminEditing: () => req<any[]>("/api/admin/editing"),
  adminUpdateEditing: (id: number, b: unknown) => req<any>(`/api/admin/editing/${id}`, { method: "PATCH", body: JSON.stringify(b) }),
  adminPortfolio: () => req<PortfolioItem[]>("/api/admin/portfolio"),
  adminCreatePortfolio: (b: unknown) => req<any>("/api/admin/portfolio", { method: "POST", body: JSON.stringify(b) }),
  adminUpdatePortfolio: (id: number, b: unknown) => req<any>(`/api/admin/portfolio/${id}`, { method: "PUT", body: JSON.stringify(b) }),
  adminDeletePortfolio: (id: number) => req<any>(`/api/admin/portfolio/${id}`, { method: "DELETE" }),
  adminProducts: () => req<Product[]>("/api/admin/products"),
  adminCreateProduct: (b: unknown) => req<any>("/api/admin/products", { method: "POST", body: JSON.stringify(b) }),
  adminUpdateProduct: (id: number, b: unknown) => req<any>(`/api/admin/products/${id}`, { method: "PUT", body: JSON.stringify(b) }),
  adminDeleteProduct: (id: number) => req<any>(`/api/admin/products/${id}`, { method: "DELETE" }),
};

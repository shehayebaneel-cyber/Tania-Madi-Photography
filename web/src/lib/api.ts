const RAW = import.meta.env.VITE_API_URL || "";
let BASE = RAW && !/^https?:\/\//.test(RAW) ? "https://" + RAW : RAW;
// Self-heal on Render if the build-time API URL was missing: derive the API host from the
// web host (tania-web.onrender.com -> tania-api.onrender.com). Avoids depending on Render's
// fromService env wiring, which can arrive empty.
if (!BASE && typeof location !== "undefined" && location.hostname.endsWith(".onrender.com")) {
  BASE = location.origin.replace("tania-web", "tania-api");
}

// Resolve a stored image path ("/uploads/<id>") to an absolute URL on the API host.
export const mediaUrl = (u: string | null | undefined): string => (u && u.startsWith("/uploads/") ? BASE + u : u || "");
export const thumbUrl = (u: string | null | undefined): string => (u && u.startsWith("/uploads/") ? BASE + u + "/thumb" : u || "");

export interface Media {
  id: string; mime: string; ext: string; width: number; height: number; bytes: number;
  thumbW: number; thumbH: number; originalName: string; title: string; alt: string;
  caption: string; category: string; focalX: number; focalY: number; isArchived: boolean;
  createdAt: string; updatedAt: string; used?: boolean; usedIn?: string[];
}

// Upload one or more images with progress (fetch can't report upload progress; XHR can).
export function uploadMedia(files: File[], opts?: { category?: string; onProgress?: (pct: number) => void }): Promise<{ created: Media[]; duplicates: Media[] }> {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    files.forEach((f) => fd.append("files", f));
    if (opts?.category) fd.append("category", opts.category);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", BASE + "/api/admin/media");
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => { if (e.lengthComputable && opts?.onProgress) opts.onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => {
      let d: any = {}; try { d = JSON.parse(xhr.responseText); } catch { /* ignore */ }
      if (xhr.status >= 200 && xhr.status < 300) resolve(d);
      else reject(new Error(d?.error || "Upload failed. Please try again."));
    };
    xhr.onerror = () => reject(new Error("Network error during upload."));
    xhr.send(fd);
  });
}

export interface Package {
  id: number; name: string; price: number | null; requestPricing: boolean;
  durationText: string; editedPhotos: string; outfits: string; features: string[];
  deposit: number; deliveryDays: string; revisions: number;
}
export interface Service {
  slug: string; name: string; tagline: string; description: string;
  includes: string[]; durationText: string; durationMinutes?: number; locationText: string;
  startingPrice: number | null; faqs: { q: string; a: string }[];
  heroTone: string; isActive: boolean; packages: Package[];
}
export interface PortfolioItem {
  id: number; category: string; extraCategories?: string[]; title: string; description: string;
  tone: string; imageUrl: string; videoUrl?: string; mediaType?: string; orientation: string;
  isFeatured: boolean; isActive?: boolean;
}
export interface PortfolioCategory { slug: string; name: string; blurb: string; coverImageUrl: string; sortOrder: number; isActive: boolean; count: number; }
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
  settingsPreview: () => req<Settings>("/api/settings/preview"),
  services: () => req<Service[]>("/api/services"),
  service: (slug: string) => req<Service>(`/api/services/${slug}`),
  portfolio: (p?: { category?: string; featured?: boolean }) => req<PortfolioItem[]>("/api/portfolio" + qs({ category: p?.category, featured: p?.featured ? "1" : undefined })),
  portfolioCategories: () => req<PortfolioCategory[]>("/api/portfolio-categories"),
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
  adminMe: () => req<{ name: string; email: string; role: string }>("/api/admin/me"),
  adminStats: () => req<any>("/api/admin/stats"),
  // Phase 9 — activity, team, backup
  adminActivity: () => req<{ id: number; adminName: string; method: string; path: string; summary: string; createdAt: string }[]>("/api/admin/activity"),
  adminTeam: () => req<{ id: number; email: string; name: string; role: string; createdAt: string }[]>("/api/admin/team"),
  adminCreateTeam: (b: { email: string; name: string; password: string; role: string }) => req<any>("/api/admin/team", { method: "POST", body: JSON.stringify(b) }),
  adminUpdateTeam: (id: number, b: { name?: string; role?: string; password?: string }) => req<any>(`/api/admin/team/${id}`, { method: "PATCH", body: JSON.stringify(b) }),
  adminDeleteTeam: (id: number) => req<any>(`/api/admin/team/${id}`, { method: "DELETE" }),
  adminBackup: () => req<any>("/api/admin/backup"),
  adminChangePassword: (current: string, next: string) => req<any>("/api/admin/password", { method: "POST", body: JSON.stringify({ current, next }) }),
  // client galleries (admin)
  adminGalleries: () => req<any[]>("/api/admin/galleries"),
  adminGallery: (id: number) => req<any>(`/api/admin/galleries/${id}`),
  adminCreateGallery: (b: { title: string; customerName?: string; customerId?: number; bookingId?: number; pin?: string; message?: string; expiresAt?: string | null }) => req<any>("/api/admin/galleries", { method: "POST", body: JSON.stringify(b) }),
  adminUpdateGallery: (id: number, b: any) => req<any>(`/api/admin/galleries/${id}`, { method: "PATCH", body: JSON.stringify(b) }),
  adminDeleteGallery: (id: number) => req<any>(`/api/admin/galleries/${id}`, { method: "DELETE" }),
  adminAddGalleryPhotos: (id: number, urls: string[]) => req<any>(`/api/admin/galleries/${id}/photos`, { method: "POST", body: JSON.stringify({ urls }) }),
  adminDeleteGalleryPhoto: (id: number) => req<any>(`/api/admin/gallery-photos/${id}`, { method: "DELETE" }),
  // client galleries (public, by token)
  galleryInfo: (token: string) => req<{ title: string; needsPin: boolean }>(`/api/gallery/${token}`),
  galleryOpen: (token: string, pin: string) => req<{ title: string; message: string; coverImageUrl: string; photos: { id: number; imageUrl: string }[]; count: number }>(`/api/gallery/${token}`, { method: "POST", body: JSON.stringify({ pin }) }),
  adminBookings: (p?: { q?: string; status?: string; service?: string; filter?: string; payment?: string; page?: number; pageSize?: number }) =>
    req<{ items: any[]; total: number; page: number; pageSize: number }>("/api/admin/bookings" + qs({ q: p?.q, status: p?.status, service: p?.service, filter: p?.filter, payment: p?.payment, page: p?.page ? String(p.page) : undefined, pageSize: p?.pageSize ? String(p.pageSize) : undefined })),
  adminBooking: (id: number) => req<any>(`/api/admin/bookings/${id}`),
  adminUpdateBooking: (id: number, b: unknown) => req<any>(`/api/admin/bookings/${id}`, { method: "PATCH", body: JSON.stringify(b) }),
  adminCreateBooking: (b: unknown) => req<any>("/api/admin/bookings", { method: "POST", body: JSON.stringify(b) }),
  adminBookingNote: (id: number, note: string) => req<any>(`/api/admin/bookings/${id}/note`, { method: "POST", body: JSON.stringify({ note }) }),
  adminDuplicateBooking: (id: number) => req<any>(`/api/admin/bookings/${id}/duplicate`, { method: "POST" }),
  adminDeleteBooking: (id: number) => req<any>(`/api/admin/bookings/${id}`, { method: "DELETE" }),
  adminCustomerSearch: (q: string) => req<any[]>(`/api/admin/customers-search` + qs({ q })),
  adminAvailability: () => req<any>("/api/admin/availability"),
  adminUpdateAvailability: (b: unknown) => req<any>("/api/admin/availability", { method: "PUT", body: JSON.stringify(b) }),
  adminBlackouts: () => req<any[]>("/api/admin/blackouts"),
  adminCreateBlackout: (b: unknown) => req<any>("/api/admin/blackouts", { method: "POST", body: JSON.stringify(b) }),
  adminDeleteBlackout: (id: number) => req<any>(`/api/admin/blackouts/${id}`, { method: "DELETE" }),
  adminCheckConflict: (b: unknown) => req<{ warnings: { type: string; msg: string }[]; count: number }>("/api/admin/bookings/check-conflict", { method: "POST", body: JSON.stringify(b) }),
  adminServices: () => req<Service[]>("/api/admin/services"),
  adminUpdateService: (slug: string, b: unknown) => req<Service>(`/api/admin/services/${slug}`, { method: "PATCH", body: JSON.stringify(b) }),
  adminCustomers: (p?: { q?: string; page?: number }) => req<{ items: any[]; total: number; page: number; pageSize: number }>("/api/admin/customers" + qs({ q: p?.q, page: p?.page ? String(p.page) : undefined })),
  adminCustomer: (id: number) => req<any>(`/api/admin/customers/${id}`),
  adminUpdateCustomer: (id: number, b: unknown) => req<any>(`/api/admin/customers/${id}`, { method: "PATCH", body: JSON.stringify(b) }),
  adminCreateCustomer: (b: unknown) => req<any>("/api/admin/customers", { method: "POST", body: JSON.stringify(b) }),
  adminRebuildCustomers: () => req<{ ok: true; linked: number }>("/api/admin/customers/rebuild", { method: "POST" }),
  // website content (draft → publish)
  adminContent: () => req<{ published: Record<string, any>; drafts: Record<string, any> }>("/api/admin/content"),
  adminSaveDraft: (key: string, value: unknown) => req<any>(`/api/admin/content/${key}`, { method: "PUT", body: JSON.stringify({ value }) }),
  adminPublishContent: (key: string) => req<any>(`/api/admin/content/${key}/publish`, { method: "POST" }),
  adminDiscardContent: (key: string) => req<any>(`/api/admin/content/${key}/discard`, { method: "POST" }),
  // packages
  adminCreatePackage: (b: unknown) => req<any>("/api/admin/packages", { method: "POST", body: JSON.stringify(b) }),
  adminUpdatePackage: (id: number, b: unknown) => req<any>(`/api/admin/packages/${id}`, { method: "PUT", body: JSON.stringify(b) }),
  adminDeletePackage: (id: number) => req<any>(`/api/admin/packages/${id}`, { method: "DELETE" }),
  // testimonials
  adminTestimonials: () => req<any[]>("/api/admin/testimonials"),
  adminCreateTestimonial: (b: unknown) => req<any>("/api/admin/testimonials", { method: "POST", body: JSON.stringify(b) }),
  adminUpdateTestimonial: (id: number, b: unknown) => req<any>(`/api/admin/testimonials/${id}`, { method: "PUT", body: JSON.stringify(b) }),
  adminDeleteTestimonial: (id: number) => req<any>(`/api/admin/testimonials/${id}`, { method: "DELETE" }),
  // message templates + notifications
  adminTemplates: () => req<any[]>("/api/admin/templates"),
  adminUpdateTemplate: (id: number, b: unknown) => req<any>(`/api/admin/templates/${id}`, { method: "PUT", body: JSON.stringify(b) }),
  adminCreateTemplate: (b: unknown) => req<any>("/api/admin/templates", { method: "POST", body: JSON.stringify(b) }),
  adminDeleteTemplate: (id: number) => req<any>(`/api/admin/templates/${id}`, { method: "DELETE" }),
  adminNotifications: () => req<{ count: number; items: any[]; seenAt: string }>("/api/admin/notifications"),
  adminMarkNotificationsSeen: () => req<any>("/api/admin/notifications/seen", { method: "POST" }),
  adminOrders: () => req<any[]>("/api/admin/orders"),
  adminOrder: (id: number) => req<any>(`/api/admin/orders/${id}`),
  adminUpdateOrder: (id: number, b: unknown) => req<any>(`/api/admin/orders/${id}`, { method: "PATCH", body: JSON.stringify(b) }),
  adminUpdateOrderItem: (id: number, b: unknown) => req<any>(`/api/admin/order-items/${id}`, { method: "PATCH", body: JSON.stringify(b) }),
  adminEditing: () => req<any[]>("/api/admin/editing"),
  adminUpdateEditing: (id: number, b: unknown) => req<any>(`/api/admin/editing/${id}`, { method: "PATCH", body: JSON.stringify(b) }),
  adminProductCategories: () => req<any[]>("/api/admin/product-categories"),
  adminPortfolio: () => req<PortfolioItem[]>("/api/admin/portfolio"),
  adminCreatePortfolio: (b: unknown) => req<any>("/api/admin/portfolio", { method: "POST", body: JSON.stringify(b) }),
  adminUpdatePortfolio: (id: number, b: unknown) => req<any>(`/api/admin/portfolio/${id}`, { method: "PUT", body: JSON.stringify(b) }),
  adminDeletePortfolio: (id: number) => req<any>(`/api/admin/portfolio/${id}`, { method: "DELETE" }),
  adminReorderPortfolio: (ids: number[]) => req<any>("/api/admin/portfolio/reorder", { method: "POST", body: JSON.stringify({ ids }) }),
  adminBulkPortfolio: (category: string, imageUrls: string[]) => req<{ ok: true; added: number }>("/api/admin/portfolio/bulk", { method: "POST", body: JSON.stringify({ category, imageUrls }) }),
  adminPortfolioCategories: () => req<PortfolioCategory[]>("/api/admin/portfolio-categories"),
  adminCreatePortfolioCategory: (b: unknown) => req<PortfolioCategory>("/api/admin/portfolio-categories", { method: "POST", body: JSON.stringify(b) }),
  adminUpdatePortfolioCategory: (slug: string, b: unknown) => req<PortfolioCategory>(`/api/admin/portfolio-categories/${slug}`, { method: "PUT", body: JSON.stringify(b) }),
  adminReorderPortfolioCategories: (slugs: string[]) => req<any>("/api/admin/portfolio-categories/reorder", { method: "POST", body: JSON.stringify({ slugs }) }),
  adminDeletePortfolioCategory: (slug: string) => req<any>(`/api/admin/portfolio-categories/${slug}`, { method: "DELETE" }),
  adminMedia: (p?: { q?: string; category?: string; page?: number; includeArchived?: boolean }) =>
    req<{ items: Media[]; total: number; page: number; pageSize: number; categories: string[] }>("/api/admin/media" + qs({ q: p?.q, category: p?.category, page: p?.page ? String(p.page) : undefined, includeArchived: p?.includeArchived ? "1" : undefined })),
  adminMediaItem: (id: string) => req<Media>(`/api/admin/media/${id}`),
  adminUpdateMedia: (id: string, b: unknown) => req<Media>(`/api/admin/media/${id}`, { method: "PATCH", body: JSON.stringify(b) }),
  adminDeleteMedia: (id: string, force?: boolean) => req<{ ok?: true; error?: string; usedIn?: string[] }>(`/api/admin/media/${id}` + (force ? "?force=1" : ""), { method: "DELETE" }),
  adminProducts: () => req<Product[]>("/api/admin/products"),
  adminCreateProduct: (b: unknown) => req<any>("/api/admin/products", { method: "POST", body: JSON.stringify(b) }),
  adminUpdateProduct: (id: number, b: unknown) => req<any>(`/api/admin/products/${id}`, { method: "PUT", body: JSON.stringify(b) }),
  adminDeleteProduct: (id: number) => req<any>(`/api/admin/products/${id}`, { method: "DELETE" }),
};

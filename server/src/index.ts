import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import { mountMedia } from "./media.js";
import "dotenv/config";

const prisma = new PrismaClient();
const app = express();
const PORT = Number(process.env.PORT) || 4020;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const WEB_URL = process.env.WEB_URL || "http://localhost:5173";
const PROD = process.env.NODE_ENV === "production";

app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());
// Configured origins from WEB_URL, plus a resilient fallback: any *.onrender.com host and
// localhost. Render's fromService WEB_URL wiring can arrive empty/wrong, which would otherwise
// break CORS for the deployed front-end, so we don't depend on it alone.
const allowlist = WEB_URL.split(",").map((s) => s.trim()).filter(Boolean).map((s) => (/^https?:\/\//.test(s) ? s : "https://" + s));
app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true); // curl, health checks, same-origin
      let host = "";
      try { host = new URL(origin).hostname; } catch { /* ignore */ }
      const ok = allowlist.includes(origin) || /\.onrender\.com$/.test(host) || host === "localhost" || host === "127.0.0.1";
      cb(null, ok);
    },
    credentials: true,
  })
);

function ref(prefix: string) {
  return prefix + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 1000);
}
function cookieOpts() {
  return { httpOnly: true, sameSite: (PROD ? "none" : "lax") as "none" | "lax", secure: PROD, maxAge: 7 * 24 * 3600 * 1000 };
}
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.tm_admin || req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Not signed in." });
  try { (req as any).adminId = (jwt.verify(token, JWT_SECRET) as { id: number }).id; next(); }
  catch { return res.status(401).json({ error: "Session expired. Please sign in again." }); }
}
function customerId(req: Request): number | null {
  const token = req.cookies?.tm_customer;
  if (!token) return null;
  try { return (jwt.verify(token, JWT_SECRET) as { id: number }).id; } catch { return null; }
}
// booking timeline / audit log
function logEvent(bookingId: number, e: { type?: string; fromStatus?: string; toStatus?: string; note?: string }) {
  return prisma.bookingEvent.create({ data: { bookingId, type: e.type || "status", fromStatus: e.fromStatus || "", toStatus: e.toStatus || "", note: e.note || "" } });
}
const effDate = (b: { date: string; preferredDate: string }) => b.date || b.preferredDate || "";
const isoDay = (d: Date) => d.toISOString().slice(0, 10);
function dateWindow(filter: string): [string, string] | null {
  const d = new Date();
  const sow = new Date(d); sow.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
  const eow = new Date(sow); eow.setDate(sow.getDate() + 6);
  const som = new Date(d.getFullYear(), d.getMonth(), 1), eom = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  if (filter === "today") return [isoDay(d), isoDay(d)];
  if (filter === "week") return [isoDay(sow), isoDay(eow)];
  if (filter === "month") return [isoDay(som), isoDay(eom)];
  return null;
}

// ---------- health & settings ----------
app.get("/api/health", async (_req, res) => {
  try { await prisma.$queryRaw`SELECT 1`; res.json({ ok: true, studio: "Tania Madi Photography" }); }
  catch { res.status(500).json({ ok: false }); }
});
app.get("/api/settings", async (_req, res) => {
  const rows = await prisma.setting.findMany();
  const out: Record<string, unknown> = {};
  for (const r of rows) out[r.key] = r.value;
  res.json(out);
});

// ---------- services & packages ----------
app.get("/api/services", async (_req, res) => {
  const services = await prisma.service.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, include: { packages: { where: { isActive: true }, orderBy: { sortOrder: "asc" } } } });
  res.json(services);
});
app.get("/api/services/:slug", async (req, res) => {
  const s = await prisma.service.findUnique({ where: { slug: req.params.slug }, include: { packages: { where: { isActive: true }, orderBy: { sortOrder: "asc" } } } });
  if (!s || !s.isActive) return res.status(404).json({ error: "Service not found." });
  res.json(s);
});

// ---------- portfolio ----------
app.get("/api/portfolio", async (req, res) => {
  const category = typeof req.query.category === "string" && req.query.category !== "all" ? req.query.category : undefined;
  const featured = req.query.featured === "1";
  const where: any = { isActive: true, hasConsent: true };
  // an item shows in a category if it's the primary OR listed in extraCategories
  if (category) where.OR = [{ category }, { extraCategories: { array_contains: category } }];
  if (featured) where.isFeatured = true;
  const items = await prisma.portfolioItem.findMany({ where, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });
  res.json(items);
});

// public portfolio categories (active only) with cover + live photo count
app.get("/api/portfolio-categories", async (_req, res) => {
  const cats = await prisma.portfolioCategory.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });
  const items = await prisma.portfolioItem.findMany({ where: { isActive: true, hasConsent: true }, select: { category: true, extraCategories: true } });
  const count = (slug: string) => items.filter((i) => i.category === slug || (Array.isArray(i.extraCategories) && (i.extraCategories as string[]).includes(slug))).length;
  res.json(cats.map((c) => ({ slug: c.slug, name: c.name, blurb: c.blurb, coverImageUrl: c.coverImageUrl, count: count(c.slug) })));
});

// ---------- testimonials ----------
app.get("/api/testimonials", async (_req, res) => {
  res.json(await prisma.testimonial.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }));
});

// ---------- products ----------
app.get("/api/product-categories", async (_req, res) => {
  const cats = await prisma.productCategory.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { products: { where: { isActive: true } } } } } });
  res.json(cats.map((c) => ({ slug: c.slug, name: c.name, count: c._count.products })));
});
app.get("/api/products", async (req, res) => {
  const category = typeof req.query.category === "string" && req.query.category !== "all" ? req.query.category : undefined;
  const featured = req.query.featured === "1";
  const where: any = { isActive: true };
  if (category) where.categorySlug = category;
  if (featured) where.isFeatured = true;
  res.json(await prisma.product.findMany({ where, orderBy: [{ sortOrder: "asc" }, { id: "asc" }], include: { category: true } }));
});
app.get("/api/products/:id", async (req, res) => {
  const p = await prisma.product.findUnique({ where: { id: Number(req.params.id) }, include: { category: true } });
  if (!p || !p.isActive) return res.status(404).json({ error: "Product not found." });
  res.json(p);
});

// ---------- editing services ----------
app.get("/api/editing-services", async (_req, res) => {
  res.json(await prisma.editingService.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }));
});

// ---------- booking request ----------
const bookingSchema = z.object({
  serviceSlug: z.string().min(1), preferredDate: z.string().default(""), altDate: z.string().default(""),
  preferredTime: z.string().default(""), setting: z.string().default(""), locationText: z.string().default(""),
  people: z.string().default(""), withVideo: z.boolean().default(false), packagePref: z.string().default(""),
  description: z.string().max(2000).default(""), extra: z.record(z.any()).default({}),
  customerName: z.string().min(2).max(100), phone: z.string().min(4).max(40), whatsapp: z.string().max(40).default(""),
  email: z.string().max(120).default(""), instagram: z.string().max(60).default(""), heardFrom: z.string().max(120).default(""),
});
app.post("/api/bookings", async (req, res) => {
  const parsed = bookingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Please check the form and try again." });
  const b = parsed.data;
  const service = await prisma.service.findUnique({ where: { slug: b.serviceSlug } });
  const booking = await prisma.booking.create({
    data: { ...b, serviceName: service?.name || b.serviceSlug, reference: ref("BK"), source: "website", date: b.preferredDate || "", customerId: customerId(req) ?? undefined },
  });
  await logEvent(booking.id, { type: "created", toStatus: booking.status, note: "Website booking request" });
  res.json({ ok: true, reference: booking.reference });
});

// ---------- editing request ----------
const editingSchema = z.object({
  serviceSlug: z.string().min(1), complexity: z.enum(["BASIC", "ADVANCED", "COMPLEX", "CUSTOM"]).default("BASIC"),
  instructions: z.string().max(2000).default(""), speed: z.enum(["STANDARD", "EXPRESS", "URGENT"]).default("STANDARD"),
  photoCount: z.number().int().min(1).max(200).default(1), uploadUrls: z.array(z.string()).default([]),
  customerName: z.string().min(2).max(100), phone: z.string().min(4).max(40), whatsapp: z.string().max(40).default(""),
  email: z.string().max(120).default(""), deliveryPref: z.string().max(120).default(""), notes: z.string().max(1000).default(""),
});
app.post("/api/editing-requests", async (req, res) => {
  const parsed = editingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Please check the form and try again." });
  const e = parsed.data;
  const svc = await prisma.editingService.findUnique({ where: { slug: e.serviceSlug } });
  const r = await prisma.editingRequest.create({ data: { ...e, serviceName: svc?.name || e.serviceSlug, reference: ref("ED"), customerId: customerId(req) ?? undefined } });
  res.json({ ok: true, reference: r.reference });
});

// ---------- product order (cash / pickup / COD / whish) ----------
const orderSchema = z.object({
  customerName: z.string().min(2).max(100), phone: z.string().min(4).max(40), email: z.string().max(120).default(""),
  address: z.string().max(200).default(""), town: z.string().max(80).default(""), note: z.string().max(500).default(""),
  fulfilment: z.enum(["PICKUP", "DELIVERY"]).default("PICKUP"),
  paymentMethod: z.enum(["CASH", "PICKUP", "COD", "WHISH"]).default("CASH"),
  items: z.array(z.object({
    productId: z.number().int(), qty: z.number().int().min(1).max(50),
    options: z.record(z.any()).default({}), uploadUrl: z.string().default(""), needsEditing: z.boolean().default(false), instructions: z.string().max(500).default(""),
  })).min(1),
});
app.post("/api/orders", async (req, res) => {
  const parsed = orderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Please check your details and try again." });
  const body = parsed.data;
  const products = await prisma.product.findMany({ where: { id: { in: body.items.map((i) => i.productId) }, isActive: true } });
  if (!products.length) return res.status(400).json({ error: "Your cart items are no longer available." });
  let itemsCost = 0;
  const itemsData = body.items.map((i) => {
    const p = products.find((x) => x.id === i.productId);
    if (!p) return null;
    const sizes = (p.sizes as { label: string; priceDelta: number }[]) || [];
    const chosen = sizes.find((s) => s.label === (i.options?.size as string));
    const unit = p.price + (chosen?.priceDelta || 0);
    itemsCost += unit * i.qty;
    return { productId: p.id, kind: "PRODUCT", name: p.name, options: i.options, uploadUrl: i.uploadUrl, needsEditing: i.needsEditing, instructions: i.instructions, price: unit, qty: i.qty };
  }).filter((x): x is NonNullable<typeof x> => x !== null);
  const deliveryFee = body.fulfilment === "DELIVERY" ? 3 : 0;
  const order = await prisma.order.create({
    data: { reference: ref("OR"), customerName: body.customerName, phone: body.phone, email: body.email, address: body.address, town: body.town, note: body.note, fulfilment: body.fulfilment, paymentMethod: body.paymentMethod, itemsCost, deliveryFee, total: itemsCost + deliveryFee, customerId: customerId(req) ?? undefined, items: { create: itemsData } },
  });
  res.json({ ok: true, reference: order.reference, total: order.total });
});

// ---------- customer accounts ----------
app.post("/api/account/register", async (req, res) => {
  const email = String(req.body?.email || "").toLowerCase().trim();
  const password = String(req.body?.password || "");
  const name = String(req.body?.name || "").trim();
  if (!email || password.length < 6 || name.length < 2) return res.status(400).json({ error: "Enter a name, email and a password of at least 6 characters." });
  if (await prisma.customer.findUnique({ where: { email } })) return res.status(400).json({ error: "An account with this email already exists." });
  const c = await prisma.customer.create({ data: { email, name, phone: String(req.body?.phone || ""), passwordHash: await bcrypt.hash(password, 10) } });
  res.cookie("tm_customer", jwt.sign({ id: c.id }, JWT_SECRET, { expiresIn: "30d" }), cookieOpts());
  res.json({ ok: true, name: c.name, email: c.email });
});
app.post("/api/account/login", async (req, res) => {
  const email = String(req.body?.email || "").toLowerCase().trim();
  const c = await prisma.customer.findUnique({ where: { email } });
  if (!c || !(await bcrypt.compare(String(req.body?.password || ""), c.passwordHash))) return res.status(401).json({ error: "Wrong email or password." });
  res.cookie("tm_customer", jwt.sign({ id: c.id }, JWT_SECRET, { expiresIn: "30d" }), cookieOpts());
  res.json({ ok: true, name: c.name, email: c.email });
});
app.post("/api/account/logout", (_req, res) => { res.clearCookie("tm_customer", { sameSite: PROD ? "none" : "lax", secure: PROD }); res.json({ ok: true }); });
app.get("/api/account/me", async (req, res) => {
  const id = customerId(req);
  if (!id) return res.status(401).json({ error: "Not signed in." });
  const c = await prisma.customer.findUnique({ where: { id } });
  if (!c) return res.status(401).json({ error: "Not found." });
  const [bookings, orders, editing] = await Promise.all([
    prisma.booking.findMany({ where: { customerId: id }, orderBy: { createdAt: "desc" } }),
    prisma.order.findMany({ where: { customerId: id }, orderBy: { createdAt: "desc" }, include: { items: true } }),
    prisma.editingRequest.findMany({ where: { customerId: id }, orderBy: { createdAt: "desc" } }),
  ]);
  res.json({ name: c.name, email: c.email, phone: c.phone, bookings, orders, editing });
});

// ---------- admin ----------
app.post("/api/admin/login", async (req, res) => {
  const email = String(req.body?.email || "").toLowerCase().trim();
  const user = await prisma.adminUser.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(String(req.body?.password || ""), user.passwordHash))) return res.status(401).json({ error: "Wrong email or password." });
  res.cookie("tm_admin", jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: "7d" }), cookieOpts());
  res.json({ ok: true, name: user.name });
});
app.post("/api/admin/logout", (_req, res) => { res.clearCookie("tm_admin", { sameSite: PROD ? "none" : "lax", secure: PROD }); res.json({ ok: true }); });
app.get("/api/admin/me", requireAdmin, async (req, res) => {
  const u = await prisma.adminUser.findUnique({ where: { id: (req as any).adminId } });
  res.json({ name: u?.name, email: u?.email });
});
app.get("/api/admin/stats", requireAdmin, async (_req, res) => {
  const all = await prisma.booking.findMany({ orderBy: { createdAt: "desc" } });
  const [orders, editing, revenue] = await Promise.all([
    prisma.order.count(), prisma.editingRequest.count(), prisma.order.aggregate({ _sum: { total: true } }),
  ]);
  const today = isoDay(new Date());
  const done = ["COMPLETED", "EDITING", "PREVIEW", "DELIVERED"];
  const dead = ["CANCELLED", "DECLINED", "NO_SHOW"];
  res.json({
    bookings: all.length,
    newBookings: all.filter((b) => b.status === "NEW").length,
    todaysBookings: all.filter((b) => effDate(b) === today).length,
    upcoming: all.filter((b) => effDate(b) >= today && ![...dead, "DELIVERED"].includes(b.status)).length,
    awaitingDeposits: all.filter((b) => b.status === "AWAITING_DEPOSIT" || (!b.depositPaid && b.status === "CONFIRMED")).length,
    confirmed: all.filter((b) => b.status === "CONFIRMED").length,
    completed: all.filter((b) => done.includes(b.status)).length,
    unpaidBalances: all.filter((b) => (b.price || 0) > (b.depositPaid ? (b.deposit || 0) : 0) && !dead.includes(b.status)).length,
    orders, editing, revenue: revenue._sum.total || 0,
    recentBookings: all.slice(0, 6),
  });
});
app.get("/api/admin/bookings", requireAdmin, async (req, res) => {
  const all = await prisma.booking.findMany({ orderBy: { createdAt: "desc" } });
  const q = String(req.query.q || "").toLowerCase().trim();
  const status = String(req.query.status || ""), service = String(req.query.service || "");
  const filter = String(req.query.filter || ""), payment = String(req.query.payment || "");
  const page = Math.max(1, Number(req.query.page) || 1), pageSize = Math.min(1000, Math.max(1, Number(req.query.pageSize) || 20));
  const today = isoDay(new Date());
  let rows = all;
  if (q) rows = rows.filter((b) => [b.reference, b.customerName, b.phone, b.email, b.whatsapp, b.instagram, b.serviceName, effDate(b)].join(" ").toLowerCase().includes(q));
  if (status) rows = rows.filter((b) => b.status === status);
  if (service) rows = rows.filter((b) => b.serviceSlug === service);
  if (payment === "unpaid") rows = rows.filter((b) => !b.depositPaid);
  if (payment === "paid") rows = rows.filter((b) => b.depositPaid);
  if (filter === "new") rows = rows.filter((b) => b.status === "NEW");
  else if (filter === "awaiting_deposit") rows = rows.filter((b) => b.status === "AWAITING_DEPOSIT");
  else if (filter === "confirmed") rows = rows.filter((b) => b.status === "CONFIRMED");
  else if (filter === "completed") rows = rows.filter((b) => ["COMPLETED", "EDITING", "PREVIEW", "DELIVERED"].includes(b.status));
  else if (filter === "cancelled") rows = rows.filter((b) => ["CANCELLED", "DECLINED", "NO_SHOW"].includes(b.status));
  else if (filter === "upcoming") rows = rows.filter((b) => effDate(b) >= today);
  else if (filter === "past") rows = rows.filter((b) => effDate(b) && effDate(b) < today);
  else { const w = dateWindow(filter); if (w) rows = rows.filter((b) => { const dt = effDate(b); return dt >= w[0] && dt <= w[1]; }); }
  res.json({ items: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, page, pageSize });
});
app.get("/api/admin/bookings/:id", requireAdmin, async (req, res) => {
  const b = await prisma.booking.findUnique({ where: { id: Number(req.params.id) }, include: { events: { orderBy: { createdAt: "desc" } }, customer: true } });
  if (!b) return res.status(404).json({ error: "Not found." });
  res.json(b);
});
app.patch("/api/admin/bookings/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const cur = await prisma.booking.findUnique({ where: { id } });
  if (!cur) return res.status(404).json({ error: "Not found." });
  const data: any = {};
  for (const k of ["status", "adminNotes", "source", "date", "startTime", "endTime", "paymentMethod", "serviceSlug", "serviceName", "preferredDate", "altDate", "preferredTime", "setting", "locationText", "people", "packagePref", "description", "customerName", "phone", "whatsapp", "email", "instagram", "heardFrom"]) if (typeof req.body?.[k] === "string") data[k] = req.body[k];
  for (const k of ["quote", "deposit", "price", "packageId"]) if (req.body?.[k] !== undefined) data[k] = req.body[k] == null || req.body[k] === "" ? null : Number(req.body[k]);
  if (typeof req.body?.depositPaid === "boolean") data.depositPaid = req.body.depositPaid;
  if (typeof req.body?.withVideo === "boolean") data.withVideo = req.body.withVideo;
  if (Array.isArray(req.body?.extras)) data.extras = req.body.extras;
  const updated = await prisma.booking.update({ where: { id }, data });
  if (data.status && data.status !== cur.status) await logEvent(id, { type: "status", fromStatus: cur.status, toStatus: data.status });
  res.json(updated);
});
// manual add booking (find or link existing customer by phone/email)
app.post("/api/admin/bookings", requireAdmin, async (req, res) => {
  const b = req.body || {};
  if (!b.customerName || !b.phone) return res.status(400).json({ error: "Customer name and phone are required." });
  const service = b.serviceSlug ? await prisma.service.findUnique({ where: { slug: b.serviceSlug } }) : null;
  let linkId = b.customerId ? Number(b.customerId) : undefined;
  if (!linkId) {
    const digits = String(b.phone).replace(/\D/g, "");
    const existing = digits.length >= 6 ? await prisma.customer.findFirst({ where: { OR: [{ phone: { contains: digits.slice(-6) } }, ...(b.email ? [{ email: String(b.email) }] : [])] } }) : null;
    if (existing) linkId = existing.id;
  }
  const booking = await prisma.booking.create({ data: {
    reference: ref("BK"), serviceSlug: b.serviceSlug || "", serviceName: service?.name || b.serviceName || b.serviceSlug || "",
    date: b.date || "", preferredDate: b.date || "", startTime: b.startTime || "", endTime: b.endTime || "",
    setting: b.setting || "", locationText: b.locationText || "", people: String(b.people || ""), withVideo: !!b.withVideo,
    packagePref: b.packagePref || "", packageId: b.packageId ? Number(b.packageId) : null, description: b.description || "",
    customerName: b.customerName, phone: b.phone, whatsapp: b.whatsapp || "", email: b.email || "", instagram: b.instagram || "",
    heardFrom: b.heardFrom || "", source: b.source || "studio", status: b.status || "CONFIRMED",
    price: b.price != null && b.price !== "" ? Number(b.price) : null, deposit: b.deposit != null && b.deposit !== "" ? Number(b.deposit) : null,
    depositPaid: !!b.depositPaid, paymentMethod: b.paymentMethod || "", adminNotes: b.adminNotes || "",
    customerId: linkId ?? null, extras: Array.isArray(b.extras) ? b.extras : [],
  } as any });
  await logEvent(booking.id, { type: "created", toStatus: booking.status, note: "Added manually" });
  res.json(booking);
});
app.post("/api/admin/bookings/:id/note", requireAdmin, async (req, res) => {
  const note = String(req.body?.note || "").trim();
  if (!note) return res.status(400).json({ error: "Write a note first." });
  res.json(await logEvent(Number(req.params.id), { type: "note", note }));
});
app.post("/api/admin/bookings/:id/duplicate", requireAdmin, async (req, res) => {
  const src = await prisma.booking.findUnique({ where: { id: Number(req.params.id) } });
  if (!src) return res.status(404).json({ error: "Not found." });
  const { id: _id, reference: _r, createdAt: _c, updatedAt: _u, ...rest } = src;
  const copy = await prisma.booking.create({ data: { ...rest, reference: ref("BK"), status: "NEW", depositPaid: false } as any });
  await logEvent(copy.id, { type: "created", toStatus: "NEW", note: "Duplicated from " + src.reference });
  res.json(copy);
});
app.delete("/api/admin/bookings/:id", requireAdmin, async (req, res) => { await prisma.booking.delete({ where: { id: Number(req.params.id) } }); res.json({ ok: true }); });
// customer quick-search for the manual booking form
app.get("/api/admin/customers-search", requireAdmin, async (req, res) => {
  const q = String(req.query.q || "").trim(); if (q.length < 2) return res.json([]);
  res.json(await prisma.customer.findMany({ where: { OR: [{ name: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }, { email: { contains: q, mode: "insensitive" } }] }, take: 8, select: { id: true, name: true, phone: true, email: true, whatsapp: true, instagram: true } }));
});
app.get("/api/admin/orders", requireAdmin, async (_req, res) => res.json(await prisma.order.findMany({ orderBy: { createdAt: "desc" }, include: { items: true } })));
app.patch("/api/admin/orders/:id", requireAdmin, async (req, res) => res.json(await prisma.order.update({ where: { id: Number(req.params.id) }, data: { status: String(req.body?.status || "NEW") } })));
app.get("/api/admin/editing", requireAdmin, async (_req, res) => res.json(await prisma.editingRequest.findMany({ orderBy: { createdAt: "desc" } })));
app.patch("/api/admin/editing/:id", requireAdmin, async (req, res) => {
  const data: any = {};
  for (const k of ["status", "previewUrl", "finalUrl"]) if (typeof req.body?.[k] === "string") data[k] = req.body[k];
  if (req.body?.quote != null) data.quote = Number(req.body.quote);
  res.json(await prisma.editingRequest.update({ where: { id: Number(req.params.id) }, data }));
});

// ---------- portfolio categories admin ----------
app.get("/api/admin/portfolio-categories", requireAdmin, async (_req, res) => {
  const cats = await prisma.portfolioCategory.findMany({ orderBy: { sortOrder: "asc" } });
  const items = await prisma.portfolioItem.findMany({ select: { category: true, extraCategories: true } });
  const count = (slug: string) => items.filter((i) => i.category === slug || (Array.isArray(i.extraCategories) && (i.extraCategories as string[]).includes(slug))).length;
  res.json(cats.map((c) => ({ ...c, count: count(c.slug) })));
});
const pcatInput = z.object({ slug: z.string().min(1), name: z.string().min(1), blurb: z.string().default(""), coverImageUrl: z.string().default(""), isActive: z.boolean().default(true), sortOrder: z.number().int().default(0) });
app.post("/api/admin/portfolio-categories", requireAdmin, async (req, res) => {
  const d = pcatInput.safeParse({ ...req.body, slug: String(req.body?.slug || req.body?.name || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") });
  if (!d.success) return res.status(400).json({ error: "Name is required." });
  if (await prisma.portfolioCategory.findUnique({ where: { slug: d.data.slug } })) return res.status(409).json({ error: "A category with this name already exists." });
  const max = await prisma.portfolioCategory.aggregate({ _max: { sortOrder: true } });
  res.json(await prisma.portfolioCategory.create({ data: { ...d.data, sortOrder: (max._max.sortOrder ?? 0) + 1 } }));
});
app.put("/api/admin/portfolio-categories/:slug", requireAdmin, async (req, res) => {
  const data: any = {};
  for (const k of ["name", "blurb", "coverImageUrl"]) if (typeof req.body?.[k] === "string") data[k] = req.body[k];
  if (typeof req.body?.isActive === "boolean") data.isActive = req.body.isActive;
  res.json(await prisma.portfolioCategory.update({ where: { slug: req.params.slug }, data }));
});
app.post("/api/admin/portfolio-categories/reorder", requireAdmin, async (req, res) => {
  const slugs: string[] = Array.isArray(req.body?.slugs) ? req.body.slugs : [];
  await prisma.$transaction(slugs.map((slug, i) => prisma.portfolioCategory.update({ where: { slug }, data: { sortOrder: i } })));
  res.json({ ok: true });
});
app.delete("/api/admin/portfolio-categories/:slug", requireAdmin, async (req, res) => {
  await prisma.portfolioCategory.delete({ where: { slug: req.params.slug } });
  res.json({ ok: true });
});

// ---------- portfolio items admin ----------
app.get("/api/admin/portfolio", requireAdmin, async (_req, res) => res.json(await prisma.portfolioItem.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }] })));
const portfolioInput = z.object({
  category: z.string(), extraCategories: z.array(z.string()).default([]),
  title: z.string().default(""), description: z.string().default(""), tone: z.string().default("g-family"),
  imageUrl: z.string().default(""), videoUrl: z.string().default(""), mediaType: z.string().default("photo"),
  orientation: z.string().default("portrait"), isFeatured: z.boolean().default(false), isActive: z.boolean().default(true), hasConsent: z.boolean().default(true),
});
app.post("/api/admin/portfolio", requireAdmin, async (req, res) => {
  const d = portfolioInput.safeParse(req.body); if (!d.success) return res.status(400).json({ error: "Invalid data." });
  const max = await prisma.portfolioItem.aggregate({ _max: { sortOrder: true } });
  res.json(await prisma.portfolioItem.create({ data: { ...d.data, sortOrder: (max._max.sortOrder ?? 0) + 1 } }));
});
app.put("/api/admin/portfolio/:id", requireAdmin, async (req, res) => { const d = portfolioInput.partial().safeParse(req.body); if (!d.success) return res.status(400).json({ error: "Invalid data." }); res.json(await prisma.portfolioItem.update({ where: { id: Number(req.params.id) }, data: d.data })); });
app.delete("/api/admin/portfolio/:id", requireAdmin, async (req, res) => { await prisma.portfolioItem.delete({ where: { id: Number(req.params.id) } }); res.json({ ok: true }); });
// reorder a set of items (drag/up-down) — save the new order
app.post("/api/admin/portfolio/reorder", requireAdmin, async (req, res) => {
  const ids: number[] = Array.isArray(req.body?.ids) ? req.body.ids.map(Number) : [];
  await prisma.$transaction(ids.map((id, i) => prisma.portfolioItem.update({ where: { id }, data: { sortOrder: i } })));
  res.json({ ok: true });
});
// bulk-add: create one item per uploaded image, all in a category
app.post("/api/admin/portfolio/bulk", requireAdmin, async (req, res) => {
  const category = String(req.body?.category || "");
  const urls: string[] = Array.isArray(req.body?.imageUrls) ? req.body.imageUrls : [];
  if (!category || !urls.length) return res.status(400).json({ error: "Pick a category and at least one photo." });
  const max = await prisma.portfolioItem.aggregate({ _max: { sortOrder: true } });
  let n = (max._max.sortOrder ?? 0) + 1;
  await prisma.portfolioItem.createMany({ data: urls.map((imageUrl) => ({ category, imageUrl, mediaType: "photo", sortOrder: n++ })) });
  res.json({ ok: true, added: urls.length });
});

// products admin
app.get("/api/admin/products", requireAdmin, async (_req, res) => res.json(await prisma.product.findMany({ orderBy: { sortOrder: "asc" }, include: { category: true } })));
const productInput = z.object({ categorySlug: z.string(), name: z.string().min(1), description: z.string().default(""), tone: z.string().default("g-family"), price: z.number().int().min(0), material: z.string().default(""), mount: z.string().default(""), glassOption: z.boolean().default(false), orientation: z.string().default("any"), colors: z.array(z.string()).default([]), sizes: z.array(z.object({ label: z.string(), priceDelta: z.number().int() })).default([]), stock: z.number().int().default(0), madeToOrder: z.boolean().default(false), prepTime: z.string().default(""), isActive: z.boolean().default(true), isFeatured: z.boolean().default(false) });
app.post("/api/admin/products", requireAdmin, async (req, res) => { const d = productInput.safeParse(req.body); if (!d.success) return res.status(400).json({ error: "Please fill the required fields." }); res.json(await prisma.product.create({ data: d.data })); });
app.put("/api/admin/products/:id", requireAdmin, async (req, res) => { const d = productInput.partial().safeParse(req.body); if (!d.success) return res.status(400).json({ error: "Invalid data." }); res.json(await prisma.product.update({ where: { id: Number(req.params.id) }, data: d.data })); });
app.delete("/api/admin/products/:id", requireAdmin, async (req, res) => { await prisma.product.update({ where: { id: Number(req.params.id) }, data: { isActive: false } }); res.json({ ok: true }); });

// services admin (activate/edit)
app.get("/api/admin/services", requireAdmin, async (_req, res) => res.json(await prisma.service.findMany({ orderBy: { sortOrder: "asc" } })));
app.patch("/api/admin/services/:slug", requireAdmin, async (req, res) => {
  const data: any = {};
  for (const k of ["name", "tagline", "description"]) if (typeof req.body?.[k] === "string") data[k] = req.body[k];
  if (typeof req.body?.isActive === "boolean") data.isActive = req.body.isActive;
  if (req.body?.startingPrice !== undefined) data.startingPrice = req.body.startingPrice == null ? null : Number(req.body.startingPrice);
  res.json(await prisma.service.update({ where: { slug: req.params.slug }, data }));
});

// settings admin
app.put("/api/admin/settings/:key", requireAdmin, async (req, res) => {
  const key = req.params.key;
  const value = req.body?.value;
  res.json(await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } }));
});

// media library (upload / serve / search / edit / delete)
mountMedia(app, prisma, requireAdmin);

app.listen(PORT, () => console.log(`Tania Madi API on http://localhost:${PORT}`));

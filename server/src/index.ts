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

// A single failed query (e.g. a transient Neon connection-pool timeout) must never
// take the whole API down. These guards keep the process alive and just log the fault.
process.on("unhandledRejection", (reason) => console.error("[unhandledRejection]", reason));
process.on("uncaughtException", (err) => console.error("[uncaughtException]", err));

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
// ── availability config + conflict checking ──────────────────────────────────
const DOW = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const DEFAULT_AVAIL = {
  workingDays: {
    mon: { open: true, start: "09:00", end: "18:00" }, tue: { open: true, start: "09:00", end: "18:00" },
    wed: { open: true, start: "09:00", end: "18:00" }, thu: { open: true, start: "09:00", end: "18:00" },
    fri: { open: true, start: "09:00", end: "18:00" }, sat: { open: true, start: "10:00", end: "16:00" },
    sun: { open: false, start: "10:00", end: "16:00" },
  },
  maxPerDay: 3, allowOverlap: false, bufferMinutes: 30, defaultDurationMinutes: 120,
};
async function getAvailability() {
  const s = await prisma.setting.findUnique({ where: { key: "availability" } });
  const v: any = s?.value || {};
  return { ...DEFAULT_AVAIL, ...v, workingDays: { ...DEFAULT_AVAIL.workingDays, ...(v.workingDays || {}) } };
}
const toMin = (t: string) => { const [h, m] = String(t || "").split(":").map(Number); return (h || 0) * 60 + (m || 0); };
const rangesOverlap = (s1: number, e1: number, s2: number, e2: number) => s1 < e2 && e1 > s2;
async function checkConflict(p: { date?: string; startTime?: string; endTime?: string; serviceSlug?: string; excludeId?: number }) {
  const warnings: { type: string; msg: string }[] = [];
  if (!p.date) return { warnings, count: 0 };
  const cfg = await getAvailability();
  const key = DOW[new Date(p.date + "T12:00:00").getDay()];
  const wd: any = (cfg.workingDays as any)[key];
  if (!wd || !wd.open) warnings.push({ type: "closed", msg: "This is not a normal working day." });
  else if (p.startTime && (toMin(p.startTime) < toMin(wd.start) || toMin(p.endTime || p.startTime) > toMin(wd.end)))
    warnings.push({ type: "hours", msg: `Outside working hours (${wd.start}–${wd.end}).` });
  // blackouts
  for (const bo of await prisma.blackout.findMany({ where: { date: p.date } })) {
    if (bo.allDay) warnings.push({ type: "blackout", msg: `This day is blocked${bo.reason ? ` — ${bo.reason}` : ""}.` });
    else if (p.startTime && rangesOverlap(toMin(p.startTime), toMin(p.endTime || p.startTime), toMin(bo.startTime), toMin(bo.endTime)))
      warnings.push({ type: "blackout", msg: `Overlaps blocked time ${bo.startTime}–${bo.endTime}${bo.reason ? ` (${bo.reason})` : ""}.` });
  }
  const svc = p.serviceSlug ? await prisma.service.findUnique({ where: { slug: p.serviceSlug } }) : null;
  const dur = svc?.durationMinutes || cfg.defaultDurationMinutes || 120;
  const myStart = p.startTime ? toMin(p.startTime) : null;
  const myEnd = p.endTime ? toMin(p.endTime) : myStart != null ? myStart + dur : null;
  const active = await prisma.booking.findMany({ where: { status: { notIn: ["CANCELLED", "DECLINED", "NO_SHOW"] } } });
  const sameDay = active.filter((b) => (b.date || b.preferredDate) === p.date && b.id !== p.excludeId);
  if (cfg.maxPerDay && sameDay.length >= cfg.maxPerDay) warnings.push({ type: "max", msg: `Already ${sameDay.length} booking(s) that day (limit ${cfg.maxPerDay}).` });
  if (!cfg.allowOverlap && myStart != null && myEnd != null) {
    const buf = cfg.bufferMinutes || 0;
    for (const b of sameDay) {
      if (!b.startTime) continue;
      const bs = toMin(b.startTime), be = b.endTime ? toMin(b.endTime) : bs + (cfg.defaultDurationMinutes || 120);
      if (rangesOverlap(myStart, myEnd, bs - buf, be + buf)) warnings.push({ type: "overlap", msg: `Overlaps ${b.customerName}'s session (${b.startTime}${b.endTime ? "–" + b.endTime : ""}).` });
    }
  }
  return { warnings, count: sameDay.length };
}
// Find an existing customer by email or phone (last 6 digits), else create a
// contact-only one. Used by every booking/order/editing so the directory stays
// complete and de-duplicated.
async function findOrCreateCustomer(c: { name?: string; phone?: string; email?: string; whatsapp?: string; instagram?: string }) {
  const phone = String(c.phone || "").trim();
  const email = String(c.email || "").trim().toLowerCase();
  const digits = phone.replace(/\D/g, "");
  const conds: any[] = [];
  if (email) conds.push({ email });
  if (digits.length >= 6) conds.push({ phone: { contains: digits.slice(-6) } });
  const found = conds.length ? await prisma.customer.findFirst({ where: { OR: conds } }) : null;
  if (found) return found;
  if (!c.name && !phone) return null;
  return prisma.customer.create({ data: { name: c.name || "Customer", phone, email: email || null, whatsapp: c.whatsapp || "", instagram: c.instagram || "" } });
}

// ---------- health & settings ----------
app.get("/api/health", async (_req, res) => {
  try { await prisma.$queryRaw`SELECT 1`; res.json({ ok: true, studio: "Tania Madi Photography" }); }
  catch { res.status(500).json({ ok: false }); }
});
const INTERNAL_KEYS = ["availability"]; // config, not public content
const isInternal = (k: string) => k.startsWith("_") || INTERNAL_KEYS.includes(k);
app.get("/api/settings", async (_req, res) => {
  const rows = await prisma.setting.findMany();
  const out: Record<string, unknown> = {};
  for (const r of rows) if (!isInternal(r.key)) out[r.key] = r.value;
  res.json(out);
});
// preview = published content with unpublished drafts overlaid (admin only)
app.get("/api/settings/preview", requireAdmin, async (_req, res) => {
  const rows = await prisma.setting.findMany();
  const out: Record<string, unknown> = {};
  for (const r of rows) if (!isInternal(r.key)) out[r.key] = r.value;
  const drafts: any = rows.find((r) => r.key === "_drafts")?.value || {};
  res.json({ ...out, ...drafts });
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
  const linked = customerId(req);
  const cust = linked ? null : await findOrCreateCustomer({ name: b.customerName, phone: b.phone, email: b.email, whatsapp: b.whatsapp, instagram: b.instagram });
  const booking = await prisma.booking.create({
    data: { ...b, serviceName: service?.name || b.serviceSlug, reference: ref("BK"), source: "website", date: b.preferredDate || "", customerId: linked ?? cust?.id ?? undefined },
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
  const eLinked = customerId(req);
  const eCust = eLinked ? null : await findOrCreateCustomer({ name: e.customerName, phone: e.phone, email: e.email, whatsapp: e.whatsapp });
  const r = await prisma.editingRequest.create({ data: { ...e, serviceName: svc?.name || e.serviceSlug, reference: ref("ED"), customerId: eLinked ?? eCust?.id ?? undefined } });
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
  const oLinked = customerId(req);
  const oCust = oLinked ? null : await findOrCreateCustomer({ name: body.customerName, phone: body.phone, email: body.email });
  const order = await prisma.order.create({
    data: { reference: ref("OR"), customerName: body.customerName, phone: body.phone, email: body.email, address: body.address, town: body.town, note: body.note, fulfilment: body.fulfilment, paymentMethod: body.paymentMethod, itemsCost, deliveryFee, total: itemsCost + deliveryFee, customerId: oLinked ?? oCust?.id ?? undefined, items: { create: itemsData } },
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
  if (!linkId) { const cust = await findOrCreateCustomer({ name: b.customerName, phone: b.phone, email: b.email, whatsapp: b.whatsapp, instagram: b.instagram }); linkId = cust?.id; }
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

// ---------- admin: customers ----------
app.get("/api/admin/customers", requireAdmin, async (req, res) => {
  const q = String(req.query.q || "").trim();
  const page = Math.max(1, Number(req.query.page) || 1), pageSize = 20;
  const where: any = q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }, { email: { contains: q, mode: "insensitive" } }, { instagram: { contains: q, mode: "insensitive" } }] } : {};
  const [total, rows] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize, include: { _count: { select: { bookings: true, orders: true, editing: true } } } }),
  ]);
  res.json({ items: rows.map((c) => ({ id: c.id, name: c.name, phone: c.phone, email: c.email, whatsapp: c.whatsapp, instagram: c.instagram, createdAt: c.createdAt, bookings: c._count.bookings, orders: c._count.orders, editing: c._count.editing, registered: !!c.passwordHash })), total, page, pageSize });
});
app.get("/api/admin/customers/:id", requireAdmin, async (req, res) => {
  const c = await prisma.customer.findUnique({ where: { id: Number(req.params.id) }, include: { bookings: { orderBy: { createdAt: "desc" } }, orders: { orderBy: { createdAt: "desc" }, include: { items: true } }, editing: { orderBy: { createdAt: "desc" } } } });
  if (!c) return res.status(404).json({ error: "Not found." });
  const bookingsTotal = c.bookings.reduce((s, b) => s + (b.price || 0), 0);
  const depositsPaid = c.bookings.reduce((s, b) => s + (b.depositPaid ? (b.deposit || 0) : 0), 0);
  const ordersTotal = c.orders.reduce((s, o) => s + (o.total || 0), 0);
  const files: string[] = [];
  for (const o of c.orders) for (const it of o.items) if (it.uploadUrl) files.push(it.uploadUrl);
  for (const e of c.editing) if (Array.isArray(e.uploadUrls)) for (const u of e.uploadUrls as string[]) files.push(u);
  res.json({ ...c, summary: { bookingsTotal, depositsPaid, bookingsOutstanding: bookingsTotal - depositsPaid, ordersTotal, files } });
});
app.patch("/api/admin/customers/:id", requireAdmin, async (req, res) => {
  const data: any = {};
  for (const k of ["name", "phone", "whatsapp", "instagram", "address", "notes"]) if (typeof req.body?.[k] === "string") data[k] = req.body[k];
  if (typeof req.body?.email === "string") data.email = req.body.email.trim() || null;
  res.json(await prisma.customer.update({ where: { id: Number(req.params.id) }, data }));
});
app.post("/api/admin/customers", requireAdmin, async (req, res) => {
  const b = req.body || {}; if (!String(b.name || "").trim()) return res.status(400).json({ error: "Name is required." });
  const c = await findOrCreateCustomer({ name: b.name, phone: b.phone, email: b.email, whatsapp: b.whatsapp, instagram: b.instagram });
  if (c && (b.notes || b.address)) await prisma.customer.update({ where: { id: c.id }, data: { notes: b.notes || "", address: b.address || "" } });
  res.json(c);
});
// backfill: link existing bookings/orders/editing that have no customer yet
app.post("/api/admin/customers/rebuild", requireAdmin, async (_req, res) => {
  let linked = 0;
  for (const b of await prisma.booking.findMany({ where: { customerId: null } })) { const c = await findOrCreateCustomer({ name: b.customerName, phone: b.phone, email: b.email, whatsapp: b.whatsapp, instagram: b.instagram }); if (c) { await prisma.booking.update({ where: { id: b.id }, data: { customerId: c.id } }); linked++; } }
  for (const o of await prisma.order.findMany({ where: { customerId: null } })) { const c = await findOrCreateCustomer({ name: o.customerName, phone: o.phone, email: o.email }); if (c) { await prisma.order.update({ where: { id: o.id }, data: { customerId: c.id } }); linked++; } }
  for (const e of await prisma.editingRequest.findMany({ where: { customerId: null } })) { const c = await findOrCreateCustomer({ name: e.customerName, phone: e.phone, email: e.email, whatsapp: e.whatsapp }); if (c) { await prisma.editingRequest.update({ where: { id: e.id }, data: { customerId: c.id } }); linked++; } }
  res.json({ ok: true, linked });
});

// ---------- availability & conflict prevention ----------
app.get("/api/admin/availability", requireAdmin, async (_req, res) => res.json(await getAvailability()));
app.put("/api/admin/availability", requireAdmin, async (req, res) => {
  const value = { ...(await getAvailability()), ...(req.body || {}) };
  await prisma.setting.upsert({ where: { key: "availability" }, update: { value }, create: { key: "availability", value } });
  res.json(value);
});
app.get("/api/admin/blackouts", requireAdmin, async (_req, res) => res.json(await prisma.blackout.findMany({ orderBy: { date: "asc" } })));
app.post("/api/admin/blackouts", requireAdmin, async (req, res) => {
  const b = req.body || {}; if (!b.date) return res.status(400).json({ error: "Pick a date." });
  res.json(await prisma.blackout.create({ data: { date: String(b.date), allDay: b.allDay !== false, startTime: b.startTime || "", endTime: b.endTime || "", reason: b.reason || "" } }));
});
app.delete("/api/admin/blackouts/:id", requireAdmin, async (req, res) => { await prisma.blackout.delete({ where: { id: Number(req.params.id) } }); res.json({ ok: true }); });
app.post("/api/admin/bookings/check-conflict", requireAdmin, async (req, res) => {
  const b = req.body || {};
  res.json(await checkConflict({ date: b.date, startTime: b.startTime, endTime: b.endTime, serviceSlug: b.serviceSlug, excludeId: b.excludeId ? Number(b.excludeId) : undefined }));
});
// public: working days + upcoming all-day blocked dates (so the booking form can grey them out)
app.get("/api/availability", async (_req, res) => {
  const cfg = await getAvailability();
  const today = isoDay(new Date());
  const blackoutDates = (await prisma.blackout.findMany({ where: { allDay: true, date: { gte: today } }, select: { date: true } })).map((b) => b.date);
  const closedDays = Object.entries(cfg.workingDays).filter(([, v]: any) => !v.open).map(([k]) => DOW.indexOf(k));
  res.json({ workingDays: cfg.workingDays, closedDays, blackoutDates });
});
app.get("/api/admin/orders", requireAdmin, async (_req, res) => res.json(await prisma.order.findMany({ orderBy: { createdAt: "desc" }, include: { items: true } })));
app.get("/api/admin/orders/:id", requireAdmin, async (req, res) => {
  const o = await prisma.order.findUnique({ where: { id: Number(req.params.id) }, include: { items: true, customer: true } });
  if (!o) return res.status(404).json({ error: "Not found." });
  res.json(o);
});
app.patch("/api/admin/orders/:id", requireAdmin, async (req, res) => {
  const data: any = {};
  for (const k of ["status", "adminNotes", "trackingCode"]) if (typeof req.body?.[k] === "string") data[k] = req.body[k];
  if (req.body?.amountPaid !== undefined) data.amountPaid = Number(req.body.amountPaid) || 0;
  res.json(await prisma.order.update({ where: { id: Number(req.params.id) }, data }));
});
app.patch("/api/admin/order-items/:id", requireAdmin, async (req, res) => {
  const data: any = {};
  for (const k of ["photoStatus", "photoNote"]) if (typeof req.body?.[k] === "string") data[k] = req.body[k];
  res.json(await prisma.orderItem.update({ where: { id: Number(req.params.id) }, data }));
});
app.get("/api/admin/editing", requireAdmin, async (_req, res) => res.json(await prisma.editingRequest.findMany({ orderBy: { createdAt: "desc" }, include: { customer: true } })));
app.patch("/api/admin/editing/:id", requireAdmin, async (req, res) => {
  const data: any = {};
  for (const k of ["status", "previewUrl", "finalUrl", "adminNotes"]) if (typeof req.body?.[k] === "string") data[k] = req.body[k];
  if (req.body?.quote != null) data.quote = req.body.quote === "" ? null : Number(req.body.quote);
  if (req.body?.amountPaid !== undefined) data.amountPaid = Number(req.body.amountPaid) || 0;
  if (req.body?.revisionsUsed !== undefined) data.revisionsUsed = Number(req.body.revisionsUsed) || 0;
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
const productInput = z.object({ categorySlug: z.string(), name: z.string().min(1), description: z.string().default(""), tone: z.string().default("g-family"), images: z.array(z.string()).default([]), price: z.number().int().min(0), material: z.string().default(""), style: z.string().default(""), mount: z.string().default(""), glassOption: z.boolean().default(false), orientation: z.string().default("any"), colors: z.array(z.string()).default([]), sizes: z.array(z.object({ label: z.string(), priceDelta: z.number().int() })).default([]), stock: z.number().int().default(0), madeToOrder: z.boolean().default(false), prepTime: z.string().default(""), isActive: z.boolean().default(true), isFeatured: z.boolean().default(false) });
app.post("/api/admin/products", requireAdmin, async (req, res) => { const d = productInput.safeParse(req.body); if (!d.success) return res.status(400).json({ error: "Please fill the required fields." }); res.json(await prisma.product.create({ data: d.data })); });
app.put("/api/admin/products/:id", requireAdmin, async (req, res) => { const d = productInput.partial().safeParse(req.body); if (!d.success) return res.status(400).json({ error: "Invalid data." }); res.json(await prisma.product.update({ where: { id: Number(req.params.id) }, data: d.data })); });
app.delete("/api/admin/products/:id", requireAdmin, async (req, res) => {
  try { await prisma.product.delete({ where: { id: Number(req.params.id) } }); }
  catch { await prisma.product.update({ where: { id: Number(req.params.id) }, data: { isActive: false } }); } // has orders → just hide
  res.json({ ok: true });
});
// product categories (for the product editor dropdown)
app.get("/api/admin/product-categories", requireAdmin, async (_req, res) => res.json(await prisma.productCategory.findMany({ orderBy: { sortOrder: "asc" } })));

// services admin (activate/edit)
app.get("/api/admin/services", requireAdmin, async (_req, res) => res.json(await prisma.service.findMany({ orderBy: { sortOrder: "asc" } })));
app.patch("/api/admin/services/:slug", requireAdmin, async (req, res) => {
  const data: any = {};
  for (const k of ["name", "tagline", "description", "durationText", "locationText", "heroTone"]) if (typeof req.body?.[k] === "string") data[k] = req.body[k];
  if (typeof req.body?.isActive === "boolean") data.isActive = req.body.isActive;
  if (Array.isArray(req.body?.includes)) data.includes = req.body.includes;
  if (Array.isArray(req.body?.faqs)) data.faqs = req.body.faqs;
  if (req.body?.durationMinutes !== undefined) data.durationMinutes = Number(req.body.durationMinutes) || 0;
  if (req.body?.startingPrice !== undefined) data.startingPrice = req.body.startingPrice == null || req.body.startingPrice === "" ? null : Number(req.body.startingPrice);
  res.json(await prisma.service.update({ where: { slug: req.params.slug }, data }));
});

// ---------- packages admin ----------
const packageData = (b: any) => ({
  name: String(b.name || ""), price: b.price == null || b.price === "" ? null : Number(b.price), requestPricing: !!b.requestPricing,
  durationText: String(b.durationText || ""), editedPhotos: String(b.editedPhotos || ""), outfits: String(b.outfits || ""),
  features: Array.isArray(b.features) ? b.features : [], deposit: Number(b.deposit || 0), deliveryDays: String(b.deliveryDays || ""),
  revisions: Number(b.revisions || 1), isActive: b.isActive !== false,
});
app.post("/api/admin/packages", requireAdmin, async (req, res) => {
  const b = req.body || {}; if (!b.serviceSlug) return res.status(400).json({ error: "Pick a service." });
  const max = await prisma.package.aggregate({ where: { serviceSlug: b.serviceSlug }, _max: { sortOrder: true } });
  res.json(await prisma.package.create({ data: { serviceSlug: b.serviceSlug, ...packageData(b), sortOrder: (max._max.sortOrder ?? 0) + 1 } }));
});
app.put("/api/admin/packages/:id", requireAdmin, async (req, res) => res.json(await prisma.package.update({ where: { id: Number(req.params.id) }, data: packageData(req.body || {}) })));
app.delete("/api/admin/packages/:id", requireAdmin, async (req, res) => { await prisma.package.delete({ where: { id: Number(req.params.id) } }); res.json({ ok: true }); });

// ---------- testimonials admin ----------
app.get("/api/admin/testimonials", requireAdmin, async (_req, res) => res.json(await prisma.testimonial.findMany({ orderBy: { sortOrder: "asc" } })));
const testimonialData = (b: any) => ({ name: String(b.name || ""), sessionType: String(b.sessionType || ""), text: String(b.text || ""), rating: Math.min(5, Math.max(1, Number(b.rating || 5))), tone: String(b.tone || "g-couple"), isActive: b.isActive !== false });
app.post("/api/admin/testimonials", requireAdmin, async (req, res) => {
  const max = await prisma.testimonial.aggregate({ _max: { sortOrder: true } });
  res.json(await prisma.testimonial.create({ data: { ...testimonialData(req.body || {}), sortOrder: (max._max.sortOrder ?? 0) + 1 } }));
});
app.put("/api/admin/testimonials/:id", requireAdmin, async (req, res) => res.json(await prisma.testimonial.update({ where: { id: Number(req.params.id) }, data: testimonialData(req.body || {}) })));
app.delete("/api/admin/testimonials/:id", requireAdmin, async (req, res) => { await prisma.testimonial.delete({ where: { id: Number(req.params.id) } }); res.json({ ok: true }); });
app.post("/api/admin/testimonials/reorder", requireAdmin, async (req, res) => {
  const ids: number[] = Array.isArray(req.body?.ids) ? req.body.ids.map(Number) : [];
  await prisma.$transaction(ids.map((id, i) => prisma.testimonial.update({ where: { id }, data: { sortOrder: i } })));
  res.json({ ok: true });
});

// ---------- website content (draft → publish) ----------
const CONTENT_KEYS = ["contact", "home", "promo", "policies", "bookingInfo"];
app.get("/api/admin/content", requireAdmin, async (_req, res) => {
  const rows = await prisma.setting.findMany({ where: { key: { in: [...CONTENT_KEYS, "_drafts"] } } });
  const map: any = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  res.json({ published: Object.fromEntries(CONTENT_KEYS.map((k) => [k, map[k] || {}])), drafts: map["_drafts"] || {} });
});
app.put("/api/admin/content/:key", requireAdmin, async (req, res) => {
  const key = req.params.key; if (!CONTENT_KEYS.includes(key)) return res.status(400).json({ error: "Unknown section." });
  const drafts: any = (await prisma.setting.findUnique({ where: { key: "_drafts" } }))?.value || {};
  drafts[key] = req.body?.value ?? req.body;
  await prisma.setting.upsert({ where: { key: "_drafts" }, update: { value: drafts }, create: { key: "_drafts", value: drafts } });
  res.json({ ok: true });
});
app.post("/api/admin/content/:key/publish", requireAdmin, async (req, res) => {
  const key = req.params.key; if (!CONTENT_KEYS.includes(key)) return res.status(400).json({ error: "Unknown section." });
  const drafts: any = (await prisma.setting.findUnique({ where: { key: "_drafts" } }))?.value || {};
  if (drafts[key] === undefined) return res.status(400).json({ error: "Nothing to publish." });
  await prisma.setting.upsert({ where: { key }, update: { value: drafts[key] }, create: { key, value: drafts[key] } });
  delete drafts[key];
  await prisma.setting.upsert({ where: { key: "_drafts" }, update: { value: drafts }, create: { key: "_drafts", value: drafts } });
  res.json({ ok: true });
});
app.post("/api/admin/content/:key/discard", requireAdmin, async (req, res) => {
  const drafts: any = (await prisma.setting.findUnique({ where: { key: "_drafts" } }))?.value || {};
  delete drafts[req.params.key];
  await prisma.setting.upsert({ where: { key: "_drafts" }, update: { value: drafts }, create: { key: "_drafts", value: drafts } });
  res.json({ ok: true });
});

// settings admin (legacy direct write — kept for compatibility)
app.put("/api/admin/settings/:key", requireAdmin, async (req, res) => {
  const key = req.params.key;
  const value = req.body?.value;
  res.json(await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } }));
});

// ---------- message templates ----------
const DEFAULT_TEMPLATES = [
  { key: "received", label: "Booking request received", body: "Hi {name}! Thank you for your booking request for {service}. I've received it and will get back to you shortly to confirm the details. — Tania Madi Photography" },
  { key: "quote", label: "Quotation sent", body: "Hi {name}, here's the quote for your {service} session: {price}. Let me know if you'd like to go ahead and I'll reserve your date 😊" },
  { key: "confirmed", label: "Date confirmed", body: "Great news {name}! Your {service} session on {date} is confirmed. Looking forward to it ✨" },
  { key: "deposit_required", label: "Deposit required", body: "Hi {name}, to lock in your {service} date on {date}, a deposit of {deposit} is required (Whish or cash). Thank you!" },
  { key: "deposit_received", label: "Deposit received", body: "Thank you {name}! I've received your deposit of {deposit}. Your {service} session on {date} is now secured 💛" },
  { key: "reminder", label: "Booking reminder", body: "Hi {name}! A little reminder about your {service} session on {date}{time}. Can't wait! Let me know if you have any questions." },
  { key: "rescheduled", label: "Booking rescheduled", body: "Hi {name}, your {service} session has been rescheduled to {date}{time}. See you then!" },
  { key: "cancelled", label: "Booking cancelled", body: "Hi {name}, your {service} booking has been cancelled. If this was a mistake or you'd like to rebook, just let me know." },
  { key: "photos_ready", label: "Photos ready (preview)", body: "Hi {name}! Your photos from the {service} session are ready to preview — I'll send the gallery link shortly 📸" },
  { key: "delivered", label: "Final files delivered", body: "Hi {name}, your final edited photos from {service} are ready and delivered! Thank you for trusting me with your memories 💛" },
];
app.get("/api/admin/templates", requireAdmin, async (_req, res) => {
  let rows = await prisma.messageTemplate.findMany({ orderBy: { sortOrder: "asc" } });
  if (rows.length === 0) { await prisma.messageTemplate.createMany({ data: DEFAULT_TEMPLATES.map((t, i) => ({ ...t, sortOrder: i })) }); rows = await prisma.messageTemplate.findMany({ orderBy: { sortOrder: "asc" } }); }
  res.json(rows);
});
app.put("/api/admin/templates/:id", requireAdmin, async (req, res) => res.json(await prisma.messageTemplate.update({ where: { id: Number(req.params.id) }, data: { label: String(req.body?.label || ""), body: String(req.body?.body || "") } })));
app.post("/api/admin/templates", requireAdmin, async (req, res) => { const max = await prisma.messageTemplate.aggregate({ _max: { sortOrder: true } }); res.json(await prisma.messageTemplate.create({ data: { key: "custom_" + Date.now(), label: String(req.body?.label || "New template"), body: String(req.body?.body || ""), sortOrder: (max._max.sortOrder ?? 0) + 1 } })); });
app.delete("/api/admin/templates/:id", requireAdmin, async (req, res) => { await prisma.messageTemplate.delete({ where: { id: Number(req.params.id) } }); res.json({ ok: true }); });

// ---------- in-admin notifications ----------
app.get("/api/admin/notifications", requireAdmin, async (_req, res) => {
  const seen = String((await prisma.setting.findUnique({ where: { key: "_notifSeen" } }))?.value || "1970-01-01T00:00:00Z");
  const since = new Date(seen);
  const [bc, oc, ec, bookings, orders, editing] = await Promise.all([
    prisma.booking.count({ where: { createdAt: { gt: since } } }),
    prisma.order.count({ where: { createdAt: { gt: since } } }),
    prisma.editingRequest.count({ where: { createdAt: { gt: since } } }),
    prisma.booking.findMany({ orderBy: { createdAt: "desc" }, take: 15 }),
    prisma.order.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.editingRequest.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
  ]);
  const items = [
    ...bookings.map((b) => ({ type: "booking", id: b.id, title: `Booking · ${b.customerName}`, sub: b.serviceName || "", at: b.createdAt, isNew: b.createdAt > since })),
    ...orders.map((o) => ({ type: "order", id: o.id, title: `Order · ${o.customerName}`, sub: o.reference, at: o.createdAt, isNew: o.createdAt > since })),
    ...editing.map((e) => ({ type: "editing", id: e.id, title: `Editing · ${e.customerName}`, sub: e.serviceName || "", at: e.createdAt, isNew: e.createdAt > since })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 20);
  res.json({ count: bc + oc + ec, items, seenAt: seen });
});
app.post("/api/admin/notifications/seen", requireAdmin, async (_req, res) => {
  const now = new Date().toISOString();
  await prisma.setting.upsert({ where: { key: "_notifSeen" }, update: { value: now }, create: { key: "_notifSeen", value: now } });
  res.json({ ok: true });
});

// media library (upload / serve / search / edit / delete)
mountMedia(app, prisma, requireAdmin);

// Last-resort error handler: return JSON 500 instead of an empty/hung response.
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[api error]", err?.message || err);
  if (!res.headersSent) res.status(500).json({ error: "Something went wrong. Please try again." });
});

app.listen(PORT, () => console.log(`Tania Madi API on http://localhost:${PORT}`));

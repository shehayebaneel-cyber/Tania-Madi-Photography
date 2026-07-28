// ─────────────────────────────────────────────────────────────────────────────
// Media library — upload, process, store, serve.
//
// Uploaded photos are processed with sharp (auto-rotate via EXIF, resize, convert
// to WebP) and stored in Postgres (full + thumbnail) so they survive Render's
// ephemeral disk. Served at /uploads/<id> and /uploads/<id>/thumb.
//
// PORTABILITY: everything that touches raw bytes lives in this file. To move to a
// Hetzner box (local disk) or R2/S3 later, change `readBytes` / `writeBytes` /
// the serving routes here — the rest of the app only ever references the
// "/uploads/<id>" URL, so nothing else has to change.
// ─────────────────────────────────────────────────────────────────────────────
import type { Express, Request, Response, NextFunction } from "express";
import type { PrismaClient } from "@prisma/client";
import multer from "multer";
import sharp from "sharp";
import { createHash, randomUUID } from "crypto";

const MAX_FULL = 2400; // longest edge for the full-size WebP
const MAX_THUMB = 480; // longest edge for the thumbnail
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024, files: 20 }, // 30MB/file, 20 files/request
});

export type ProcessedImage = {
  mime: string; ext: string; width: number; height: number; bytes: number;
  data: Buffer; thumbData: Buffer; thumbW: number; thumbH: number; hash: string;
};

// Turn any uploaded image (JPG/PNG/HEIC/WebP/screenshot…) into optimised WebP.
async function processImage(buf: Buffer): Promise<ProcessedImage> {
  const meta = await sharp(buf, { failOn: "none" }).metadata();
  if (!meta.width || !meta.height) throw new Error("Not a readable image.");
  const full = await sharp(buf, { failOn: "none" })
    .rotate() // honour EXIF orientation
    .resize({ width: MAX_FULL, height: MAX_FULL, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });
  const thumb = await sharp(buf, { failOn: "none" })
    .rotate()
    .resize({ width: MAX_THUMB, height: MAX_THUMB, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 72 })
    .toBuffer({ resolveWithObject: true });
  return {
    mime: "image/webp", ext: "webp",
    width: full.info.width, height: full.info.height, bytes: full.data.length,
    data: full.data, thumbData: thumb.data, thumbW: thumb.info.width, thumbH: thumb.info.height,
    hash: createHash("sha256").update(buf).digest("hex"),
  };
}

// Pull the media ids referenced inside any string (imageUrl, JSON blob, …).
const ID_RE = /\/uploads\/([0-9a-fA-F-]{36})/g;
function idsIn(value: unknown): string[] {
  const s = typeof value === "string" ? value : JSON.stringify(value ?? "");
  const out: string[] = [];
  for (const m of s.matchAll(ID_RE)) out.push(m[1]);
  return out;
}

// Scan everywhere media can be referenced → { mediaId: [ "Portfolio: Title", … ] }.
async function buildUsageMap(prisma: PrismaClient): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  const add = (id: string, where: string) => { const a = map.get(id) ?? []; a.push(where); map.set(id, a); };
  const [portfolio, products, settings] = await Promise.all([
    prisma.portfolioItem.findMany({ select: { imageUrl: true, title: true, category: true } }),
    prisma.product.findMany({ select: { images: true, name: true } }),
    prisma.setting.findMany(),
  ]);
  for (const p of portfolio) for (const id of idsIn(p.imageUrl)) add(id, `Portfolio · ${p.title || p.category}`);
  for (const p of products) for (const id of idsIn(p.images)) add(id, `Product · ${p.name}`);
  for (const s of settings) for (const id of idsIn(s.value)) add(id, `Content · ${s.key}`);
  return map;
}

const metaSelect = {
  id: true, mime: true, ext: true, width: true, height: true, bytes: true,
  thumbW: true, thumbH: true, hash: true, originalName: true, title: true,
  alt: true, caption: true, category: true, focalX: true, focalY: true,
  isArchived: true, createdAt: true, updatedAt: true,
} as const;

export function mountMedia(app: Express, prisma: PrismaClient, requireAdmin: (req: Request, res: Response, next: NextFunction) => void) {
  // ---- public serving (no auth; images are referenced by <img> from the web) ----
  const sendMedia = (buf: Buffer | null, res: Response) => {
    if (!buf) return res.status(404).end();
    res.setHeader("Content-Type", "image/webp");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.end(buf);
  };
  app.get("/uploads/:id/thumb", async (req, res) => {
    const m = await prisma.media.findUnique({ where: { id: req.params.id }, select: { thumbData: true, data: true } });
    sendMedia(m ? Buffer.from(m.thumbData ?? m.data) : null, res);
  });
  app.get("/uploads/:id", async (req, res) => {
    const m = await prisma.media.findUnique({ where: { id: req.params.id }, select: { data: true } });
    sendMedia(m ? Buffer.from(m.data) : null, res);
  });

  // ---- upload (one or many) ----
  app.post("/api/admin/media", requireAdmin, upload.array("files", 20), async (req, res) => {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (!files.length) return res.status(400).json({ error: "No image received." });
    const category = String((req.body?.category ?? "")).trim();
    const created: any[] = [];
    const duplicates: any[] = [];
    for (const f of files) {
      let img: ProcessedImage;
      try { img = await processImage(f.buffer); }
      catch { return res.status(400).json({ error: `"${f.originalname}" could not be read. Use a normal photo (JPG/PNG/WebP/HEIC).` }); }
      // de-dupe: identical bytes already uploaded → reuse it instead of storing twice
      const existing = await prisma.media.findFirst({ where: { hash: img.hash }, select: metaSelect });
      if (existing) { duplicates.push(existing); continue; }
      const row = await prisma.media.create({
        data: {
          id: randomUUID(), mime: img.mime, ext: img.ext, width: img.width, height: img.height,
          bytes: img.bytes, data: img.data, thumbData: img.thumbData, thumbW: img.thumbW, thumbH: img.thumbH,
          hash: img.hash, originalName: f.originalname.slice(0, 200), category,
          title: f.originalname.replace(/\.[a-z0-9]+$/i, "").slice(0, 120),
        },
        select: metaSelect,
      });
      created.push(row);
    }
    res.status(201).json({ created, duplicates });
  });

  // ---- library list (search + category filter + pagination + usage) ----
  app.get("/api/admin/media", requireAdmin, async (req, res) => {
    const q = String(req.query.q ?? "").trim();
    const category = String(req.query.category ?? "").trim();
    const includeArchived = req.query.includeArchived === "1";
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(60, Math.max(1, Number(req.query.pageSize) || 24));
    const where: any = {};
    if (!includeArchived) where.isArchived = false;
    if (category) where.category = category;
    if (q) where.OR = ["title", "alt", "caption", "originalName", "category"].map((f) => ({ [f]: { contains: q, mode: "insensitive" } }));
    const [total, rows, usage, categories] = await Promise.all([
      prisma.media.count({ where }),
      prisma.media.findMany({ where, select: metaSelect, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
      buildUsageMap(prisma),
      prisma.media.findMany({ where: { category: { not: "" } }, select: { category: true }, distinct: ["category"], orderBy: { category: "asc" } }),
    ]);
    const items = rows.map((r) => ({ ...r, usedIn: usage.get(r.id) ?? [], used: (usage.get(r.id) ?? []).length > 0 }));
    res.json({ items, total, page, pageSize, categories: categories.map((c) => c.category) });
  });

  // ---- single item + where it is used ----
  app.get("/api/admin/media/:id", requireAdmin, async (req, res) => {
    const m = await prisma.media.findUnique({ where: { id: req.params.id }, select: metaSelect });
    if (!m) return res.status(404).json({ error: "Not found." });
    const usage = await buildUsageMap(prisma);
    res.json({ ...m, usedIn: usage.get(m.id) ?? [] });
  });

  // ---- edit metadata (title / alt / caption / category / focal / hide) ----
  app.patch("/api/admin/media/:id", requireAdmin, async (req, res) => {
    const data: any = {};
    for (const k of ["title", "alt", "caption", "category"]) if (typeof req.body?.[k] === "string") data[k] = req.body[k].slice(0, 400);
    for (const k of ["focalX", "focalY"]) if (req.body?.[k] != null) data[k] = Math.min(1, Math.max(0, Number(req.body[k])));
    if (typeof req.body?.isArchived === "boolean") data.isArchived = req.body.isArchived;
    const m = await prisma.media.update({ where: { id: req.params.id }, data, select: metaSelect });
    res.json(m);
  });

  // ---- delete (blocks if still in use unless ?force=1) ----
  app.delete("/api/admin/media/:id", requireAdmin, async (req, res) => {
    const usage = await buildUsageMap(prisma);
    const usedIn = usage.get(req.params.id) ?? [];
    if (usedIn.length && req.query.force !== "1") return res.status(409).json({ error: "This image is still in use.", usedIn });
    await prisma.media.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  });
}

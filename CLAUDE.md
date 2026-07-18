# Tania Madi Photography — CLAUDE.md

## What this is
A full photography-studio platform for **Tania Madi Photography** (Aley, Lebanon;
IG [@taniamadi_photography](https://instagram.com/taniamadi_photography)). Four connected
sections sharing one customer account + one admin dashboard:
1. Portfolio (weddings, couples, maternity, newborn, birthdays, gender reveals, families, product/food, videography)
2. Photography session **booking requests**
3. **Frames & prints shop** (custom photo upload + options)
4. **Photo editing & restoration** service (upload → quote → preview → deliver)

## Stack & layout
- `web/` (Vite + React 18 + TS + Tailwind v4 + React Router) — dev port 5173
- `server/` (Express + Prisma + Neon Postgres, `tsx`) — port 4020
- Deploy: **Render** blueprint (`render.yaml`) — `tania-api` (Node) + `tania-web` (static)
- DB: Neon Postgres (us-east-1)

## Commands
- Dev: `cd server && npm run dev` + `cd web && npm run dev`
- Typecheck: `npx tsc --noEmit` in both
- DB: `cd server && npx prisma db push` then `npm run db:seed`
- NOTE: this machine blocks npm postinstall — after `npm install` run `npx prisma generate`
  (server) and approve/run esbuild (web) manually.

## Brand
- Voice: warm, personal, emotional — not corporate.
- Palette: **soft & romantic** — cream `--paper`, blush panels, warm taupe, mauve `--ink`
  for text, dusty-rose `--gold` accent. Elegant **serif headings** (Georgia), clean sans body.
  Light + dark both defined in `web/src/index.css`. Colours may be revisited — the client
  approved "soft & romantic"; do NOT reintroduce the beige/gold or "too blue" looks.
- Do NOT make it extremely dark; maternity/newborn/family should feel bright.
- Imagery is **tone placeholders** (`Tone` component, `g-*` classes) until real photos arrive.

## Domain rules
- Bookings are **requests**, never auto-confirmed. Statuses: NEW → CONTACTED → QUOTED →
  AWAITING_DEPOSIT → CONFIRMED → COMPLETED / CANCELLED / DECLINED / RESCHEDULE.
- Editing requests: NEW → REVIEW → QUOTED → … → PREVIEW → REVISION → DELIVERED.
- Product orders: cash / pickup / COD / Whish. No online card payment yet.
- Uploaded customer photos must NEVER be public or added to the portfolio; portfolio items
  need `hasConsent`. Real file-storage upload (R2/S3) is a later phase — current upload
  fields capture filenames/intent only; binaries are not yet persisted server-side.
- Admin auth = JWT httpOnly cookie `tm_admin`; customer = `tm_customer`. In production both
  are SameSite=None; Secure (web & API are separate origins).

## Secrets (Render dashboard; never committed)
- `DATABASE_URL`, `DIRECT_URL` (Neon pooled + direct), `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `JWT_SECRET` (auto)
- `⚠️` Neon password was shared in plaintext during setup — rotate it.

## Status / phased plan
- [x] Phase 1: all pages built + working — Home, Services + detail, Portfolio (filter + swipe
      lightbox), Book (multi-step), Frames shop + Product (options + upload preview), Editing
      request, Cart, Checkout (COD/Whish), Confirm, Account (auth + dashboard), About, Contact,
      Admin (dashboard, bookings, orders, editing, portfolio add/delete, products list). On Neon.
- [ ] First deploy to Render (needs dashboard secrets). Admin seeded taniamadi.photography@gmail.com / ChangeMe123! — change after launch.
- [ ] Real photo/file uploads to storage (R2) — portfolio, product photos, editing files, watermarked previews
- [ ] Phase 2 next (client's pick): deepen **Frames & prints shop** — full product add/edit form, variants, crop preview, discount codes
- [ ] Later: packages editor, private client galleries + secure downloads, online card payment, SEO/analytics, policies pages
- [ ] Confirm before publishing: phone number, exact studio address + map pin, logo files

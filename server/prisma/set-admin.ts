// Apply the ADMIN_EMAIL / ADMIN_PASSWORD env vars to the database.
//
// Why this exists: the admin account is a DB row created once by the seed.
// Changing ADMIN_EMAIL / ADMIN_PASSWORD (locally or on Render) does NOT update
// that row — the env vars are only read when a row is first created. Run this
// script whenever you change those vars and want the login to actually change.
//
// Usage (from server/):  npm run set-admin
//   Reads DATABASE_URL + ADMIN_EMAIL + ADMIN_PASSWORD from server/.env.
//   Point DATABASE_URL at the database you want to fix (prod Neon here).
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

const email = String(process.env.ADMIN_EMAIL || "").toLowerCase().trim();
const password = String(process.env.ADMIN_PASSWORD || "");

if (!email || !password) {
  console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD in server/.env first.");
  process.exit(1);
}

const passwordHash = await bcrypt.hash(password, 10);

// Make the intended email the one and only admin login.
await db.adminUser.upsert({
  where: { email },
  update: { passwordHash, name: "Tania Madi" },
  create: { email, passwordHash, name: "Tania Madi" },
});
// Remove any other admin rows so old credentials stop working.
const removed = await db.adminUser.deleteMany({ where: { email: { not: email } } });

const all = await db.adminUser.findMany({ select: { email: true } });
console.log(`Admin login is now: ${email}`);
if (removed.count) console.log(`Removed ${removed.count} old admin account(s).`);
console.log("Admins in DB:", all.map((a) => a.email).join(", "));

await db.$disconnect();

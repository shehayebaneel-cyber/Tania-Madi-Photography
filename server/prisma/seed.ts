import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import "dotenv/config";

const prisma = new PrismaClient();

const SERVICES = [
  { slug: "weddings", name: "Weddings", tone: "g-wed", tagline: "Your whole day, beautifully remembered.",
    description: "From the quiet moments of preparation to the last dance — full wedding coverage, engagement sessions, albums and optional videography.",
    includes: ["Preparation & getting-ready", "Couple portraits", "Ceremony & reception", "High-resolution edited gallery", "Optional album & video"],
    durationText: "6–12 hours", locationText: "On location", startingPrice: null,
    faqs: [{ q: "Do you offer videography too?", a: "Yes — photography and videography can be booked together as a package." }, { q: "How far in advance should we book?", a: "Popular dates fill months ahead; earlier is better." }], sortOrder: 1 },
  { slug: "couples", name: "Couples", tone: "g-couple", tagline: "Engagements, anniversaries & proposals.",
    description: "Relaxed, natural sessions for couples — engagements, anniversaries, proposals and just-because portraits, in studio or outdoors.",
    includes: ["60–90 min session", "Studio or outdoor", "Edited high-res gallery", "Outfit change"], durationText: "60–90 min", locationText: "Studio or outdoor", startingPrice: null, faqs: [], sortOrder: 2 },
  { slug: "maternity", name: "Maternity", tone: "g-mat", tagline: "The glow before the arrival.",
    description: "Elegant maternity sessions in studio or outdoors, with gowns available and space for partner and family to join.",
    includes: ["Studio or outdoor", "Gowns available", "Partner & family welcome", "Edited high-res gallery"], durationText: "60–90 min", locationText: "Studio or outdoor", startingPrice: null, faqs: [{ q: "When should I book my maternity session?", a: "Usually between 30–36 weeks, when the bump is beautifully round." }], sortOrder: 3 },
  { slug: "newborn", name: "Newborn", tone: "g-newborn", tagline: "Those tiny, fleeting first days.",
    description: "Gentle, safe newborn photography with props and outfits provided. Sibling and parent photographs included on request.",
    includes: ["Props & outfits provided", "Gentle, safety-first posing", "Sibling & parent photos", "Edited high-res gallery"], durationText: "2–3 hours", locationText: "Studio", startingPrice: null, faqs: [{ q: "What's the best age for newborn photos?", a: "The first 5–14 days are ideal, while babies sleep most soundly." }, { q: "Is it safe?", a: "Absolutely — comfort and safety come before every shot." }], sortOrder: 4 },
  { slug: "first-birthdays", name: "First Birthdays", tone: "g-birthday", tagline: "Cake, smiles & happy chaos.",
    description: "Cake-smash sessions and first-birthday portraits with themed setups and decorations, plus family photographs.",
    includes: ["Cake-smash setup", "Themed decorations", "Family photographs", "Edited high-res gallery"], durationText: "60–90 min", locationText: "Studio", startingPrice: null, faqs: [], sortOrder: 5 },
  { slug: "gender-reveals", name: "Gender Reveals", tone: "g-gender", tagline: "Capture the happy surprise.",
    description: "Studio or event photography for gender reveals, with optional videography to relive the moment.",
    includes: ["Studio or event coverage", "Optional videography", "Edited high-res gallery"], durationText: "1–2 hours", locationText: "Studio or event", startingPrice: null, faqs: [], sortOrder: 6 },
  { slug: "family", name: "Family", tone: "g-family", tagline: "Everyone you love, in one frame.",
    description: "Warm family portraits in studio or outdoors — for growing families, reunions and generations together.",
    includes: ["Studio or outdoor", "All ages welcome", "Edited high-res gallery"], durationText: "60–90 min", locationText: "Studio or outdoor", startingPrice: null, faqs: [], sortOrder: 7 },
  { slug: "product-food", name: "Product & Food", tone: "g-food", tagline: "Content that sells.",
    description: "Professional product and food photography for restaurants, cafés, shops and brands — menus, e-commerce, advertising and social media.",
    includes: ["Studio or on-site", "Styling guidance", "Web & print-ready files", "Bulk & package pricing"], durationText: "Half or full day", locationText: "Studio or on-site", startingPrice: null, faqs: [], sortOrder: 8 },
  { slug: "videography", name: "Videography", tone: "g-video", tagline: "Motion, sound & story.",
    description: "Wedding films, event coverage, short promotional videos, reels, product videos and social-media content.",
    includes: ["Wedding & event films", "Reels & promos", "Product videos", "Edited & colour-graded"], durationText: "Varies", locationText: "On location", startingPrice: null, faqs: [], sortOrder: 9 },
];

const PACKAGES = [
  { serviceSlug: "weddings", name: "Essential", price: null, requestPricing: true, durationText: "6 hours", editedPhotos: "300+ edited", outfits: "", features: ["6 hours coverage", "300+ edited photos", "Online gallery", "1 photographer"], deposit: 0, deliveryDays: "3–4 weeks", revisions: 1, sortOrder: 1 },
  { serviceSlug: "weddings", name: "Full Day", price: null, requestPricing: true, durationText: "10 hours", editedPhotos: "600+ edited", outfits: "", features: ["10 hours coverage", "600+ edited photos", "Engagement session", "Album included", "2 photographers"], deposit: 0, deliveryDays: "4–6 weeks", revisions: 2, sortOrder: 2 },
  { serviceSlug: "newborn", name: "Newborn Studio", price: 180, requestPricing: false, durationText: "2–3 hours", editedPhotos: "20 edited", outfits: "3 setups", features: ["2–3 hour session", "Props & outfits", "20 edited photos", "Sibling & parent photos"], deposit: 50, deliveryDays: "2 weeks", revisions: 1, sortOrder: 1 },
  { serviceSlug: "maternity", name: "Maternity Studio", price: 150, requestPricing: false, durationText: "90 min", editedPhotos: "15 edited", outfits: "2 gowns", features: ["90 min session", "2 gowns included", "15 edited photos", "Partner welcome"], deposit: 40, deliveryDays: "2 weeks", revisions: 1, sortOrder: 1 },
];

const PORTFOLIO: { category: string; tone: string; title: string; featured: boolean; orientation: string }[] = [];
const CATS = [
  ["weddings", "g-wed"], ["couples", "g-couple"], ["maternity", "g-mat"], ["newborn", "g-newborn"],
  ["birthdays", "g-birthday"], ["gender-reveals", "g-gender"], ["families", "g-family"], ["products-food", "g-food"], ["videography", "g-video"],
];
CATS.forEach(([category, tone], ci) => {
  for (let i = 0; i < 6; i++) {
    PORTFOLIO.push({ category, tone, title: "", featured: ci < 6 && i === 0, orientation: i % 3 === 0 ? "portrait" : i % 3 === 1 ? "landscape" : "portrait" });
  }
});

const PRODUCT_CATEGORIES = [
  { slug: "frames", name: "Photo Frames", sortOrder: 1 },
  { slug: "premium-frames", name: "Premium Frames", sortOrder: 2 },
  { slug: "canvas", name: "Canvas Prints", sortOrder: 3 },
  { slug: "albums", name: "Photo Albums", sortOrder: 4 },
  { slug: "prints", name: "Printed Photos", sortOrder: 5 },
  { slug: "gifts", name: "Personalized Gifts", sortOrder: 6 },
];

const PRODUCTS = [
  { cat: "frames", name: "Classic Wood Frame", tone: "g-family", price: 25, material: "Solid wood", mount: "both", glass: true, sizes: [{ label: "A5", priceDelta: 0 }, { label: "A4", priceDelta: 8 }, { label: "A3", priceDelta: 18 }], colors: ["Natural", "Walnut", "Black", "White"], stock: 40, featured: true },
  { cat: "premium-frames", name: "Gilded Ornate Frame", tone: "g-wed", price: 65, material: "Resin, gold leaf", mount: "wall", glass: true, sizes: [{ label: "A4", priceDelta: 0 }, { label: "A3", priceDelta: 25 }], colors: ["Antique gold", "Champagne"], stock: 15, featured: true },
  { cat: "canvas", name: "Gallery Canvas Print", tone: "g-couple", price: 45, material: "Cotton canvas", mount: "wall", glass: false, sizes: [{ label: "30×40cm", priceDelta: 0 }, { label: "50×70cm", priceDelta: 30 }, { label: "70×100cm", priceDelta: 70 }], colors: [], orientation: "any", stock: 0, madeToOrder: true, prepTime: "3–5 days", featured: true },
  { cat: "albums", name: "Layflat Wedding Album", tone: "g-wed", price: 180, material: "Linen cover, layflat pages", mount: "", glass: false, sizes: [{ label: "20 pages", priceDelta: 0 }, { label: "30 pages", priceDelta: 60 }, { label: "40 pages", priceDelta: 120 }], colors: ["Ivory", "Blush", "Charcoal"], stock: 0, madeToOrder: true, prepTime: "1–2 weeks", featured: true },
  { cat: "albums", name: "Baby's First Year Album", tone: "g-newborn", price: 95, material: "Soft-touch cover", mount: "", glass: false, sizes: [{ label: "20 pages", priceDelta: 0 }, { label: "30 pages", priceDelta: 40 }], colors: ["Cream", "Powder pink", "Sky"], stock: 0, madeToOrder: true, prepTime: "1–2 weeks", featured: false },
  { cat: "prints", name: "Fine-Art Print", tone: "g-mat", price: 12, material: "Fine-art matte paper", mount: "", glass: false, sizes: [{ label: "A5", priceDelta: 0 }, { label: "A4", priceDelta: 6 }, { label: "A3", priceDelta: 16 }], colors: [], orientation: "any", stock: 100, featured: false },
  { cat: "frames", name: "Tabletop Duo Frame", tone: "g-birthday", price: 32, material: "MDF, glass", mount: "tabletop", glass: true, sizes: [{ label: "2×A6", priceDelta: 0 }, { label: "2×A5", priceDelta: 10 }], colors: ["White", "Blush", "Grey"], stock: 24, featured: true },
  { cat: "gifts", name: "Photo Keepsake Box", tone: "g-gender", price: 40, material: "Wood, engraved lid", mount: "", glass: false, sizes: [{ label: "Standard", priceDelta: 0 }], colors: ["Natural", "White"], stock: 18, featured: false },
];

const EDITING_SERVICES = [
  { slug: "color-correction", name: "Colour correction", pricingType: "FIXED", price: 5, sortOrder: 1, description: "Balanced colour, exposure and tone." },
  { slug: "skin-retouching", name: "Skin & beauty retouching", pricingType: "STARTING", price: 8, sortOrder: 2, description: "Natural skin smoothing and blemish removal." },
  { slug: "background-removal", name: "Background removal / replacement", pricingType: "COMPLEXITY", price: null, sortOrder: 3, description: "Remove or replace the background cleanly." },
  { slug: "object-removal", name: "Object / person removal", pricingType: "QUOTE", price: null, sortOrder: 4, description: "Remove unwanted objects or people." },
  { slug: "restoration", name: "Old photo restoration", pricingType: "QUOTE", price: null, sortOrder: 5, description: "Repair scratches, damage and fading." },
  { slug: "colorization", name: "Black & white colourization", pricingType: "COMPLEXITY", price: null, sortOrder: 6, description: "Bring old black-and-white photos to life in colour." },
  { slug: "product-editing", name: "Product photo editing", pricingType: "STARTING", price: 6, sortOrder: 7, description: "Clean, consistent product images for shops." },
  { slug: "passport", name: "Passport / profile photo", pricingType: "FIXED", price: 4, sortOrder: 8, description: "Correctly sized, compliant photos." },
];

const TESTIMONIALS = [
  { name: "Rita & Elie", sessionType: "Wedding", text: "Tania made our wedding day feel effortless. The photos are beyond anything we imagined — we cry every time we look at them.", tone: "g-couple", sortOrder: 1 },
  { name: "Maya K.", sessionType: "Newborn", text: "So gentle and patient with our newborn. She waited for every little moment and captured our family perfectly.", tone: "g-newborn", sortOrder: 2 },
  { name: "Georges N.", sessionType: "Photo restoration", text: "Restored my grandmother's old photo that was torn and faded. Seeing it again brought my mother to tears. Thank you.", tone: "g-family", sortOrder: 3 },
];

const SETTINGS: Record<string, unknown> = {
  contact: {
    phone: "", whatsapp: "", email: "taniamadi.photography@gmail.com",
    instagram: "taniamadi_photography", instagramUrl: "https://instagram.com/taniamadi_photography",
    address: "3rd floor, Adico Building, Piscine Street, Aley, Lebanon",
    hours: "By appointment · Mon–Sat", mapUrl: "",
  },
  home: {
    heroTitle: "Turning life's most beautiful moments into memories",
    heroSubtitle: "Weddings, couples, maternity, newborn, family, birthdays, commercial photography & videography in Aley, Lebanon.",
    aboutTitle: "Hello, I'm Tania",
    aboutBody: "For years I've had the privilege of standing beside families in Aley and across Lebanon on their most meaningful days. My style is warm, natural and unhurried — I photograph the real moments between the posed ones.",
  },
};

async function main() {
  console.log("Seeding Tania Madi Photography…");

  for (const [key, value] of Object.entries(SETTINGS))
    await prisma.setting.upsert({ where: { key }, update: { value: value as object }, create: { key, value: value as object } });

  for (const s of SERVICES)
    await prisma.service.upsert({
      where: { slug: s.slug },
      update: { name: s.name, tagline: s.tagline, description: s.description, includes: s.includes, durationText: s.durationText, locationText: s.locationText, startingPrice: s.startingPrice, faqs: s.faqs, heroTone: s.tone, sortOrder: s.sortOrder },
      create: { slug: s.slug, name: s.name, tagline: s.tagline, description: s.description, includes: s.includes, durationText: s.durationText, locationText: s.locationText, startingPrice: s.startingPrice, faqs: s.faqs, heroTone: s.tone, sortOrder: s.sortOrder },
    });
  console.log(`  ${SERVICES.length} services`);

  await prisma.package.deleteMany();
  for (const p of PACKAGES)
    await prisma.package.create({ data: { serviceSlug: p.serviceSlug, name: p.name, price: p.price, requestPricing: p.requestPricing, durationText: p.durationText, editedPhotos: p.editedPhotos, outfits: p.outfits, features: p.features, deposit: p.deposit, deliveryDays: p.deliveryDays, revisions: p.revisions, sortOrder: p.sortOrder } });
  console.log(`  ${PACKAGES.length} packages`);

  if ((await prisma.portfolioItem.count()) === 0) {
    let i = 0;
    for (const p of PORTFOLIO) { await prisma.portfolioItem.create({ data: { category: p.category, tone: p.tone, isFeatured: p.featured, orientation: p.orientation, sortOrder: i++ } }); }
    console.log(`  ${PORTFOLIO.length} portfolio items`);
  }

  for (const c of PRODUCT_CATEGORIES)
    await prisma.productCategory.upsert({ where: { slug: c.slug }, update: { name: c.name, sortOrder: c.sortOrder }, create: c });

  await prisma.product.deleteMany();
  let pi = 0;
  for (const p of PRODUCTS)
    await prisma.product.create({ data: { categorySlug: p.cat, name: p.name, tone: p.tone, price: p.price, material: p.material, mount: p.mount, glassOption: p.glass, sizes: p.sizes, colors: p.colors ?? [], orientation: (p as { orientation?: string }).orientation ?? "any", stock: p.stock, madeToOrder: (p as { madeToOrder?: boolean }).madeToOrder ?? false, prepTime: (p as { prepTime?: string }).prepTime ?? "", isFeatured: p.featured, sortOrder: pi++ } });
  console.log(`  ${PRODUCTS.length} products`);

  for (const e of EDITING_SERVICES)
    await prisma.editingService.upsert({ where: { slug: e.slug }, update: { name: e.name, description: e.description, pricingType: e.pricingType, price: e.price, sortOrder: e.sortOrder }, create: e });
  console.log(`  ${EDITING_SERVICES.length} editing services`);

  await prisma.testimonial.deleteMany();
  for (const t of TESTIMONIALS) await prisma.testimonial.create({ data: t });
  console.log(`  ${TESTIMONIALS.length} testimonials`);

  const email = process.env.ADMIN_EMAIL || "admin@example.com";
  const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD || "ChangeMe123!", 10);
  await prisma.adminUser.upsert({ where: { email }, update: {}, create: { email, passwordHash, name: "Tania Madi" } });
  console.log(`  Admin: ${email}`);
  console.log("Done.");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());

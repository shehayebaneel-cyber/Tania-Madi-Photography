import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, type Settings } from "./api";

interface Contact {
  phone: string; whatsapp: string; email: string; instagram: string; instagramUrl: string;
  address: string; hours: string; mapUrl: string;
}
interface Site {
  contact: Contact; home: Record<string, string>; promo: Record<string, any>;
  policies: string; bookingInfo: string;
  waLink: string; telLink: string; preview: boolean;
}
const FALLBACK: Contact = {
  phone: "+961 71 547 939", whatsapp: "+961 71 547 939", email: "tania.w.m@outlook.com",
  instagram: "taniamadi_photography", instagramUrl: "https://instagram.com/taniamadi_photography",
  address: "3rd floor, Adico Building, Piscine Street, Aley, Lebanon", hours: "By appointment · Mon–Sat", mapUrl: "",
};
const Ctx = createContext<Site>({ contact: FALLBACK, home: {}, promo: {}, policies: "", bookingInfo: "", waLink: "#", telLink: "#", preview: false });

export function SiteProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>({});
  const preview = typeof location !== "undefined" && new URLSearchParams(location.search).get("preview") === "1";
  useEffect(() => {
    // in preview mode (admin) show unpublished drafts; otherwise the live published content
    (preview ? api.settingsPreview().catch(() => api.settings()) : api.settings()).then(setSettings).catch(() => {});
  }, [preview]);
  const contact: Contact = { ...FALLBACK, ...(settings.contact || {}) };
  // Normalise to an international WhatsApp number: drop 00 prefix, add Lebanon 961 if local.
  let d = (contact.whatsapp || contact.phone || "").replace(/[^0-9]/g, "").replace(/^00/, "");
  if (d && !d.startsWith("961")) d = "961" + d.replace(/^0/, "");
  const waLink = d ? `https://wa.me/${d}` : "https://instagram.com/taniamadi_photography";
  const telLink = contact.phone ? `tel:${contact.phone.replace(/\s/g, "")}` : "#";
  const policies = (settings.policies?.text || "").trim();
  const bookingInfo = (settings.bookingInfo?.text || "").trim();
  return <Ctx.Provider value={{ contact, home: settings.home || {}, promo: settings.promo || {}, policies, bookingInfo, waLink, telLink, preview }}>{children}</Ctx.Provider>;
}
export function useSite() { return useContext(Ctx); }

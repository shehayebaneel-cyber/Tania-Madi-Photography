import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, type Settings } from "./api";

interface Contact {
  phone: string; whatsapp: string; email: string; instagram: string; instagramUrl: string;
  address: string; hours: string; mapUrl: string;
}
interface Site {
  contact: Contact; home: Record<string, string>;
  waLink: string; telLink: string;
}
const FALLBACK: Contact = {
  phone: "", whatsapp: "", email: "taniamadi.photography@gmail.com",
  instagram: "taniamadi_photography", instagramUrl: "https://instagram.com/taniamadi_photography",
  address: "3rd floor, Adico Building, Piscine Street, Aley, Lebanon", hours: "By appointment · Mon–Sat", mapUrl: "",
};
const Ctx = createContext<Site>({ contact: FALLBACK, home: {}, waLink: "#", telLink: "#" });

export function SiteProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>({});
  useEffect(() => { api.settings().then(setSettings).catch(() => {}); }, []);
  const contact: Contact = { ...FALLBACK, ...(settings.contact || {}) };
  const digits = (contact.whatsapp || contact.phone || "").replace(/[^0-9]/g, "");
  const waLink = digits ? `https://wa.me/${digits.startsWith("961") ? digits : "961" + digits.replace(/^0/, "")}` : "https://instagram.com/taniamadi_photography";
  const telLink = contact.phone ? `tel:${contact.phone.replace(/\s/g, "")}` : "#";
  return <Ctx.Provider value={{ contact, home: settings.home || {}, waLink, telLink }}>{children}</Ctx.Provider>;
}
export function useSite() { return useContext(Ctx); }

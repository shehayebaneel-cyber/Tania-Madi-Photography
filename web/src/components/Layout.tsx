import { useState, type ReactNode } from "react";
import { Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useCart } from "../lib/cart";
import { useSite } from "../lib/site";
import { Logo } from "./Art";

const NAV = [
  { to: "/services", label: "Services" },
  { to: "/portfolio", label: "Portfolio" },
  { to: "/book", label: "Book" },
  { to: "/frames", label: "Frames & Prints" },
  { to: "/editing", label: "Editing" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
];

function Header() {
  const { count } = useCart();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  return (
    <header className="site">
      <div className="wrap bar">
        <div onClick={() => nav("/")} style={{ cursor: "pointer" }}><Logo /></div>
        <nav className="main">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => (isActive ? "on" : "")}>{n.label}</NavLink>
          ))}
        </nav>
        <div className="head-cta">
          <button className="iconbtn" onClick={() => nav("/account")} aria-label="My account">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg>
          </button>
          <button className="iconbtn" onClick={() => nav("/cart")} aria-label="Cart">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><path d="M3 6h18M16 10a4 4 0 0 1-8 0" /></svg>
            {count > 0 && <span className="cart-count">{count}</span>}
          </button>
          <Link className="btn btn-dark" to="/book">Book a Session</Link>
          <button className="iconbtn menu" onClick={() => setOpen((v) => !v)} aria-label="Menu">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">{open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}</svg>
          </button>
        </div>
      </div>
      <div className={`mnav ${open ? "open" : ""}`} onClick={() => setOpen(false)}>
        {NAV.map((n) => <Link key={n.to} to={n.to}>{n.label}</Link>)}
        <Link to="/account">My Account</Link>
        <Link to="/book" style={{ color: "var(--gold)" }}>Book a Session →</Link>
      </div>
    </header>
  );
}

function Footer() {
  const { contact } = useSite();
  return (
    <footer className="site">
      <div className="wrap">
        <div className="foot-grid">
          <div>
            <Logo light />
            <p className="fnote">Weddings, family &amp; commercial photography and videography in Aley, Lebanon.</p>
          </div>
          <div>
            <h4>Explore</h4>
            <ul>
              <li><Link to="/services">Services</Link></li>
              <li><Link to="/portfolio">Portfolio</Link></li>
              <li><Link to="/book">Book a Session</Link></li>
              <li><Link to="/about">About</Link></li>
            </ul>
          </div>
          <div>
            <h4>Shop &amp; Studio</h4>
            <ul>
              <li><Link to="/frames">Frames &amp; Prints</Link></li>
              <li><Link to="/editing">Photo Editing</Link></li>
              <li><Link to="/account">My Account</Link></li>
              <li><Link to="/cart">Cart</Link></li>
            </ul>
          </div>
          <div>
            <h4>Contact</h4>
            <ul>
              <li><a href={contact.instagramUrl}>@{contact.instagram}</a></li>
              {contact.phone && <li><a href={`tel:${contact.phone}`}>{contact.phone}</a></li>}
              <li><a href={`mailto:${contact.email}`}>{contact.email}</a></li>
              <li>{contact.address}</li>
            </ul>
          </div>
        </div>
        <div className="foot-bottom">
          <span>© 2026 Tania Madi Photography</span>
          <Link to="/admin/login" style={{ opacity: .7 }}>Studio login</Link>
        </div>
      </div>
    </footer>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const loc = useLocation();
  const nav = useNavigate();
  const { waLink } = useSite();
  if (loc.pathname.startsWith("/admin")) return <>{children}</>;
  return (
    <>
      <Header />
      <main>{children}</main>
      <Footer />
      <a className="float-wa" href={waLink} aria-label="WhatsApp">
        <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2zm0 2a8 8 0 1 1-4.2 14.8l-.3-.2-2.8.8.8-2.7-.2-.3A8 8 0 0 1 12 4zm-2.7 4.3c-.2 0-.5.1-.7.4-.3.3-1 .9-1 2.2s1 2.6 1.2 2.8c.1.2 1.9 3 4.7 4.1 2.3.9 2.8.7 3.3.7.5 0 1.6-.7 1.9-1.3.2-.7.2-1.2.1-1.3-.1-.1-.3-.2-.6-.4-.3-.1-1.6-.8-1.9-.9-.2-.1-.4-.1-.6.1-.2.3-.6.9-.8 1-.1.2-.3.2-.5.1-.3-.1-1.1-.4-2.1-1.3-.8-.7-1.3-1.5-1.5-1.8-.1-.3 0-.4.1-.5l.4-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5 0-.1-.6-1.5-.8-2-.2-.5-.4-.4-.6-.4z" /></svg>
      </a>
      <div className="mobile-book">
        <button className="btn btn-dark" style={{ flex: 2 }} onClick={() => nav("/book")}>Book a Session</button>
        <a className="btn btn-wa" style={{ flex: 1 }} href={waLink}>WhatsApp</a>
      </div>
    </>
  );
}

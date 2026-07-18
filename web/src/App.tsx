import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Services from "./pages/Services";
import ServiceDetail from "./pages/ServiceDetail";
import Portfolio from "./pages/Portfolio";
import Book from "./pages/Book";
import Frames from "./pages/Frames";
import Product from "./pages/Product";
import Editing from "./pages/Editing";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import Confirm from "./pages/Confirm";
import Account from "./pages/Account";
import About from "./pages/About";
import Contact from "./pages/Contact";
import AdminLogin from "./pages/AdminLogin";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/services" element={<Services />} />
        <Route path="/services/:slug" element={<ServiceDetail />} />
        <Route path="/portfolio" element={<Portfolio />} />
        <Route path="/book" element={<Book />} />
        <Route path="/frames" element={<Frames />} />
        <Route path="/frames/:cat" element={<Frames />} />
        <Route path="/product/:id" element={<Product />} />
        <Route path="/editing" element={<Editing />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/confirm/:kind/:ref" element={<Confirm />} />
        <Route path="/account" element={<Account />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { CartProvider } from "./lib/cart";
import { SiteProvider } from "./lib/site";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <SiteProvider>
        <CartProvider>
          <App />
        </CartProvider>
      </SiteProvider>
    </BrowserRouter>
  </React.StrictMode>
);

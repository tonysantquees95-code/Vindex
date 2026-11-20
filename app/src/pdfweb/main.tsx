import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PdfWeb } from "./PdfWeb";
import "./web.css";

createRoot(document.getElementById("raiz")!).render(<StrictMode><PdfWeb /></StrictMode>);

// Instalável e funciona sem internet depois da primeira visita.
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => { void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined); });
}

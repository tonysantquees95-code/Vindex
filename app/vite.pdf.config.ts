import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// Vindex PDF na web (e também o que o app Vindex PDF empacota). PDF_BASE = onde fica publicado ("/pdf/" no site; "./" dentro dos apps).
export default defineConfig({
  base: process.env.PDF_BASE ?? "/pdf/",
  plugins: [react(), tailwindcss()],
  publicDir: "public-pdf",
  build: {
    outDir: "dist-pdf", emptyOutDir: true, target: "es2020", sourcemap: false,
    rollupOptions: { input: { index: "pdf-web.html" }, output: { assetFileNames: (a) => (String(a.names?.[0] ?? a.name ?? "").endsWith(".mjs") ? "assets/[name]-[hash].js" : "assets/[name]-[hash][extname]") } }
  },
  server: { port: 5178, strictPort: true, host: true }
});

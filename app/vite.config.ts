import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "dist", target: "es2020",
    // o worker do leitor de PDF sai como .js: alguns servidores locais (Android) não conhecem o tipo de arquivo .mjs
    rollupOptions: { output: { assetFileNames: (a) => (String(a.names?.[0] ?? a.name ?? "").endsWith(".mjs") ? "assets/[name]-[hash].js" : "assets/[name]-[hash][extname]") } }
  },
  server: { port: 5177, strictPort: true, host: true }
});

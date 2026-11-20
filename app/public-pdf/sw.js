// Deixa o Vindex PDF abrir sem internet depois da primeira visita: guarda os arquivos do próprio site.
const VERSAO = "vindex-pdf-v1";
self.addEventListener("install", (e) => { self.skipWaiting(); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSAO).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const r = e.request;
  if (r.method !== "GET" || new URL(r.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(r).then((resp) => { if (resp.ok) { const c = resp.clone(); void caches.open(VERSAO).then((cache) => cache.put(r, c)); } return resp; })
      .catch(() => caches.match(r).then((x) => x || caches.match(new URL("./", self.location).href)))
  );
});

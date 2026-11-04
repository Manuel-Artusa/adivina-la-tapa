// Juegos Rock: permite instalar la página como app.
// Siempre busca primero la versión nueva en internet; si no hay conexión, usa la guardada.
// Las páginas y los .json se piden "sin memoria" (el navegador pregunta si cambiaron), así un juego nuevo
// o frases nuevas se ven apenas se publican, también en la app instalada.
// v3: al activarse borra las copias guardadas de versiones anteriores (podían mostrar una página vieja)
const CACHE = "juegos-rock-v3";
self.addEventListener("install", e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(["./", "icon-192.png"]).catch(() => {})));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return; // Supabase, iTunes y demás van directo
  let pedido;
  if (req.mode === "navigate") {
    // redirect "manual": si Render redirige (por ejemplo, a la dirección con "/" al final), lo sigue el navegador
    pedido = fetch(req.url, { cache: "no-store", redirect: "manual", credentials: "same-origin" });
  } else if (/\.(json|html)$/.test(url.pathname)) {
    pedido = fetch(new Request(req, { cache: "no-store" }));
  } else {
    pedido = fetch(req);
  }
  e.respondWith(
    pedido.then(r => {
      if (r.ok) { const copia = r.clone(); caches.open(CACHE).then(c => c.put(req, copia)); }
      return r;
    }).catch(() => caches.match(req).then(r => r || caches.match("./")))
  );
});

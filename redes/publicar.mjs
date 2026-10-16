// Publica en Instagram lo del día. Lo corre la tarea de GitHub "Publicar en Instagram" (.github/workflows/redes.yml).
// 1) sirve el sitio armado (carpeta public/) en esta máquina y abre el generador de contenido con Chromium
// 2) guarda las imágenes y los textos en redes/salida/<día>/ (quedan para descargar en la tarea)
// 3) si no es prueba: las sube a Supabase Storage (bucket público "redes") y las publica con la API de Instagram
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const PUBLIC = path.join(RAIZ, "public");
const env = process.env;
const hoyAR = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
const DIA = env.DIA && /^\d{4}-\d{2}-\d{2}$/.test(env.DIA) ? env.DIA : hoyAR();
const TURNO = ["manana", "tarde", "todo"].includes(env.TURNO) ? env.TURNO : "manana";
const SUPA = (env.SUPA_URL || "").replace(/\/+$/, "");
const SERVICIO = env.SUPABASE_SERVICE_KEY || "";
const PRUEBA = env.PRUEBA === "true" || !SUPA || !SERVICIO;
const IG = "https://graph.instagram.com/v25.0";
const SALIDA = path.join(RAIZ, "redes", "salida", DIA);
const resumen = [];
const log = (...a) => { console.log(...a); resumen.push(a.join(" ")) };

// ---------- 1) servidor del sitio ----------
const TIPOS = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json", ".css": "text/css",
  ".png": "image/png", ".jpg": "image/jpeg", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".xml": "application/xml", ".txt": "text/plain" };
function servir() {
  return new Promise(ok => {
    const s = http.createServer((req, res) => {
      let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
      if (p.endsWith("/")) p += "index.html";
      let f = path.join(PUBLIC, p);
      if (!f.startsWith(PUBLIC) || !fs.existsSync(f)) f = path.join(PUBLIC, "index.html");
      res.writeHead(200, { "Content-Type": TIPOS[path.extname(f)] || "application/octet-stream" });
      fs.createReadStream(f).pipe(res);
    }).listen(8099, () => ok(s));
  });
}

// ---------- 2) armar las piezas ----------
async function armar() {
  const srv = await servir();
  const b = await chromium.launch({ args: ["--disable-web-security"] }); // así las tapas se pueden pasar a JPG
  const pg = await b.newPage({ viewport: { width: 1080, height: 1350 } });
  pg.on("console", m => { if (m.type() === "error") console.log("  [página]", m.text()) });
  await pg.addInitScript(() => { try { localStorage.setItem("tapa-nombre", JSON.stringify("Juegos Rock")) } catch (e) {} });
  await pg.goto("http://localhost:8099/", { waitUntil: "load" });
  await pg.waitForTimeout(3000);
  const r = await pg.evaluate(([d, t]) => window.redesExportar(d, t), [DIA, TURNO]);
  await b.close(); srv.close();
  fs.mkdirSync(SALIDA, { recursive: true });
  for (const p of r.pubs) {
    p.archivos = p.imgs.map((u, i) => {
      const f = path.join(SALIDA, `${TURNO}-${p.id}${p.imgs.length > 1 ? "-" + (i + 1) : ""}.jpg`);
      fs.writeFileSync(f, Buffer.from(u.split(",")[1], "base64")); return f;
    });
    delete p.imgs;
  }
  fs.writeFileSync(path.join(SALIDA, `${TURNO}-textos.json`), JSON.stringify(r.pubs, null, 2));
  r.errores.forEach(e => log("⚠️ No se pudo armar", e));
  return r.pubs;
}

// ---------- Supabase ----------
const sb = (ruta, o = {}) => fetch(`${SUPA}${ruta}`, { ...o, headers: { apikey: SERVICIO, Authorization: `Bearer ${SERVICIO}`, ...(o.headers || {}) } });
async function leerClave(clave) {
  const r = await sb(`/rest/v1/redes?clave=eq.${encodeURIComponent(clave)}&select=valor,actualizado`);
  if (!r.ok) throw new Error(`Supabase (tabla redes) respondió ${r.status}: ${await r.text()}`);
  return (await r.json())[0] || null;
}
async function guardarClave(clave, valor) {
  const r = await sb(`/rest/v1/redes`, { method: "POST", headers: { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ clave, valor, actualizado: new Date().toISOString() }) });
  if (!r.ok) throw new Error(`No pude guardar ${clave} en Supabase: ${r.status} ${await r.text()}`);
}
async function subir(archivo, destino, tipo) {
  const r = await sb(`/storage/v1/object/redes/${destino}`, { method: "POST", headers: { "Content-Type": tipo, "x-upsert": "true" }, body: fs.readFileSync(archivo) });
  if (!r.ok) throw new Error(`No pude subir ${destino} a Supabase Storage: ${r.status} ${await r.text()}`);
  return `${SUPA}/storage/v1/object/public/redes/${destino}`;
}
async function limpiarViejos() {
  const r = await sb(`/storage/v1/object/list/redes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prefix: "", limit: 200 }) });
  if (!r.ok) return;
  const limite = new Date(Date.parse(DIA + "T12:00:00Z") - 4 * 864e5).toISOString().slice(0, 10);
  for (const c of await r.json()) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(c.name) || c.name >= limite) continue;
    const l = await sb(`/storage/v1/object/list/redes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prefix: c.name, limit: 200 }) });
    const archivos = l.ok ? (await l.json()).map(x => `${c.name}/${x.name}`) : [];
    if (archivos.length) await sb(`/storage/v1/object/redes`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prefixes: archivos }) });
  }
}

// ---------- Instagram ----------
async function igToken() {
  const g = await leerClave("ig_token");
  let token = g && g.valor || env.IG_TOKEN || "";
  if (!token) throw new Error("No hay token de Instagram: cargá el secreto IG_TOKEN en GitHub (ver INSTAGRAM.md).");
  // el token dura 60 días: se renueva solo si tiene más de 5 días
  const viejo = !g || Date.now() - Date.parse(g.actualizado) > 5 * 864e5;
  if (viejo) {
    const r = await fetch(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`);
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.access_token) { token = j.access_token; await guardarClave("ig_token", token); log("🔑 Token de Instagram renovado (vale 60 días más)") }
    else if (!g) { await guardarClave("ig_token", token) }
    else log("⚠️ No se pudo renovar el token:", JSON.stringify(j.error || j));
  }
  return token;
}
async function ig(token, ruta, params = {}, metodo = "POST") {
  const q = new URLSearchParams({ ...params, access_token: token });
  const r = metodo === "GET" ? await fetch(`${IG}/${ruta}?${q}`) : await fetch(`${IG}/${ruta}`, { method: "POST", body: q });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(`Instagram (${ruta}): ${j.error ? j.error.message : r.status}`);
  return j;
}
const esperar = ms => new Promise(r => setTimeout(r, ms));
async function listo(token, id, max = 40) {
  for (let i = 0; i < max; i++) {
    const s = await ig(token, id, { fields: "status_code" }, "GET");
    if (s.status_code === "FINISHED") return;
    if (s.status_code === "ERROR" || s.status_code === "EXPIRED") throw new Error(`Instagram no pudo procesar el archivo (${s.status_code})`);
    await esperar(i < 5 ? 3000 : 15000);
  }
  throw new Error("Instagram tardó demasiado en procesar el archivo");
}
async function publicar(token, uid, p, urls) {
  let id;
  if (p.tipo === "historia") {
    id = (await ig(token, `${uid}/media`, { media_type: "STORIES", image_url: urls[0] })).id;
  } else if (p.tipo === "reel") {
    id = (await ig(token, `${uid}/media`, { media_type: "REELS", video_url: urls[0], caption: p.caption, share_to_feed: "true" })).id;
  } else if (urls.length === 1) {
    id = (await ig(token, `${uid}/media`, { image_url: urls[0], caption: p.caption })).id;
  } else {
    const hijos = [];
    for (const u of urls.slice(0, 10)) hijos.push((await ig(token, `${uid}/media`, { image_url: u, is_carousel_item: "true" })).id);
    for (const h of hijos) await listo(token, h);
    id = (await ig(token, `${uid}/media`, { media_type: "CAROUSEL", children: hijos.join(","), caption: p.caption })).id;
  }
  await listo(token, id, p.tipo === "reel" ? 40 : 20);
  return (await ig(token, `${uid}/media_publish`, { creation_id: id })).id;
}

// ---------- principal ----------
let fallas = 0;
try {
  log(`📅 ${DIA} · turno ${TURNO}${PRUEBA ? " · MODO PRUEBA (no publica)" : ""}`);
  const pubs = await armar();
  log(`🖼️ Armé ${pubs.length} publicaciones: ${pubs.map(p => p.id).join(", ") || "ninguna"}`);
  if (!PRUEBA && pubs.length) {
    const token = await igToken();
    const yo = await ig(token, "me", { fields: "user_id,username" }, "GET");
    const uid = yo.user_id || yo.id;
    log(`📷 Publicando en @${yo.username}`);
    // las historias primero (respuesta de ayer antes que la pregunta de hoy), después el feed
    const orden = pubs.sort((a, b) => (a.tipo === "historia" ? 0 : 1) - (b.tipo === "historia" ? 0 : 1));
    for (const p of orden) {
      const clave = `pub:${DIA}:${TURNO}:${p.id}`;
      try {
        if (await leerClave(clave)) { log(`⏭️ ${p.id}: ya estaba publicado`); continue }
        let urls;
        if (p.tipo === "reel") {
          const f = path.join(RAIZ, "redes", "videos", p.video);
          if (!fs.existsSync(f)) { log(`⏭️ ${p.id}: falta el video redes/videos/${p.video}`); continue }
          urls = [await subir(f, `${DIA}/${p.video}`, "video/mp4")];
        } else urls = await Promise.all(p.archivos.map(f => subir(f, `${DIA}/${path.basename(f)}`, "image/jpeg")));
        const mid = await publicar(token, uid, p, urls);
        await guardarClave(clave, mid);
        log(`✅ ${p.id} (${p.tipo}) publicado`);
        await esperar(4000);
      } catch (e) { fallas++; log(`❌ ${p.id}: ${e.message}`) }
    }
    await limpiarViejos().catch(() => {});
  }
} catch (e) { fallas++; log(`❌ ${e.message}`) }
if (env.GITHUB_STEP_SUMMARY) fs.appendFileSync(env.GITHUB_STEP_SUMMARY, "## Instagram\n\n" + resumen.map(l => "- " + l).join("\n") + "\n");
process.exit(fallas ? 1 : 0);

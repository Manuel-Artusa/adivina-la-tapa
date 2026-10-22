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
  for (let intento = 0; ; intento++) {
    const q = new URLSearchParams({ ...params, access_token: token });
    const r = metodo === "GET" ? await fetch(`${IG}/${ruta}?${q}`) : await fetch(`${IG}/${ruta}`, { method: "POST", body: q });
    const j = await r.json().catch(() => ({}));
    if (r.ok && !j.error) return j;
    const msg = j.error ? j.error.message : String(r.status);
    // Instagram frena si se le pide mucho seguido, o si el archivo todavía no está listo: esperar y reintentar
    const limite = /request limit|too many|rate limit/i.test(msg), noListo = /does not exist|not ready|media id is not available/i.test(msg) && ruta.endsWith("media_publish");
    if ((limite || noListo) && intento < 3) { log(`   ⏳ Instagram pidió esperar (${limite ? "límite de pedidos" : "archivo no listo"}), reintento…`); await esperar(limite ? 70000 : 20000); continue }
    throw new Error(`Instagram (${ruta}): ${msg}`);
  }
}
const esperar = ms => new Promise(r => setTimeout(r, ms));
async function listo(token, id, max = 25) {
  for (let i = 0; i < max; i++) {
    const s = await ig(token, id, { fields: "status_code" }, "GET");
    if (s.status_code === "FINISHED") return;
    if (s.status_code === "ERROR" || s.status_code === "EXPIRED") throw new Error(`Instagram no pudo procesar el archivo (${s.status_code})`);
    await esperar(i === 0 ? 5000 : i < 4 ? 10000 : 20000);
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
  await listo(token, id, p.tipo === "reel" ? 30 : 15);
  return (await ig(token, `${uid}/media_publish`, { creation_id: id })).id;
}

// ---------- Threads ----------
const THREADS_HOSTS = ["https://graph.threads.net", "https://graph.threads.com"];
async function th(token, ruta, params = {}, metodo = "POST") {
  let ultimo;
  for (const host of THREADS_HOSTS) {
    const q = new URLSearchParams({ ...params, access_token: token });
    try {
      const r = metodo === "GET" ? await fetch(`${host}/v1.0/${ruta}?${q}`) : await fetch(`${host}/v1.0/${ruta}`, { method: "POST", body: q });
      const j = await r.json().catch(() => ({}));
      if (r.ok && !j.error) return j;
      ultimo = new Error(`Threads (${ruta}): ${j.error ? j.error.message : r.status}`);
      if (r.status !== 404) break;
    } catch (e) { ultimo = e }
  }
  throw ultimo;
}
async function thToken() {
  const g = await leerClave("th_token");
  let token = g && g.valor || env.THREADS_TOKEN || "";
  if (!token) return null;
  if (!g || Date.now() - Date.parse(g.actualizado) > 5 * 864e5) {
    for (const host of THREADS_HOSTS) {
      const r = await fetch(`${host}/refresh_access_token?grant_type=th_refresh_token&access_token=${encodeURIComponent(token)}`).catch(() => null);
      const j = r ? await r.json().catch(() => ({})) : {};
      if (r && r.ok && j.access_token) { token = j.access_token; log("🔑 Token de Threads renovado"); break }
    }
    await guardarClave("th_token", token);
  }
  return token;
}
// Threads deja 500 caracteres: sin hashtags y cortado prolijo
function textoThreads(c) {
  let t = (c || "").replace(/(^|\s)#[^\s#]+/g, "").replace(/\n{3,}/g, "\n\n").trim();
  if (t.length > 480) { t = t.slice(0, 440); t = t.slice(0, Math.max(t.lastIndexOf(". "), t.lastIndexOf("\n"), 200) + 1).trim() + "\n\njuegosrock.com.ar" }
  return t;
}
async function thListo(token, id) {
  for (let i = 0; i < 20; i++) {
    const s = await th(token, id, { fields: "status,error_message" }, "GET").catch(() => ({}));
    if (s.status === "FINISHED") return;
    if (s.status === "ERROR" || s.status === "EXPIRED") throw new Error(`Threads no pudo procesar el archivo: ${s.error_message || s.status}`);
    await esperar(i < 3 ? 10000 : 15000);
  }
}
async function publicarThreads(token, uid, p, urls) {
  const text = textoThreads(p.caption);
  let id;
  if (p.tipo === "reel") id = (await th(token, `${uid}/threads`, { media_type: "VIDEO", video_url: urls[0], text })).id;
  else if (urls.length === 1) id = (await th(token, `${uid}/threads`, { media_type: "IMAGE", image_url: urls[0], text })).id;
  else {
    const hijos = [];
    for (const u of urls.slice(0, 20)) hijos.push((await th(token, `${uid}/threads`, { media_type: "IMAGE", image_url: u, is_carousel_item: "true" })).id);
    for (const h of hijos) await thListo(token, h);
    id = (await th(token, `${uid}/threads`, { media_type: "CAROUSEL", children: hijos.join(","), text })).id;
  }
  await thListo(token, id);
  return (await th(token, `${uid}/threads_publish`, { creation_id: id })).id;
}

// ---------- Facebook (página) ----------
const FB = "https://graph.facebook.com/v23.0";
async function fb(token, ruta, params = {}, metodo = "POST", host = FB) {
  const q = new URLSearchParams({ ...params, access_token: token });
  const r = metodo === "GET" ? await fetch(`${host}/${ruta}?${q}`) : await fetch(`${host}/${ruta}`, { method: "POST", body: q });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(`Facebook (${ruta}): ${j.error ? j.error.message : r.status}`);
  return j;
}
// Con un token de usuario de larga duración se saca el token de la página, que no vence
const esLaPagina = p => p && (env.FB_PAGE_ID ? p.id === env.FB_PAGE_ID : /juegos\s*rock/i.test(p.name || ""));
async function fbPagina() {
  const g = await leerClave("fb_pagina");
  if (g && g.valor) { try { const p = JSON.parse(g.valor); if (esLaPagina(p)) return p } catch (e) {} }
  const token = env.FB_TOKEN || "";
  if (!token) return null;
  let pag = null;
  try {
    const cuentas = (await fb(token, "me/accounts", { fields: "id,name,access_token" }, "GET")).data || [];
    pag = cuentas.find(c => esLaPagina(c)) || null;
    if (!pag) throw new Error(`no encontré la página de Juegos Rock. Este token ve: ${cuentas.map(c => `«${c.name}» (${c.id})`).join(", ") || "ninguna página"}. Generá el token eligiendo la página de Juegos Rock, o cargá su número en el secreto FB_PAGE_ID.`);
    pag = { id: pag.id, name: pag.name, token: pag.access_token };
  } catch (e) {
    if (/no encontré la página/.test(e.message)) throw e;
    const yo = await fb(token, "me", { fields: "id,name" }, "GET"); // ya era un token de página
    pag = { id: yo.id, name: yo.name, token };
    if (!esLaPagina(pag)) throw new Error(`el token es de la página «${yo.name}», no de Juegos Rock`);
  }
  if (!pag) throw new Error("Ese token de Facebook no administra ninguna página");
  await guardarClave("fb_pagina", JSON.stringify(pag));
  log(`🔑 Facebook conectado a la página «${pag.name}»`);
  return pag;
}
async function publicarFacebook(pag, p, urls) {
  if (p.tipo === "reel") return (await fb(pag.token, `${pag.id}/videos`, { file_url: urls[0], description: p.caption }, "POST", "https://graph-video.facebook.com/v23.0")).id;
  if (urls.length === 1) return (await fb(pag.token, `${pag.id}/photos`, { url: urls[0], message: p.caption })).post_id;
  const fotos = [];
  for (const u of urls.slice(0, 10)) fotos.push((await fb(pag.token, `${pag.id}/photos`, { url: u, published: "false" })).id);
  const params = { message: p.caption };
  fotos.forEach((id, i) => params[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id }));
  return (await fb(pag.token, `${pag.id}/feed`, params)).id;
}

// ---------- TikTok (el video llega a la bandeja de TikTok: se publica con un toque y se le pone música) ----------
async function ttToken() {
  const g = await leerClave("tt_refresh");
  if (!g || !g.valor || !env.TIKTOK_CLIENT_KEY || !env.TIKTOK_CLIENT_SECRET) return null;
  const r = await fetch("https://open.tiktokapis.com/v2/oauth/token/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_key: env.TIKTOK_CLIENT_KEY, client_secret: env.TIKTOK_CLIENT_SECRET, grant_type: "refresh_token", refresh_token: g.valor }) });
  const j = await r.json().catch(() => ({}));
  if (!j.access_token) throw new Error(`TikTok no renovó el acceso: ${j.error_description || j.error || r.status}. Volvé a correr «Conectar TikTok».`);
  if (j.refresh_token && j.refresh_token !== g.valor) await guardarClave("tt_refresh", j.refresh_token);
  return j.access_token;
}
async function subirTikTok(token, archivo) {
  const tam = fs.statSync(archivo).size;
  const r = await fetch("https://open.tiktokapis.com/v2/post/publish/inbox/video/init/", { method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify({ source_info: { source: "FILE_UPLOAD", video_size: tam, chunk_size: tam, total_chunk_count: 1 } }) });
  const j = await r.json().catch(() => ({}));
  if (!j.data || !j.data.upload_url) throw new Error(`TikTok: ${j.error && j.error.message || r.status}`);
  const up = await fetch(j.data.upload_url, { method: "PUT", headers: { "Content-Type": "video/mp4", "Content-Range": `bytes 0-${tam - 1}/${tam}` }, body: fs.readFileSync(archivo) });
  if (!up.ok) throw new Error(`TikTok no aceptó el video (${up.status})`);
  return j.data.publish_id;
}

// ---------- principal ----------
let fallas = 0;
try {
  log(`📅 ${DIA} · turno ${TURNO}${PRUEBA ? " · MODO PRUEBA (no publica)" : ""}`);
  const pubs = await armar();
  log(`🖼️ Armé ${pubs.length} publicaciones: ${pubs.map(p => p.id).join(", ") || "ninguna"}`);
  if (!PRUEBA && pubs.length) {
    // conectar cada red (las que no estén configuradas se saltean)
    const R = {};
    try { const token = await igToken(); const yo = await ig(token, "me", { fields: "user_id,username" }, "GET"); R.ig = { token, uid: yo.user_id || yo.id }; log(`📷 Instagram: @${yo.username}`) }
    catch (e) { fallas++; log(`❌ Instagram: ${e.message}`) }
    try { const token = await thToken(); if (token) { const yo = await th(token, "me", { fields: "id,username" }, "GET"); R.th = { token, uid: yo.id }; log(`🧵 Threads: @${yo.username}`) } }
    catch (e) { fallas++; log(`❌ Threads: ${e.message}`) }
    try { const pag = await fbPagina(); if (pag) { R.fb = pag; log(`📘 Facebook: ${pag.name}`) } }
    catch (e) { fallas++; log(`❌ Facebook: ${e.message}`) }
    try { const token = await ttToken(); if (token) { R.tt = { token }; log("🎵 TikTok conectado") } }
    catch (e) { fallas++; log(`❌ TikTok: ${e.message}`) }
    // las historias primero (respuesta de ayer antes que la pregunta de hoy), después el feed
    const orden = pubs.sort((a, b) => (a.tipo === "historia" ? 0 : 1) - (b.tipo === "historia" ? 0 : 1));
    for (const p of orden) {
      let urls, archivoVideo;
      try {
        if (p.tipo === "reel") {
          archivoVideo = path.join(RAIZ, "redes", "videos", p.video);
          if (!fs.existsSync(archivoVideo)) { log(`⏭️ ${p.id}: falta el video redes/videos/${p.video}`); continue }
          urls = [await subir(archivoVideo, `${DIA}/${p.video}`, "video/mp4")];
        } else urls = await Promise.all(p.archivos.map(f => subir(f, `${DIA}/${path.basename(f)}`, "image/jpeg")));
      } catch (e) { fallas++; log(`❌ ${p.id}: ${e.message}`); continue }
      // qué va a cada red: historias solo a Instagram; videos también a TikTok
      const destinos = [
        ["ig", "Instagram", `pub:${DIA}:${TURNO}:${p.id}`, () => publicar(R.ig.token, R.ig.uid, p, urls)],
        ["th", "Threads", `th:${DIA}:${TURNO}:${p.id}`, () => publicarThreads(R.th.token, R.th.uid, p, urls), p.tipo !== "historia"],
        ["fb", "Facebook", `fb:${DIA}:${TURNO}:${p.id}`, () => publicarFacebook(R.fb, p, urls), p.tipo !== "historia"],
        ["tt", "TikTok", `tt:${DIA}:${TURNO}:${p.id}`, () => subirTikTok(R.tt.token, archivoVideo), p.tipo === "reel"],
      ];
      for (const [red, nombre, clave, hacer, va = true] of destinos) {
        if (!va || !R[red]) continue;
        try {
          if (await leerClave(clave)) { log(`⏭️ ${p.id} en ${nombre}: ya estaba`); continue }
          const mid = await hacer();
          await guardarClave(clave, String(mid || "ok"));
          log(`✅ ${p.id} (${p.tipo}) → ${nombre}${red === "tt" ? " (te llegó a la bandeja de TikTok para publicarlo)" : ""}`);
          await esperar(3000);
        } catch (e) { fallas++; log(`❌ ${p.id} en ${nombre}: ${e.message}`) }
      }
    }
    await limpiarViejos().catch(() => {});
  }
} catch (e) { fallas++; log(`❌ ${e.message}`) }
if (env.GITHUB_STEP_SUMMARY) fs.appendFileSync(env.GITHUB_STEP_SUMMARY, "## Redes\n\n" + resumen.map(l => "- " + l).join("\n") + "\n");
process.exit(fallas ? 1 : 0);

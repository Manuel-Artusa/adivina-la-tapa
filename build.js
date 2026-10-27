// Se corre en Render al publicar. Arma la carpeta "public/" con la página lista:
// completa las claves de Supabase, la dirección del sitio y el contador de visitas
// desde las variables de Render (Environment), así nada de eso queda en GitHub.
// Además genera una página por juego (con su título, descripción y texto para Google),
// sitemap.xml y robots.txt.
//
// Variables de Render:
//   SUPA_URL     URL del proyecto de Supabase
//   SUPA_KEY     clave pública (anon / publishable). Nunca la secret / service_role
//   SITE_URL     dirección del sitio, ej. https://juegosrock.com.ar (para Google y para compartir)
//   GOATCOUNTER  código de GoatCounter, ej. juegosrock (opcional, para contar visitas)
const fs = require("fs");
const path = require("path");

const url = (process.env.SUPA_URL || "").trim();
const key = (process.env.SUPA_KEY || "").trim();
const sitio = (process.env.SITE_URL || process.env.RENDER_EXTERNAL_URL || "").trim().replace(/\/+$/, "");
const goat = (process.env.GOATCOUNTER || "").trim().replace(/[^a-z0-9-]/gi, "");

if (!url || !key) console.warn("Aviso: faltan SUPA_URL o SUPA_KEY. El sitio se publica igual, pero sin top.");
if (!sitio) console.warn("Aviso: falta SITE_URL. La imagen al compartir y el sitemap pueden no andar bien.");

// Freno de seguridad: nunca publicar una clave secreta en la página
const esSecreta = /service_role|^sb_secret_/i.test(key) || (() => {
  try { return JSON.parse(Buffer.from(key.split(".")[1] || "", "base64").toString()).role === "service_role"; }
  catch { return false; }
})();
if (esSecreta) {
  console.error("ERROR: SUPA_KEY es una clave secreta (service_role / secret). Usá la clave pública: anon o publishable.");
  process.exit(1);
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const seo = JSON.parse(fs.readFileSync("seo.json", "utf8"));
const hoy = new Date().toISOString().slice(0, 10);

fs.rmSync("public", { recursive: true, force: true });
fs.mkdirSync("public");

let base = fs.readFileSync("index.html", "utf8");
base = base.replace("__SUPA_URL__", url).replace("__SUPA_KEY__", key);
base = base.split("__SITE_URL__").join(sitio);
// ¿De qué tema es?: el juego aparece (y suma al día) recién con 10 temas con frases en frases.json
let nFrases = 0;
try {
  const d = JSON.parse(fs.readFileSync("frases.json", "utf8"));
  // no cuentan los instrumentales (los que tienen como única frase "Instrumental")
  const instr = x => (Array.isArray(x.frases) ? x.frases : [x.frase]).every(f => String(f || "").toLowerCase().replace(/[^a-z]/g, "") === "instrumental");
  nFrases = (d.temas || d.frases || []).filter(x => x && x.tema && ((Array.isArray(x.frases) && x.frases.length) || x.frase) && !instr(x)).length;
} catch {}
const letraOn = nFrases >= 10;
base = base.replace("__LETRA_ON__", letraOn ? "1" : "0");
if (!letraOn) seo.letra.noindex = true;
if (goat) {
  base = base.replace("<!--ANALYTICS-->",
    `<script data-goatcounter="https://${goat}.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>`);
}

// Texto visible por página (el mismo que arma la página al navegar)
function bloque(id) {
  const P = seo[id];
  let h = `<h2>${esc(P.h)}</h2>` + (P.texto || []).map(t => `<p>${esc(t)}</p>`).join("");
  if (P.faq) h += `<h3>Preguntas frecuentes</h3>` + P.faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("");
  h += `<h3>Todos los juegos</h3><nav aria-label="Juegos">` +
    Object.entries(seo).filter(([k]) => !seo[k].noindex).map(([k, p]) => `<a href="${p.ruta}" data-ir="${k}">${k === "inicio" ? "Inicio" : esc(p.h.split(":")[0])}</a>`).join("") + `</nav>`;
  return h;
}

// Datos estructurados para Google
function jsonld(id) {
  const P = seo[id], urlPag = sitio + P.ruta, datos = [];
  if (id === "inicio") {
    datos.push({ "@context": "https://schema.org", "@type": "WebSite", name: "Juegos Rock", url: sitio + "/", inLanguage: "es-AR", description: P.descripcion });
    datos.push({ "@context": "https://schema.org", "@type": "Organization", name: "Juegos Rock", url: sitio + "/", logo: sitio + "/favicon-192.png",
      sameAs: ["https://www.instagram.com/juegosrock", "https://www.tiktok.com/@juegosrock"] });
    datos.push({ "@context": "https://schema.org", "@type": "FAQPage",
      mainEntity: P.faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) });
    datos.push({ "@context": "https://schema.org", "@type": "ItemList", name: "Juegos de Juegos Rock",
      itemListElement: Object.entries(seo).filter(([k, p]) => !["inicio", "top"].includes(k) && !p.noindex)
        .map(([k, p], i) => ({ "@type": "ListItem", position: i + 1, name: p.h, url: sitio + p.ruta })) });
  } else {
    datos.push({ "@context": "https://schema.org", "@type": "WebApplication", name: P.h, url: urlPag, description: P.descripcion,
      applicationCategory: "GameApplication", operatingSystem: "Cualquiera (navegador web)", inLanguage: "es-AR",
      isAccessibleForFree: true, offers: { "@type": "Offer", price: "0", priceCurrency: "ARS" } });
    datos.push({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Juegos Rock", item: sitio + "/" },
      { "@type": "ListItem", position: 2, name: P.h, item: urlPag }] });
  }
  return datos.map(d => `<script type="application/ld+json">${JSON.stringify(d)}</script>`).join("\n");
}

const datosNav = {};
for (const [k, p] of Object.entries(seo)) datosNav[k] = { titulo: p.titulo, descripcion: p.descripcion, h: p.h, texto: p.texto, faq: p.faq };

for (const [id, P] of Object.entries(seo)) {
  const urlPag = sitio + P.ruta;
  let html = base
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(P.titulo)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/, `$1${esc(P.descripcion)}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${esc(P.titulo)}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${esc(P.descripcion)}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${esc(urlPag)}$2`)
    .replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${esc(P.titulo)}$2`)
    .replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${esc(P.descripcion)}$2`)
    .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${esc(urlPag)}$2`)
    .replace("<!--SEO_TEXTO-->", bloque(id))
    .replace("<!--JSONLD-->",
      (P.noindex ? `<meta name="robots" content="noindex">\n` : "") +
      `<script>window.SEO_PAGINAS=${JSON.stringify(datosNav).replace(/</g, "\\u003c")}</script>\n` + jsonld(id));
  const dir = path.join("public", P.ruta);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), html);
}

// Mapa del sitio y reglas para buscadores
const urls = Object.values(seo).filter(p => !p.noindex).map(p =>
  `  <url><loc>${sitio}${p.ruta}</loc><lastmod>${hoy}</lastmod><changefreq>daily</changefreq><priority>${p.ruta === "/" ? "1.0" : "0.8"}</priority></url>`);
fs.writeFileSync("public/sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`);
fs.writeFileSync("public/robots.txt", `User-agent: *\nAllow: /\n\nSitemap: ${sitio}/sitemap.xml\n`);

for (const f of ["favicon.ico", "favicon-96.png", "favicon-192.png", "og.png", "apple-touch-icon.png", "icon-192.png", "icon-512.png", "icon-maskable.png", "manifest.webmanifest", "sw.js", "discos.json", "datos.json", "piezas.json", "frases.json"]) {
  if (fs.existsSync(f)) fs.copyFileSync(f, "public/" + f);
  else if (f === "discos.json") console.warn("Aviso: todavía no hay discos.json; el juego busca en iTunes en vivo.");
}

// Archivos de verificación (TikTok, Google, etc.): todo lo de la carpeta "verificacion" va a la raíz del sitio
if (fs.existsSync("verificacion")) for (const f of fs.readdirSync("verificacion")) {
  if (fs.statSync(path.join("verificacion", f)).isFile()) fs.copyFileSync(path.join("verificacion", f), path.join("public", f));
}

// Páginas fijas (privacidad, términos y la vuelta del login de TikTok)
if (fs.existsSync("paginas")) for (const f of fs.readdirSync("paginas").filter(f => f.endsWith(".html"))) {
  const dir = path.join("public", f.replace(/\.html$/, ""));
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(path.join("paginas", f), path.join(dir, "index.html"));
}

console.log([
  `Listo: ${Object.keys(seo).length} páginas + sitemap.xml + robots.txt`,
  url && key ? "top activado" : "sin top",
  sitio ? "SITE_URL " + sitio : "sin SITE_URL",
  goat ? "contador de visitas activado" : "sin contador",
  fs.existsSync("discos.json") ? "con discos.json" : "sin discos.json",
  `${nFrases} temas con frases (¿De qué tema es? ${letraOn ? "activado" : "oculto hasta tener 10"})`,
].join(" · "));

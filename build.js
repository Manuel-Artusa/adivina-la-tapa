// Se corre en Render al publicar. Arma la carpeta "public/" con la página lista:
// completa las claves de Supabase, la dirección del sitio y el contador de visitas
// desde las variables de Render (Environment), así nada de eso queda en GitHub.
//
// Variables de Render:
//   SUPA_URL     URL del proyecto de Supabase
//   SUPA_KEY     clave pública (anon / publishable). Nunca la secret / service_role
//   SITE_URL     dirección del sitio, ej. https://adivina-la-tapa.onrender.com (para la imagen al compartir)
//   GOATCOUNTER  código de GoatCounter, ej. juegosrock (opcional, para contar visitas)
const fs = require("fs");

const url = (process.env.SUPA_URL || "").trim();
const key = (process.env.SUPA_KEY || "").trim();
const sitio = (process.env.SITE_URL || process.env.RENDER_EXTERNAL_URL || "").trim().replace(/\/+$/, "");
const goat = (process.env.GOATCOUNTER || "").trim().replace(/[^a-z0-9-]/gi, "");

if (!url || !key) console.warn("Aviso: faltan SUPA_URL o SUPA_KEY. El sitio se publica igual, pero sin top.");
if (!sitio) console.warn("Aviso: falta SITE_URL. La imagen al compartir puede no verse en WhatsApp.");

// Freno de seguridad: nunca publicar una clave secreta en la página
const esSecreta = /service_role|^sb_secret_/i.test(key) || (() => {
  try { return JSON.parse(Buffer.from(key.split(".")[1] || "", "base64").toString()).role === "service_role"; }
  catch { return false; }
})();
if (esSecreta) {
  console.error("ERROR: SUPA_KEY es una clave secreta (service_role / secret). Usá la clave pública: anon o publishable.");
  process.exit(1);
}

fs.rmSync("public", { recursive: true, force: true });
fs.mkdirSync("public");

let html = fs.readFileSync("index.html", "utf8");
html = html.replace("__SUPA_URL__", url).replace("__SUPA_KEY__", key);
html = html.split("__SITE_URL__").join(sitio);
if (goat) {
  html = html.replace("<!--ANALYTICS-->",
    `<script data-goatcounter="https://${goat}.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>`);
}
fs.writeFileSync("public/index.html", html);

for (const f of ["og.png", "apple-touch-icon.png", "icon-192.png", "icon-512.png", "icon-maskable.png", "manifest.webmanifest", "sw.js", "discos.json"]) {
  if (fs.existsSync(f)) fs.copyFileSync(f, "public/" + f);
  else if (f === "discos.json") console.warn("Aviso: todavía no hay discos.json; el juego busca en iTunes en vivo.");
}

console.log([
  "Listo: public/index.html",
  url && key ? "top activado" : "sin top",
  sitio ? "imagen para compartir OK" : "sin SITE_URL",
  goat ? "contador de visitas activado" : "sin contador",
  fs.existsSync("discos.json") ? "con discos.json" : "sin discos.json",
].join(" · "));

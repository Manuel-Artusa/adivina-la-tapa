// Se corre en Render al publicar: copia el sitio a "public/" y completa las variables de Supabase.
// Así las claves viven en Render (Environment) y no en GitHub.
const fs = require("fs");

const url = (process.env.SUPA_URL || "").trim();
const key = (process.env.SUPA_KEY || "").trim();

if (!url || !key) {
  console.warn("Aviso: faltan SUPA_URL o SUPA_KEY en Render. El sitio se publica igual, pero sin top.");
}
// Freno de seguridad: nunca publicar una clave secreta en la página
if (/service_role|^sb_secret_/i.test(key) || (() => { try { return JSON.parse(Buffer.from(key.split(".")[1] || "", "base64").toString()).role === "service_role"; } catch { return false; } })()) {
  console.error("ERROR: SUPA_KEY es una clave secreta (service_role / secret). Usá la clave pública: anon o publishable.");
  process.exit(1);
}

fs.rmSync("public", { recursive: true, force: true });
fs.mkdirSync("public");
let html = fs.readFileSync("index.html", "utf8");
html = html.replace("__SUPA_URL__", url).replace("__SUPA_KEY__", key);
fs.writeFileSync("public/index.html", html);
console.log("Listo: public/index.html" + (url && key ? " con top activado." : " sin top."));

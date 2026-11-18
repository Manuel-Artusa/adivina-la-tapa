// Fija de antemano el tema del día de "Adiviná el tema" en tema-dia.json (para los próximos 90 días).
// Así el tema es el mismo para todos, aunque iTunes falle o cambie discos.json: la página lee el tema de acá.
// Nunca cambia un día ya fijado; solo agrega los que faltan. Lo corre la tarea "Fijar temas del día" (y se puede correr a mano).
//   node build.js && node redes/fijar_temas.mjs
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const PUBLIC = path.join(RAIZ, "public"), ARCHIVO = path.join(RAIZ, "tema-dia.json");
const DIAS = +(process.env.DIAS || 90);
const TIPOS = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml" };
const hoyAR = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
const masDias = (d, n) => new Date(Date.parse(d + "T12:00:00Z") + n * 864e5).toISOString().slice(0, 10);

const fijos = fs.existsSync(ARCHIVO) ? JSON.parse(fs.readFileSync(ARCHIVO, "utf8")) : {};
const desde = process.env.DESDE || masDias(hoyAR(), 1); // hoy no se toca: ya hay gente que lo jugó
// REHACER=1 vuelve a sortear los días desde DESDE (solo días que todavía no se jugaron: nunca hoy ni antes)
if (process.env.REHACER === "1") { if (desde <= hoyAR()) throw new Error("REHACER solo para días que todavía no llegaron"); for (const d of Object.keys(fijos)) if (d >= desde) delete fijos[d] }
const faltan = []; for (let i = 0; i < DIAS; i++) { const d = masDias(desde, i); if (!fijos[d]) faltan.push(d) }
if (!faltan.length) { console.log("Todos los días ya estaban fijados"); process.exit(0) }

const srv = await new Promise(ok => { const s = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname); if (p.endsWith("/")) p += "index.html";
  let f = path.join(PUBLIC, p); if (!f.startsWith(PUBLIC) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(PUBLIC, "index.html");
  res.writeHead(200, { "Content-Type": TIPOS[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res);
}).listen(8096, () => ok(s)) });
const b = await chromium.launch(), ctx = await b.newContext();
// PREVIA=AAAA-MM-DD: arma como se va a ver la página ese día (por ejemplo, con una banda que entra mañana). Necesita LLAVE_HUELLA.
if (process.env.PREVIA) await ctx.addInitScript(h => { try { localStorage.setItem("tapa-llave", h) } catch (e) {} }, process.env.LLAVE_HUELLA || "");
const pg = await ctx.newPage();
await pg.route(/supabase|goatcounter|itunes\.apple\.com/, r => r.abort()); // solo con lo guardado: lo mismo que verá cualquiera
await pg.goto("http://localhost:8096/" + (process.env.PREVIA ? "?previa=" + process.env.PREVIA : ""));
if (process.env.PREVIA && await pg.evaluate(() => hoyAR()) !== process.env.PREVIA) throw new Error("no se pudo armar la vista previa"); await pg.waitForTimeout(3000);
let n = 0;
// un tema no se repite en 180 días ni la banda dos días seguidos: si toca, se vuelve a sortear (con otra semilla)
const clave = x => x.banda + "|" + x.tema.toLowerCase();
const cerca = (dia, f) => Object.entries(fijos).some(([d, x]) => Math.abs(Date.parse(d) - Date.parse(dia)) <= f.dias * 864e5 && f.ok(x));
for (const dia of faltan) {
  let x = null;
  for (let intento = 0; intento < 12; intento++) {
    const y = await pg.evaluate(async ([dia, semilla]) => {
      const j = await temaSortear(dia, "diario", semillaRng(hashStr(semilla)));
      return j && j.p && j.p.prev ? { banda: j.d[0], disco: j.d[1], anio: j.d[2], cat: j.d[3], tema: j.p.t, prev: j.p.prev, id: j.r.id, url: j.r.url } : null;
    }, [dia, intento ? `tema-${dia}-${intento}` : `tema-${dia}`]);
    if (!y) continue; x = x || y;
    if (cerca(dia, { dias: 180, ok: z => clave(z) === clave(y) }) || cerca(dia, { dias: 1, ok: z => z.banda === y.banda })) continue;
    x = y; break;
  }
  if (x) { fijos[dia] = x; n++; console.log(`${dia}: ${x.tema} · ${x.banda}`) } else console.log(`${dia}: no se pudo (queda el sorteo de la página)`);
}
await b.close(); srv.close();
const orden = Object.fromEntries(Object.entries(fijos).sort(([a], [c]) => a < c ? -1 : 1));
fs.writeFileSync(ARCHIVO, JSON.stringify(orden, null, 1) + "\n");
console.log(`Fijé ${n} días nuevos en tema-dia.json (hay ${Object.keys(orden).length})`);

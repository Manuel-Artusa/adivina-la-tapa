// Videos de los juegos grabados en la página de verdad (no dibujados): Chrome en formato celular (1080x1920)
// juega una partida en modo Libre (no muestra las respuestas del día), con cámara que hace zoom a la acción,
// un dedo que toca, textos grandes arriba y un cierre con la dirección. Los puntajes no se suben (Supabase bloqueado).
//   import { grabarReel, GRABABLES } from "./grabar.mjs"
//   await grabarReel({ juego: "tapa", semilla: "2026-11-12", salida: "redes/salida", ffmpeg: "/ruta/ffmpeg" })
// Para probar sin internet: TAPAS_FALSAS=1 reemplaza las tapas de iTunes por cuadros de colores.
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const PUBLIC = path.join(RAIZ, "public");
const espera = ms => new Promise(r => setTimeout(r, ms));
const TIPOS = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".css": "text/css",
  ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json", ".ico": "image/x-icon" };

function servir(puerto) {
  return new Promise(ok => {
    const s = http.createServer((req, res) => {
      let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
      if (p.endsWith("/")) p += "index.html";
      let f = path.join(PUBLIC, p);
      if (!f.startsWith(PUBLIC) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(PUBLIC, "index.html");
      res.writeHead(200, { "Content-Type": TIPOS[path.extname(f)] || "application/octet-stream" });
      fs.createReadStream(f).pipe(res);
    }).listen(puerto, () => ok(s));
  });
}

// ---------- Lo que se agrega a la página para filmar: cámara, dedo, textos y cierre ----------
const ESCENOGRAFIA = () => {
  const st = document.createElement("style");
  st.textContent = `
  .tabs,footer{visibility:hidden!important} #seo-texto{display:none!important}
  html,body{overflow:hidden!important;scroll-behavior:auto!important}
  .cam-on{transform-origin:0 0;transition:transform 1s cubic-bezier(.45,0,.2,1);will-change:transform}
  .cam-rapida{transition-duration:.55s}
  #rec-txt{position:fixed;left:0;right:0;top:54px;z-index:99999;display:flex;justify-content:center;pointer-events:none}
  #rec-txt b{background:#141210;color:#f2c230;font:400 27px/1.12 var(--display,sans-serif);text-transform:uppercase;padding:13px 18px 11px;max-width:84%;text-align:center;
    box-shadow:6px 6px 0 #d7262b;rotate:-1.5deg;animation:recEntra .45s cubic-bezier(.2,1.6,.4,1) both}
  @keyframes recEntra{from{scale:.4;opacity:0;rotate:-8deg}}
  #rec-marca{position:fixed;left:50%;top:14px;translate:-50% 0;z-index:99999;pointer-events:none;background:#d7262b;color:#fff;font:700 12px/1 var(--mono,monospace);letter-spacing:2px;padding:6px 10px;box-shadow:3px 3px 0 #141210}
  #rec-sticker{position:fixed;left:50%;top:44%;z-index:99999;pointer-events:none;translate:-50% -50%}
  #rec-sticker b{display:block;font:400 44px/1.05 var(--display,sans-serif);text-align:center;color:#fffaf0;padding:14px 26px 10px;border:5px solid #141210;box-shadow:8px 8px 0 #141210;
    animation:recPop 1.3s cubic-bezier(.2,1.5,.4,1) both;white-space:nowrap}
  #rec-sticker b.ok{background:#1f7a3a;rotate:-4deg} #rec-sticker b.mal{background:#d7262b;rotate:4deg}
  @keyframes recPop{0%{scale:.2;opacity:0}18%{scale:1.15;opacity:1}30%{scale:1}80%{opacity:1;scale:1}100%{opacity:0;scale:.9}}
  #rec-flash{position:fixed;inset:0;z-index:99990;pointer-events:none;opacity:0}
  #rec-flash.ok{animation:recFlash .6s;background:radial-gradient(circle,rgba(31,122,58,0) 40%,rgba(31,122,58,.55))}
  #rec-flash.mal{animation:recFlash .6s;background:radial-gradient(circle,rgba(215,38,43,0) 40%,rgba(215,38,43,.55))}
  @keyframes recFlash{0%{opacity:0}25%{opacity:1}100%{opacity:0}}
  .rec-tiembla{animation:recTiembla .45s}
  @keyframes recTiembla{20%{translate:-9px 0}40%{translate:8px 0}60%{translate:-6px 0}80%{translate:4px 0}}
  #rec-dedo{position:fixed;left:0;top:0;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;background:rgba(255,255,255,.85);border:4px solid #141210;
    z-index:99998;pointer-events:none;transition:transform .55s cubic-bezier(.3,.7,.3,1),opacity .25s;opacity:0;box-shadow:0 6px 18px rgba(0,0,0,.35)}
  #rec-dedo::after{content:"";position:absolute;inset:-4px;border-radius:50%;border:5px solid #d7262b;opacity:0}
  #rec-dedo.toca{animation:recToca .35s}
  #rec-dedo.toca::after{animation:recOnda .6s}
  @keyframes recToca{50%{scale:.7;background:#d7262b}}
  @keyframes recOnda{0%{opacity:1;scale:1}100%{opacity:0;scale:2.6}}
  #rec-fin{position:fixed;inset:0;z-index:100000;background:#f2c230;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;text-align:center;padding:30px;
    opacity:0;pointer-events:none;transition:opacity .35s}
  #rec-fin.ver{opacity:1}
  #rec-fin .chip{background:#141210;color:#f2c230;font:500 14px monospace;letter-spacing:3px;padding:7px 12px}
  #rec-fin h1{font:400 50px/1 var(--display,sans-serif);color:#141210;margin:0;text-transform:uppercase}
  #rec-fin p{font:800 19px/1.55 var(--body,sans-serif);color:#141210;margin:0}
  #rec-fin .url{background:#d7262b;color:#fff;font:400 28px var(--display,sans-serif);padding:12px 20px 9px;box-shadow:7px 7px 0 #141210;rotate:-2deg}
  #rec-fin.ver h1{animation:recEntra .5s cubic-bezier(.2,1.6,.4,1) both} #rec-fin.ver .url{animation:recEntra .5s .35s cubic-bezier(.2,1.6,.4,1) both}`;
  document.head.appendChild(st);
  for (const id of ["rec-marca", "rec-txt", "rec-sticker", "rec-flash", "rec-dedo", "rec-fin"]) { const d = document.createElement("div"); d.id = id; document.body.appendChild(d) }
  // cámara: lleva el centro de un elemento al centro de la pantalla, con zoom (sobre la sección visible, no sobre la página entera)
  const C = { sec: null, tx: 0, ty: 0, z: 1 };
  window.__cam = (sel, z = 1, alto = .5, rapida = false) => {
    const sec = [...document.querySelectorAll("main > section, section.sub, section")].find(s => !s.hidden && s.offsetParent);
    if (!sec) return;
    if (C.sec !== sec) { if (C.sec) { C.sec.style.transform = ""; C.sec.classList.remove("cam-on") } C.sec = sec; C.tx = C.ty = 0; C.z = 1; sec.classList.add("cam-on") }
    sec.classList.toggle("cam-rapida", !!rapida);
    const W = innerWidth, H = innerHeight, r = sec.getBoundingClientRect(), sx = r.left - C.tx, sy = r.top - C.ty;
    if (!sel || z <= 1) { C.tx = 0; C.ty = 0; C.z = 1; sec.style.transform = "translate(0px,0px) scale(1)"; return }
    const el = typeof sel === "string" ? sec.querySelector(sel) || document.querySelector(sel) : sel; if (!el) return;
    const e = el.getBoundingClientRect(), cx = (e.left + e.width / 2 - r.left) / C.z, cy = (e.top + e.height / 2 - r.top) / C.z;
    let tx = W / 2 - sx - z * cx, ty = H * alto - sy - z * cy;
    tx = Math.min((z - 1) * sx, Math.max((1 - z) * (W - sx), tx)); // que la pantalla quede siempre cubierta por la página, sin bordes vacíos a los costados
    C.tx = tx; C.ty = ty; C.z = z; sec.style.transform = `translate(${tx}px,${ty}px) scale(${z})`;
  };
  document.getElementById("rec-marca").textContent = "JUEGOSROCK.COM.AR";
  window.__txt = t => { const e = document.getElementById("rec-txt"); e.innerHTML = t ? `<b>${t}</b>` : "" };
  window.__sticker = (t, ok) => {
    const e = document.getElementById("rec-sticker"); e.innerHTML = `<b class="${ok ? "ok" : "mal"}">${t}</b>`;
    const f = document.getElementById("rec-flash"); f.className = ""; void f.offsetWidth; f.className = ok ? "ok" : "mal";
  };
  window.__fin = html => { const e = document.getElementById("rec-fin"); e.innerHTML = html; e.classList.add("ver") };
};

// Math.random con semilla: la partida "libre" sale distinta cada día pero igual si se vuelve a grabar
const SEMILLA = s => {
  let h = 1779033703 ^ s.length; for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19 }
  let a = h >>> 0; Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 };
};

// ---------- Las partidas: cada juego, una jugada con aciertos y algún error ----------
// pg = página; A = acciones (tocar, cam, txt, sticker, esperar, escribir)
const JUEGOS = {
  async tapa(pg, A) {
    await A.ir("diario", "libre");
    await pg.locator("#opts button").first().waitFor({ timeout: 15000 });
    await A.imagenes("#stage");
    await A.cam("#stage", 1.45, .5, true); A.txt("¿Qué disco es?"); await A.grabando();
    await espera(1700);
    await A.cam("#opts", 1.12, .6); await espera(700);
    await A.tocar(pg.locator('#opts button:not([data-ok="1"])').first()); A.sticker("✘ NO", false); await espera(900);
    await A.cam("#stage", 1.35, .5); A.txt("Se aclara con cada error…"); await espera(1500);
    await A.cam("#opts", 1.12, .6); await espera(500);
    await A.tocar(pg.locator('#opts button[data-ok="1"]')); A.sticker("✔ ¡ESA!", true);
    await A.cam("#stage", 1.2, .45); A.txt(await pg.evaluate(() => `${G.actual.t} · ${G.actual.a}`)); await espera(1900);
    // segunda tapa, de una
    await A.tocar(pg.locator("#next")); await A.cam(null); A.txt("¿Y esta?");
    await pg.locator('#opts button[data-ok="1"]').waitFor({ timeout: 15000 }); await A.imagenes("#stage");
    await A.cam("#stage", 1.45, .5); await espera(1500);
    await A.cam("#opts", 1.12, .6); await espera(500);
    await A.tocar(pg.locator('#opts button[data-ok="1"]')); A.sticker("✔ DE UNA", true);
    A.txt(await pg.evaluate(() => `${G.actual.t} · ${G.actual.a}`)); await espera(1800);
  },
  async antes(pg, A) {
    await A.ir("antes", "libre");
    await pg.locator("#ant-antes").waitFor({ timeout: 15000 }); await A.imagenes("#v-antes");
    A.txt("¿Salió antes o después?"); await A.cam("#antes-duelo", 1.08, .52); await A.grabando(); await espera(1300);
    for (let k = 0; k < 3; k++) {
      if (!(await pg.locator("#ant-antes").count())) await pg.locator("#ant-antes").waitFor({ timeout: 10000 });
      await A.imagenes("#v-antes");
      const bien = await pg.evaluate(() => Math.sign(ANT.der.d[2] - ANT.izq.d[2]) < 0 ? "#ant-antes" : "#ant-despues");
      const mal = bien === "#ant-antes" ? "#ant-despues" : "#ant-antes", ok = k < 2;
      await A.cam("#antes-duelo", 1.08, .5); await espera(700);
      await A.tocar(pg.locator(ok ? bien : mal)); A.sticker(ok ? "✔ +10" : "✘ PERDÍ", ok);
      await A.cam("#antes-der .anio", 1.3, .5, true); await espera(1500);
      if (!ok) { A.txt(await pg.evaluate(() => `Era de ${ANT.der.d[2]}`)); await espera(1500); break }
      await A.cam("#antes-duelo", 1.08, .52); await espera(1000); A.txt(["¿Y este?", "Racha de 2… ¿sigo?"][k] || "");
    }
  },
  async bingo(pg, A) {
    await A.ir("bingo", "libre");
    await pg.locator("#bingo-empezar").waitFor({ timeout: 15000 });
    // el mazo se ordena para que las primeras tapas sean de bandas distintas que están en el cartón (si no, el video se va en "saltear")
    await pg.evaluate(() => { const vistas = new Set(), primero = [], resto = [];
      for (const c of BIN.mazo) { if (BIN.bandas.includes(c.b) && !vistas.has(c.b) && primero.length < 6) { vistas.add(c.b); primero.push(c) } else resto.push(c) }
      BIN.mazo = [...primero, ...resto]; binPintar() });
    await A.tocar(pg.locator("#bingo-empezar")); await espera(500); await A.imagenes("#bingo-cab");
    A.txt("¿De qué banda es esta tapa?"); await A.cam("#bingo-cab img", 1.7, .42, true); await A.grabando(); await espera(1000);
    for (let k = 0; k < 5; k++) {
      if (k) { await A.imagenes("#bingo-cab"); await A.cam("#bingo-cab img", 1.7, .42, true); await espera(700) }
      const r = await pg.evaluate(() => { const c = BIN.mazo[BIN.i]; return { i: BIN.bandas.indexOf(c.b), b: c.b } });
      await A.cam("#bingo-grilla", 1.12, .55, true);
      const celdas = pg.locator("#bingo-grilla .bin-c");
      if (k === 2) { // un error
        const n = await celdas.count(); let otra = -1; for (let j = 0; j < n; j++) if (j !== r.i && !(await celdas.nth(j).isDisabled())) { otra = j; break }
        if (otra >= 0) { await A.tocar(celdas.nth(otra), { rapido: true }); A.sticker("✘ NO", false); await espera(800) }
      }
      await A.tocar(celdas.nth(r.i), { rapido: true }); A.sticker("✔ BINGO", true); A.txt(r.b); await espera(900);
    }
    A.txt("¿Completás las 12 en un minuto?"); await A.cam("#bingo-grilla", 1.05, .5); await espera(1300);
  },
  async piojos(pg, A) {
    await A.ir("piojos", "libre");
    await pg.locator("#pio-ops button").first().waitFor({ timeout: 15000 });
    A.txt("Completá la letra de Los Piojos"); await A.cam("#pio-frase", 1.15, .45); await A.grabando(); await espera(2000);
    for (let k = 0; k < 2; k++) {
      if (k) { await A.tocar(pg.locator("#pio-sig")); await pg.locator("#pio-ops button:not([disabled])").first().waitFor({ timeout: 8000 }); A.txt("¿Y esta?"); await A.cam("#pio-frase", 1.15, .45); await espera(1800) }
      const w = await pg.evaluate(() => PIO.j.palabra), ops = pg.locator("#pio-ops button");
      await A.cam("#pio-ops", 1.15, .6); await espera(500);
      if (k === 0) {
        const n = await ops.count(); for (let i = 0; i < n; i++) if ((await ops.nth(i).innerText()).trim() !== w) { await A.tocar(ops.nth(i)); break }
        A.sticker("✘ NO", false); await A.cam("#pio-pistas", 1.3, .5); await espera(1500); await A.cam("#pio-ops", 1.15, .6); await espera(400);
      }
      for (let i = 0; i < (await ops.count()); i++) if ((await ops.nth(i).innerText()).trim() === w) { await A.tocar(ops.nth(i)); break }
      A.sticker(k ? "✔ DE UNA" : "✔ ¡ESA!", true); await A.cam("#pio-frase", 1.15, .45); await espera(2000);
    }
  },
  async ahorcado(pg, A) {
    await A.ir("ahorcado", "libre");
    await pg.locator("#aho-teclado button").first().waitFor({ timeout: 15000 });
    A.txt("¿Qué tema es? Letra por letra"); await A.cam("#aho-palabra", 1.2, .45); await A.grabando(); await espera(1500);
    const { si, no } = await pg.evaluate(() => { const l = [...AHO.j.letras], v = "AEIOU"; return { si: [...l.filter(c => v.includes(c)), ...l.filter(c => !v.includes(c))], no: [..."STRNLCDMUOIEA"].filter(c => !l.includes(c)) } });
    const sec = []; let s = 0, n = 0;
    for (const g of [1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]) { if (g && s < si.length) sec.push([si[s++], 1]); else if (!g && n < Math.min(2, no.length)) sec.push([no[n++], 0]) }
    while (s < si.length) sec.push([si[s++], 1]);
    await A.cam("#aho-teclado", 1.12, .66); await espera(400);
    for (const [k, [l, ok]] of sec.entries()) {
      await A.tocar(pg.locator(`#aho-k${l}`), { rapido: true }); if (!ok) A.sticker("✘", false);
      if (k % 3 === 2 || !ok) { await A.cam("#aho-palabra", 1.2, .45, true); await espera(650); await A.cam("#aho-teclado", 1.12, .66, true); await espera(300) }
      if (await pg.evaluate(() => AHO.j && AHO.j.fin)) break;
    }
    await A.cam("#aho-palabra", 1.2, .45); A.sticker("✔ ¡SALIÓ!", true);
    A.txt(await pg.evaluate(() => `${AHO.j.t} · ${AHO.j.banda}`)); await espera(2000);
  },
  async abre(pg, A) {
    await A.ir("abre", "libre");
    await pg.locator("#abre-opts button").first().waitFor({ timeout: 20000 }); await A.imagenes("#v-abre");
    A.txt("¿Qué tema abre el disco?"); await A.cam("#abre-tapa", 1.5, .45); await A.grabando(); await espera(1700);
    for (let k = 0; k < 2; k++) {
      if (k) { await A.tocar(pg.locator("#abre-sig")); await pg.locator("#abre-opts button:not([disabled])").first().waitFor({ timeout: 15000 }); await A.imagenes("#v-abre"); A.txt("¿Y este?"); await A.cam("#abre-tapa", 1.5, .45); await espera(1400) }
      await A.cam("#abre-opts", 1.12, .55); await espera(600);
      const i = await pg.evaluate(() => ABR.j.ops.indexOf(ABR.j.target));
      await A.tocar(pg.locator(`#abre-op${i}`)); A.sticker(k ? "✔ +20" : "✔ ¡ESE!", true); await espera(1600);
    }
  },
  async conexiones(pg, A) {
    await A.ir("conexiones", "libre");
    if (await pg.locator("#con-empezar:visible").count()) await pg.locator("#con-empezar").click();
    await pg.locator("#con-grilla .tema-t").first().waitFor({ timeout: 20000 });
    A.txt("¿Qué temas son del mismo disco?"); await A.cam("#con-grilla", 1.05, .6); await A.grabando(); await espera(1600);
    const grupo = gi => pg.evaluate(gi => CON.p.fichas.map((f, i) => f.gi === gi && !CON.p.hechos.includes(f.gi) ? i : -1).filter(i => i >= 0), gi);
    const g0 = await grupo(0), intruso = (await grupo(1))[0];
    for (const i of [...g0.slice(0, 3), intruso]) await A.tocar(pg.locator(`#ficha${i}`), { rapido: true });
    await A.cam("#con-enviar", 1.2, .6); await A.tocar(pg.locator("#con-enviar")); A.sticker("✘ UNO NO VA", false); await espera(1100);
    await A.cam("#con-grilla", 1.05, .6); await A.tocar(pg.locator(`#ficha${intruso}`), { rapido: true }); await A.tocar(pg.locator(`#ficha${g0[3]}`), { rapido: true });
    await A.tocar(pg.locator("#con-enviar")); A.sticker("✔ ¡GRUPO!", true); await A.cam("#con-hechos", 1.15, .4); await espera(1600);
    await A.cam("#con-grilla", 1.1, .6); A.txt("Va otro…");
    for (const i of await grupo(1)) await A.tocar(pg.locator(`#ficha${i}`), { rapido: true });
    await A.tocar(pg.locator("#con-enviar")); A.sticker("✔ ¡OTRO!", true); await A.cam("#con-hechos", 1.1, .42); await espera(1800);
  },
  async grilla(pg, A) {
    await A.ir("grilla", "libre");
    await pg.locator("#grilla-empezar").waitFor({ timeout: 15000 });
    A.txt("Grilla rockera: una banda que cumpla las dos"); await A.cam("#grilla-tabla", 1.05, .5); await A.grabando(); await espera(1400);
    await A.tocar(pg.locator("#grilla-empezar")); await espera(300);
    const usadas = new Set();
    for (const [n, k] of [4, 0, 8].entries()) {
      await A.cam("#grilla-tabla", 1.18, .5, true);
      await A.tocar(pg.locator(`#grilla-tabla button[data-k="${k}"]`), { rapido: true }); await A.cam("#grilla-panel", 1.15, .55, true);
      const cond = await pg.evaluate(k => `${GRI.filas[Math.floor(k / 3)].t} + ${GRI.cols[k % 3].t}`, k); A.txt(cond);
      const banda = await pg.evaluate(([k, u]) => (GRI.resp[k].find(b => !u.includes(b)) || GRI.resp[k][0]), [k, [...usadas]]); usadas.add(banda);
      if (n === 1) { // una que no cumple
        const mala = await pg.evaluate(k => griBandas().map(b => b.a).find(b => !GRI.resp[k].includes(b)), k);
        await A.escribir("#grilla-in", mala); await pg.locator("#grilla-in").press("Enter"); A.sticker("✘ NO CUMPLE", false); await espera(900);
        await pg.locator("#grilla-in").fill("");
      }
      await A.escribir("#grilla-in", banda); await pg.locator("#grilla-in").press("Enter"); A.sticker("✔ CUMPLE", true); await A.cam("#grilla-tabla", 1.18, .5, true); await espera(900);
    }
    A.txt("¿Llenás las 9 antes del minuto?"); await A.cam("#grilla-tabla", 1.05, .5); await espera(1500);
  },
};
export const GRABABLES = Object.keys(JUEGOS);

// ---------- Grabación ----------
export async function grabarReel({ juego, semilla = "", salida, ffmpeg = "ffmpeg", puerto = 8097, log = console.log }) {
  if (!JUEGOS[juego]) return null;
  const cuadrosDir = path.join(salida, `reel-${juego}-cuadros`);
  fs.rmSync(cuadrosDir, { recursive: true, force: true }); fs.mkdirSync(cuadrosDir, { recursive: true });
  const srv = await servir(puerto), b = await chromium.launch(), cuadros = [];
  try {
    const ctx = await b.newContext({ viewport: { width: 412, height: 732 }, deviceScaleFactor: 1080 / 412, isMobile: true, hasTouch: true, reducedMotion: "no-preference" });
    await ctx.route(/supabase\.co|goatcounter|accounts\.google/, r => r.abort());
    if (process.env.TAPAS_FALSAS) await ctx.route(/mzstatic\.com/, r => { // pruebas sin internet: un cuadro de color por tapa
      const h = [...r.request().url()].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7), c1 = `hsl(${h % 360},60%,45%)`, c2 = `hsl(${(h >> 9) % 360},70%,70%)`;
      r.fulfill({ status: 200, headers: { "Content-Type": "image/svg+xml", "Access-Control-Allow-Origin": "*" },
        body: `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><rect width="600" height="600" fill="${c1}"/><circle cx="${200 + h % 200}" cy="300" r="170" fill="${c2}"/><rect x="60" y="470" width="480" height="70" fill="#111"/></svg>` });
    });
    await ctx.addInitScript(([s, f]) => { (new Function("s", `(${f})(s)`))(s); try { localStorage.setItem("tapa-nombre", JSON.stringify("Juegos Rock")); localStorage.setItem("tapa-visto-tuto", "1") } catch (e) {} },
      [`${juego}-${semilla}`, SEMILLA.toString()]);
    const pg = await ctx.newPage();
    pg.on("pageerror", e => log("  [página]", e.message));
    await pg.goto(`http://localhost:${puerto}/`, { waitUntil: "load" });
    await pg.waitForTimeout(2500);
    await pg.evaluate(ESCENOGRAFIA);

    // grabación: Chrome manda un cuadro cada vez que cambia la pantalla, con su hora (después se respetan los tiempos reales)
    const cdp = await ctx.newCDPSession(pg); let grabando = false;
    cdp.on("Page.screencastFrame", f => {
      cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
      if (!grabando) return;
      const archivo = path.join(cuadrosDir, `c${String(cuadros.length).padStart(5, "0")}.jpg`);
      fs.writeFileSync(archivo, Buffer.from(f.data, "base64")); cuadros.push({ archivo, t: f.metadata.timestamp });
    });
    await cdp.send("Page.startScreencast", { format: "jpeg", quality: 90, maxWidth: 1080, maxHeight: 1920, everyNthFrame: 1 });

    const A = {
      async ir(v, modo) {
        await pg.evaluate(v => irA(v), v); await espera(700);
        if (modo) { const l = pg.locator(`.modo-dia[data-juego="${v}"] [data-m="${modo}"]:visible, #tapa-modo [data-m="${modo}"]:visible`).first(); if (await l.count()) { await l.click().catch(() => {}); await espera(900) } }
        await pg.evaluate(() => scrollTo(0, 0));
      },
      // la grabación arranca recién con la primera pregunta en pantalla (el primer segundo tiene que enganchar)
      async grabando() { await espera(1100); grabando = true },
      cam: async (sel, z = 1, alto = .5, rapida = false) => { await pg.evaluate(([s, z, a, r]) => window.__cam(s, z, a, r), [sel, z, alto, rapida]); await espera(rapida ? 550 : 1000) },
      txt: t => pg.evaluate(t => window.__txt(t), t),
      sticker: (t, ok) => pg.evaluate(([t, ok]) => window.__sticker(t, ok), [t, ok]),
      async imagenes(sel) { await pg.waitForFunction(s => [...document.querySelectorAll(`${s} img`)].every(i => !i.src || i.complete), sel, { timeout: 10000 }).catch(() => {}); await espera(300) },
      async tocar(loc, { rapido = false } = {}) {
        const bx = await loc.boundingBox().catch(() => null); if (!bx) return false;
        const x = bx.x + bx.width / 2, y = bx.y + bx.height / 2;
        await pg.evaluate(([x, y]) => { const d = document.getElementById("rec-dedo"); d.style.opacity = 1; d.style.transform = `translate(${x}px,${y}px)` }, [x, y]);
        await espera(rapido ? 380 : 650);
        await pg.evaluate(() => { const d = document.getElementById("rec-dedo"); d.classList.remove("toca"); void d.offsetWidth; d.classList.add("toca") });
        await loc.click({ timeout: 3000, force: true }).catch(() => {});
        await espera(rapido ? 220 : 450); return true;
      },
      async escribir(sel, t) { const l = pg.locator(sel); await A.tocar(l, { rapido: true }); for (const c of t) { await l.type(c); await espera(55 + Math.random() * 60) } await espera(350) },
    };
    await JUEGOS[juego](pg, A);
    await pg.evaluate(() => { document.getElementById("rec-dedo").style.opacity = 0; window.__txt("") });
    await pg.evaluate(() => window.__fin(`<span class="chip">JUEGOS ROCK</span><h1>¿Cuántas<br>sacás vos?</h1><p>✔ Un desafío nuevo cada día<br>✔ Ranking con todos<br>✔ Gratis, sin descargar nada</p><span class="url">juegosrock.com.ar</span>`));
    await espera(3200);
    grabando = false; await cdp.send("Page.stopScreencast");
    if (cuadros.length < 20) throw new Error(`se grabaron muy pocos cuadros (${cuadros.length})`);
  } finally { await b.close(); srv.close() }

  // cuadros con su duración real → mp4 1080x1920 a 30 cuadros por segundo, con audio mudo (lo piden las redes)
  const lista = cuadros.map((c, i) => `file '${c.archivo}'\nduration ${Math.max(0.01, ((cuadros[i + 1] || c).t - c.t) || 0.5).toFixed(3)}`).join("\n")
    + `\nfile '${cuadros.at(-1).archivo}'\n`;
  const listaF = path.join(cuadrosDir, "cuadros.txt"); fs.writeFileSync(listaF, lista);
  const mp4 = path.join(salida, `reel-${juego}.mp4`);
  execFileSync(ffmpeg, ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", listaF,
    "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
    "-vf", "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=0xF2C230,fps=30,format=yuv420p",
    "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-c:a", "aac", "-b:a", "96k", "-shortest", "-movflags", "+faststart", mp4]);
  fs.rmSync(cuadrosDir, { recursive: true, force: true });
  log(`🎬 Video grabado en la página (${juego}): ${cuadros.length} cuadros, ${(cuadros.at(-1).t - cuadros[0].t).toFixed(1)} s → ${path.basename(mp4)}`);
  return mp4;
}

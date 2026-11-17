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
  #rec-banda{position:fixed;left:0;right:0;top:0;height:150px;z-index:99995;pointer-events:none;background:#f2c230;
    background-image:radial-gradient(rgba(20,18,16,.13) 1px,transparent 1.3px);background-size:6px 6px;border-bottom:4px solid #141210;box-shadow:0 8px 18px rgba(20,18,16,.18);transition:height .3s}
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
  for (const id of ["rec-banda", "rec-marca", "rec-txt", "rec-sticker", "rec-flash", "rec-dedo", "rec-fin"]) { const d = document.createElement("div"); d.id = id; document.body.appendChild(d) }
  // cámara: lleva el centro de un elemento al centro de la pantalla, con zoom (sobre la sección visible, no sobre la página entera)
  const C = { sec: null, tx: 0, ty: 0, z: 1 };
  window.__cam = (sel, z = 1, alto = .5, rapida = false) => {
    const sec = [...document.querySelectorAll("main > section, section.sub, section")].find(s => !s.hidden && s.offsetParent);
    if (!sec) return;
    if (C.sec !== sec) { if (C.sec) { C.sec.style.transform = ""; C.sec.classList.remove("cam-on") } C.sec = sec; C.tx = C.ty = 0; C.z = 1; sec.classList.add("cam-on") }
    sec.classList.toggle("cam-rapida", !!rapida);
    const W = innerWidth, H = innerHeight, r = sec.getBoundingClientRect(), sx = r.left - C.tx, sy = r.top - C.ty;
    if (!sel || z <= 1) { C.tx = 0; C.ty = 110; C.z = 1; sec.style.transform = "translate(0px,110px) scale(1)"; return }
    const el = typeof sel === "string" ? sec.querySelector(sel) || document.querySelector(sel) : sel; if (!el) return;
    const e = el.getBoundingClientRect(), cx = (e.left + e.width / 2 - r.left) / C.z, cy = (e.top + e.height / 2 - r.top) / C.z;
    const arriba = 160; let tx = W / 2 - sx - z * cx, ty = arriba + (H - arriba) * alto - sy - z * cy; // la franja de arriba tapa ~160 px
    tx = Math.min((z - 1) * sx, Math.max((1 - z) * (W - sx), tx)); // que la pantalla quede siempre cubierta por la página, sin bordes vacíos a los costados
    C.tx = tx; C.ty = ty; C.z = z; sec.style.transform = `translate(${tx}px,${ty}px) scale(${z})`;
  };
  document.getElementById("rec-marca").textContent = "JUEGOSROCK.COM.AR";
  window.__txt = t => { const e = document.getElementById("rec-txt"); e.innerHTML = t ? `<b>${t}</b>` : "";
    const b = e.querySelector("b"), alto = b ? Math.max(150, Math.ceil(b.getBoundingClientRect().bottom) + 22) : 64; document.getElementById("rec-banda").style.height = alto + "px" };
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

// ---------- Sonidos: efectos sintetizados acá mismo (sin música con derechos, así las redes no silencian el video) ----------
const SR = 44100;
const SONIDOS = (() => {
  const env = (t, a, d) => t < a ? t / a : Math.exp(-(t - a) / d);
  const hacer = (dur, f) => { const n = Math.round(dur * SR), x = new Float32Array(n); for (let i = 0; i < n; i++) x[i] = f(i / SR, i); return x };
  let ruido = 12345; const rnd = () => (ruido = (ruido * 1103515245 + 12345) & 0x7fffffff) / 0x3fffffff - 1;
  const tono = (fr, t) => Math.sin(2 * Math.PI * fr * t);
  return {
    // toque: un clic seco con cuerpo
    toque: hacer(.07, t => (tono(1400, t) * .5 + rnd() * .5) * env(t, .002, .012) * .55 + tono(180, t) * env(t, .001, .02) * .5),
    tecla: hacer(.04, t => (rnd() * .6 + tono(2600, t) * .4) * env(t, .001, .006) * .35),
    // acierto: dos notas que suben, brillantes
    bien: hacer(.55, t => { const a = t < .11 ? 0 : 1, fr = a ? 1318.5 : 987.8, tt = a ? t - .11 : t;
      return (tono(fr, tt) * .6 + tono(fr * 2, tt) * .2 + tono(fr * 3, tt) * .08) * env(tt, .004, a ? .16 : .07) * .6 }),
    // error: zumbido grave que baja
    mal: hacer(.45, t => { const fr = 190 - t * 120, w = Math.sign(tono(fr, t)) * .5 + tono(fr * .5, t) * .5; return w * env(t, .005, .14) * .38 }),
    // movimiento de cámara: soplido de ruido filtrado
    whoosh: (() => { let lp = 0; return hacer(.4, t => { const k = .02 + .2 * Math.sin(Math.PI * t / .4); lp += k * (rnd() - lp); return lp * Math.sin(Math.PI * t / .4) ** 2 * .9 }) })(),
    // texto nuevo arriba: "pop" corto
    pop: hacer(.12, t => tono(380 + 900 * t / .12, t) * env(t, .003, .035) * .45),
    // cierre: arpegio que sube y queda sonando
    fin: hacer(1.6, t => { const notas = [523.3, 659.3, 784, 1046.5]; let v = 0;
      notas.forEach((fr, i) => { const tt = t - i * .09; if (tt > 0) v += (tono(fr, tt) * .5 + tono(fr * 2, tt) * .15) * env(tt, .004, i === 3 ? .55 : .25) }); return v * .32 }),
  };
})();
// Música de fondo: una base de rock hecha acá (batería, bajo y guitarra con distorsión), 128 bpm, en mi menor
function musica(dur) {
  const n = Math.ceil(dur * SR), m = new Float32Array(n), BPM = 128, neg = 60 / BPM, oct = neg / 2;
  let ruido = 777; const rnd = () => (ruido = (ruido * 1103515245 + 12345) & 0x7fffffff) / 0x3fffffff - 1;
  const poner = (t0, largo, f, vol = 1) => { const i0 = Math.round(t0 * SR); for (let i = 0; i < largo * SR && i0 + i < n; i++) m[i0 + i] += f(i / SR) * vol };
  const bombo = t0 => poner(t0, .22, t => { const fr = 45 + 110 * Math.exp(-t / .03); return Math.sin(2 * Math.PI * fr * t) * Math.exp(-t / .12) }, .9);
  const caja = t0 => poner(t0, .2, t => (rnd() * .8 * Math.exp(-t / .07) + Math.sin(2 * Math.PI * 190 * t) * .5 * Math.exp(-t / .04)), .5);
  let hp = 0; const plato = (t0, v) => poner(t0, .06, t => { const r = rnd(), y = r - hp; hp = r; return y * Math.exp(-t / .018) }, v);
  const saw = (fr, t) => 2 * ((fr * t) % 1) - 1;
  const bajo = (t0, fr) => { let lp = 0; poner(t0, oct * .95, t => { lp += .08 * (saw(fr, t) - lp); return lp * Math.min(1, t / .005) * Math.exp(-t / .35) }, .55) };
  const guitarra = (t0, fr, largo, v) => { let lp = 0; poner(t0, largo, t => { const x = saw(fr, t) + saw(fr * 1.4983, t) * .8 + saw(fr * 2, t) * .5;
    lp += .18 * (Math.tanh(x * 3) - lp); return lp * Math.min(1, t / .004) * Math.exp(-t / (largo * .7)) }, v) };
  const acordes = [82.41, 82.41, 65.41, 73.42]; // mi, mi, do, re: un compás cada uno
  for (let c = 0; c * 4 * neg < dur; c++) {
    const raiz = acordes[c % 4], t = c * 4 * neg;
    for (let k = 0; k < 8; k++) { const tk = t + k * oct;
      if (k === 0 || k === 4 || k === 5) bombo(tk); if (k === 2 || k === 6) caja(tk); plato(tk, k % 2 ? .12 : .2);
      bajo(tk, raiz); guitarra(tk, raiz * 2, k === 0 ? oct * 3 : oct * .5, k === 0 ? .2 : .11) } // golpe abierto al empezar el compás y "chugs" apagados
  }
  // entra suave y se apaga al final
  for (let i = 0; i < n; i++) { const t = i / SR; m[i] *= Math.min(1, t / .4) * Math.min(1, (dur - t) / 1.2) }
  return m;
}
// ---------- Voz narradora (estilo TikTok): Piper, voz es_AR "daniela" (libre, sin conexión). Si no está instalada, el video sale sin voz ----------
// VOZ_MODELO = ruta al .onnx (la tarea de GitHub lo baja). Sin esa variable, no hay voz.
const paraLeer = t => String(t || "")
  .replace(/juegosrock\.com\.ar/gi, "juegos rock punto com punto ar")
  .replace(/[✔✘«»"#️⃣]/g, "").replace(/\s*·\s*/g, ", de ").replace(/\s+\+\s+/g, ", y ").replace(/\+(\d+)/g, "más $1")
  .replace(/\b1er\b/gi, "primer").replace(/\b3er\b/gi, "tercer").replace(/…/g, "...")
  .replace(/\s+/g, " ").trim()
  .replace(/^(.)(.*)$/, (m, a, b) => /^[A-ZÁÉÍÓÚÑ¡¿! ]+$/.test(m) ? (a + b.toLowerCase()) : m); // lo que viene en mayúsculas se lee normal
// Voz argentina de Microsoft (Azure Speech, neuronal: es-AR Elena o Tomás). Necesita AZURE_SPEECH_KEY y AZURE_SPEECH_REGION;
// AZURE_VOZ elige la voz (por defecto es-AR-ElenaNeural; la otra es es-AR-TomasNeural). Si no están, se usa Piper.
const xml = t => t.replace(/[<>&'"]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]);
async function sintetizarAzure(frases, dir) {
  const clave = process.env.AZURE_SPEECH_KEY, region = process.env.AZURE_SPEECH_REGION, voz = process.env.AZURE_VOZ || "es-AR-ElenaNeural";
  if (!clave || !region) return null;
  const out = [];
  for (const [i, f] of frases.entries()) {
    const r = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, { method: "POST",
      headers: { "Ocp-Apim-Subscription-Key": clave, "Content-Type": "application/ssml+xml", "X-Microsoft-OutputFormat": "riff-24khz-16bit-mono-pcm", "User-Agent": "juegosrock-videos" },
      body: `<speak version="1.0" xml:lang="es-AR"><voice name="${voz}"><prosody rate="+12%" pitch="+3%">${xml(f)}</prosody></voice></speak>` });
    if (!r.ok) throw new Error(`Azure respondió ${r.status} ${await r.text()}`);
    const a = path.join(dir, `voz${i}.wav`); fs.writeFileSync(a, Buffer.from(await r.arrayBuffer())); out.push(leerWav(a));
  }
  return out;
}
// Voz argentina de Microsoft sin cuenta (edge-tts, la lectura en voz alta de Edge). Uso no oficial: si deja de andar, queda Piper.
// EDGE_VOZ elige la voz (por defecto es-AR-ElenaNeural; la otra es es-AR-TomasNeural). EDGE_VOZ=no la apaga.
// Un video con Elena y el siguiente con Tomás (los videos salen martes, jueves y sábado: se cuentan en ese orden)
let VOZ_DEL_DIA = "es-AR-ElenaNeural";
function elegirVoz(semilla) {
  const m = String(semilla).match(/^\d{4}-\d{2}-\d{2}/); if (!m) return;
  const dias = Math.floor(Date.parse(m[0] + "T12:00:00Z") / 864e5), ds = new Date(m[0] + "T12:00:00Z").getUTCDay();
  const n = [2, 4, 6].includes(ds) ? Math.floor((dias + 4) / 7) * 3 + [2, 4, 6].indexOf(ds) : dias; // semanas de domingo a sábado
  VOZ_DEL_DIA = n % 2 ? "es-AR-TomasNeural" : "es-AR-ElenaNeural";
}
function sintetizarEdge(frases, dir, ffmpeg) {
  const voz = process.env.EDGE_VOZ || VOZ_DEL_DIA; if (voz === "no") return null;
  const lista = path.join(dir, "frases-edge.json"); fs.writeFileSync(lista, JSON.stringify(frases.map((f, i) => ({ t: f, a: path.join(dir, `edge${i}.mp3`) }))));
  execFileSync("python3", ["-c", `import asyncio,json,os,ssl,sys
import edge_tts, edge_tts.communicate as c
if os.environ.get("EDGE_CA"): c._SSL_CTX=ssl.create_default_context(cafile=os.environ["EDGE_CA"])
async def main():
  for f in json.load(open(sys.argv[2])):
    await edge_tts.Communicate(f["t"], sys.argv[1], rate="+12%", proxy=os.environ.get("HTTPS_PROXY")).save(f["a"])
asyncio.run(main())`, voz, lista], { stdio: "pipe", timeout: 120000 });
  return frases.map((f, i) => { const mp3 = path.join(dir, `edge${i}.mp3`), wav = path.join(dir, `edge${i}.wav`);
    execFileSync(ffmpeg, ["-y", "-loglevel", "error", "-i", mp3, "-ac", "1", "-ar", "24000", "-c:a", "pcm_s16le", wav]); return leerWav(wav) });
}
async function sintetizar(frases, dir, log = console.log, ffmpeg = "ffmpeg") {
  if (!frases.length) return [];
  try { const a = await sintetizarAzure(frases, dir); if (a) return a } catch (e) { log(`(la voz de Microsoft con clave falló: ${e.message.slice(0, 160)}; pruebo otra)`) }
  try { const a = sintetizarEdge(frases, dir, ffmpeg); if (a && a.every(x => x.length)) return a } catch (e) { log(`(la voz de Microsoft sin cuenta falló: ${String(e.message).split("\n")[0].slice(0, 160)}; uso Piper)`) }
  const modelo = process.env.VOZ_MODELO; if (!modelo || !fs.existsSync(modelo)) return [];
  const lista = path.join(dir, "frases.json"); fs.writeFileSync(lista, JSON.stringify(frases.map((f, i) => ({ t: f, a: path.join(dir, `voz${i}.wav`) }))));
  execFileSync("python3", ["-c", `import json,sys,wave
from piper import PiperVoice, SynthesisConfig
v=PiperVoice.load(sys.argv[1]); c=SynthesisConfig(length_scale=0.9)
for f in json.load(open(sys.argv[2])):
  with wave.open(f["a"],"wb") as w: v.synthesize_wav(f["t"],w,syn_config=c)`, modelo, lista], { stdio: "pipe" });
  return frases.map((f, i) => leerWav(path.join(dir, `voz${i}.wav`)));
}
// WAV 16 bits mono → Float32 a 44100 Hz
function leerWav(f) {
  const b = fs.readFileSync(f); let i = 12, sr = 22050, datos = null;
  while (i < b.length - 8) { const id = b.toString("ascii", i, i + 4), n = b.readUInt32LE(i + 4);
    if (id === "fmt ") sr = b.readUInt32LE(i + 12); if (id === "data") { datos = b.subarray(i + 8, i + 8 + n); break } i += 8 + n + (n % 2) }
  if (!datos) return new Float32Array(0);
  const m = datos.length / 2, k = SR / sr, out = new Float32Array(Math.floor(m * k));
  for (let j = 0; j < out.length; j++) { const x = j / k, a = Math.floor(x), f2 = x - a, v1 = datos.readInt16LE(Math.min(m - 1, a) * 2), v2 = datos.readInt16LE(Math.min(m - 1, a + 1) * 2); out[j] = (v1 + (v2 - v1) * f2) / 32768 }
  return out;
}

// Arma la pista de audio (WAV mono 16 bits) con cada efecto en su momento
function pistaWav(eventos, dur, voces = []) {
  const n = Math.ceil((dur + .5) * SR), mix = new Float32Array(n), fondo = musica(dur), habla = new Float32Array(n);
  // la voz: cada frase en su momento; si todavía está hablando la anterior, espera (y si se atrasa mucho, se saltea)
  let libre = 0;
  for (const v of voces) { const s0 = Math.max(v.t, libre); if (s0 - v.t > 1.2 || !v.a.length) continue;
    const i0 = Math.round(s0 * SR); for (let i = 0; i < v.a.length && i0 + i < n; i++) { mix[i0 + i] += v.a[i] * 1.15; habla[i0 + i] = 1 }
    libre = s0 + v.a.length / SR + .08 }
  // la música va abajo de los efectos y baja más mientras habla la voz (con subida y bajada suaves)
  let g = 1; for (let i = 0; i < fondo.length && i < n; i++) { const obj = habla[i] ? .35 : 1; g += (obj - g) * (obj < g ? .002 : .0002); mix[i] += fondo[i] * .32 * g }
  for (const e of eventos) { const s = SONIDOS[e.n], i0 = Math.round(e.t * SR); if (!s || i0 < 0) continue;
    for (let i = 0; i < s.length && i0 + i < n; i++) mix[i0 + i] += s[i] * (e.vol ?? 1) }
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write("WAVEfmt ", 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write("data", 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, Math.tanh(mix[i] * 1.1))) * 32000), 44 + i * 2);
  return buf;
}

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
  elegirVoz(semilla);
  const cuadrosDir = path.join(salida, `reel-${juego}-cuadros`);
  fs.rmSync(cuadrosDir, { recursive: true, force: true }); fs.mkdirSync(cuadrosDir, { recursive: true });
  const srv = await servir(puerto), b = await chromium.launch(), cuadros = [], eventos = [], frases = [];
  try {
    const ctx = await b.newContext({ viewport: { width: 432, height: 768 }, deviceScaleFactor: 2.5, isMobile: true, hasTouch: true, reducedMotion: "no-preference" });
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
    await cdp.send("Page.startScreencast", { format: "jpeg", quality: 100, maxWidth: 1080, maxHeight: 1920, everyNthFrame: 1 });

    const sonar = (n, vol = 1) => { if (grabando) eventos.push({ n, vol, t: Date.now() / 1000 }) };
    const decir = (texto, demora = 0) => { const f = paraLeer(texto); if (grabando && f) frases.push({ f, t: Date.now() / 1000 + demora }) };
    const A = {
      sonar,
      async ir(v, modo) {
        await pg.evaluate(v => irA(v), v); await espera(700);
        if (modo) { const l = pg.locator(`.modo-dia[data-juego="${v}"] [data-m="${modo}"]:visible, #tapa-modo [data-m="${modo}"]:visible`).first(); if (await l.count()) { await l.click().catch(() => {}); await espera(900) } }
        await pg.evaluate(() => scrollTo(0, 0));
      },
      // la grabación arranca recién con la primera pregunta en pantalla (el primer segundo tiene que enganchar)
      async grabando() { await espera(1100); grabando = true; const t = await pg.evaluate(() => document.getElementById("rec-txt").innerText); decir(t) },
      cam: async (sel, z = 1, alto = .5, rapida = false) => { sonar("whoosh", rapida ? .35 : .6); await pg.evaluate(([s, z, a, r]) => window.__cam(s, z, a, r), [sel, z, alto, rapida]); await espera(rapida ? 550 : 1000) },
      txt: t => { if (t) { sonar("pop", .8); decir(t) } return pg.evaluate(t => window.__txt(t), t) },
      sticker: (t, ok) => { sonar(ok ? "bien" : "mal"); decir(t, .25); return pg.evaluate(([t, ok]) => window.__sticker(t, ok), [t, ok]) },
      async imagenes(sel) { await pg.waitForFunction(s => [...document.querySelectorAll(`${s} img`)].every(i => !i.src || i.complete), sel, { timeout: 10000 }).catch(() => {}); await espera(300) },
      async tocar(loc, { rapido = false } = {}) {
        const bx = await loc.boundingBox().catch(() => null); if (!bx) return false;
        const x = bx.x + bx.width / 2, y = bx.y + bx.height / 2;
        await pg.evaluate(([x, y]) => { const d = document.getElementById("rec-dedo"); d.style.opacity = 1; d.style.transform = `translate(${x}px,${y}px)` }, [x, y]);
        await espera(rapido ? 380 : 650);
        await pg.evaluate(() => { const d = document.getElementById("rec-dedo"); d.classList.remove("toca"); void d.offsetWidth; d.classList.add("toca") }); sonar("toque");
        await loc.click({ timeout: 3000, force: true }).catch(() => {});
        await espera(rapido ? 220 : 450); return true;
      },
      async escribir(sel, t) { const l = pg.locator(sel); await A.tocar(l, { rapido: true }); for (const c of t) { sonar("tecla", .8); await l.type(c); await espera(55 + Math.random() * 60) } await espera(350) },
    };
    await JUEGOS[juego](pg, A);
    await pg.evaluate(() => { document.getElementById("rec-dedo").style.opacity = 0; window.__txt("") });
    sonar("fin"); decir("¿Cuántas sacás vos? Jugá gratis en juegosrock.com.ar", .3); await pg.evaluate(() => window.__fin(`<span class="chip">JUEGOS ROCK</span><h1>¿Cuántas<br>sacás vos?</h1><p>✔ Un desafío nuevo cada día<br>✔ Ranking con todos<br>✔ Gratis, sin descargar nada</p><span class="url">juegosrock.com.ar</span>`));
    await espera(4300);
    grabando = false; await cdp.send("Page.stopScreencast");
    if (cuadros.length < 20) throw new Error(`se grabaron muy pocos cuadros (${cuadros.length})`);
  } finally { await b.close(); srv.close() }

  // cuadros con su duración real → mp4 1080x1920 a 30 cuadros por segundo, con audio mudo (lo piden las redes)
  const lista = cuadros.map((c, i) => `file '${c.archivo}'\nduration ${Math.max(0.01, ((cuadros[i + 1] || c).t - c.t) || 0.5).toFixed(3)}`).join("\n")
    + `\nfile '${cuadros.at(-1).archivo}'\n`;
  const listaF = path.join(cuadrosDir, "cuadros.txt"); fs.writeFileSync(listaF, lista);
  const t0 = cuadros[0].t, wav = path.join(cuadrosDir, "sonido.wav");
  let voces = []; try { const a = await sintetizar(frases.map(f => f.f), cuadrosDir, log, ffmpeg); voces = frases.map((f, i) => ({ t: f.t - t0, a: a[i] || new Float32Array(0) })).filter(v => v.a.length) }
  catch (e) { log(`(sin voz: ${String(e.message).split("\n")[0]})`) }
  fs.writeFileSync(wav, pistaWav(eventos.map(e => ({ ...e, t: e.t - t0 })), cuadros.at(-1).t - t0, voces));
  const mp4 = path.join(salida, `reel-${juego}.mp4`);
  execFileSync(ffmpeg, ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", listaF,
    "-i", wav, "-af", "aformat=channel_layouts=stereo,loudnorm=I=-14:TP=-1.5:LRA=11", "-ar", "44100",
    "-vf", "scale=1080:1920:flags=lanczos:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=0xF2C230,fps=30,format=yuv420p",
    // Full HD vertical en máxima calidad: H.264 High 4.2, casi sin pérdida (crf 14), con tope de 20 Mbps (lo que aceptan Instagram y TikTok)
    "-c:v", "libx264", "-preset", "slow", "-tune", "animation", "-crf", "14", "-maxrate", "20M", "-bufsize", "40M", "-profile:v", "high", "-level", "4.2",
    "-r", "30", "-g", "60", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
    "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-shortest", "-movflags", "+faststart", mp4]);
  fs.rmSync(cuadrosDir, { recursive: true, force: true });
  log(`🎬 Video grabado en la página (${juego}, voz ${(process.env.EDGE_VOZ || VOZ_DEL_DIA).replace(/^es-AR-|Neural$/g, "")}): ${cuadros.length} cuadros, ${eventos.length} sonidos, ${voces.length} frases de voz, ${(cuadros.at(-1).t - cuadros[0].t).toFixed(1)} s → ${path.basename(mp4)}`);
  return mp4;
}

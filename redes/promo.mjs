// Video promocional: graba un recorrido por la página en formato celular (1080x1920) con textos encima.
// Lo corre la tarea "Publicar en redes" con turno "promo"; el mp4 queda en redes/salida/promo/ para descargar.
// Juega en modo Libre (no muestra las respuestas del día) y bloquea Supabase (no sube puntajes).
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const PUBLIC = path.join(RAIZ, "public");
const SALIDA = path.join(RAIZ, "redes", "salida", "promo");
const CUADROS = path.join(SALIDA, "cuadros");
const espera = ms => new Promise(r => setTimeout(r, ms));

const TIPOS = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json", ".css": "text/css",
  ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json" };
function servir() {
  return new Promise(ok => {
    const s = http.createServer((req, res) => {
      let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
      if (p.endsWith("/")) p += "index.html";
      let f = path.join(PUBLIC, p);
      if (!f.startsWith(PUBLIC) || !fs.existsSync(f)) f = path.join(PUBLIC, "index.html");
      res.writeHead(200, { "Content-Type": TIPOS[path.extname(f)] || "application/octet-stream" });
      fs.createReadStream(f).pipe(res);
    }).listen(8098, () => ok(s));
  });
}

async function rutaFfmpeg() {
  try { const m = await import("ffmpeg-static"); if (m.default && fs.existsSync(m.default)) return m.default } catch (e) {}
  return "ffmpeg";
}

// Capa de textos y dedo, dentro de la página
const CAPA = () => {
  const st = document.createElement("style");
  st.textContent = `
  #promo-txt{position:fixed;left:0;right:0;top:12px;z-index:99999;display:flex;justify-content:center;pointer-events:none;transition:opacity .35s,transform .35s;opacity:0;transform:translateY(-16px)}
  #promo-txt.ver{opacity:1;transform:none}
  #promo-txt b{background:var(--tinta,#141210);color:var(--papel,#f2c230);font:800 23px/1.15 var(--display,sans-serif);text-transform:uppercase;padding:12px 18px;max-width:86%;text-align:center;box-shadow:6px 6px 0 var(--rojo,#d7262b)}
  #promo-tel{position:fixed;inset:0;z-index:100000;background:var(--papel,#f2c230);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;text-align:center;padding:30px;transition:opacity .4s;opacity:0;pointer-events:none}
  #promo-tel.ver{opacity:1}
  #promo-tel h1{font:400 46px/1.02 var(--display,sans-serif);color:var(--tinta,#141210);margin:0;text-transform:uppercase}
  #promo-tel p{font:700 19px/1.5 var(--texto,sans-serif);color:var(--tinta,#141210);margin:0}
  #promo-tel .url{background:var(--rojo,#d7262b);color:#fff;font:400 26px var(--display,sans-serif);padding:10px 18px;box-shadow:6px 6px 0 var(--tinta,#141210)}
  #promo-tel .chip{background:var(--tinta,#141210);color:var(--papel,#f2c230);font:500 13px monospace;letter-spacing:2px;padding:6px 10px}
  #promo-dedo{position:fixed;left:0;top:0;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;background:rgba(255,255,255,.8);border:3px solid var(--tinta,#141210);z-index:99998;pointer-events:none;transition:transform .55s cubic-bezier(.3,.7,.3,1),opacity .3s;opacity:0}
  #promo-dedo.toca{animation:promoToca .35s}
  @keyframes promoToca{50%{width:24px;height:24px;margin:-12px 0 0 -12px;background:var(--rojo,#d7262b)}}`;
  document.head.appendChild(st);
  for (const id of ["promo-txt", "promo-tel", "promo-dedo"]) { const d = document.createElement("div"); d.id = id; document.body.appendChild(d) }
};

async function main() {
  fs.rmSync(SALIDA, { recursive: true, force: true }); fs.mkdirSync(CUADROS, { recursive: true });
  const srv = await servir();
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 412, height: 732 }, deviceScaleFactor: 1080 / 412, isMobile: true, hasTouch: true });
  await ctx.route(/supabase\.co/, r => r.abort());
  await ctx.addInitScript(() => { try { localStorage.setItem("tapa-nombre", JSON.stringify("Juegos Rock")) } catch (e) {} });
  const pg = await ctx.newPage();
  pg.on("pageerror", e => console.log("  [página]", e.message));
  await pg.goto("http://localhost:8098/", { waitUntil: "load" });
  await pg.waitForTimeout(2500);
  await pg.evaluate(CAPA);

  const txt = async t => pg.evaluate(t => { const e = document.getElementById("promo-txt"); if (!t) { e.classList.remove("ver"); return }
    e.innerHTML = `<b>${t}</b>`; e.classList.add("ver") }, t);
  const tel = async html => pg.evaluate(h => { const e = document.getElementById("promo-tel"); if (!h) { e.classList.remove("ver"); return }
    e.innerHTML = h; e.classList.add("ver") }, html);
  const tocar = async (sel, pausa = 700) => {
    const el = typeof sel === "string" ? pg.locator(sel).first() : sel;
    try { await el.scrollIntoViewIfNeeded({ timeout: 3000 }) } catch (e) { return false }
    const bx = await el.boundingBox(); if (!bx) return false;
    const x = bx.x + bx.width / 2, y = bx.y + bx.height / 2;
    await pg.evaluate(([x, y]) => { const d = document.getElementById("promo-dedo"); d.style.opacity = 1; d.style.transform = `translate(${x}px,${y}px)` }, [x, y]);
    await espera(450);
    await pg.evaluate(() => { const d = document.getElementById("promo-dedo"); d.classList.remove("toca"); void d.offsetWidth; d.classList.add("toca") });
    try { await el.click({ timeout: 2000 }) } catch (e) {}
    await espera(pausa); return true;
  };
  const sinDedo = () => pg.evaluate(() => { document.getElementById("promo-dedo").style.opacity = 0 });
  const inicio = async () => { await sinDedo(); await pg.evaluate(() => irA("inicio")); await espera(500) };
  const juego = async (ir, titulo) => {
    await inicio(); await txt(titulo);
    await tocar(`#v-hub [data-ir="${ir}"]`, 900);
    const libre = pg.locator(`.modo-dia[data-juego="${ir}"] [data-m="libre"]:visible, #tapa-modo [data-m="libre"]:visible`).first();
    if (await libre.count()) await tocar(libre, 1200);
  };
  const paso = async (nombre, f) => { try { await f() } catch (e) { console.log(`  (salteo ${nombre}: ${e.message.split("\n")[0]})`) } };

  // grabación: Chrome manda un cuadro cada vez que cambia la pantalla, con su hora
  const cdp = await ctx.newCDPSession(pg), cuadros = [];
  cdp.on("Page.screencastFrame", f => {
    const n = String(cuadros.length).padStart(5, "0"), archivo = path.join(CUADROS, `c${n}.jpg`);
    fs.writeFileSync(archivo, Buffer.from(f.data, "base64")); cuadros.push({ archivo, t: f.metadata.timestamp });
    cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
  });
  await tel(`<span class="chip">JUEGOS ROCK</span><h1>¿Cuánto sabés<br>de rock?</h1><p>12 juegos · un desafío nuevo cada día</p>`);
  await espera(300);
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 88, maxWidth: 1080, maxHeight: 1920, everyNthFrame: 1 });
  await espera(2200);

  await paso("inicio", async () => {
    await tel(""); await txt("12 juegos de rock en una sola página"); await espera(1000);
    for (let i = 0; i < 24; i++) { await pg.mouse.wheel(0, 80); await espera(50) }
    await txt("Un desafío nuevo cada día, igual para todos");
    for (let i = 0; i < 24; i++) { await pg.mouse.wheel(0, 80); await espera(50) }
    await espera(500);
  });
  await paso("tapa", async () => {
    await juego("diario", "Adiviná el disco por su tapa");
    await pg.locator("#opts button").first().waitFor({ timeout: 8000 }); await espera(900);
    await tocar(pg.locator("#opts button").nth(1), 1400);
  });
  await paso("antes", async () => {
    await juego("antes", "¿Salió antes o después?");
    await espera(500);
    for (let i = 0; i < 2; i++) { const bt = pg.locator("#antes-der button:visible"); if (!(await bt.count())) break; await tocar(bt.nth(i % 2), 1700) }
  });
  await paso("ahorcado", async () => {
    await juego("ahorcado", "Ahorcado rockero: letra por letra");
    await espera(800);
    for (const l of ["A", "E", "O", "S"]) await tocar(pg.locator("#aho-teclado button", { hasText: new RegExp(`^${l}$`) }), 300);
    await espera(600);
  });
  await paso("bingo", async () => {
    await juego("bingo", "Bingo rockero contra reloj");
    await espera(600);
    if (await pg.locator("#bingo-empezar:visible").count()) await tocar("#bingo-empezar", 1300);
    for (let i = 0; i < 3; i++) { const c = pg.locator("#bingo-grilla button:visible"); if (!(await c.count())) break; await tocar(c.nth((i * 5) % (await c.count())), 900) }
  });
  await paso("conexiones", async () => {
    await juego("conexiones", "Conexiones: juntá los temas del mismo disco");
    await espera(500);
    if (await pg.locator("#con-empezar:visible").count()) await tocar("#con-empezar", 600);
    await pg.evaluate(() => scrollTo(0, 0)); await espera(400);
    const t = pg.locator("#con-grilla > *:visible");
    for (let i = 0; i < 4 && i < await t.count(); i++) await tocar(t.nth(i), 350);
    await espera(800);
  });

  await sinDedo(); await txt("");
  await tel(`<h1>¿Te animás?</h1><p>✔ Gratis y sin descargar nada<br>✔ Ranking diario<br>✔ Rock nacional e internacional</p><span class="url">juegosrock.com.ar</span>`);
  await espera(3200);
  await cdp.send("Page.stopScreencast");
  await b.close(); srv.close();

  // cuadros con su duración real → mp4 a 30 cuadros por segundo, con audio mudo (lo piden las redes)
  if (cuadros.length < 10) throw new Error("se grabaron muy pocos cuadros");
  const lista = cuadros.map((c, i) => `file '${c.archivo}'\nduration ${Math.max(0.01, ((cuadros[i + 1] || c).t - c.t) || 0.5).toFixed(3)}`).join("\n")
    + `\nfile '${cuadros.at(-1).archivo}'\n`;
  const listaF = path.join(SALIDA, "cuadros.txt"); fs.writeFileSync(listaF, lista);
  const mp4 = path.join(SALIDA, "juegosrock-promo.mp4");
  execFileSync(await rutaFfmpeg(), ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", listaF,
    "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
    "-vf", "setpts=PTS/1.2,scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=0xF2C230,fps=30,format=yuv420p",
    "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-c:a", "aac", "-b:a", "96k", "-shortest", "-movflags", "+faststart", mp4], { stdio: "inherit" });
  fs.rmSync(CUADROS, { recursive: true, force: true }); fs.rmSync(listaF);
  console.log(`🎬 Video promocional: ${cuadros.length} cuadros → ${mp4}`);
}

main().catch(e => { console.error(e); process.exit(1) });

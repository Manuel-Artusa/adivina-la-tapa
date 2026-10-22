// Conecta la cuenta de TikTok una sola vez (la corre la tarea de GitHub "Conectar TikTok").
// Sin código: muestra el link para autorizar. Con código: lo canjea y guarda el acceso en Supabase.
import fs from "node:fs";
const env = process.env;
const SUPA = (env.SUPA_URL || "").replace(/\/+$/, ""), SERVICIO = env.SUPABASE_SERVICE_KEY || "";
const REDIRECT = "https://juegosrock.com.ar/tiktok/";
const salida = [];
const log = t => { console.log(t); salida.push(t) };
const fin = c => { if (env.GITHUB_STEP_SUMMARY) fs.appendFileSync(env.GITHUB_STEP_SUMMARY, "## Conectar TikTok\n\n" + salida.join("\n\n") + "\n"); process.exit(c) };
if (!env.TIKTOK_CLIENT_KEY || !env.TIKTOK_CLIENT_SECRET) { log("❌ Faltan los secretos TIKTOK_CLIENT_KEY y TIKTOK_CLIENT_SECRET."); fin(1) }
const code = (env.CODIGO || "").trim();
if (!code) {
  const url = `https://www.tiktok.com/v2/auth/authorize/?client_key=${encodeURIComponent(env.TIKTOK_CLIENT_KEY)}&scope=user.info.basic,video.upload&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT)}&state=juegosrock`;
  log("1. Abrí este link en el navegador donde tenés abierto TikTok con @juegosrock y aceptá:");
  log(url);
  log("2. Te va a llevar a juegosrock.com.ar/tiktok/ con un código. Copialo y corré esta misma tarea pegándolo en «código».");
  fin(0);
}
const r = await fetch("https://open.tiktokapis.com/v2/oauth/token/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ client_key: env.TIKTOK_CLIENT_KEY, client_secret: env.TIKTOK_CLIENT_SECRET, code, grant_type: "authorization_code", redirect_uri: REDIRECT }) });
const j = await r.json().catch(() => ({}));
if (!j.refresh_token) { log(`❌ TikTok no aceptó el código: ${j.error_description || j.error || r.status}. Los códigos vencen rápido: pedí uno nuevo y probá enseguida.`); fin(1) }
const g = await fetch(`${SUPA}/rest/v1/redes`, { method: "POST", headers: { apikey: SERVICIO, Authorization: `Bearer ${SERVICIO}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" },
  body: JSON.stringify({ clave: "tt_refresh", valor: j.refresh_token, actualizado: new Date().toISOString() }) });
if (!g.ok) { log(`❌ No pude guardar el acceso en Supabase (${g.status}).`); fin(1) }
log(`✅ TikTok conectado (permisos: ${j.scope || "?"}). Desde ahora los videos te llegan a la bandeja de TikTok.`);
fin(0);

# Publicaciones automáticas en Instagram

La tarea de GitHub **"Publicar en Instagram"** (`.github/workflows/redes.yml`) corre dos veces por día:

| Hora (Argentina) | Qué publica |
|---|---|
| 9:00 | Post del día (aniversario de un disco nacional o redondo, o la primera tapa de la Tapa del día) · historias: respuesta de ayer, tapa de hoy, banda del día, grilla del día, ranking de ayer (el domingo, el de la semana) · los miércoles: carrusel de Ordená la discografía |
| 19:00 | Cumpleaños de artistas (o aniversario de formación de una banda) · efemérides del día · martes, jueves y sábado: un video de los juegos (Reel), rotando los de `redes/videos/` |

Las imágenes salen del mismo generador de `/contenido/`. En cada corrida quedan para descargar (zip) en la pestaña Actions durante 7 días.

## Configurar (una sola vez)

### 1. Supabase
1. Supabase → **SQL Editor** → pegar entero `supabase.sql` → **Run** (crea la tabla `redes` y la carpeta pública `redes`).
2. Supabase → **Project Settings → API Keys** → copiar la clave **service_role / secret** (la secreta, no la anon).
   Esa clave va SOLO en los secretos de GitHub del paso 3: nunca en Render ni en el código.

### 2. Instagram y Meta
1. En la app de Instagram, con @juegosrock: **Configuración → Tipo de cuenta y herramientas → Cambiar a cuenta profesional** (Creador o Empresa, cualquiera sirve).
2. Entrar a <https://developers.facebook.com/apps> con tu Facebook → **Crear app** → caso de uso **"Administrar mensajes y contenido en Instagram"** → crear.
3. En la app: **Casos de uso → Personalizar → Configuración de la API con inicio de sesión de Instagram**.
4. En **"Generar tokens de acceso"** → **Agregar cuenta** → entrar con @juegosrock y aceptar los permisos.
   - Si pide agregar la cuenta como evaluador: **Roles de la app → Roles → Evaluadores de Instagram** → agregar `juegosrock`, y aceptar la invitación en Instagram: **Configuración → Apps y sitios web → Invitaciones de evaluador**.
5. Tocar **Generar token** al lado de la cuenta y copiarlo (es largo). Dura 60 días, pero la tarea lo renueva sola.

### 3. Secretos en GitHub
GitHub → el repo → **Settings → Secrets and variables → Actions → New repository secret**, uno por uno:

| Nombre | Valor |
|---|---|
| `SUPA_URL` | la misma URL de Supabase que está en Render |
| `SUPA_KEY` | la misma clave anon/publishable que está en Render |
| `SUPABASE_SERVICE_KEY` | la clave service_role/secret del paso 1 |
| `IG_TOKEN` | el token de Instagram del paso 2 |

### 4. Probar
1. GitHub → **Actions → Publicar en Instagram → Run workflow** → dejar tildado **Modo prueba** → Run.
2. Cuando termine, abrir la corrida → abajo, en **Artifacts**, bajar el zip y mirar las imágenes y `textos.json`.
3. Si está todo bien, correrla de nuevo **destildando Modo prueba**: publica de verdad.

### 5. Prender el automático
GitHub → **Settings → Secrets and variables → Actions → pestaña Variables → New repository variable**:
nombre `REDES_ACTIVO`, valor `si`. Desde ese momento publica sola a las 9 y a las 19.
Para pausarla, cambiar el valor a `no`.

## Bueno saber
- Si algo falla, GitHub te manda un mail y el resumen de la corrida dice qué pasó.
- Si una corrida se repite, no publica dos veces lo mismo.
- GitHub a veces atrasa las tareas programadas unos minutos.
- TikTok no deja publicar automático sin una revisión de su parte: los videos están en `redes/videos/` para subirlos a mano.
- Para agregar un video nuevo a la rotación: ponerlo en `redes/videos/` y sumarlo a `REDES_VIDEOS` en `index.html`.

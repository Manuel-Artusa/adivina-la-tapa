# Threads, Facebook y TikTok

La tarea **"Publicar en redes"** (antes "Publicar en Instagram") publica lo mismo en todas las redes que estén conectadas.
Las que no estén configuradas se saltean, así que podés conectarlas de a una.

| Red | Qué recibe |
|---|---|
| Instagram | todo: posts, historias y videos |
| Threads | posts y videos (las historias no existen en Threads) |
| Facebook | posts y videos en la página |
| TikTok | los videos de los juegos (martes, jueves y sábado; se arma uno nuevo cada vez, rotando por 12 juegos, con discos y bandas distintos). **Te llegan a la bandeja de TikTok**: abrís la notificación, le ponés música y publicás |

Todos los secretos se cargan en GitHub → el repo → **Settings → Secrets and variables → Actions → New repository secret**.

---

## Threads

1. Si todavía no tenés Threads: abrí la app de Threads e iniciá sesión con @juegosrock (se crea con la cuenta de Instagram).
2. En <https://developers.facebook.com/apps> → **Crear app** → caso de uso **"Acceder a la API de Threads"** (tiene que ser una app aparte de la de Instagram) → nombre `JuegosRock-Threads`.
3. En la app: **Casos de uso → Acceder a la API de Threads → Personalizar**:
   - en **Permisos** agregá `threads_basic` y `threads_content_publish`;
   - en **Configuración**, en las tres direcciones que pide (devolución de llamada, desinstalar y eliminar) poné `https://juegosrock.com.ar/privacidad/`.
4. **Roles de la app → Roles → Evaluadores de Threads → Agregar** → `juegosrock`.
   En la app de Threads: **Configuración → Cuenta → Permisos de sitios web → Invitaciones → Aceptar**.
5. Volvé a **Casos de uso → Acceder a la API de Threads → Configuración** → **Generador de tokens de usuario** → **Generar token** al lado de juegosrock → copiá el token.
6. Secreto en GitHub: `THREADS_TOKEN` = ese token. Dura 60 días, pero la tarea lo renueva sola.

## Facebook (página)

1. Si no tenés una página de Facebook de Juegos Rock, creala: Facebook → **Páginas → Crear página**.
2. En la app de Meta que ya tenés (la de Instagram): **Casos de uso → Agregar caso de uso → "Administrar todo en tu página"**. En sus permisos agregá `pages_manage_posts`, `pages_read_engagement` y `pages_show_list`.
3. Entrá a <https://developers.facebook.com/tools/explorer>:
   - arriba a la derecha elegí tu app;
   - en **Usuario o página** dejá "Token de usuario";
   - en **Permisos** agregá `pages_manage_posts`, `pages_read_engagement` y `pages_show_list`;
   - tocá **Generate Access Token**, aceptá y elegí la página de Juegos Rock.
4. Copiá el token y pegalo en <https://developers.facebook.com/tools/debug/accesstoken> → **Depurar** → abajo **Extender token de acceso** → copiá el token largo que aparece.
5. Secreto en GitHub: `FB_TOKEN` = ese token largo. La tarea saca de ahí el token de la página, que no vence.
   (Si administrás más de una página y elige otra: agregá el secreto `FB_PAGE_ID` con el número de la página de Juegos Rock.)

## TikTok

1. Entrá a <https://developers.tiktok.com> e iniciá sesión con la cuenta de TikTok de @juegosrock.
2. **Manage apps → Connect an app**. Completá:
   - nombre `Juegos Rock`, ícono: `icon-512.png` de la carpeta del proyecto, categoría Entretenimiento, descripción corta;
   - **Terms of Service URL**: `https://juegosrock.com.ar/terminos/`
   - **Privacy Policy URL**: `https://juegosrock.com.ar/privacidad/`
   - plataforma **Web**, URL `https://juegosrock.com.ar`.
3. **Add products**: agregá **Login Kit** y **Content Posting API**.
   - En Login Kit, **Redirect URI**: `https://juegosrock.com.ar/tiktok/`
   - En **Scopes** tienen que estar `user.info.basic` y `video.upload`.
4. Arriba, pasá a **Sandbox** → **Create sandbox** → en **Target users** agregá tu cuenta de TikTok (@juegosrock).
   Copiá **Client key** y **Client secret** de esa sandbox.
5. Secretos en GitHub: `TIKTOK_CLIENT_KEY` y `TIKTOK_CLIENT_SECRET`.
6. Conectar la cuenta (una sola vez):
   - GitHub → **Actions → Conectar TikTok → Run workflow** con el código vacío.
   - Abrí la corrida: en el resumen aparece un link. Abrilo en el navegador donde estás con @juegosrock en TikTok y aceptá.
   - Te lleva a `juegosrock.com.ar/tiktok/` con un código → **Copiar código**.
   - Enseguida (el código vence en unos minutos): **Run workflow** otra vez, pegando el código. Tiene que decir "✅ TikTok conectado".

Si TikTok rechaza las subidas desde la sandbox, en el panel tocá **Submit for review** (explicá que es para subir los videos de tu propio sitio a tu propia cuenta) y usá las claves de producción cuando lo aprueben.

---

## Probar
**Actions → Publicar en redes → Run workflow** → turno `todo` → **destildá Modo prueba** solo cuando quieras publicar de verdad.
El resumen de la corrida dice qué se publicó en cada red y, si algo falla, por qué.

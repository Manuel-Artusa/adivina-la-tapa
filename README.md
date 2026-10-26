# Juegos Rock

Juegos web de rock, con foco en rock nacional: adiviná la tapa, el tema en 1 segundo, ordená la discografía, conexiones y más.

- **Normal:** partidas libres de 10 rondas (Todo, Nacional o Internacional).
- **Diario:** los mismos 10 discos para todos, cambia a las 00:00 hora argentina.
- **Top:** ranking compartido con Supabase, uno por juego y un top general que suma los 7 desafíos del día.
- **Todos los juegos tienen desafío del día** (igual para todos, una vez por día) y modo libre.
- **Días anteriores:** desde el inicio se pueden jugar los desafíos de días pasados (no suman al ranking ni a la racha).
- **Yo:** racha de días, calendario y estadísticas por desafío (se guardan en el navegador).
- **Compartir mi día:** arma un mensaje con los puntos de los 7 desafíos.
- **Se instala como app** en el celular (manifest + service worker).
- **Juegos:** Adiviná el tema (fragmentos de audio), ¿Antes o después?, Ordená la discografía, Tema número 1, Conexiones y ¿Qué tema no está? (La Vela Puerca).
- **¿De qué tema es?** (Redondos e Indio): escribís el tema; si errás, aparece otra frase. Las frases (hasta 4 por tema)
  se cargan a mano en `/cargar-frases/` y se guardan en `frases.json`. El juego aparece cuando hay 10 temas cargados o más.

La página es `index.html`. Las tapas, temas y audios salen de iTunes y se guardan en `discos.json`
(lo arma `armar_discos.py` con GitHub Actions), así el juego no depende de buscar en vivo.

## Variables en Render (Environment)

| Variable | Para qué |
|---|---|
| `SUPA_URL` | URL del proyecto de Supabase |
| `SUPA_KEY` | clave pública **anon** o **publishable** (nunca la secret/service_role) |
| `SITE_URL` | dirección del sitio, para la imagen al compartir |
| `GOATCOUNTER` | código de GoatCounter, para contar visitas (opcional) |

Render corre `node build.js`, que arma `public/` con esas variables. Nada de eso queda en GitHub.

## Supabase

Correr `supabase.sql` en el SQL Editor (se puede repetir). Deja el top protegido: solo puntajes del día,
uno por dispositivo y por juego, con máximos por juego; nadie puede editar ni borrar.

## discos.json

En GitHub → **Actions** → **Armar discos.json** → **Run workflow**. Busca los discos nuevos del catálogo
(o todos, tildando la opción) y guarda el archivo en el repo. Se refresca solo el día 1 de cada mes.
Como el robot agrega commits, antes de subir cambios hacé `git pull`.

## Deploy en Render

Static Site con **Build Command** `node build.js` y **Publish Directory** `public`.

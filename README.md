# Juegos Rock

Juegos web de rock, con foco en rock nacional: adiviná la tapa, el tema en 1 segundo, ordená la discografía, conexiones y más.

- **Normal:** partidas libres de 10 rondas (Todo, Nacional o Internacional).
- **Diario:** los mismos 10 discos para todos, cambia a las 00:00 hora argentina.
- **Top:** ranking compartido con Supabase, uno por juego y un top general que suma los 7 desafíos del día.
- **Todos los juegos tienen desafío del día** (igual para todos, una vez por día) y modo libre.
- **Juegos:** Adiviná el tema (fragmentos de audio), ¿Antes o después?, Ordená la discografía, Tema número 1, Conexiones y ¿Qué tema no está? (La Vela Puerca).

Es un solo archivo, `index.html`. Las tapas se piden en vivo a la API pública de iTunes.

## Activar el top

1. En Supabase, correr `supabase.sql` en el SQL Editor.
2. En Render → tu sitio → **Environment**, cargar `SUPA_URL` (la URL del proyecto) y `SUPA_KEY` (la clave pública **anon** o **publishable**, nunca la secret/service_role).
3. Render corre `node build.js` al publicar y completa esas variables en la página. Las claves no se guardan en GitHub.

## Deploy en Render

Static Site con **Build Command** `node build.js` y **Publish Directory** `public`.

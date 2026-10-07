# Adiviná la Tapa

Juego web para adivinar tapas de discos de rock, con foco en rock nacional. La tapa arranca pixelada y se aclara con cada error.

- **Normal:** partidas libres de 10 rondas (Todo, Nacional o Internacional).
- **Diario:** los mismos 10 discos para todos, cambia a las 00:00 hora argentina.
- **Top:** ranking compartido con Supabase.

Es un solo archivo, `index.html`. Las tapas se piden en vivo a la API pública de iTunes.

## Activar el top

1. Crear un proyecto en Supabase y correr `supabase.sql` en el SQL Editor.
2. Pegar la URL del proyecto y la clave pública (anon / publishable) en `SUPA_URL` y `SUPA_KEY`, al principio del script de `index.html`.

## Deploy en Render

New → Blueprint → elegir este repo. Render lee `render.yaml` y lo publica como Static Site.

-- Pasa los puntajes YA guardados de la Tapa del día y del Tema del día a la escala nueva (sobre 100).
-- Correr UNA vez en Supabase → SQL Editor → Run (si se corre de nuevo no hace nada: solo toca los del formato viejo).
-- No cambia ningún desafío: solo convierte los puntos de quienes ya jugaron.

begin;

-- Tapa del día: era sobre 50 → ahora sobre 100 (por 2)
update puntajes p
set puntos = least(100, p.puntos * 2), genero = 'diario'
where p.modo = 'diario' and p.genero = 'todos'
  and not exists (select 1 from puntajes q where q.jugador = p.jugador and q.modo = 'diario' and q.genero = 'diario' and q.dia = p.dia);

-- Tema del día: era de 1 a 6 → ahora 100, 80, 60, 40, 20, 10 (0 si no lo sacó)
update puntajes p
set puntos = case p.puntos when 6 then 100 when 5 then 80 when 4 then 60 when 3 then 40 when 2 then 20 when 1 then 10 else 0 end,
    genero = 'diario'
where p.modo = 'tema' and p.genero = 'todos'
  and not exists (select 1 from puntajes q where q.jugador = p.jugador and q.modo = 'tema' and q.genero = 'diario' and q.dia = p.dia);

commit;

-- Para ver cómo quedó hoy:
select modo, nombre, puntos from puntajes
where dia = (now() at time zone 'America/Argentina/Buenos_Aires')::date and modo in ('diario','tema')
order by modo, puntos desc;

-- Top de Adiviná la Tapa. Pegar entero en Supabase → SQL Editor → Run.
-- Sirve tanto si la tabla no existe como si ya la habías creado antes: la crea o la actualiza.

create table if not exists puntajes (
  id bigint generated always as identity primary key,
  nombre text not null check (char_length(nombre) between 1 and 20),
  puntos int not null,
  modo text not null,
  genero text not null default 'todos',
  dia date not null default (now() at time zone 'America/Argentina/Buenos_Aires')::date,
  created_at timestamptz not null default now()
);

-- Reglas de qué se puede guardar (incluye los tops de todos los juegos y sus desafíos del día)
alter table puntajes drop constraint if exists puntajes_puntos_check;
alter table puntajes drop constraint if exists puntajes_modo_check;
alter table puntajes drop constraint if exists puntajes_genero_check;
alter table puntajes add constraint puntajes_puntos_check check (puntos between 0 and 500);
alter table puntajes add constraint puntajes_modo_check check (modo in ('diario','normal','tema','antes','orden','abre','conexiones','impostor'));
alter table puntajes add constraint puntajes_genero_check check (genero in ('todos','nac','int','facil','normal','dificil','diario'));

-- Índice para que los tops carguen rápido
create index if not exists puntajes_top_idx on puntajes (modo, genero, dia, puntos desc);
create index if not exists puntajes_dia_idx on puntajes (dia);

-- Cualquiera puede ver el top y subir puntajes, nadie puede editar ni borrar
alter table puntajes enable row level security;
drop policy if exists "ver top" on puntajes;
drop policy if exists "subir puntaje" on puntajes;
create policy "ver top" on puntajes for select using (true);
create policy "subir puntaje" on puntajes for insert with check (true);

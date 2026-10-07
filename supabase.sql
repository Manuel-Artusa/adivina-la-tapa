-- Tabla del top. Pegar en Supabase → SQL Editor → Run
create table puntajes (
  id bigint generated always as identity primary key,
  nombre text not null check (char_length(nombre) between 1 and 20),
  puntos int not null check (puntos between 0 and 50),
  modo text not null check (modo in ('diario','normal')),
  genero text not null default 'todos' check (genero in ('todos','nac','int')),
  dia date not null default (now() at time zone 'America/Argentina/Buenos_Aires')::date,
  created_at timestamptz not null default now()
);
alter table puntajes enable row level security;
create policy "ver top" on puntajes for select using (true);
create policy "subir puntaje" on puntajes for insert with check (true);

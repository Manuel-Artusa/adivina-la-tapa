-- Top de Juegos Rock. Pegar entero en Supabase → SQL Editor → Run.
-- Se puede correr las veces que haga falta: crea o actualiza la tabla sin borrar puntajes.

create table if not exists puntajes (
  id bigint generated always as identity primary key,
  nombre text not null check (char_length(nombre) between 1 and 20),
  puntos int not null,
  modo text not null,
  genero text not null default 'todos',
  dia date not null default (now() at time zone 'America/Argentina/Buenos_Aires')::date,
  created_at timestamptz not null default now()
);

-- Id anónimo de cada dispositivo (lo genera el juego)
alter table puntajes add column if not exists jugador uuid;

-- Reglas generales de qué se puede guardar
alter table puntajes drop constraint if exists puntajes_puntos_check;
alter table puntajes drop constraint if exists puntajes_modo_check;
alter table puntajes drop constraint if exists puntajes_genero_check;
alter table puntajes add constraint puntajes_puntos_check check (puntos between 0 and 500);
alter table puntajes add constraint puntajes_modo_check check (modo in ('diario','normal','tema','antes','orden','abre','conexiones','impostor'));
alter table puntajes add constraint puntajes_genero_check check (genero in ('todos','nac','int','facil','normal','dificil','diario'));

-- Un solo puntaje por dispositivo, por juego y por día (el segundo intento se rechaza)
create unique index if not exists puntajes_uno_por_dia on puntajes (jugador, modo, genero, dia) where jugador is not null;

-- Índices para que los tops carguen rápido
create index if not exists puntajes_top_idx on puntajes (modo, genero, dia, puntos desc);
create index if not exists puntajes_dia_idx on puntajes (dia);

-- Permisos: cualquiera puede ver el top. Para subir un puntaje tiene que ser
-- del desafío de HOY, con id de dispositivo y con un puntaje posible para ese juego.
-- Nadie puede editar ni borrar.
alter table puntajes enable row level security;
drop policy if exists "ver top" on puntajes;
drop policy if exists "subir puntaje" on puntajes;
create policy "ver top" on puntajes for select using (true);
create policy "subir puntaje" on puntajes for insert with check (
  jugador is not null
  and dia = (now() at time zone 'America/Argentina/Buenos_Aires')::date
  and (
       (modo = 'diario' and genero = 'todos' and puntos <= 50)
    or (modo = 'tema'   and genero = 'todos' and puntos <= 6)
    or (modo in ('antes','orden','abre','conexiones','impostor') and genero = 'diario'
        and puntos <= 100 and puntos % 10 = 0)
  )
);

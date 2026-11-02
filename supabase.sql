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
-- Cualquier juego (nombre corto en minúsculas): así los juegos nuevos no necesitan tocar esto
alter table puntajes add constraint puntajes_modo_check check (modo ~ '^[a-z]{3,20}$');
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
       -- formato viejo (se dejan para no romper puntajes de días anteriores)
       (modo = 'diario' and genero = 'todos' and puntos <= 50)
    or (modo = 'tema'   and genero = 'todos' and puntos <= 6)
    -- Tapa del día sobre 100 (va de a 2)
    or (modo = 'diario' and genero = 'diario' and puntos <= 100 and puntos % 2 = 0)
    -- el resto de los desafíos del día (incluido el Tema del día) sobre 100, de a 10; la grilla hasta 120
    or (modo not in ('diario','normal') and genero = 'diario'
        and puntos <= (case when modo = 'grilla' then 120 else 100 end) and puntos % 10 = 0)
  )
);

-- ===== Publicaciones automáticas en Instagram (tarea de GitHub "Publicar en Instagram") =====
-- Tabla interna: guarda el token de Instagram (se renueva solo) y qué se publicó cada día.
-- Sin políticas: solo la puede leer o escribir la clave secreta (service_role) que usa la tarea, nunca la página.
create table if not exists redes (
  clave text primary key,
  valor text,
  actualizado timestamptz not null default now()
);
alter table redes enable row level security;

-- Carpeta pública donde la tarea deja las imágenes y videos del día (Instagram las baja de ahí).
-- Se borran solas a los 4 días.
insert into storage.buckets (id, name, public)
values ('redes', 'redes', true)
on conflict (id) do update set public = true;


-- ===== Cuentas con Google: el progreso de cada jugador (nombre, rachas, récords, desafíos jugados) =====
-- Cada uno puede leer y guardar solo su propia fila. Antes de usarlo: activar Google en Authentication → Providers.
create table if not exists cuentas (
  user_id uuid primary key references auth.users(id) on delete cascade,
  datos jsonb not null default '{}'::jsonb check (octet_length(datos::text) < 300000),
  actualizado timestamptz not null default now()
);
alter table cuentas enable row level security;
drop policy if exists "ver mi cuenta" on cuentas;
drop policy if exists "crear mi cuenta" on cuentas;
drop policy if exists "guardar mi cuenta" on cuentas;
create policy "ver mi cuenta" on cuentas for select using (auth.uid() = user_id);
create policy "crear mi cuenta" on cuentas for insert with check (auth.uid() = user_id);
create policy "guardar mi cuenta" on cuentas for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

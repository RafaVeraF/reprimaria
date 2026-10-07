-- =====================================================================
--  REPRIMARIA · Esquema de base de datos para Supabase
--  Cómo usarlo: Supabase → SQL Editor → New query → pega TODO este
--  archivo → Run. Después corre supabase/invitados.sql con los correos.
--  Se puede volver a correr sin problema (es idempotente).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. TABLAS
-- ---------------------------------------------------------------------

-- Lista de invitados: solo estos correos pueden crear cuenta.
create table if not exists public.invitados (
  email     text primary key,
  nombre    text not null,
  es_admin  boolean not null default false
);

-- Perfil de cada integrante (se crea solo al registrarse).
create table if not exists public.perfiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  nombre     text not null,
  emoji      text not null default '🙂',
  color      text not null default '#2f6f4f',
  es_admin   boolean not null default false,
  created_at timestamptz not null default now()
);

-- Cursos. estado: 'propuesta' (en el pizarrón) o 'programado' (ganó un domingo).
create table if not exists public.cursos (
  id          uuid primary key default gen_random_uuid(),
  autor_id    uuid not null references public.perfiles(id) on delete cascade,
  titulo      text not null,
  descripcion text not null default '',
  emoji       text not null default '📚',
  estado      text not null default 'propuesta' check (estado in ('propuesta','programado')),
  created_at  timestamptz not null default now()
);

-- Lecciones dentro de un curso.
create table if not exists public.lecciones (
  id         uuid primary key default gen_random_uuid(),
  curso_id   uuid not null references public.cursos(id) on delete cascade,
  orden      int  not null default 1,
  titulo     text not null,
  contenido  text not null default '',
  video_url  text,
  created_at timestamptz not null default now()
);

-- Material de apoyo (archivo en Storage o link externo).
create table if not exists public.materiales (
  id           uuid primary key default gen_random_uuid(),
  leccion_id   uuid not null references public.lecciones(id) on delete cascade,
  nombre       text not null,
  url          text,          -- link externo
  storage_path text,          -- ruta dentro del bucket "materiales"
  created_at   timestamptz not null default now()
);

-- Inscripciones a cursos.
create table if not exists public.inscripciones (
  curso_id   uuid not null references public.cursos(id) on delete cascade,
  usuario_id uuid not null default auth.uid() references public.perfiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (curso_id, usuario_id)
);

-- Apuntes personales (uno por lección y persona; solo los ve su autor).
create table if not exists public.apuntes (
  leccion_id uuid not null references public.lecciones(id) on delete cascade,
  usuario_id uuid not null default auth.uid() references public.perfiles(id) on delete cascade,
  contenido  text not null default '',
  updated_at timestamptz not null default now(),
  primary key (leccion_id, usuario_id)
);

-- Comentarios en lecciones.
create table if not exists public.comentarios (
  id         uuid primary key default gen_random_uuid(),
  leccion_id uuid not null references public.lecciones(id) on delete cascade,
  usuario_id uuid not null default auth.uid() references public.perfiles(id) on delete cascade,
  contenido  text not null check (length(trim(contenido)) > 0),
  created_at timestamptz not null default now()
);

-- Reacciones en lecciones.
create table if not exists public.reacciones (
  leccion_id uuid not null references public.lecciones(id) on delete cascade,
  usuario_id uuid not null default auth.uid() references public.perfiles(id) on delete cascade,
  emoji      text not null check (emoji in ('👏','🤯','😂','❤️','🤓')),
  primary key (leccion_id, usuario_id, emoji)
);

-- Votos de la semana (semana = lunes de esa semana).
create table if not exists public.votos (
  id         uuid primary key default gen_random_uuid(),
  semana     date not null,
  usuario_id uuid not null default auth.uid() references public.perfiles(id) on delete cascade,
  curso_id   uuid not null references public.cursos(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (semana, usuario_id, curso_id)
);

-- Domingos de Reprimaria: qué curso se dio (o se dará) cada domingo.
create table if not exists public.domingos (
  fecha    date primary key,
  curso_id uuid not null unique references public.cursos(id) on delete cascade,
  nota     text
);

create index if not exists lecciones_curso_idx    on public.lecciones(curso_id, orden);
create index if not exists materiales_leccion_idx on public.materiales(leccion_id);
create index if not exists comentarios_leccion_idx on public.comentarios(leccion_id, created_at);
create index if not exists votos_semana_idx       on public.votos(semana, curso_id);

-- ---------------------------------------------------------------------
-- 2. FUNCIONES DE APOYO
-- ---------------------------------------------------------------------

create or replace function public.es_miembro() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles where id = auth.uid());
$$;

create or replace function public.es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select es_admin from public.perfiles where id = auth.uid()), false);
$$;

create or replace function public.es_autor_curso(p_curso uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.cursos where id = p_curso and autor_id = auth.uid());
$$;

create or replace function public.curso_de_leccion(p_leccion uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select curso_id from public.lecciones where id = p_leccion;
$$;

-- Hora de la familia (Ciudad de México).
create or replace function public.ahora_local() returns timestamp
language sql stable as $$
  select now() at time zone 'America/Mexico_City';
$$;

-- Lunes de la semana actual.
create or replace function public.semana_actual() returns date
language sql stable as $$
  select date_trunc('week', public.ahora_local())::date;
$$;

-- La votación está abierta de lunes a jueves.
create or replace function public.votacion_abierta() returns boolean
language sql stable as $$
  select extract(isodow from public.ahora_local()) between 1 and 4;
$$;

-- ---------------------------------------------------------------------
-- 3. TRIGGERS
-- ---------------------------------------------------------------------

-- Al crear una cuenta: solo si el correo está invitado; crea su perfil.
create or replace function public.al_crear_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_inv public.invitados%rowtype;
begin
  select * into v_inv from public.invitados where lower(email) = lower(new.email);
  if not found then
    raise exception 'REPRIMARIA_NO_INVITADO: este correo no está en la lista de invitados';
  end if;
  insert into public.perfiles (id, nombre, es_admin)
  values (new.id, v_inv.nombre, v_inv.es_admin)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function public.al_crear_usuario();

-- Nadie puede hacerse admin a sí mismo.
create or replace function public.proteger_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.es_admin is distinct from old.es_admin and not public.es_admin() then
    new.es_admin := old.es_admin;
  end if;
  return new;
end $$;

drop trigger if exists proteger_perfil on public.perfiles;
create trigger proteger_perfil before update on public.perfiles
  for each row execute function public.proteger_perfil();

-- El estado del curso solo lo cambia la votación (o un admin).
create or replace function public.proteger_curso() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if not public.es_admin() then
      new.autor_id := auth.uid();
      new.estado := 'propuesta';
    end if;
  elsif new.estado is distinct from old.estado and not public.es_admin()
        and coalesce(current_setting('reprimaria.sistema', true), '') <> 'si' then
    new.estado := old.estado;
  end if;
  return new;
end $$;

drop trigger if exists proteger_curso on public.cursos;
create trigger proteger_curso before insert or update on public.cursos
  for each row execute function public.proteger_curso();

-- Reglas del voto.
create or replace function public.validar_voto() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_curso public.cursos%rowtype;
begin
  new.usuario_id := auth.uid();
  new.semana := public.semana_actual();
  if not public.votacion_abierta() then
    raise exception 'La votación solo está abierta de lunes a jueves';
  end if;
  select * into v_curso from public.cursos where id = new.curso_id;
  if v_curso.estado <> 'propuesta' then
    raise exception 'Ese curso ya no está en votación';
  end if;
  if v_curso.autor_id = auth.uid() then
    raise exception 'No puedes votar por tu propio curso';
  end if;
  if (select count(*) from public.votos
       where usuario_id = auth.uid() and semana = new.semana) >= 3 then
    raise exception 'Ya usaste tus 3 votos de esta semana';
  end if;
  return new;
end $$;

drop trigger if exists validar_voto on public.votos;
create trigger validar_voto before insert on public.votos
  for each row execute function public.validar_voto();

-- Al guardar un apunte, actualiza la fecha.
create or replace function public.tocar_apunte() returns trigger
language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists tocar_apunte on public.apuntes;
create trigger tocar_apunte before update on public.apuntes
  for each row execute function public.tocar_apunte();

-- ---------------------------------------------------------------------
-- 4. CIERRE DE VOTACIÓN
--    Se llama sola desde la app a partir del viernes (cualquier miembro
--    que entre la dispara). Un admin la puede forzar antes.
--    Reglas:
--      · 1 punto por voto de la semana.
--      · +1 punto de "antigüedad" si el curso lleva 3+ semanas propuesto.
--      · Quien dio el último domingo no puede ganar esta semana.
--      · Empate: gana quien lleva más tiempo sin dar clase.
-- ---------------------------------------------------------------------
create or replace function public.cerrar_votacion() returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_semana  date := public.semana_actual();
  v_domingo date := public.semana_actual() + 6;
  v_existente uuid;
  v_ultimo_profe uuid;
  v_ganador uuid;
begin
  if not public.es_miembro() then
    raise exception 'No autorizado';
  end if;

  select curso_id into v_existente from public.domingos where fecha = v_domingo;
  if found then return v_existente; end if;

  if public.votacion_abierta() and not public.es_admin() then
    return null; -- todavía se está votando
  end if;

  select c.autor_id into v_ultimo_profe
    from public.domingos d join public.cursos c on c.id = d.curso_id
   where d.fecha < v_domingo
   order by d.fecha desc limit 1;

  with puntajes as (
    select c.id,
           (select count(*) from public.votos v
             where v.curso_id = c.id and v.semana = v_semana)
           + case when c.created_at <= now() - interval '21 days' then 1 else 0 end
             as puntos,
           coalesce((select max(d.fecha) from public.domingos d
                       join public.cursos c2 on c2.id = d.curso_id
                      where c2.autor_id = c.autor_id), date '1900-01-01')
             as ultima_clase
      from public.cursos c
     where c.estado = 'propuesta'
       and c.autor_id is distinct from v_ultimo_profe
  )
  select id into v_ganador
    from puntajes
   where puntos > 0
   order by puntos desc, ultima_clase asc, random()
   limit 1;

  if v_ganador is null then
    return null; -- nadie votó: domingo libre
  end if;

  perform set_config('reprimaria.sistema', 'si', true);
  insert into public.domingos (fecha, curso_id) values (v_domingo, v_ganador);
  update public.cursos set estado = 'programado' where id = v_ganador;
  return v_ganador;
end $$;

-- Puntaje actual de cada propuesta (para mostrar en el pizarrón).
create or replace function public.puntajes_semana()
returns table (curso_id uuid, votos bigint, antiguedad int)
language sql stable security definer set search_path = public as $$
  select c.id,
         (select count(*) from public.votos v
           where v.curso_id = c.id and v.semana = public.semana_actual()),
         case when c.created_at <= now() - interval '21 days' then 1 else 0 end
    from public.cursos c
   where c.estado = 'propuesta' and public.es_miembro();
$$;

-- Estado de la semana para la portada.
create or replace function public.estado_semana()
returns table (semana date, domingo date, abierta boolean, dia int)
language sql stable as $$
  select public.semana_actual(),
         public.semana_actual() + 6,
         public.votacion_abierta(),
         extract(isodow from public.ahora_local())::int;
$$;

-- Admin: cancelar el domingo programado (el curso regresa al pizarrón).
create or replace function public.cancelar_domingo(p_fecha date) returns void
language plpgsql security definer set search_path = public as $$
declare v_curso uuid;
begin
  if not public.es_admin() then raise exception 'Solo administradores'; end if;
  delete from public.domingos where fecha = p_fecha returning curso_id into v_curso;
  if v_curso is not null then
    perform set_config('reprimaria.sistema', 'si', true);
    update public.cursos set estado = 'propuesta' where id = v_curso;
  end if;
end $$;

-- Admin: registrar una clase pasada (por ejemplo, las de la pandemia).
create or replace function public.registrar_clase_pasada(
  p_titulo text, p_autor uuid, p_fecha date, p_emoji text default '📚'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.es_admin() then raise exception 'Solo administradores'; end if;
  perform set_config('reprimaria.sistema', 'si', true);
  insert into public.cursos (autor_id, titulo, emoji, estado, created_at)
  values (p_autor, p_titulo, coalesce(p_emoji, '📚'), 'programado', p_fecha)
  returning id into v_id;
  insert into public.domingos (fecha, curso_id, nota) values (p_fecha, v_id, 'Clase histórica');
  return v_id;
end $$;

-- ---------------------------------------------------------------------
-- 5. SEGURIDAD (Row Level Security)
-- ---------------------------------------------------------------------
alter table public.invitados     enable row level security;
alter table public.perfiles      enable row level security;
alter table public.cursos        enable row level security;
alter table public.lecciones     enable row level security;
alter table public.materiales    enable row level security;
alter table public.inscripciones enable row level security;
alter table public.apuntes       enable row level security;
alter table public.comentarios   enable row level security;
alter table public.reacciones    enable row level security;
alter table public.votos         enable row level security;
alter table public.domingos      enable row level security;

do $$
declare r record;
begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public' loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- invitados: solo admins
create policy inv_admin on public.invitados for all
  using (public.es_admin()) with check (public.es_admin());

-- perfiles
create policy perf_ver on public.perfiles for select using (public.es_miembro());
create policy perf_editar on public.perfiles for update
  using (id = auth.uid() or public.es_admin())
  with check (id = auth.uid() or public.es_admin());

-- cursos
create policy cur_ver on public.cursos for select using (public.es_miembro());
create policy cur_crear on public.cursos for insert
  with check (public.es_miembro() and (autor_id = auth.uid() or public.es_admin()));
create policy cur_editar on public.cursos for update
  using (autor_id = auth.uid() or public.es_admin());
create policy cur_borrar on public.cursos for delete
  using ((autor_id = auth.uid() and estado = 'propuesta') or public.es_admin());

-- lecciones
create policy lec_ver on public.lecciones for select using (public.es_miembro());
create policy lec_escribir on public.lecciones for all
  using (public.es_autor_curso(curso_id) or public.es_admin())
  with check (public.es_autor_curso(curso_id) or public.es_admin());

-- materiales
create policy mat_ver on public.materiales for select using (public.es_miembro());
create policy mat_escribir on public.materiales for all
  using (public.es_autor_curso(public.curso_de_leccion(leccion_id)) or public.es_admin())
  with check (public.es_autor_curso(public.curso_de_leccion(leccion_id)) or public.es_admin());

-- inscripciones
create policy ins_ver on public.inscripciones for select using (public.es_miembro());
create policy ins_crear on public.inscripciones for insert
  with check (usuario_id = auth.uid() and public.es_miembro());
create policy ins_borrar on public.inscripciones for delete using (usuario_id = auth.uid());

-- apuntes: privados
create policy apu_propios on public.apuntes for all
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- comentarios
create policy com_ver on public.comentarios for select using (public.es_miembro());
create policy com_crear on public.comentarios for insert
  with check (usuario_id = auth.uid() and public.es_miembro());
create policy com_editar on public.comentarios for update using (usuario_id = auth.uid());
create policy com_borrar on public.comentarios for delete
  using (usuario_id = auth.uid() or public.es_admin());

-- reacciones
create policy rea_ver on public.reacciones for select using (public.es_miembro());
create policy rea_crear on public.reacciones for insert
  with check (usuario_id = auth.uid() and public.es_miembro());
create policy rea_borrar on public.reacciones for delete using (usuario_id = auth.uid());

-- votos
create policy vot_ver on public.votos for select using (public.es_miembro());
create policy vot_crear on public.votos for insert with check (public.es_miembro());
create policy vot_borrar on public.votos for delete
  using (usuario_id = auth.uid() and semana = public.semana_actual() and public.votacion_abierta());

-- domingos
create policy dom_ver on public.domingos for select using (public.es_miembro());
create policy dom_admin on public.domingos for all
  using (public.es_admin()) with check (public.es_admin());

-- ---------------------------------------------------------------------
-- 6. ARCHIVOS (Supabase Storage) · bucket privado "materiales"
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('materiales', 'materiales', false, 52428800)  -- 50 MB por archivo
on conflict (id) do update set public = false, file_size_limit = 52428800;

drop policy if exists "reprimaria ver archivos"    on storage.objects;
drop policy if exists "reprimaria subir archivos"  on storage.objects;
drop policy if exists "reprimaria borrar archivos" on storage.objects;

create policy "reprimaria ver archivos" on storage.objects for select
  using (bucket_id = 'materiales' and public.es_miembro());
create policy "reprimaria subir archivos" on storage.objects for insert
  with check (bucket_id = 'materiales' and public.es_miembro());
create policy "reprimaria borrar archivos" on storage.objects for delete
  using (bucket_id = 'materiales' and (owner = auth.uid() or public.es_admin()));

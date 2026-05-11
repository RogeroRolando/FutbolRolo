-- Rolo Futbol — esquema inicial. Ejecutar en Supabase SQL Editor (o supabase db push).

create extension if not exists "pgcrypto";

-- Perfiles ligados a auth.users (rol admin / solo lectura)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  role text not null default 'viewer'
    check (role in ('admin', 'viewer')),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      split_part(new.email, '@', 1)
    ),
    'viewer'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

-- Jugadores
create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  birth_date date,
  phone text,
  primary_position text not null default 'OTRO',
  foot text check (foot is null or foot in ('derecha', 'izquierda', 'ambas')),
  strengths text,
  weaknesses text,
  fitness_status text not null default 'ok'
    check (fitness_status in ('ok', 'molestias', 'lesionado')),
  rating numeric(4, 1)
    check (rating is null or (rating >= 1 and rating <= 10)),
  rating_updated_at timestamptz,
  shirt_number int,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists players_archived_idx on public.players (archived);
create index if not exists players_name_idx on public.players (full_name);

-- Eventos (entreno / partido)
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('entrenamiento', 'partido')),
  starts_at timestamptz not null,
  title text,
  description text,
  created_at timestamptz not null default now()
);

-- Asistencia por evento + jugador
create table if not exists public.attendance (
  event_id uuid not null references public.events (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  status text not null
    check (status in ('presente', 'ausente', 'justificado', 'lesion')),
  primary key (event_id, player_id)
);

-- Convocados
create table if not exists public.call_ups (
  event_id uuid not null references public.events (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  primary key (event_id, player_id)
);

-- Pizarra táctica serializada
create table if not exists public.tactical_boards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  event_id uuid references public.events (id) on delete set null,
  schema_version int not null default 1,
  konva_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists tactical_boards_updated_idx
  on public.tactical_boards (updated_at desc);

-- updated_at automático en players
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists players_updated_at on public.players;
create trigger players_updated_at
  before update on public.players
  for each row execute function public.set_updated_at();

-- RLS
alter table public.profiles enable row level security;
alter table public.players enable row level security;
alter table public.events enable row level security;
alter table public.attendance enable row level security;
alter table public.call_ups enable row level security;
alter table public.tactical_boards enable row level security;

-- profiles: cada usuario ve el suyo; admins ven todos (para futura gestión de roles)
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- jugadores
create policy players_select on public.players
  for select to authenticated using (true);

create policy players_insert on public.players
  for insert to authenticated with check (public.is_admin());

create policy players_update on public.players
  for update to authenticated using (public.is_admin());

create policy players_delete on public.players
  for delete to authenticated using (public.is_admin());

-- eventos
create policy events_select on public.events
  for select to authenticated using (true);

create policy events_insert on public.events
  for insert to authenticated with check (public.is_admin());

create policy events_update on public.events
  for update to authenticated using (public.is_admin());

create policy events_delete on public.events
  for delete to authenticated using (public.is_admin());

-- asistencia
create policy attendance_select on public.attendance
  for select to authenticated using (true);

create policy attendance_write on public.attendance
  for insert to authenticated with check (public.is_admin());

create policy attendance_update on public.attendance
  for update to authenticated using (public.is_admin());

create policy attendance_delete on public.attendance
  for delete to authenticated using (public.is_admin());

-- convocados
create policy call_ups_select on public.call_ups
  for select to authenticated using (true);

create policy call_ups_insert on public.call_ups
  for insert to authenticated with check (public.is_admin());

create policy call_ups_update on public.call_ups
  for update to authenticated using (public.is_admin());

create policy call_ups_delete on public.call_ups
  for delete to authenticated using (public.is_admin());

-- pizarras
create policy boards_select on public.tactical_boards
  for select to authenticated using (true);

create policy boards_insert on public.tactical_boards
  for insert to authenticated with check (public.is_admin());

create policy boards_update on public.tactical_boards
  for update to authenticated using (public.is_admin());

create policy boards_delete on public.tactical_boards
  for delete to authenticated using (public.is_admin());

comment on table public.profiles is 'Perfil app; role admin | viewer';
comment on table public.players is 'Plantel; archived=true conserva historial';
comment on table public.tactical_boards is 'konva_json + schema_version para migraciones';

-- Dar rol administrador a un usuario (ejecutar con el email real):
-- update public.profiles set role = 'admin'
-- where id = (select id from auth.users where email = 'admin@ejemplo.com' limit 1);

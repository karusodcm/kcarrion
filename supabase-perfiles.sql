-- kcarrion · Perfiles de usuario
-- Ejecuta este script UNA vez en Supabase: SQL Editor → New query → pegar → Run.
--
-- Al registrarse, la página envía los datos (nombre, celular, área, especialidad,
-- departamento, provincia, distrito) junto con el correo y la contraseña.
-- Supabase los guarda en el usuario (user_metadata) y este script, además,
-- los copia a la tabla public.perfiles para que puedas consultarlos o exportarlos.

create table if not exists public.perfiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  correo        text,
  nombre        text,
  celular       text,
  area          text,
  especialidad  text,
  departamento  text,
  provincia     text,
  distrito      text,
  creado        timestamptz not null default now(),
  actualizado   timestamptz not null default now()
);

alter table public.perfiles enable row level security;

-- Cada persona solo puede ver y editar su propio perfil.
drop policy if exists "perfil_select_propio" on public.perfiles;
create policy "perfil_select_propio" on public.perfiles
  for select using (auth.uid() = id);

drop policy if exists "perfil_update_propio" on public.perfiles;
create policy "perfil_update_propio" on public.perfiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Crea el perfil automáticamente cuando alguien se registra
-- (funciona aunque Supabase exija confirmar el correo).
create or replace function public.crear_perfil_al_registrarse()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfiles (id, correo, nombre, celular, area, especialidad, departamento, provincia, distrito)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'nombre',
    new.raw_user_meta_data ->> 'celular',
    new.raw_user_meta_data ->> 'area',
    new.raw_user_meta_data ->> 'especialidad',
    new.raw_user_meta_data ->> 'departamento',
    new.raw_user_meta_data ->> 'provincia',
    new.raw_user_meta_data ->> 'distrito'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.crear_perfil_al_registrarse();

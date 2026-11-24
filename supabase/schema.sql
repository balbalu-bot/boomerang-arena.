-- =====================================================================
--  Boomerang Battle Arena — database Supabase (stanze private)
--  Incollare TUTTO in: Supabase → SQL Editor → New query → Run
--  Si può rieseguire senza problemi.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------- TABELLE ----------
create table if not exists public.rooms (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,
  host_id     uuid not null references auth.users(id) on delete cascade,
  locked      boolean not null default false,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '12 hours'
);

create table if not exists public.room_members (
  room_id    uuid not null references public.rooms(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  nickname   text not null check (char_length(nickname) between 1 and 16),
  joined_at  timestamptz not null default now(),
  primary key (room_id, user_id)
);

alter table public.rooms        enable row level security;
alter table public.room_members enable row level security;

-- ---------- FUNZIONI DI SUPPORTO ----------
-- true se l'utente collegato fa parte della stanza
create or replace function public.is_room_member(r uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.room_members m where m.room_id = r and m.user_id = auth.uid());
$$;

-- codice d'invito casuale (8 caratteri, senza lettere ambigue)
create or replace function public.new_room_code()
returns text language plpgsql volatile set search_path = public, extensions as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  b bytea := gen_random_bytes(8);
  out text := '';
begin
  for i in 0..7 loop
    out := out || substr(alphabet, (get_byte(b, i) % 32) + 1, 1);
  end loop;
  return out;
end $$;

-- crea una stanza: chi la crea è l'host e il primo membro
create or replace function public.create_room(p_nick text)
returns table (out_id uuid, out_code text, out_host uuid)
language plpgsql volatile security definer set search_path = public as $$
declare r public.rooms; nick text := left(trim(coalesce(p_nick, '')), 16);
begin
  if auth.uid() is null then raise exception 'non autenticato'; end if;
  if nick = '' then raise exception 'soprannome mancante'; end if;
  delete from public.rooms where expires_at < now();               -- pulizia stanze scadute
  delete from public.rooms where host_id = auth.uid();             -- una stanza per host
  loop
    begin
      insert into public.rooms(code, host_id) values (public.new_room_code(), auth.uid()) returning * into r;
      exit;
    exception when unique_violation then end;                       -- codice già usato: riprova
  end loop;
  insert into public.room_members(room_id, user_id, nickname) values (r.id, auth.uid(), nick);
  return query select r.id, r.code, r.host_id;
end $$;

-- entra in una stanza con il codice
create or replace function public.join_room(p_code text, p_nick text)
returns table (out_id uuid, out_code text, out_host uuid)
language plpgsql volatile security definer set search_path = public as $$
declare r public.rooms; nick text := left(trim(coalesce(p_nick, '')), 16); n int;
begin
  if auth.uid() is null then raise exception 'non autenticato'; end if;
  if nick = '' then raise exception 'soprannome mancante'; end if;
  select * into r from public.rooms where code = upper(trim(p_code)) and expires_at > now();
  if not found then raise exception 'stanza inesistente o scaduta'; end if;
  if exists (select 1 from public.room_members m where m.room_id = r.id and m.user_id = auth.uid()) then
    update public.room_members set nickname = nick where room_members.room_id = r.id and user_id = auth.uid();
  else
    if r.locked then raise exception 'stanza chiusa'; end if;
    select count(*) into n from public.room_members m where m.room_id = r.id;
    if n >= 8 then raise exception 'stanza piena'; end if;
    insert into public.room_members(room_id, user_id, nickname) values (r.id, auth.uid(), nick);
  end if;
  return query select r.id, r.code, r.host_id;
end $$;

revoke all on function public.create_room(text) from public, anon;
revoke all on function public.join_room(text, text) from public, anon;
grant execute on function public.create_room(text) to authenticated;
grant execute on function public.join_room(text, text) to authenticated;
grant execute on function public.is_room_member(uuid) to authenticated;

-- ---------- POLICY (Row Level Security) ----------
drop policy if exists "stanze: solo i membri leggono"   on public.rooms;
drop policy if exists "stanze: l'host modifica"          on public.rooms;
drop policy if exists "stanze: l'host elimina"           on public.rooms;
drop policy if exists "membri: solo i membri leggono"    on public.room_members;
drop policy if exists "membri: esci o espelli"           on public.room_members;

create policy "stanze: solo i membri leggono" on public.rooms
  for select to authenticated using (public.is_room_member(id));
create policy "stanze: l'host modifica" on public.rooms
  for update to authenticated using (host_id = auth.uid()) with check (host_id = auth.uid());
create policy "stanze: l'host elimina" on public.rooms
  for delete to authenticated using (host_id = auth.uid());

create policy "membri: solo i membri leggono" on public.room_members
  for select to authenticated using (public.is_room_member(room_id));
-- ognuno può uscire; l'host può espellere
create policy "membri: esci o espelli" on public.room_members
  for delete to authenticated using (
    user_id = auth.uid()
    or exists (select 1 from public.rooms r where r.id = room_id and r.host_id = auth.uid())
  );
-- nessuna policy di INSERT: si entra solo tramite create_room / join_room

-- ---------- REALTIME: canali privati "room:<id>" solo per i membri ----------
drop policy if exists "realtime: i membri ricevono" on realtime.messages;
drop policy if exists "realtime: i membri inviano"  on realtime.messages;

create policy "realtime: i membri ricevono" on realtime.messages
  for select to authenticated using (
    realtime.topic() like 'room:%'
    and public.is_room_member(nullif(split_part(realtime.topic(), ':', 2), '')::uuid)
  );
create policy "realtime: i membri inviano" on realtime.messages
  for insert to authenticated with check (
    realtime.topic() like 'room:%'
    and public.is_room_member(nullif(split_part(realtime.topic(), ':', 2), '')::uuid)
  );

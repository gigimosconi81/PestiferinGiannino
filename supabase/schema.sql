-- Le storie di Pestiferin Giannino · schema del database
-- Da incollare in Supabase: SQL Editor → New query → Run.
-- Alla fine, sostituisci l'indirizzo nell'ultima riga con il tuo e rilancia solo quella riga.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Chi fa parte della famiglia (solo questi indirizzi possono usare l'app)
-- ---------------------------------------------------------------------------
create table if not exists public.membri (
  email      text primary key check (email = lower(email)),
  nome       text,
  ruolo      text not null default 'famiglia' check (ruolo in ('admin', 'famiglia')),
  creato     timestamptz not null default now()
);

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.membri where email = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.membri where email = lower(coalesce(auth.jwt() ->> 'email', '')) and ruolo = 'admin');
$$;

revoke all on function public.is_member() from public;
revoke all on function public.is_admin() from public;
revoke execute on function public.is_member() from anon;
revoke execute on function public.is_admin() from anon;
grant execute on function public.is_member() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- Personaggi: per ora servono soprattutto a far riconoscere i nomi
-- alla trascrizione e a Claude ("Pestiferin" non è una parola italiana)
-- ---------------------------------------------------------------------------
create table if not exists public.personaggi (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  descrizione text,
  creato     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Storie, registrazioni e pulizia
-- ---------------------------------------------------------------------------
create table if not exists public.storie (
  id          uuid primary key default gen_random_uuid(),
  titolo      text not null default '',
  trama       text,
  stato       text not null default 'da_raccontare'
              check (stato in ('da_raccontare', 'registrata', 'trascritta', 'in_pulizia', 'da_rivedere', 'pronta')),
  -- blocchi della storia dopo la pulizia: [{id, tipo, testo, proposta, tenuto, usa_proposta, motivo}]
  blocchi     jsonb,
  pulizia_errore text,
  testo_finale text,
  creato_da   uuid default auth.uid() references auth.users on delete set null,
  creato      timestamptz not null default now(),
  aggiornato  timestamptz not null default now()
);

create table if not exists public.registrazioni (
  id            uuid primary key,
  storia_id     uuid not null references public.storie on delete cascade,
  parte         integer not null default 1,
  storage_path  text not null,
  mime          text,
  durata_sec    numeric,
  dimensione    bigint,
  stato         text not null default 'caricata'
                check (stato in ('caricata', 'in_trascrizione', 'trascritta', 'errore')),
  trascrizione  text,
  errore        text,
  registrata_il timestamptz,
  creato_da     uuid default auth.uid() references auth.users on delete set null,
  creato        timestamptz not null default now(),
  aggiornato    timestamptz not null default now()
);
create index if not exists registrazioni_storia on public.registrazioni (storia_id, registrata_il, parte);

-- Ogni volta che qualcuno tiene un pezzo che Claude voleva togliere (o viceversa)
-- lo ricordiamo: le prossime pulizie usano questi esempi.
create table if not exists public.esempi_pulizia (
  id        uuid primary key default gen_random_uuid(),
  testo     text not null,
  proposto  text not null,   -- cosa aveva deciso Claude: storia | contorno | idea
  scelto    text not null,   -- cosa ha deciso la famiglia: tenere | togliere
  creato    timestamptz not null default now()
);

create or replace function public.tocca_aggiornato() returns trigger language plpgsql set search_path = public as $$
begin new.aggiornato := now(); return new; end $$;
drop trigger if exists storie_aggiornato on public.storie;
create trigger storie_aggiornato before update on public.storie for each row execute function public.tocca_aggiornato();
drop trigger if exists registrazioni_aggiornato on public.registrazioni;
create trigger registrazioni_aggiornato before update on public.registrazioni for each row execute function public.tocca_aggiornato();

-- ---------------------------------------------------------------------------
-- Permessi: solo i membri della famiglia vedono e modificano
-- ---------------------------------------------------------------------------
alter table public.membri enable row level security;
alter table public.personaggi enable row level security;
alter table public.storie enable row level security;
alter table public.registrazioni enable row level security;
alter table public.esempi_pulizia enable row level security;

drop policy if exists membri_leggi on public.membri;
create policy membri_leggi on public.membri for select to authenticated using (public.is_member());
drop policy if exists membri_gestisci on public.membri;
create policy membri_gestisci on public.membri for all to authenticated using (public.is_admin()) with check (public.is_admin());

do $$
declare t text;
begin
  foreach t in array array['personaggi', 'storie', 'registrazioni', 'esempi_pulizia'] loop
    execute format('drop policy if exists %1$s_famiglia on public.%1$s', t);
    execute format('create policy %1$s_famiglia on public.%1$s for all to authenticated using (public.is_member()) with check (public.is_member())', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Archivio dei file audio (privato)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('audio', 'audio', false, 52428800)
on conflict (id) do nothing;

drop policy if exists audio_leggi on storage.objects;
create policy audio_leggi on storage.objects for select to authenticated
  using (bucket_id = 'audio' and public.is_member());
drop policy if exists audio_carica on storage.objects;
create policy audio_carica on storage.objects for insert to authenticated
  with check (bucket_id = 'audio' and public.is_member());
drop policy if exists audio_aggiorna on storage.objects;
create policy audio_aggiorna on storage.objects for update to authenticated
  using (bucket_id = 'audio' and public.is_member())
  with check (bucket_id = 'audio' and public.is_member());
drop policy if exists audio_cancella on storage.objects;
create policy audio_cancella on storage.objects for delete to authenticated
  using (bucket_id = 'audio' and public.is_member());

-- ---------------------------------------------------------------------------
-- Primo amministratore: metti qui il tuo indirizzo (minuscolo)
-- ---------------------------------------------------------------------------
-- insert into public.membri (email, nome, ruolo) values ('tuo.indirizzo@esempio.it', 'Il tuo nome', 'admin');

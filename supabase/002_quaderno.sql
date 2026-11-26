-- Il quaderno dei personaggi dentro l'app (da lanciare dopo schema.sql)
alter table public.personaggi
  add column if not exists scheda jsonb not null default '{}'::jsonb,
  add column if not exists immagini jsonb not null default '[]'::jsonb,
  add column if not exists aggiornato timestamptz not null default now();
drop trigger if exists personaggi_aggiornato on public.personaggi;
create trigger personaggi_aggiornato before update on public.personaggi for each row execute function public.tocca_aggiornato();

create table if not exists public.luoghi (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null default '',
  scheda     jsonb not null default '{}'::jsonb,
  immagini   jsonb not null default '[]'::jsonb,
  creato     timestamptz not null default now(),
  aggiornato timestamptz not null default now()
);
drop trigger if exists luoghi_aggiornato on public.luoghi;
create trigger luoghi_aggiornato before update on public.luoghi for each row execute function public.tocca_aggiornato();

create table if not exists public.stile (
  id         integer primary key default 1 check (id = 1),
  scheda     jsonb not null default '{}'::jsonb,
  immagini   jsonb not null default '[]'::jsonb,
  aggiornato timestamptz not null default now()
);
insert into public.stile (id) values (1) on conflict (id) do nothing;
drop trigger if exists stile_aggiornato on public.stile;
create trigger stile_aggiornato before update on public.stile for each row execute function public.tocca_aggiornato();

alter table public.storie add column if not exists quaderno jsonb not null default '{}'::jsonb;

alter table public.luoghi enable row level security;
alter table public.stile enable row level security;
drop policy if exists luoghi_famiglia on public.luoghi;
create policy luoghi_famiglia on public.luoghi for all to authenticated using (public.is_member()) with check (public.is_member());
drop policy if exists stile_famiglia on public.stile;
create policy stile_famiglia on public.stile for all to authenticated using (public.is_member()) with check (public.is_member());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('immagini', 'immagini', false, 20971520, array['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif'])
on conflict (id) do nothing;

drop policy if exists immagini_leggi on storage.objects;
create policy immagini_leggi on storage.objects for select to authenticated using (bucket_id = 'immagini' and public.is_member());
drop policy if exists immagini_carica on storage.objects;
create policy immagini_carica on storage.objects for insert to authenticated with check (bucket_id = 'immagini' and public.is_member());
drop policy if exists immagini_aggiorna on storage.objects;
create policy immagini_aggiorna on storage.objects for update to authenticated using (bucket_id = 'immagini' and public.is_member()) with check (bucket_id = 'immagini' and public.is_member());
drop policy if exists immagini_cancella on storage.objects;
create policy immagini_cancella on storage.objects for delete to authenticated using (bucket_id = 'immagini' and public.is_member());

-- Jeux de cartes en ligne — schéma Supabase OPTIONNEL.
--
-- Les jeux fonctionnent sans Supabase (état en mémoire côté serveur Next.js).
-- Appliquer ce schéma permet aux salles de survivre à un redémarrage du serveur.
--
-- Une table par jeu : chaque store de salles est indépendant, et un code de
-- salle du Président n'entre jamais en collision avec un code de Rami.
--
-- Ces tables ne sont JAMAIS lues par le navigateur : les mains des joueurs
-- vivent dans `state`. RLS est active et aucune policy publique n'est créée ;
-- le serveur utilise SUPABASE_SERVICE_ROLE_KEY, qui contourne RLS.

create table if not exists public.president_rooms (
  code        text primary key,
  state       jsonb not null,
  tokens      jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

create table if not exists public.rami_rooms (
  code        text primary key,
  state       jsonb not null,
  tokens      jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

create index if not exists president_rooms_updated_at_idx
  on public.president_rooms (updated_at desc);
create index if not exists rami_rooms_updated_at_idx
  on public.rami_rooms (updated_at desc);

alter table public.president_rooms enable row level security;
alter table public.rami_rooms enable row level security;

revoke all on public.president_rooms from anon, authenticated;
revoke all on public.rami_rooms from anon, authenticated;

-- Reprise d'une installation antérieure, où les salles du Président vivaient
-- dans une table nommée `rooms`.
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'rooms'
  ) then
    insert into public.president_rooms (code, state, tokens, updated_at)
      select code, state, tokens, updated_at from public.rooms
      on conflict (code) do nothing;
  end if;
end $$;

-- Nettoyage des salles inactives (à brancher sur pg_cron si souhaité).
create or replace function public.purge_stale_rooms() returns void
language sql security definer as $$
  delete from public.president_rooms where updated_at < now() - interval '12 hours';
  delete from public.rami_rooms where updated_at < now() - interval '12 hours';
$$;

-- Le Président Online — schéma Supabase OPTIONNEL.
--
-- Le jeu fonctionne sans Supabase (état en mémoire côté serveur Next.js).
-- Appliquer ce schéma permet aux salles de survivre à un redémarrage du serveur.
--
-- La table n'est jamais lue par le navigateur : seule la clé service_role
-- (ou anon avec la policy ci-dessous) est utilisée côté serveur. Les mains des
-- joueurs vivent dans `state`, elles ne doivent donc JAMAIS être exposées
-- publiquement.

create table if not exists public.rooms (
  code        text primary key,
  state       jsonb not null,
  tokens      jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

create index if not exists rooms_updated_at_idx on public.rooms (updated_at desc);

alter table public.rooms enable row level security;

-- Aucune policy « select » pour le rôle anonyme : la table reste inaccessible
-- depuis le navigateur. Le serveur utilise SUPABASE_SERVICE_ROLE_KEY, qui
-- contourne RLS.
revoke all on public.rooms from anon, authenticated;

-- Nettoyage des salles inactives (à brancher sur pg_cron si souhaité).
create or replace function public.purge_stale_rooms() returns void
language sql security definer as $$
  delete from public.rooms where updated_at < now() - interval '12 hours';
$$;

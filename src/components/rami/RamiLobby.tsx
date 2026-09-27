'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useState } from 'react';
import { MODE_LABELS, TARGET_BY_MODE } from '@/rami/scoring';
import { requiredPlayers } from '@/rami/engine';
import type { GameMode } from '@/rami/types';
import type { RamiPlayerView } from '@/rami/view';
import { Button } from '@/components/ui/Button';
import { ShareRow } from '@/components/lobby/ShareRow';
import { RamiRulesSheet } from './RamiRulesSheet';
import { teamName, teamStyle } from './theme';
import type { RamiRoom } from './RamiTable';

const MODES: GameMode[] = ['1v1', '1v1v1', '2v2'];

/**
 * Salon d'avant-partie.
 *
 * Le mode fixe le nombre de places : la table se remplit jusqu'au compte exact,
 * et la partie ne peut pas démarrer avant. C'est l'hôte qui décide du mode, et
 * chacun voit son équipe avant même la distribution.
 */
export function RamiLobby({
  view,
  code,
  room,
  onLeave,
}: {
  view: RamiPlayerView;
  code: string;
  room: RamiRoom;
  onLeave: () => void;
}) {
  const [rulesOpen, setRulesOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const me = view.players.find((player) => player.id === view.youId) ?? null;
  const isHost = Boolean(me?.isHost);
  const needed = requiredPlayers(view.settings.mode);
  const missing = needed - view.players.length;
  const ready = missing === 0;

  const act = async (action: string, payload?: Record<string, unknown>) => {
    if (busy) return;
    setBusy(true);
    try {
      await room.send(action, payload);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="felt-surface felt-grain min-h-dvh w-full">
      <div className="pt-safe pb-safe mx-auto flex min-h-dvh max-w-2xl flex-col gap-4 px-4 py-6">
        <header className="flex items-center justify-between gap-3">
          <Link
            href="/rami"
            className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-cream/45 transition hover:text-cream"
          >
            ← Accueil
          </Link>
          <button
            type="button"
            onClick={() => setRulesOpen(true)}
            className="rounded-full border border-white/12 bg-white/6 px-3 py-1.5 text-[0.72rem] font-semibold text-cream/70 transition hover:bg-white/12 hover:text-cream"
          >
            Règlement
          </button>
        </header>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 28 }}
          className="panel rounded-3xl p-5"
        >
          <ShareRow code={code} path="/rami/salle" gameName="Rami" />
        </motion.div>

        {/* ------------------------------------------------------ Le mode */}
        <section className="panel rounded-3xl p-4">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h2 className="text-[0.68rem] font-bold uppercase tracking-[0.18em] text-cream/50">
              Mode de jeu
            </h2>
            {!isHost && (
              <span className="text-[0.68rem] text-cream/35">Choisi par l’hôte</span>
            )}
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            {MODES.map((mode) => {
              const active = view.settings.mode === mode;
              const disabled = !isHost || view.players.length > requiredPlayers(mode);
              return (
                <button
                  key={mode}
                  type="button"
                  disabled={disabled && !active}
                  onClick={() => act('settings', { settings: { mode } })}
                  aria-pressed={active}
                  className={[
                    'rounded-2xl border px-3 py-3 text-center transition',
                    active
                      ? 'border-gold-400/70 bg-gold-500/12 shadow-[0_0_24px_-10px_rgba(236,208,138,0.8)]'
                      : 'border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.07]',
                    disabled && !active ? 'cursor-not-allowed opacity-40' : '',
                  ].join(' ')}
                >
                  <span className="block text-[0.86rem] font-semibold text-cream">
                    {MODE_LABELS[mode]}
                  </span>
                  <span className="block text-[0.68rem] text-cream/45">
                    {requiredPlayers(mode)} joueurs · {TARGET_BY_MODE[mode]} pts
                  </span>
                </button>
              );
            })}
          </div>

          <p className="mt-2.5 text-[0.7rem] leading-relaxed text-cream/40">
            Atteindre {TARGET_BY_MODE[view.settings.mode]} points fait <strong>perdre</strong>.
            {view.settings.mode === '2v2' && ' Les partenaires sont placés face à face.'}
          </p>
        </section>

        {/* --------------------------------------------------- Les joueurs */}
        <section className="panel rounded-3xl p-4">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h2 className="text-[0.68rem] font-bold uppercase tracking-[0.18em] text-cream/50">
              Joueurs
            </h2>
            <span className="text-[0.74rem] font-semibold tabular-nums text-cream/60">
              {view.players.length} / {needed}
            </span>
          </div>

          <ul className="flex flex-col gap-2">
            {Array.from({ length: needed }).map((_, seat) => {
              const player = view.players.find((entry) => entry.seat === seat);
              if (!player) {
                return (
                  <li
                    key={`empty-${seat}`}
                    className="flex items-center gap-3 rounded-2xl border border-dashed border-white/12 px-3 py-2.5 text-cream/30"
                  >
                    <span className="grid h-10 w-10 place-items-center rounded-full border border-dashed border-white/15 text-sm">
                      {seat + 1}
                    </span>
                    <span className="text-[0.82rem]">Place libre</span>
                  </li>
                );
              }
              const style = teamStyle(player.teamId);
              return (
                <motion.li
                  key={player.id}
                  layout
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-3 rounded-2xl border px-3 py-2.5"
                  style={{ borderColor: style.border, background: style.surface }}
                >
                  <span className="relative shrink-0">
                    <span
                      className={`grid h-10 w-10 place-items-center rounded-full text-lg ${
                        player.connected ? '' : 'opacity-45 grayscale'
                      }`}
                      style={{
                        background:
                          'radial-gradient(circle at 35% 25%, rgba(255,255,255,0.16), rgba(0,0,0,0.35))',
                        border: `1px solid ${style.border}`,
                      }}
                      aria-hidden="true"
                    >
                      {player.avatar}
                    </span>
                    {/* Pastille de présence : un joueur hors ligne ne doit pas
                        se confondre avec une place occupée et prête. */}
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-ink-950 ${
                        player.connected ? 'bg-emerald-400' : 'bg-ruby-500'
                      }`}
                      title={player.connected ? 'En ligne' : 'Hors ligne'}
                      aria-label={player.connected ? 'en ligne' : 'hors ligne'}
                      role="img"
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[0.9rem] font-semibold text-cream">
                        {player.name}
                      </span>
                      {player.id === view.youId && (
                        <span className="text-[0.66rem] text-cream/40">(vous)</span>
                      )}
                      {player.isHost && (
                        <span className="rounded-full bg-gold-500/18 px-1.5 text-[0.56rem] font-bold uppercase tracking-wider text-gold-300">
                          hôte
                        </span>
                      )}
                      {player.isBot && (
                        <span className="rounded-full bg-white/10 px-1.5 text-[0.56rem] font-bold uppercase tracking-wider text-cream/55">
                          bot
                        </span>
                      )}
                    </span>
                    {/* Le nom d'équipe n'a de sens qu'en 2 vs 2 : ailleurs, chacun
                        est sa propre équipe et le répéter n'apprend rien. */}
                    {view.settings.mode === '2v2' ? (
                      <span className="block text-[0.68rem]" style={{ color: style.accent }}>
                        {teamName(player.teamId, view.settings.mode, view.players)}
                        {me && me.teamId === player.teamId && player.id !== view.youId
                          ? ' — votre partenaire'
                          : ''}
                      </span>
                    ) : (
                      <span className="block text-[0.68rem] text-cream/35">
                        Siège {player.seat + 1}
                      </span>
                    )}
                  </span>

                  {isHost && player.id !== view.youId && (
                    <button
                      type="button"
                      onClick={() => act('kick', { targetId: player.id })}
                      aria-label={`Retirer ${player.name}`}
                      className="shrink-0 rounded-full bg-white/8 px-2 py-1 text-[0.66rem] text-cream/50 transition hover:bg-ruby-500/30 hover:text-cream"
                    >
                      Retirer
                    </button>
                  )}
                </motion.li>
              );
            })}
          </ul>
        </section>

        {/* ------------------------------------------------------ Actions */}
        <div className="mt-auto flex flex-col gap-2">
          {isHost && missing > 0 && (
            <Button variant="secondary" block onClick={() => act('add_bot')} disabled={busy}>
              Ajouter un bot ({missing} place{missing > 1 ? 's' : ''} libre
              {missing > 1 ? 's' : ''})
            </Button>
          )}

          {isHost ? (
            <Button
              variant="primary"
              size="lg"
              block
              disabled={!ready || busy}
              onClick={() => act('start_game')}
            >
              {ready
                ? 'Lancer la partie'
                : `Il manque ${missing} joueur${missing > 1 ? 's' : ''}`}
            </Button>
          ) : (
            <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-center text-[0.82rem] text-cream/55">
              {ready
                ? 'La table est complète — l’hôte peut lancer la partie.'
                : `En attente de ${missing} joueur${missing > 1 ? 's' : ''}…`}
            </p>
          )}

          <Button variant="ghost" block onClick={onLeave}>
            Quitter le salon
          </Button>
        </div>
      </div>

      <RamiRulesSheet open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </div>
  );
}

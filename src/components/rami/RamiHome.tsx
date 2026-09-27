'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { cardsFromSpec } from '@/rami/notation';
import { MODE_LABELS, TARGET_BY_MODE } from '@/rami/scoring';
import { requiredPlayers } from '@/rami/engine';
import type { GameMode } from '@/rami/types';
import { RamiPlayingCard } from '@/components/ramicard/RamiPlayingCard';
import { IdentityPicker } from '@/components/lobby/IdentityPicker';
import { Button } from '@/components/ui/Button';
import { AVATARS, randomAvatar } from '@/lib/avatars';
import { loadIdentity, saveIdentity, saveSession } from '@/lib/session';
import { normalizeRoomCode } from '@/lib/roomCode';
import { sound } from '@/lib/sound';
import { RamiRulesSheet } from './RamiRulesSheet';

const MODES: GameMode[] = ['1v1', '1v1v1', '2v2'];
const HERO_CARDS = 'H5 H6 X H8 SA';

/** Accueil du Rami : créer une table, ou en rejoindre une avec un code. */
export function RamiHome() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState<string>(AVATARS[0]);
  const [mode, setMode] = useState<GameMode>('2v2');
  const [joinCode, setJoinCode] = useState('');
  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);

  const hero = useMemo(() => cardsFromSpec(HERO_CARDS), []);

  useEffect(() => {
    const identity = loadIdentity();
    if (identity) {
      setName(identity.name);
      setAvatar(identity.avatar);
    } else {
      setAvatar(randomAvatar());
    }
  }, []);

  const create = useCallback(async () => {
    setBusy(true);
    setError(null);
    void sound().resume();
    try {
      const response = await fetch('/api/rami/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, avatar, settings: { mode } }),
      });
      const body = (await response.json()) as {
        code?: string;
        token?: string;
        playerId?: string;
        error?: string;
      };
      if (!response.ok || !body.code || !body.token || !body.playerId) {
        setError(body.error ?? 'Impossible de créer la partie.');
        return;
      }
      saveIdentity({ name, avatar });
      saveSession({ code: body.code, token: body.token, playerId: body.playerId }, 'rami');
      router.push(`/rami/salle/${body.code}`);
    } catch {
      setError('Connexion impossible. Vérifiez votre réseau.');
    } finally {
      setBusy(false);
    }
  }, [name, avatar, mode, router]);

  const join = useCallback(() => {
    const code = normalizeRoomCode(joinCode);
    if (code.length < 4) {
      setError('Un code de salle compte 4 caractères.');
      return;
    }
    void sound().resume();
    saveIdentity({ name: name.trim() || 'Joueur', avatar });
    router.push(`/rami/salle/${code}`);
  }, [joinCode, name, avatar, router]);

  const nameOk = name.trim().length >= 2;

  return (
    <main className="felt-surface felt-grain relative min-h-dvh w-full overflow-hidden">
      {/* Éventail de cartes en fond : vectoriel, donc net à toute taille.
          Il s'efface vers le bas pour ne jamais gêner la lecture du titre. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 hidden justify-center pt-4 opacity-[0.13] sm:flex"
        aria-hidden="true"
        style={{
          maskImage: 'linear-gradient(to bottom, black 0%, transparent 82%)',
          WebkitMaskImage: 'linear-gradient(to bottom, black 0%, transparent 82%)',
        }}
      >
        {hero.map((card, index) => (
          <motion.div
            key={card.id}
            initial={{ y: -40, opacity: 0, rotate: 0 }}
            animate={{ y: 0, opacity: 1, rotate: (index - 2) * 9 }}
            transition={{ delay: 0.1 + index * 0.08, type: 'spring', stiffness: 220, damping: 22 }}
            style={{ marginLeft: index === 0 ? 0 : -34 }}
          >
            <RamiPlayingCard card={card} width={150} elevation="fly" />
          </motion.div>
        ))}
      </div>

      <div className="pt-safe pb-safe relative mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-5 px-5 py-10 2xl:max-w-xl 2xl:gap-7">
        <header className="text-center">
          <motion.p
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-[0.62rem] font-bold uppercase tracking-[0.3em] text-gold-500/70"
          >
            Multijoueur en temps réel
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            className="text-gradient-gold font-display text-6xl leading-none sm:text-7xl 2xl:text-8xl"
          >
            Rami
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mx-auto mt-2 max-w-sm text-[0.88rem] leading-relaxed text-cream/55"
          >
            108 cartes, jokers compris. Ouvrez à 71 points, posez vos tierces, et laissez les
            autres ramasser les points.
          </motion.p>
        </header>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, type: 'spring', stiffness: 280, damping: 28 }}
          className="panel rounded-3xl p-5"
        >
          <div
            className="mb-4 grid grid-cols-2 gap-1 rounded-2xl bg-ink-950/50 p-1"
            role="tablist"
          >
            {(['create', 'join'] as const).map((value) => (
              <button
                key={value}
                role="tab"
                aria-selected={tab === value}
                onClick={() => {
                  setTab(value);
                  setError(null);
                }}
                className={`relative rounded-xl px-3 py-2 text-[0.82rem] font-semibold transition ${
                  tab === value ? 'text-ink-950' : 'text-cream/55 hover:text-cream'
                }`}
              >
                {tab === value && (
                  <motion.span
                    layoutId="rami-tab"
                    className="absolute inset-0 rounded-xl bg-[linear-gradient(175deg,#fbeec6_0%,#ecd08a_38%,#c79a45_100%)]"
                    transition={{ type: 'spring', stiffness: 460, damping: 36 }}
                  />
                )}
                <span className="relative">
                  {value === 'create' ? 'Créer une table' : 'Rejoindre'}
                </span>
              </button>
            ))}
          </div>

          <IdentityPicker name={name} avatar={avatar} onName={setName} onAvatar={setAvatar} />

          {tab === 'create' ? (
            <div className="mt-4 flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <span className="text-[0.68rem] font-bold uppercase tracking-[0.18em] text-cream/45">
                  Mode
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {MODES.map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={mode === value}
                      onClick={() => setMode(value)}
                      className={`rounded-xl border px-2 py-2.5 text-center transition ${
                        mode === value
                          ? 'border-gold-400/70 bg-gold-500/14 shadow-[0_0_22px_-10px_rgba(236,208,138,0.9)]'
                          : 'border-white/10 bg-white/[0.03] hover:border-white/22 hover:bg-white/[0.07]'
                      }`}
                    >
                      <span className="block text-[0.78rem] font-semibold text-cream">
                        {MODE_LABELS[value]}
                      </span>
                      <span className="block text-[0.62rem] text-cream/45">
                        {requiredPlayers(value)} j · {TARGET_BY_MODE[value]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <Button
                variant="primary"
                size="lg"
                block
                disabled={!nameOk || busy}
                onClick={create}
              >
                {busy ? 'Création…' : 'Créer la table'}
              </Button>
            </div>
          ) : (
            <div className="mt-4 flex flex-col gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-[0.68rem] font-bold uppercase tracking-[0.18em] text-cream/45">
                  Code de la salle
                </span>
                <input
                  value={joinCode}
                  onChange={(event) => setJoinCode(normalizeRoomCode(event.target.value))}
                  placeholder="ABCD"
                  inputMode="text"
                  autoCapitalize="characters"
                  autoComplete="off"
                  maxLength={6}
                  className="h-14 rounded-2xl border border-white/12 bg-ink-950/45 px-4 text-center font-display text-3xl tracking-[0.3em] text-gold-300 placeholder:text-cream/20 focus:border-gold-500/50 focus:outline-none"
                />
              </label>
              <Button variant="primary" size="lg" block onClick={join}>
                Rejoindre la partie
              </Button>
            </div>
          )}

          {error && (
            <p className="mt-3 rounded-xl border border-ruby-400/30 bg-ruby-600/15 px-3 py-2 text-[0.82rem] text-ruby-400">
              {error}
            </p>
          )}
        </motion.div>

        <div className="flex flex-col gap-2 text-center">
          <button
            type="button"
            onClick={() => setRulesOpen(true)}
            className="mx-auto rounded-full border border-white/12 bg-white/5 px-4 py-2 text-[0.78rem] font-semibold text-cream/70 transition hover:bg-white/12 hover:text-cream"
          >
            📖 Règlement du Rami
          </button>
          <Link
            href="/"
            className="text-[0.74rem] text-cream/35 transition hover:text-cream/70"
          >
            Autres jeux de la maison
          </Link>
        </div>
      </div>

      <RamiRulesSheet open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </main>
  );
}

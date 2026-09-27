'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cardsFromSpec } from '@/rami/notation';
import { MODE_LABELS, OPENING_THRESHOLD, TARGET_BY_MODE } from '@/rami/scoring';
import {
  ACE_HAND_POINTS,
  JOKER_HAND_POINTS,
  NEVER_MELDED_POINTS,
  TOTAL_CARDS,
} from '@/rami/cards';
import { RamiPlayingCard } from '@/components/ramicard/RamiPlayingCard';

/* ------------------------------------------------------------------ */
/* Briques d'exemple                                                   */
/* ------------------------------------------------------------------ */

type Verdict = 'ok' | 'no' | 'note';

const VERDICTS: Record<Verdict, { badge: string; tone: string; ring: string }> = {
  ok: {
    badge: 'Valide',
    tone: 'text-emerald-300 bg-emerald-400/15 border-emerald-300/35',
    ring: 'rgba(94,231,171,0.3)',
  },
  no: {
    badge: 'Interdit',
    tone: 'text-ruby-400 bg-ruby-500/15 border-ruby-400/35',
    ring: 'rgba(242,96,106,0.28)',
  },
  note: {
    badge: 'Exemple',
    tone: 'text-gold-300 bg-gold-500/15 border-gold-500/35',
    ring: 'rgba(236,208,138,0.28)',
  },
};

/**
 * Exemple illustré avec les **vraies cartes** du jeu.
 * Le règlement ne décrit pas les cartes : il les montre.
 */
function Example({
  cards,
  verdict = 'note',
  caption,
  width = 46,
  arrow,
}: {
  cards: string;
  verdict?: Verdict;
  caption?: string;
  width?: number;
  /** Seconde rangée, après une flèche : sert aux remplacements de joker. */
  arrow?: string;
}) {
  const primary = useMemo(() => cardsFromSpec(cards), [cards]);
  const secondary = useMemo(() => (arrow ? cardsFromSpec(arrow) : null), [arrow]);
  const style = VERDICTS[verdict];

  return (
    <div
      className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5"
      style={{ boxShadow: `inset 0 0 0 1px ${style.ring}` }}
    >
      <div className="mb-2 flex items-center gap-2">
        <span
          className={`rounded-full border px-2 py-0.5 text-[0.56rem] font-bold uppercase tracking-[0.1em] ${style.tone}`}
        >
          {style.badge}
        </span>
        {caption && (
          <span className="min-w-0 flex-1 text-[0.7rem] leading-snug text-cream/60">
            {caption}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          {primary.map((card, index) => (
            <RamiPlayingCard key={`${card.id}-${index}`} card={card} width={width} />
          ))}
        </div>
        {secondary && (
          <>
            <span className="text-lg text-gold-400" aria-hidden="true">
              →
            </span>
            <div className="flex gap-1">
              {secondary.map((card, index) => (
                <RamiPlayingCard key={`${card.id}-b${index}`} card={card} width={width} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Rule({ children }: { children: React.ReactNode }) {
  return <p className="text-[0.82rem] leading-relaxed text-cream/70">{children}</p>;
}

function Key({ children }: { children: React.ReactNode }) {
  return <strong className="font-semibold text-cream">{children}</strong>;
}

/* ------------------------------------------------------------------ */
/* Accordéon                                                           */
/* ------------------------------------------------------------------ */

interface Section {
  id: string;
  icon: string;
  title: string;
  summary: string;
  body: React.ReactNode;
}

function Accordion({ sections, initial }: { sections: Section[]; initial?: string }) {
  const [open, setOpen] = useState<string | null>(initial ?? sections[0]?.id ?? null);

  return (
    <div className="flex flex-col gap-2">
      {sections.map((section) => {
        const expanded = open === section.id;
        return (
          <div
            key={section.id}
            className={`overflow-hidden rounded-2xl border transition-colors ${
              expanded
                ? 'border-gold-500/35 bg-white/[0.05]'
                : 'border-white/10 bg-white/[0.025]'
            }`}
          >
            <button
              type="button"
              onClick={() => setOpen(expanded ? null : section.id)}
              aria-expanded={expanded}
              className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition hover:bg-white/[0.04]"
            >
              <span className="text-lg" aria-hidden="true">
                {section.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[0.9rem] font-semibold text-cream">
                  {section.title}
                </span>
                <span className="block truncate text-[0.7rem] text-cream/45">
                  {section.summary}
                </span>
              </span>
              <motion.span
                className="shrink-0 text-cream/40"
                animate={{ rotate: expanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                aria-hidden="true"
              >
                ⌄
              </motion.span>
            </button>

            <AnimatePresence initial={false}>
              {expanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.26, ease: [0.22, 0.61, 0.36, 1] }}
                >
                  <div className="flex flex-col gap-3 px-3.5 pb-4 pt-1">{section.body}</div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Le règlement                                                        */
/* ------------------------------------------------------------------ */

/**
 * Règlement du Rami, dans la variante jouée ici.
 *
 * Organisé en sections dépliables et illustré avec les cartes du jeu : un mur
 * de texte ne s'apprend pas, une tierce montrée se retient tout de suite.
 */
export function RamiRules() {
  const sections: Section[] = [
    {
      id: 'modes',
      icon: '🎯',
      title: 'Les trois modes',
      summary: 'Atteindre la cible fait perdre',
      body: (
        <>
          <Rule>
            Le Rami se gagne <Key>par le bas</Key> : le premier joueur — ou la première
            équipe — à atteindre ou dépasser la cible <Key>perd</Key> la partie. Le gagnant
            est celui qui a le score le plus bas.
          </Rule>
          <div className="grid gap-2 sm:grid-cols-3">
            {(['1v1', '1v1v1', '2v2'] as const).map((mode) => (
              <div
                key={mode}
                className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-center"
              >
                <p className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-gold-500/70">
                  {MODE_LABELS[mode]}
                </p>
                <p className="text-gradient-gold font-display text-2xl">
                  {TARGET_BY_MODE[mode]}
                </p>
                <p className="text-[0.66rem] text-cream/45">
                  {mode === '2v2' ? '4 joueurs, 2 équipes' : `${mode === '1v1' ? 2 : 3} joueurs, chacun pour soi`}
                </p>
              </div>
            ))}
          </div>
          <Rule>
            En <Key>2 vs 2</Key>, les partenaires sont face à face, et les règles d’équipe
            s’appliquent : ouverture commune, entraide sur les combinaisons.
          </Rule>
        </>
      ),
    },
    {
      id: 'cartes',
      icon: '🃏',
      title: 'Les cartes',
      summary: `${TOTAL_CARDS} cartes, jokers compris`,
      body: (
        <>
          <Rule>
            Deux jeux de 52 cartes et <Key>4 jokers</Key>, soit {TOTAL_CARDS} cartes. Chaque
            carte existe donc en deux exemplaires.
          </Rule>
          <Example
            cards="H5 H5' X X1"
            verdict="note"
            caption="Deux exemplaires du ♥5, et deux jokers parmi les quatre."
          />
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
            <p className="mb-2 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-cream/45">
              Valeur en points
            </p>
            <ul className="grid gap-1 text-[0.78rem] text-cream/70 sm:grid-cols-2">
              <li>2 à 10 — leur valeur</li>
              <li>Valet, Dame, Roi — 10</li>
              <li>As en main — {ACE_HAND_POINTS}</li>
              <li>Joker en main — {JOKER_HAND_POINTS}</li>
            </ul>
          </div>
        </>
      ),
    },
    {
      id: 'as',
      icon: '🅰️',
      title: 'L’As vaut 1 ou 11',
      summary: 'Sa position décide',
      body: (
        <>
          <Rule>
            L’As est la seule carte dont la valeur dépend de sa <Key>place</Key>.
          </Rule>
          <Example cards="HA H2 H3" verdict="ok" caption="As bas : il vaut 1 — total 6 points." />
          <Example cards="HD HR HA" verdict="ok" caption="As haut : il vaut 11 — total 31 points." />
          <Example cards="SA HA DA" verdict="ok" caption="Dans un brelan, l’As vaut toujours 11." />
          <Example cards="HR HA H2" verdict="no" caption="Une suite ne fait jamais le tour : R-A-2 n’existe pas." />
        </>
      ),
    },
    {
      id: 'distribution',
      icon: '🤲',
      title: 'Distribution',
      summary: '14 cartes, 15 pour le donneur',
      body: (
        <>
          <Rule>
            Chaque joueur reçoit <Key>14 cartes</Key>. Le donneur en reçoit <Key>15</Key>.
          </Rule>
          <Rule>
            Le donneur entame : il <Key>ne pioche pas</Key> et doit jeter sa quinzième carte.
            Cette carte devient la première carte visible de la défausse. Le donneur change à
            chaque manche.
          </Rule>
        </>
      ),
    },
    {
      id: 'tour',
      icon: '🔄',
      title: 'Le tour de jeu',
      summary: 'Piocher, poser, puis jeter',
      body: (
        <>
          <Rule>
            <Key>1.</Key> Prendre la carte du dessus de la pioche, <em>ou</em> reprendre la
            carte que le joueur précédent vient de jeter.
          </Rule>
          <Rule>
            <Key>2.</Key> Poser ou compléter des combinaisons — facultatif.
          </Rule>
          <Rule>
            <Key>3.</Key> Jeter une carte. C’est <Key>obligatoire</Key> : un tour se termine
            toujours par une défausse.
          </Rule>
          <div className="rounded-2xl border border-ruby-400/30 bg-ruby-500/8 px-3 py-2.5">
            <p className="text-[0.8rem] leading-relaxed text-cream/80">
              <Key>La carte reprise dans la défausse doit servir immédiatement.</Key> Impossible
              de la prendre simplement pour la garder : elle doit entrer dans une combinaison
              avant votre défausse.
            </p>
          </div>
          <Example
            cards="H8 H9 H10"
            verdict="note"
            caption="Vous avez ♥8 ♥9 ♥10, l’adversaire jette le ♥7…"
          />
          <Example
            cards="H7 H8 H9 H10"
            verdict="ok"
            caption="…vous le reprenez et posez aussitôt la tierce. La carte a bien servi."
          />
        </>
      ),
    },
    {
      id: 'tierce',
      icon: '📈',
      title: 'La tierce',
      summary: '3 cartes qui se suivent, même signe',
      body: (
        <>
          <Rule>
            Une tierce est une <Key>suite d’au moins 3 cartes</Key> du <Key>même signe</Key>.
            Elle peut être prolongée autant que possible.
          </Rule>
          <Example cards="H4 H5 H6" verdict="ok" />
          <Example
            cards="H4 H5 H6 H7 H8 H9 H10 HV HD HR HA"
            verdict="ok"
            width={32}
            caption="Une tierce peut courir jusqu’à l’As."
          />
          <Example cards="H5 H7 H8" verdict="no" caption="Les cartes doivent se suivre sans trou." />
          <Example cards="H5 S6 H7" verdict="no" caption="Un signe différent casse la tierce." />
        </>
      ),
    },
    {
      id: 'brelan',
      icon: '🎴',
      title: 'Brelan et carré',
      summary: 'Même valeur, signes différents',
      body: (
        <>
          <Rule>
            Un brelan réunit <Key>3 cartes de même valeur</Key>, de <Key>signes différents</Key>.
            Le carré en réunit quatre, un par signe.
          </Rule>
          <Example cards="S7 H7 D7" verdict="ok" caption="Brelan de sept — 21 points." />
          <Example cards="S7 H7 D7 C7" verdict="ok" caption="Carré de sept — 28 points." />
          <Example
            cards="S7 S7' H7"
            verdict="no"
            caption="Deux piques : les signes doivent tous être différents."
          />
        </>
      ),
    },
    {
      id: 'joker',
      icon: '🃟',
      title: 'Les jokers',
      summary: 'Un seul par combinaison',
      body: (
        <>
          <Rule>
            Il y a 4 jokers, et <Key>un seul par combinaison</Key>. Un joker posé représente
            une carte précise, et prend sa valeur en points.
          </Rule>
          <Example
            cards="H5 H6 X H8"
            verdict="ok"
            caption="Le joker représente le ♥7 : la combinaison vaut 5+6+7+8 = 26 points."
          />
          <Example
            cards="HV HD X HA"
            verdict="ok"
            caption="Ici le joker vaut un Roi, donc 10 points."
          />
          <Example cards="H5 H6 X X1" verdict="no" caption="Deux jokers dans la même combinaison." />
        </>
      ),
    },
    {
      id: 'recuperation',
      icon: '♻️',
      title: 'Récupérer un joker',
      summary: 'La carte exacte, ou toutes les manquantes',
      body: (
        <>
          <Rule>
            <Key>Dans une tierce</Key> : il faut la carte <Key>exacte</Key> que le joker
            représente. Un 7 d’un autre signe ne convient pas.
          </Rule>
          <Example
            cards="H5 H6 X H8"
            arrow="H5 H6 H7 H8"
            verdict="ok"
            caption="Avec le ♥7 en main, on remplace le joker et on le récupère."
          />
          <Example cards="S7" verdict="no" caption="Un ♠7 ne remplace pas un joker qui représente le ♥7." />
          <Rule>
            <Key>Dans un brelan</Key> : il faut apporter <Key>toutes</Key> les cartes
            manquantes. Avec une seule, c’est interdit.
          </Rule>
          <Example
            cards="S8 H8 X"
            arrow="S8 H8 D8 C8"
            verdict="ok"
            caption="Il faut ♦8 et ♣8 ensemble : le brelan devient un carré et le joker revient en main."
          />
          <Rule>
            Un joker récupéré peut être <Key>rejoué tout de suite</Key> ou gardé en main. Une
            fois les ouvertures faites, on peut aussi récupérer le joker d’une combinaison
            <Key> adverse</Key>, selon les mêmes règles.
          </Rule>
        </>
      ),
    },
    {
      id: 'ouverture',
      icon: '🔓',
      title: 'L’ouverture',
      summary: `${OPENING_THRESHOLD} points, avec une vraie tierce`,
      body: (
        <>
          <Rule>
            Pour poser sa première combinaison, il faut atteindre{' '}
            <Key>{OPENING_THRESHOLD} points</Key> en une seule fois, toutes combinaisons
            confondues — et l’une d’elles doit être une <Key>tierce de trois vraies cartes</Key>.
          </Rule>
          <Example
            cards="H10 HV HD HR HA"
            verdict="ok"
            width={40}
            caption="51 points de tierce…"
          />
          <Example
            cards="S5 H5 D5 C5"
            verdict="ok"
            width={40}
            caption="…et 20 points de carré : 71 pile, l’ouverture passe."
          />
          <Example
            cards="H5 H6 X"
            verdict="no"
            caption="Un joker ne peut pas remplacer l’une des trois cartes de la tierce obligatoire."
          />
          <Rule>
            Le joker <Key>peut</Key> servir à atteindre les 71 points, mais dans une{' '}
            <em>autre</em> combinaison que la tierce obligatoire.
          </Rule>
          <div className="rounded-2xl border border-gold-500/25 bg-gold-500/8 px-3 py-2.5">
            <p className="text-[0.8rem] leading-relaxed text-cream/80">
              <Key>L’équipe suivante doit faire mieux.</Key> Si la première ouvre à 71, la
              suivante doit atteindre 72. À 119, il faut 120. À 150, il faut 151.
            </p>
          </div>
          <Rule>
            <Key>Le partenaire est dispensé.</Key> En 2 vs 2, si un joueur a ouvert pour son
            équipe, son partenaire n’a pas à refaire le seuil : il lui suffit de poser une
            tierce.
          </Rule>
          <Rule>
            Un joker récupéré à l’adversaire ne peut pas servir à atteindre son propre seuil
            d’ouverture : il faut d’abord avoir ouvert.
          </Rule>
        </>
      ),
    },
    {
      id: 'completer',
      icon: '➕',
      title: 'Compléter la table',
      summary: 'On ajoute, on ne réorganise jamais',
      body: (
        <>
          <Rule>
            Une fois une combinaison posée, elle ne bouge plus : impossible de déplacer une
            carte, de casser une combinaison, d’en fusionner deux ou de les réorganiser. On
            peut uniquement <Key>compléter</Key>.
          </Rule>
          <Example
            cards="H5 H6 H7 H8"
            arrow="H4 H5 H6 H7 H8 H9 H10"
            verdict="ok"
            width={34}
            caption="Avec ♥4, ♥9 et ♥10 en main, la tierce s’allonge par ses deux extrémités."
          />
          <Rule>
            Une fois que <Key>toutes les équipes ont ouvert</Key>, la contrainte de tierce
            disparaît : on peut poser librement, compléter les combinaisons de son équipe
            comme celles des adversaires, et récupérer des jokers.
          </Rule>
        </>
      ),
    },
    {
      id: 'finir',
      icon: '🏁',
      title: 'Finir une manche',
      summary: 'Il faut toujours une carte à jeter',
      body: (
        <>
          <Rule>
            Pour finir, il faut <Key>toujours avoir une carte à jeter</Key>. Poser toutes ses
            cartes d’un coup, sans défausse, est interdit.
          </Rule>
          <Example
            cards="H6 H8 H9"
            verdict="note"
            caption="Main : 6, 8, 9. Vous reprenez le 7 dans la défausse."
          />
          <Example cards="H6 H7 H8" arrow="H9" verdict="ok" caption="Poser 6-7-8, puis jeter le 9." />
          <Example cards="H7 H8 H9" arrow="H6" verdict="ok" caption="Ou poser 7-8-9, puis jeter le 6." />
          <Example
            cards="H6 H7 H8 H9"
            verdict="no"
            caption="Tout poser ne laisse aucune carte à jeter : interdit."
          />
        </>
      ),
    },
    {
      id: 'pioche',
      icon: '🔁',
      title: 'Pioche épuisée',
      summary: 'La défausse est remélangée',
      body: (
        <>
          <Rule>
            Quand la pioche est vide, la <Key>dernière carte jetée reste visible</Key>. Toutes
            les autres cartes de la défausse sont reprises, mélangées, et deviennent la
            nouvelle pioche. La partie continue.
          </Rule>
        </>
      ),
    },
    {
      id: 'score',
      icon: '🧮',
      title: 'Le score',
      summary: '0 pour le gagnant, 100 si on n’a rien posé',
      body: (
        <>
          <Rule>
            Le gagnant de la manche marque <Key>0</Key>. En 2 vs 2, les <em>deux</em> joueurs de
            l’équipe gagnante marquent 0, même si l’un d’eux a encore des cartes.
          </Rule>
          <Rule>
            Un perdant qui <Key>n’a jamais posé</Key> marque {NEVER_MELDED_POINTS} points
            forfaitaires, quel que soit le nombre de cartes qui lui restent.
          </Rule>
          <Rule>
            Un perdant qui <Key>a posé</Key> compte uniquement les cartes restées dans sa main.
          </Rule>
          <Example
            cards="H8 SR SA X"
            verdict="note"
            caption="8 + 10 + 11 + 25 = 54 points."
          />
          <Rule>
            Les points s’ajoutent au cumul. Dès qu’une équipe atteint ou dépasse la cible, la
            partie s’arrête : cette équipe a perdu.
          </Rule>
        </>
      ),
    },
  ];

  return <Accordion sections={sections} />;
}

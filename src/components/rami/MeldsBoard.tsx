"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Meld } from "@/rami/types";
import type { PublicRamiPlayer } from "@/rami/view";
import type { GameMode } from "@/rami/types";
import { MeldView, type MeldAffordance } from "./MeldView";
import { teamName, teamStyle } from "./theme";

/**
 * En dessous, les cartes posées ne se lisent plus : on rend alors le
 * défilement plutôt que de les réduire davantage.
 */
const MIN_SCALE = 0.4;

/** Instants où l'on remesure après un rendu, le temps que les ressorts se posent. */
const SETTLE_MS = [0, 140, 340, 680];

/**
 * Ajuste le tapis pour que **tout ce qui est posé reste visible d'un coup
 * d'œil**, sur n'importe quel téléphone.
 *
 * La zone du tapis fait parfois moins de 150 px de haut : dès la troisième
 * combinaison, il fallait faire défiler pour voir ce qui venait d'être posé —
 * exactement au moment où l'on en a besoin.
 *
 * Réduire ne suffit pas : à l'étroit, les combinaisons s'empilent en hauteur
 * alors que la largeur reste libre. On cherche donc la plus grande réduction
 * qui fasse tout tenir, en élargissant la mise en page d'autant qu'on la
 * réduit — les combinaisons se remettent alors côte à côte. « Tient ou pas »
 * est monotone en l'échelle, une dichotomie trouve donc le point exact en
 * quelques essais.
 *
 * Tout se joue en écriture directe sur le DOM : passer par un état ferait
 * boucler la mesure sur son propre résultat.
 */
function useFitToFrame() {
  const frameRef = useRef<HTMLDivElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const layout = useCallback(() => {
    const frame = frameRef.current;
    const spacer = spacerRef.current;
    const content = contentRef.current;
    if (!frame || !spacer || !content) return;
    // Deux pixels de marge : sans eux, l'arrondi du navigateur suffit à
    // rallumer une barre de défilement d'un cheveu.
    const availableHeight = frame.clientHeight - 2;
    const availableWidth = frame.clientWidth;
    if (availableHeight <= 0 || !availableWidth) return;

    /** Hauteur occupée à l'écran pour une réduction donnée. */
    const heightAt = (scale: number): number => {
      content.style.width = `${availableWidth / scale}px`;
      return content.offsetHeight * scale;
    };

    let scale = 1;
    if (heightAt(1) > availableHeight) {
      let low = MIN_SCALE;
      let high = 1;
      for (let step = 0; step < 7; step += 1) {
        const middle = (low + high) / 2;
        if (heightAt(middle) <= availableHeight) low = middle;
        else high = middle;
      }
      scale = low;
    }

    const natural = heightAt(scale) / scale;
    // La mise en page est élargie de 1/échelle : on la recentre à la main,
    // une translation en pourcentage se ferait écraser par la réduction.
    content.style.left = `${(availableWidth - availableWidth / scale) / 2}px`;
    content.style.transform = `scale(${scale})`;
    spacer.style.height = `${Math.ceil(natural * scale)}px`;
  }, []);

  useLayoutEffect(() => {
    const timers = SETTLE_MS.map((delay) => window.setTimeout(layout, delay));
    return () => timers.forEach(window.clearTimeout);
  });

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const observer = new ResizeObserver(layout);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [layout]);

  return { frameRef, spacerRef, contentRef };
}

interface MeldsBoardProps {
  melds: Meld[];
  players: PublicRamiPlayer[];
  mode: GameMode;
  myTeamId: number | null;
  cardWidth: number;
  compact: boolean;
  affordanceFor: (meld: Meld) => MeldAffordance;
  onActivate: (meld: Meld) => void;
  freshCardIds: ReadonlySet<string>;
  hiddenCardIds: ReadonlySet<string>;
  /** Phrase affichée tant qu'aucune combinaison n'est posée. */
  emptyHint: string;
}

/**
 * Le tapis : toutes les combinaisons posées, regroupées par équipe.
 *
 * C'est le cœur visuel d'une table de Rami. On regroupe par équipe parce que
 * c'est l'information qui compte : savoir qui a ouvert, et où l'on a le droit
 * de poser. Les combinaisons de sa propre équipe passent en tête.
 */
export function MeldsBoard({
  melds,
  players,
  mode,
  myTeamId,
  cardWidth,
  compact,
  affordanceFor,
  onActivate,
  freshCardIds,
  hiddenCardIds,
  emptyHint,
}: MeldsBoardProps) {
  const groups = useMemo(() => {
    const byTeam = new Map<number, Meld[]>();
    for (const meld of melds) {
      const list = byTeam.get(meld.teamId);
      if (list) list.push(meld);
      else byTeam.set(meld.teamId, [meld]);
    }
    return Array.from(byTeam.entries())
      .map(([teamId, list]) => ({ teamId, melds: list }))
      .sort((a, b) => {
        // Son équipe d'abord : c'est là qu'on agit le plus souvent.
        if (a.teamId === myTeamId) return -1;
        if (b.teamId === myTeamId) return 1;
        return a.teamId - b.teamId;
      });
  }, [melds, myTeamId]);

  const { frameRef, spacerRef, contentRef } = useFitToFrame();

  if (melds.length === 0) {
    return (
      <div className="mx-auto my-auto grid min-h-[6.5rem] w-full max-w-md place-items-center rounded-2xl border border-dashed border-white/12 bg-white/[0.025] px-5 py-6 text-center">
        <p className="text-[0.8rem] leading-relaxed text-cream/45">
          {emptyHint}
        </p>
      </div>
    );
  }

  return (
    <div
      ref={frameRef}
      className="flex h-full min-h-0 w-full flex-1 items-center justify-center overflow-y-auto overflow-x-hidden"
    >
      {/* Cale à la hauteur réellement occupée après réduction : le tapis reste
          centré, et garde un défilement au plancher de lisibilité. */}
      <div ref={spacerRef} className="relative w-full shrink-0">
        <div
          ref={contentRef}
          className="absolute top-0 flex flex-col gap-3"
          style={{ transformOrigin: "top center" }}
        >
          <AnimatePresence initial={false}>
            {groups.map((group) => {
              const style = teamStyle(group.teamId);
              const label = teamName(group.teamId, mode, players);
              const mine = group.teamId === myTeamId;
              return (
                <motion.section
                  key={group.teamId}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: "spring", stiffness: 320, damping: 30 }}
                  aria-label={`Combinaisons — ${label}`}
                >
                  <header className="mb-1.5 flex items-center gap-2">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{
                        background: style.accent,
                        boxShadow: `0 0 10px ${style.glow}`,
                      }}
                      aria-hidden="true"
                    />
                    <h3 className="text-[0.66rem] font-bold uppercase tracking-[0.14em] text-cream/55">
                      {label}
                      {mine && (
                        <span className="ml-1.5 text-cream/35">— vous</span>
                      )}
                    </h3>
                    <span
                      className="h-px flex-1 bg-white/8"
                      aria-hidden="true"
                    />
                    <span className="text-[0.62rem] tabular-nums text-cream/35">
                      {group.melds.length} combinaison
                      {group.melds.length > 1 ? "s" : ""}
                    </span>
                  </header>

                  <div
                    className={`flex flex-wrap items-start ${compact ? "gap-2" : "gap-3"}`}
                  >
                    {group.melds.map((meld) => (
                      <MeldView
                        key={meld.id}
                        meld={meld}
                        cardWidth={cardWidth}
                        compact={compact}
                        affordance={affordanceFor(meld)}
                        onActivate={onActivate}
                        freshCardIds={freshCardIds}
                        hiddenCardIds={hiddenCardIds}
                        ownerLabel={
                          players.find((player) => player.id === meld.ownerId)
                            ?.name ?? label
                        }
                      />
                    ))}
                  </div>
                </motion.section>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

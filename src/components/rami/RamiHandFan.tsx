'use client';

import { motion, type PanInfo } from 'framer-motion';
import { useCallback, useMemo, useRef } from 'react';
import { cardLabel } from '@/rami/cards';
import type { CardId, RamiCard } from '@/rami/types';
import { RamiPlayingCard } from '@/components/ramicard/RamiPlayingCard';
import { computeFanLayout } from '@/components/card/fan';
import { anchorKeys, useAnchors } from '@/components/game/Anchors';

interface RamiHandFanProps {
  cards: RamiCard[];
  selectedIds: CardId[];
  /** Cartes immobilisées dans une combinaison préparée. */
  reservedIds: ReadonlySet<CardId>;
  /** Carte reprise dans la défausse : elle doit servir avant la défausse. */
  pinnedId: CardId | null;
  onToggle: (cardId: CardId) => void;
  /**
   * Carte lâchée quelque part sur la table.
   * Le point est en coordonnées viewport : c'est la table qui décide de la
   * cible, puisqu'elle seule connaît les ancres.
   */
  onDrop?: (cardId: CardId, point: { x: number; y: number }) => void;
  /** Largeur disponible, en pixels. */
  width: number;
  compact: boolean;
  /** Plafond de largeur d'une carte : impose la hauteur totale de l'éventail. */
  maxCardWidth?: number;
  interactive: boolean;
  /** Décalage entre deux cartes à la distribution, en secondes. */
  dealStagger: number;
  dealOrigin: { dx: number; dy: number };
  reducedMotion: boolean;
}

/**
 * Main du joueur en éventail.
 *
 * Une main de Rami compte 14 ou 15 cartes : l'éventail calcule la largeur
 * réellement balayée pour qu'aucune carte ne soit rognée, de 320 px à 4K, et
 * augmente le chevauchement plutôt que de réduire les cartes sous le seuil de
 * lisibilité.
 */
export function RamiHandFan({
  cards,
  selectedIds,
  reservedIds,
  pinnedId,
  onToggle,
  onDrop,
  width,
  compact,
  maxCardWidth,
  interactive,
  dealStagger,
  dealOrigin,
  reducedMotion,
}: RamiHandFanProps) {
  const { bind } = useAnchors();
  const layout = useMemo(
    () =>
      computeFanLayout(cards.length, width, {
        compact,
        maxCard: maxCardWidth ?? (compact ? 88 : 104),
        minCard: Math.min(compact ? 46 : 62, maxCardWidth ?? 999),
      }),
    [cards.length, width, compact, maxCardWidth],
  );

  const { cardWidth, cardHeight, bottomInset, height } = layout;
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedIndexes = useMemo(
    () =>
      cards
        .map((card, index) => (selected.has(card.id) ? index : -1))
        .filter((index) => index >= 0),
    [cards, selected],
  );

  const stagger = reducedMotion ? 0 : dealStagger;

  // Un glissement ne doit pas se terminer par une sélection : on retient qu'un
  // geste a eu lieu, et le clic qui suit le relâchement est ignoré.
  const draggedRef = useRef(false);

  const handleDragEnd = useCallback(
    (cardId: CardId, info: PanInfo) => {
      onDrop?.(cardId, info.point);
      // Le clic de fin de geste part juste après : on libère au tour suivant.
      setTimeout(() => {
        draggedRef.current = false;
      }, 0);
    },
    [onDrop],
  );

  return (
    <div
      ref={bind(anchorKeys.hand)}
      className="stage-3d relative mx-auto"
      style={{ width: '100%', height }}
      role="group"
      aria-label="Votre main"
    >
      {cards.map((card, index) => {
        const slot = layout.slots[index];
        if (!slot) return null;
        const isSelected = selected.has(card.id);
        const isReserved = reservedIds.has(card.id);
        const isPinned = pinnedId === card.id;

        // Les cartes voisines s'écartent légèrement de la carte soulevée.
        const neighbourPush = selectedIndexes.reduce((sum, selectedIndex) => {
          if (selectedIndex === index) return sum;
          const distance = index - selectedIndex;
          if (Math.abs(distance) > 2) return sum;
          return sum + (Math.sign(distance) * (cardWidth * 0.1)) / Math.abs(distance);
        }, 0);

        const lifted = isSelected || isReserved;

        return (
          <motion.button
            key={card.id}
            ref={bind(anchorKeys.card(card.id))}
            type="button"
            disabled={!interactive || isReserved}
            aria-pressed={isSelected}
            aria-label={[
              cardLabel(card),
              isSelected ? 'sélectionnée' : null,
              isReserved ? 'déjà placée dans une combinaison préparée' : null,
              isPinned ? 'reprise dans la défausse, à utiliser ce tour-ci' : null,
            ]
              .filter(Boolean)
              .join(', ')}
            onClick={() => {
              if (draggedRef.current) return;
              onToggle(card.id);
            }}
            className="absolute left-1/2 top-auto origin-bottom will-animate no-select disabled:cursor-default"
            style={{
              width: cardWidth,
              height: cardHeight,
              bottom: bottomInset,
              marginLeft: -cardWidth / 2,
              zIndex: lifted ? 200 + index : index,
              borderRadius: '7%',
            }}
            initial={false}
            animate={{
              x: slot.x + neighbourPush,
              y: slot.y - (lifted ? cardHeight * 0.26 : 0),
              rotate: slot.rotate * (lifted ? 0.25 : 1),
              scale: isSelected ? 1.07 : isReserved ? 1.02 : 1,
            }}
            transition={
              reducedMotion
                ? { duration: 0.14 }
                : { type: 'spring', stiffness: 360, damping: 28, mass: 0.7 }
            }
            whileHover={
              interactive && !lifted
                ? {
                    y: slot.y - cardHeight * 0.12,
                    transition: { type: 'spring', stiffness: 460, damping: 26 },
                  }
                : undefined
            }
            whileTap={interactive && !isReserved ? { scale: isSelected ? 1.03 : 0.98 } : undefined}
          >
            {/* Couche de préhension : le glisser-déposer vit seul ici.
                Mêlé à la couche de placement, il entrerait en conflit avec
                l'animation de position de la carte. */}
            <motion.div
              className="h-full w-full will-animate"
              drag={interactive && !isReserved && Boolean(onDrop)}
              dragSnapToOrigin
              dragMomentum={false}
              dragElastic={0.14}
              onDragStart={() => {
                draggedRef.current = true;
              }}
              onDragEnd={(_, info) => handleDragEnd(card.id, info)}
              whileDrag={{ scale: 1.14, zIndex: 999, cursor: 'grabbing' }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            >
            {/* Couche d'arrivée : la carte vient de la pioche à la distribution.
                Séparée de la couche de placement pour que le délai de
                distribution ne retarde jamais la réaction à la sélection. */}
            <motion.div
              className="h-full w-full will-animate"
              initial={
                reducedMotion
                  ? { opacity: 0 }
                  : {
                      x: dealOrigin.dx - slot.x,
                      y: dealOrigin.dy,
                      rotate: -16,
                      scale: 0.66,
                      opacity: 0,
                    }
              }
              animate={{ x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 }}
              transition={
                reducedMotion
                  ? { duration: 0.2, delay: index * 0.01 }
                  : {
                      type: 'spring',
                      stiffness: 320,
                      damping: 26,
                      mass: 0.8,
                      delay: index * stagger,
                    }
              }
            >
              <RamiPlayingCard
                card={card}
                width={cardWidth}
                dimmed={isReserved}
                elevation={lifted ? 'lift' : 'rest'}
              />

              {isSelected && (
                <span
                  className="pointer-events-none absolute -inset-[2px] rounded-[8.5%] ring-[2.5px] ring-gold-300"
                  style={{
                    boxShadow:
                      '0 0 0 1px rgba(10,20,14,0.55), 0 0 26px 2px rgba(236,208,138,0.55)',
                  }}
                />
              )}
              {isReserved && (
                <span
                  className="pointer-events-none absolute -inset-[2px] rounded-[8.5%] ring-2 ring-emerald-300/70"
                  style={{ boxShadow: '0 0 20px -4px rgba(94,231,171,0.6)' }}
                />
              )}
              {isPinned && !isSelected && !isReserved && (
                <span
                  className="pointer-events-none absolute -inset-[2px] rounded-[8.5%] ring-2 ring-ruby-400/80"
                  style={{ boxShadow: '0 0 22px -4px rgba(242,96,106,0.7)' }}
                />
              )}
            </motion.div>
            </motion.div>
          </motion.button>
        );
      })}
    </div>
  );
}

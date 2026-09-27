/**
 * Joker vectoriel.
 *
 * Aucun visage dessiné : à 60 px de large dans une main éventaillée, un visage
 * devient une tache. On garde donc la grammaire héraldique des figures du jeu —
 * bonnet de bouffon à grelots, médaillon, étoile — qui reste lisible à toute
 * échelle et dans les deux sens de lecture.
 *
 * La composition est en symétrie centrale, comme une vraie carte : le bonnet est
 * repris à 180° dans la moitié basse, et le mot JOKER court verticalement le
 * long des deux bords, chacun étant la rotation de l'autre.
 *
 * Les jokers alternent le rouge et le noir, comme dans un jeu du commerce :
 * quatre jokers indiscernables seraient plus pauvres à l'œil.
 */

import { CARD_H, CARD_W } from '@/components/card/geometry';

/**
 * Bonnet à trois pointes, grelots compris, dans une boîte 100 × 100.
 * Les deux pointes latérales retombent : c'est ce qui distingue un bonnet de
 * bouffon d'une couronne de roi, à laquelle il ressemblerait sinon.
 */
function JesterCap({ color, gold }: { color: string; gold: string }) {
  return (
    <g>
      {/* Pointes : deux retombantes, une dressée. */}
      <path d="M34 60 C22 56 10 46 6 32 L20 26 C26 40 34 50 44 56 Z" fill={color} />
      <path d="M43 58 C43 36 44 18 46 8 L59 8 C58 20 57 38 57 58 Z" fill={color} />
      <path d="M66 60 C78 56 90 46 94 32 L80 26 C74 40 66 50 56 56 Z" fill={color} />

      {/* Grelots au bout de chaque pointe. */}
      <circle cx={11} cy={26} r={8} fill={gold} stroke={color} strokeWidth={1.8} />
      <circle cx={52} cy={7} r={8} fill={gold} stroke={color} strokeWidth={1.8} />
      <circle cx={89} cy={26} r={8} fill={gold} stroke={color} strokeWidth={1.8} />

      {/* Bandeau. */}
      <rect
        x={22}
        y={56}
        width={56}
        height={14}
        rx={7}
        fill={gold}
        stroke={color}
        strokeWidth={1.8}
      />
      <g fill={color}>
        <circle cx={36} cy={63} r={2.6} />
        <circle cx={50} cy={63} r={2.6} />
        <circle cx={64} cy={63} r={2.6} />
      </g>
    </g>
  );
}

/** Étoile à cinq branches, centrée sur l'origine. */
export function Star({ r = 10 }: { r?: number }) {
  const points: string[] = [];
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? r : r * 0.42;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    points.push(
      `${(Math.cos(angle) * radius).toFixed(2)},${(Math.sin(angle) * radius).toFixed(2)}`,
    );
  }
  return <polygon points={points.join(' ')} />;
}

/** Mot-valise vertical, posé le long d'un bord. */
function SideWord({ x, color }: { x: number; color: string }) {
  return (
    <text
      transform={`translate(${x} ${CARD_H / 2}) rotate(${x < CARD_W / 2 ? -90 : 90})`}
      textAnchor="middle"
      fontFamily="var(--font-display)"
      fontSize={30}
      letterSpacing="7"
      fill={color}
      style={{ fontVariantLigatures: 'none' }}
    >
      JOKER
    </text>
  );
}

export function JokerArt({
  color,
  gold,
  courtFill,
  clipId,
}: {
  color: string;
  gold: string;
  courtFill: string;
  clipId: string;
}) {
  const panel = { x: 40, y: 50, w: 170, h: 250 };
  const center = { x: CARD_W / 2, y: CARD_H / 2 };

  return (
    <g>
      <rect
        x={panel.x}
        y={panel.y}
        width={panel.w}
        height={panel.h}
        rx={12}
        fill={courtFill}
        stroke={color}
        strokeWidth={1}
      />
      <rect
        x={panel.x + 5}
        y={panel.y + 5}
        width={panel.w - 10}
        height={panel.h - 10}
        rx={8}
        fill="none"
        stroke={color}
        strokeWidth={0.7}
        opacity={0.3}
      />
      <clipPath id={clipId}>
        <rect x={panel.x} y={panel.y} width={panel.w} height={panel.h} rx={12} />
      </clipPath>

      <g clipPath={`url(#${clipId})`}>
        {/* Éclat de fond : donne sa profondeur sans gêner la lecture. */}
        <g transform={`translate(${center.x} ${center.y})`} fill={color} opacity={0.06}>
          <Star r={98} />
        </g>

        <SideWord x={64} color={color} />
        <SideWord x={CARD_W - 64} color={color} />

        <g transform={`translate(${center.x} 120) scale(0.72) translate(-50 -50)`}>
          <JesterCap color={color} gold={gold} />
        </g>
        <g transform={`translate(${CARD_W} ${CARD_H}) rotate(180)`}>
          <g transform={`translate(${center.x} 120) scale(0.72) translate(-50 -50)`}>
            <JesterCap color={color} gold={gold} />
          </g>
        </g>
      </g>

      {/* Losange central : rappelle la symétrie des figures. */}
      <g transform={`translate(${center.x} ${center.y})`}>
        <path d="M0 -19 L15 0 L0 19 L-15 0 Z" fill={gold} stroke={color} strokeWidth={1.2} />
        <g fill={color}>
          <Star r={8.5} />
        </g>
      </g>
    </g>
  );
}

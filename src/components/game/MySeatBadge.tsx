'use client';

import type { PlayerView } from '@/game/view';
import { anchorKeys, useAnchors } from './Anchors';
import { ROLE_META } from './roles';
import { TurnTimer } from './TurnTimer';

/** Pastille du joueur local : avatar, rôle et anneau de chrono. */
export function MySeatBadge({
  view,
  skew,
  isYourTurn,
}: {
  view: PlayerView;
  skew: number;
  isYourTurn: boolean;
}) {
  const { bind } = useAnchors();
  const me = view.players.find((p) => p.id === view.youId);
  if (!me) return null;
  const role = me.role ? ROLE_META[me.role] : null;

  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: 58, height: 58 }}>
      <div
        ref={bind(anchorKeys.seat(me.id))}
        className={`grid h-[46px] w-[46px] place-items-center rounded-full border text-xl ${
          isYourTurn ? 'border-gold-400/70' : 'border-white/12'
        } bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.14),rgba(6,32,24,0.9))]`}
        title={role ? role.label : 'Vous'}
      >
        <span className="no-select">{me.avatar}</span>
      </div>
      {isYourTurn && view.turnDeadline !== null && (
        <TurnTimer
          deadline={view.turnDeadline}
          totalMs={view.turnTotalMs ?? view.settings.turnSeconds * 1000}
          skew={skew}
          size={58}
          alert
        />
      )}
      {role && role.label !== 'Neutre' && (
        <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 rounded-full bg-ink-950/90 px-1.5 text-[0.6rem]">
          {role.icon}
        </span>
      )}
    </div>
  );
}

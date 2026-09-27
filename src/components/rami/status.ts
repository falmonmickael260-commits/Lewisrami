import { shortLabel } from '@/rami/cards';
import type { RamiPlayerView } from '@/rami/view';
import { PHASE_LABELS } from './theme';

export interface StatusLine {
  /** Phrase principale : « qui joue, et que dois-je faire ? ». */
  title: string;
  /** Précision secondaire, ou `null`. */
  detail: string | null;
  tone: 'idle' | 'you' | 'urgent';
}

/** « Au tour d'Alice » plutôt que « Au tour de Alice ». */
function withElision(name: string | undefined): string {
  if (!name) return 'de …';
  return /^[aeiouyàâäéèêëîïôöùûüh]/i.test(name) ? `d’${name}` : `de ${name}`;
}

/**
 * Phrase d'état de la table.
 *
 * Elle doit répondre en un coup d'œil à « qui joue et que dois-je faire ? ».
 * Les contraintes du Rami — seuil d'ouverture, carte reprise à utiliser,
 * défausse obligatoire — y sont dites en clair, jamais en jargon.
 */
export function buildRamiStatus(view: RamiPlayerView): StatusLine {
  if (view.phase === 'dealing') {
    return { title: 'Distribution des cartes…', detail: null, tone: 'idle' };
  }
  if (view.phase === 'round_end') {
    return { title: 'Fin de manche', detail: 'Décompte des points…', tone: 'idle' };
  }
  if (view.phase === 'game_over') {
    return { title: 'Partie terminée', detail: null, tone: 'idle' };
  }
  if (view.phase !== 'playing') {
    return { title: PHASE_LABELS[view.phase] ?? '', detail: null, tone: 'idle' };
  }

  const current = view.players.find((player) => player.id === view.currentPlayerId);
  const isMine = view.currentPlayerId === view.youId;

  if (!isMine) {
    const stage =
      view.turn?.stage === 'draw'
        ? 'pioche ou reprend la défausse'
        : view.turn?.takenCardId && !view.turn.takenCardUsed
          ? 'doit utiliser la carte reprise'
          : 'pose et doit jeter';
    return {
      title: `Au tour ${withElision(current?.name)}`,
      detail: current ? `${current.name} ${stage}` : null,
      tone: 'idle',
    };
  }

  if (view.turn?.isDealerOpening) {
    return {
      title: 'À vous — vous êtes le donneur',
      detail: 'Vous ne piochez pas : posez si vous pouvez, puis jetez votre quinzième carte.',
      tone: 'you',
    };
  }

  if (view.turn?.stage === 'draw') {
    const top = view.discardTop;
    return {
      title: 'À vous — piochez',
      detail: top
        ? `Talon, ou le ${shortLabel(top)} de la défausse — mais il devra servir tout de suite.`
        : 'Prenez une carte au talon.',
      tone: 'you',
    };
  }

  if (view.hints.mustUseTakenCard) {
    const taken = view.hand.find((card) => card.id === view.turn?.takenCardId);
    return {
      title: 'Cette carte doit être utilisée immédiatement',
      detail: taken
        ? `Le ${shortLabel(taken)} doit entrer dans une combinaison avant votre défausse — sinon, remettez-le.`
        : null,
      tone: 'urgent',
    };
  }

  if (view.hints.openingPoints !== null) {
    return {
      title: 'À vous — posez ou jetez',
      detail: view.hints.openingLabel,
      tone: 'you',
    };
  }

  return {
    title: 'À vous — posez, complétez, puis jetez',
    detail: 'Un tour se termine toujours par une carte jetée.',
    tone: 'you',
  };
}

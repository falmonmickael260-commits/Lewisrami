/**
 * Moteur audio procédural (Web Audio).
 *
 * Aucun fichier son n'est téléchargé : tout est synthétisé. Cela garantit une
 * latence nulle — indispensable pour caler précisément le son sur l'animation —
 * et évite d'embarquer des assets compressés.
 */

export type SoundName =
  | 'deal'
  | 'flick'
  | 'land'
  | 'select'
  | 'deselect'
  | 'pass'
  | 'carre'
  | 'turn'
  | 'finish'
  | 'victory'
  | 'error';

const STORAGE_KEY = 'president:sound';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private enabled = true;

  constructor() {
    if (typeof window !== 'undefined') {
      this.enabled = window.localStorage?.getItem(STORAGE_KEY) !== 'off';
    }
  }

  isEnabled() {
    return this.enabled;
  }

  setEnabled(value: boolean) {
    this.enabled = value;
    try {
      window.localStorage.setItem(STORAGE_KEY, value ? 'on' : 'off');
    } catch {
      /* mode privé : on reste silencieux sans casser le jeu */
    }
    if (value) void this.resume();
  }

  /** À appeler sur la première interaction : les navigateurs exigent un geste. */
  async resume() {
    const ctx = this.context();
    if (ctx && ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        /* ignoré */
      }
    }
  }

  private context(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (this.ctx) return this.ctx;
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    return this.ctx;
  }

  private noise(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer) return this.noiseBuffer;
    const length = Math.floor(ctx.sampleRate * 0.6);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buffer;
    return buffer;
  }

  private burst(
    ctx: AudioContext,
    {
      start,
      duration,
      frequency,
      q = 1,
      gain = 0.25,
      type = 'bandpass',
      sweepTo,
    }: {
      start: number;
      duration: number;
      frequency: number;
      q?: number;
      gain?: number;
      type?: BiquadFilterType;
      sweepTo?: number;
    },
  ) {
    const source = ctx.createBufferSource();
    source.buffer = this.noise(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(frequency, start);
    filter.Q.value = q;
    if (sweepTo) filter.frequency.exponentialRampToValueAtTime(sweepTo, start + duration);

    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0, start);
    amp.gain.linearRampToValueAtTime(gain, start + duration * 0.16);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    source.connect(filter).connect(amp).connect(this.master!);
    source.start(start);
    source.stop(start + duration + 0.05);
  }

  private tone(
    ctx: AudioContext,
    {
      start,
      duration,
      frequency,
      gain = 0.16,
      type = 'sine',
      glideTo,
    }: {
      start: number;
      duration: number;
      frequency: number;
      gain?: number;
      type?: OscillatorType;
      glideTo?: number;
    },
  ) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, start);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, start + duration);

    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0, start);
    amp.gain.linearRampToValueAtTime(gain, start + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    osc.connect(amp).connect(this.master!);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  play(name: SoundName, options?: { delay?: number }) {
    if (!this.enabled) return;
    const ctx = this.context();
    if (!ctx || !this.master) return;
    if (ctx.state === 'suspended') void ctx.resume();

    const t = ctx.currentTime + (options?.delay ?? 0);

    switch (name) {
      case 'flick':
        // Frottement du carton qui quitte la main.
        this.burst(ctx, { start: t, duration: 0.16, frequency: 1800, sweepTo: 4200, q: 0.7, gain: 0.2 });
        break;
      case 'deal':
        this.burst(ctx, { start: t, duration: 0.1, frequency: 2600, sweepTo: 1200, q: 1.2, gain: 0.14 });
        break;
      case 'land':
        // Impact mat sur le tapis : un choc grave et un souffle court.
        this.tone(ctx, { start: t, duration: 0.12, frequency: 170, glideTo: 70, gain: 0.2, type: 'triangle' });
        this.burst(ctx, { start: t, duration: 0.1, frequency: 900, q: 0.8, gain: 0.13 });
        break;
      case 'select':
        this.tone(ctx, { start: t, duration: 0.07, frequency: 660, glideTo: 880, gain: 0.08, type: 'triangle' });
        break;
      case 'deselect':
        this.tone(ctx, { start: t, duration: 0.07, frequency: 520, glideTo: 380, gain: 0.07, type: 'triangle' });
        break;
      case 'pass':
        this.burst(ctx, { start: t, duration: 0.22, frequency: 700, sweepTo: 260, q: 0.9, gain: 0.12 });
        break;
      case 'turn':
        this.tone(ctx, { start: t, duration: 0.2, frequency: 523.25, gain: 0.07 });
        this.tone(ctx, { start: t + 0.06, duration: 0.24, frequency: 783.99, gain: 0.05 });
        break;
      case 'carre': {
        // Moment spectaculaire : impact + accord montant.
        this.tone(ctx, { start: t, duration: 0.5, frequency: 110, glideTo: 55, gain: 0.3, type: 'sawtooth' });
        this.burst(ctx, { start: t, duration: 0.5, frequency: 3000, sweepTo: 300, q: 0.5, gain: 0.22 });
        [261.63, 329.63, 392.0, 523.25, 659.25].forEach((frequency, index) => {
          this.tone(ctx, {
            start: t + 0.05 + index * 0.055,
            duration: 0.7,
            frequency,
            gain: 0.1,
            type: 'triangle',
          });
        });
        break;
      }
      case 'finish':
        [523.25, 659.25, 783.99].forEach((frequency, index) => {
          this.tone(ctx, { start: t + index * 0.08, duration: 0.4, frequency, gain: 0.1 });
        });
        break;
      case 'victory':
        [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((frequency, index) => {
          this.tone(ctx, {
            start: t + index * 0.1,
            duration: 0.9,
            frequency,
            gain: 0.11,
            type: 'triangle',
          });
        });
        break;
      case 'error':
        this.tone(ctx, { start: t, duration: 0.14, frequency: 220, glideTo: 150, gain: 0.12, type: 'square' });
        break;
    }
  }
}

let engine: SoundEngine | null = null;

export function sound(): SoundEngine {
  if (!engine) engine = new SoundEngine();
  return engine;
}

import type { RarityTier } from '../types';

/**
 * All of DEEPER's sound is synthesised with the Web Audio API, so there are no audio files to
 * ship or license. Browsers block audio until the player interacts with the page, so the
 * context is only created inside `unlock()`, which the UI calls from real click / key events.
 */

export type SfxName =
  | 'click'
  | 'tick'
  | 'submit'
  | 'wrong'
  | 'timeout'
  | 'reveal'
  | 'discovery'
  | 'biome'
  | 'victory'
  | 'levelup';

export interface AudioSettings {
  volume: number;
  musicOn: boolean;
  sfxOn: boolean;
}

const TIER_INDEX: Record<RarityTier, number> = { pebble: 0, copper: 1, quartz: 2, obsidian: 3, void: 4, corebound: 5 };
// Minor pentatonic over a root that gets lower the deeper you go.
const SCALE = [0, 3, 5, 7, 10, 12, 15];

type WebkitWindow = typeof globalThis & { webkitAudioContext?: typeof AudioContext };

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private settings: AudioSettings = { volume: 0.7, musicOn: true, sfxOn: true };
  private musicWanted = false;
  private musicNodes: { stop: () => void } | null = null;
  private pluckTimer = 0;
  private biomeIndex = 0;

  /** Call from a click / keydown handler. Safe to call repeatedly. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor = globalThis.AudioContext ?? (globalThis as WebkitWindow).webkitAudioContext;
    if (!Ctor) return;
    try {
      this.ctx = new Ctor();
    } catch {
      return;
    }
    this.master = this.ctx.createGain();
    this.sfxBus = this.ctx.createGain();
    this.musicBus = this.ctx.createGain();
    this.sfxBus.connect(this.master);
    this.musicBus.connect(this.master);
    this.master.connect(this.ctx.destination);
    this.noise = this.makeNoise();
    this.applySettings();
    if (this.musicWanted) this.startMusicNodes();
  }

  configure(next: AudioSettings): void {
    this.settings = { ...next };
    this.applySettings();
    if (!next.musicOn) this.stopMusicNodes();
    else if (this.musicWanted && this.ctx && !this.musicNodes) this.startMusicNodes();
  }

  private applySettings(): void {
    if (!this.ctx || !this.master || !this.sfxBus || !this.musicBus) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(Math.max(0, Math.min(1, this.settings.volume)) * 0.8, t, 0.02);
    this.sfxBus.gain.setTargetAtTime(this.settings.sfxOn ? 1 : 0, t, 0.02);
    this.musicBus.gain.setTargetAtTime(this.settings.musicOn ? 0.5 : 0, t, 0.05);
  }

  private makeNoise(): AudioBuffer {
    const ctx = this.ctx as AudioContext;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  private ready(): boolean {
    return !!(this.ctx && this.sfxBus && this.settings.sfxOn && this.ctx.state === 'running');
  }

  // ---- Building blocks ---------------------------------------------------------------------

  private tone(opts: {
    type?: OscillatorType; freq: number; endFreq?: number; start?: number; dur: number; gain?: number; attack?: number; bus?: AudioNode;
  }): void {
    const ctx = this.ctx as AudioContext;
    const t0 = ctx.currentTime + (opts.start ?? 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = opts.type ?? 'square';
    osc.frequency.setValueAtTime(opts.freq, t0);
    if (opts.endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.endFreq), t0 + opts.dur);
    const peak = opts.gain ?? 0.2;
    const attack = opts.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
    osc.connect(g).connect(opts.bus ?? (this.sfxBus as AudioNode));
    osc.start(t0);
    osc.stop(t0 + opts.dur + 0.05);
  }

  private burst(opts: { start?: number; dur: number; gain?: number; filter?: BiquadFilterType; freq?: number; endFreq?: number; q?: number }): void {
    const ctx = this.ctx as AudioContext;
    const t0 = ctx.currentTime + (opts.start ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = opts.filter ?? 'lowpass';
    f.frequency.setValueAtTime(opts.freq ?? 800, t0);
    if (opts.endFreq) f.frequency.exponentialRampToValueAtTime(Math.max(20, opts.endFreq), t0 + opts.dur);
    f.Q.value = opts.q ?? 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(opts.gain ?? 0.3, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
    src.connect(f).connect(g).connect(this.sfxBus as AudioNode);
    src.start(t0, Math.random());
    src.stop(t0 + opts.dur + 0.05);
  }

  // ---- UI sounds ---------------------------------------------------------------------------

  sfx(name: SfxName, tier?: RarityTier): void {
    if (!this.ready()) return;
    switch (name) {
      case 'click':
        this.tone({ freq: 520, endFreq: 380, dur: 0.06, gain: 0.12 });
        break;
      case 'tick':
        this.tone({ type: 'triangle', freq: 880, dur: 0.05, gain: 0.1 });
        break;
      case 'submit':
        this.tone({ freq: 330, dur: 0.07, gain: 0.14 });
        this.tone({ freq: 495, start: 0.06, dur: 0.09, gain: 0.14 });
        break;
      case 'wrong':
        this.tone({ type: 'sawtooth', freq: 220, endFreq: 110, dur: 0.28, gain: 0.16 });
        this.tone({ type: 'sawtooth', freq: 165, endFreq: 80, start: 0.12, dur: 0.3, gain: 0.14 });
        break;
      case 'timeout':
        this.tone({ type: 'triangle', freq: 300, endFreq: 90, dur: 0.5, gain: 0.2 });
        break;
      case 'reveal': {
        const i = TIER_INDEX[tier ?? 'pebble'];
        const base = 392 * Math.pow(2, i / 12 * 2);
        for (let n = 0; n <= Math.min(5, i + 1); n++) {
          this.tone({ type: 'square', freq: base * Math.pow(2, (SCALE[n] ?? 0) / 12), start: n * 0.075, dur: 0.16, gain: 0.1 + i * 0.012 });
        }
        if (i >= 3) this.tone({ type: 'triangle', freq: base / 2, dur: 0.7, gain: 0.2, attack: 0.04 });
        if (i >= 5) this.burst({ dur: 0.9, gain: 0.25, freq: 200, endFreq: 3000, filter: 'bandpass' });
        break;
      }
      case 'discovery':
        [660, 880, 1100, 1320, 1760].forEach((f, n) =>
          this.tone({ type: 'triangle', freq: f, start: n * 0.09, dur: 0.35, gain: 0.14 }));
        break;
      case 'biome':
        this.tone({ type: 'sine', freq: 196, endFreq: 392, dur: 0.9, gain: 0.2, attack: 0.1 });
        this.tone({ type: 'sine', freq: 294, endFreq: 588, dur: 0.9, gain: 0.12, attack: 0.1 });
        break;
      case 'victory':
        [523, 659, 784, 1047].forEach((f, n) => this.tone({ freq: f, start: n * 0.12, dur: 0.22, gain: 0.14 }));
        this.tone({ type: 'triangle', freq: 1047, start: 0.5, dur: 0.7, gain: 0.16 });
        break;
      case 'levelup':
        [392, 523, 659, 784, 1047, 1319].forEach((f, n) => this.tone({ freq: f, start: n * 0.07, dur: 0.14, gain: 0.12 }));
        break;
    }
  }

  // ---- Digging sounds (one per equipment tier) ---------------------------------------------

  /** Starts the equipment's sound for the length of its animation. */
  dig(tier: RarityTier, durationMs: number): void {
    if (!this.ready()) return;
    const secs = durationMs / 1000;
    switch (tier) {
      case 'pebble': // soft shovel scoops
        for (let t = 0.15; t < secs * 0.85; t += 0.42) {
          this.burst({ start: t, dur: 0.16, gain: 0.3, freq: 700, endFreq: 200 });
          this.tone({ type: 'sine', freq: 110, endFreq: 70, start: t, dur: 0.12, gain: 0.18 });
        }
        break;
      case 'copper': // pickaxe ring on stone
        for (let t = 0.3; t < secs * 0.85; t += 0.5) {
          this.burst({ start: t, dur: 0.1, gain: 0.35, freq: 2200, filter: 'highpass' });
          this.tone({ type: 'triangle', freq: 1400, endFreq: 900, start: t, dur: 0.18, gain: 0.12 });
          this.tone({ type: 'sine', freq: 90, start: t, dur: 0.1, gain: 0.2 });
        }
        break;
      case 'quartz': // jackhammer
        for (let t = 0.2; t < secs * 0.88; t += 0.045) {
          this.burst({ start: t, dur: 0.035, gain: 0.22, freq: 1800, q: 2 });
          this.tone({ type: 'square', freq: 70, start: t, dur: 0.03, gain: 0.07 });
        }
        break;
      case 'obsidian': // pneumatic drill whine
        this.tone({ type: 'sawtooth', freq: 140, endFreq: 260, start: 0.25, dur: secs * 0.6, gain: 0.1, attack: 0.3 });
        this.burst({ start: 0.25, dur: secs * 0.6, gain: 0.18, filter: 'bandpass', freq: 1600, endFreq: 3200, q: 3 });
        for (let t = 0.6; t < secs * 0.85; t += 0.3) this.burst({ start: t, dur: 0.07, gain: 0.25, filter: 'highpass', freq: 3500 });
        break;
      case 'void': // heavy engine and grind
        this.tone({ type: 'sawtooth', freq: 52, endFreq: 70, start: 0.1, dur: secs * 0.85, gain: 0.16, attack: 0.4 });
        this.tone({ type: 'square', freq: 26, start: 0.1, dur: secs * 0.85, gain: 0.1, attack: 0.4 });
        this.burst({ start: 0.5, dur: secs * 0.7, gain: 0.2, freq: 500, endFreq: 140 });
        for (let t = 1; t < secs * 0.8; t += 0.7) this.burst({ start: t, dur: 0.25, gain: 0.3, freq: 600, endFreq: 100 });
        break;
      case 'corebound': // tunnel borer: huge rumble, rising grind, crashing rock
        this.tone({ type: 'sine', freq: 34, endFreq: 48, start: 0, dur: secs, gain: 0.34, attack: 0.5 });
        this.tone({ type: 'sawtooth', freq: 60, endFreq: 150, start: 0.6, dur: secs * 0.7, gain: 0.14, attack: 0.6 });
        this.burst({ start: 0.4, dur: secs * 0.9, gain: 0.3, freq: 300, endFreq: 1800, filter: 'bandpass', q: 1.4 });
        for (let t = 1; t < secs * 0.9; t += 0.45) this.burst({ start: t, dur: 0.3, gain: 0.32, freq: 900, endFreq: 90 });
        break;
    }
  }

  /** A crack / thud when the cutter bites. Strength 0..1. */
  impact(tier: RarityTier, strength: number): void {
    if (!this.ready()) return;
    const s = Math.max(0.1, Math.min(1, strength));
    this.burst({ dur: 0.12 + s * 0.3, gain: 0.2 + s * 0.25, freq: 1200, endFreq: 120 });
    this.tone({ type: 'sine', freq: 80 - TIER_INDEX[tier] * 8, endFreq: 40, dur: 0.15 + s * 0.2, gain: 0.2 + s * 0.2 });
  }

  // ---- Ambient music -----------------------------------------------------------------------

  /** Starts (or retunes) the ambient bed. Pass the biome index so it darkens with depth. */
  startMusic(biomeIndex = 0): void {
    this.musicWanted = true;
    this.biomeIndex = biomeIndex;
    if (!this.ctx || !this.settings.musicOn) return;
    if (!this.musicNodes) this.startMusicNodes();
  }

  setMusicBiome(biomeIndex: number): void {
    this.biomeIndex = biomeIndex;
  }

  stopMusic(): void {
    this.musicWanted = false;
    this.stopMusicNodes();
  }

  private rootFreq(): number {
    return 110 * Math.pow(2, -this.biomeIndex / 30);
  }

  private startMusicNodes(): void {
    if (!this.ctx || !this.musicBus || this.musicNodes) return;
    const ctx = this.ctx;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500;
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.07;
    lfoGain.gain.value = 220;
    lfo.connect(lfoGain).connect(filter.frequency);
    const padGain = ctx.createGain();
    padGain.gain.value = 0.06;
    const oscs = [0, 7, 12].map((semi, i) => {
      const o = ctx.createOscillator();
      o.type = i === 0 ? 'triangle' : 'sine';
      o.frequency.value = this.rootFreq() * Math.pow(2, semi / 12);
      o.detune.value = (i - 1) * 6;
      o.connect(filter);
      o.start();
      return o;
    });
    filter.connect(padGain).connect(this.musicBus);
    lfo.start();

    const pluck = () => {
      if (!this.ctx || !this.musicBus) return;
      const root = this.rootFreq() * 4;
      const note = SCALE[Math.floor(Math.random() * SCALE.length)] ?? 0;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = root * Math.pow(2, note / 12);
      const t = ctx.currentTime;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.05, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
      o.connect(g).connect(this.musicBus);
      o.start(t);
      o.stop(t + 1.7);
      oscs.forEach((osc, i) => osc.frequency.setTargetAtTime(this.rootFreq() * Math.pow(2, [0, 7, 12][i] as number / 12), t, 2));
      this.pluckTimer = window.setTimeout(pluck, 1800 + Math.random() * 3200);
    };
    this.pluckTimer = window.setTimeout(pluck, 1200);

    this.musicNodes = {
      stop: () => {
        window.clearTimeout(this.pluckTimer);
        const t = ctx.currentTime;
        padGain.gain.setTargetAtTime(0, t, 0.2);
        window.setTimeout(() => {
          oscs.forEach((o) => { try { o.stop(); } catch { /* already stopped */ } });
          try { lfo.stop(); } catch { /* already stopped */ }
        }, 800);
      },
    };
  }

  private stopMusicNodes(): void {
    this.musicNodes?.stop();
    this.musicNodes = null;
  }
}

export const audio = new AudioEngine();

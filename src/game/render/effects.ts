import type { ParticleSystem } from './particles';

/** Colours of each trail effect, also used to draw its swatch in the Garage. */
export const EFFECT_COLORS: Record<string, readonly string[]> = {
  'fx-sparkle': ['#fff6a8', '#ffffff', '#ffd94a'],
  'fx-frost': ['#bff3ff', '#ffffff', '#7fd4ff'],
  'fx-embers': ['#ff9a3a', '#ffd94a', '#ff5a2a'],
  'fx-stars': ['#ffd94a', '#ff8ad8', '#8affd0'],
};

/** Emits one trail particle around a miner standing at (x, feetY). Cosmetic only. */
export function spawnTrail(fx: ParticleSystem, effectId: string, x: number, feetY: number, rnd: () => number): void {
  const colors = EFFECT_COLORS[effectId];
  if (!colors) return;
  const color = colors[Math.floor(rnd() * colors.length)] as string;
  const px = x + (rnd() - 0.5) * 16;
  const py = feetY - 2 - rnd() * 22;
  switch (effectId) {
    case 'fx-sparkle':
      fx.spawn({ x: px, y: py, vx: (rnd() - 0.5) * 10, vy: -8 - rnd() * 10, life: 0.6, color, mode: 'blink' });
      break;
    case 'fx-frost':
      fx.spawn({ x: px, y: py - 8, vx: (rnd() - 0.5) * 8, vy: 6 + rnd() * 8, life: 0.9, color });
      break;
    case 'fx-embers':
      fx.spawn({ x: px, y: py, vx: (rnd() - 0.5) * 12, vy: -14 - rnd() * 12, life: 0.8, color });
      break;
    case 'fx-stars':
      fx.spawn({ x: px, y: py, vx: (rnd() - 0.5) * 24, vy: (rnd() - 0.5) * 24, life: 0.7, size: 2, color, mode: 'blink' });
      break;
  }
}

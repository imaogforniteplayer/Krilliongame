import type { DiscoveryItem, DiscoveryKind } from '../discoveries/discoveries';
import { makeCanvas, spriteFromRows } from './canvas';

/**
 * Original pixel icons for every discovery. o = outline, m = mid, l = light, s = sparkle.
 * Each item recolours one of twelve shapes with its own four colours.
 */
const SHAPES: Partial<Record<DiscoveryKind, readonly string[]>> = {
  gem: [
    '...oooooo...', '..olllllmo..', '.olssllmmmo.', 'oollllmmmmoo', '.olllmmmmmo.',
    '..ollmmmmo..', '...ollmmo...', '....olmo....', '.....oo.....',
  ],
  coin: [
    '...oooo...', '..ollllo..', '.olsslmmo.', 'olsllllmmo', 'olllmmmmmo',
    'olllmllmmo', '.olllmmmo.', '..ommmmo..', '...oooo...',
  ],
  bone: [
    'oo........oo', 'olo......olo', '.ollllllllo.', '.olssmmmmlo.', '.ommmmmmmmo.', 'olo......olo', 'oo........oo',
  ],
  crystal: [
    '....oo....', '...olso...', '..ollsmo..', '..ollmmo..', '.olllmmmo.',
    '.olllmmmo.', 'olllmmmmmo', 'olllmmmmmo', '.oooooooo.',
  ],
  meteor: [
    '...oooooo...', '..ommmmmmo..', '.ommlmmmmmo.', 'ommmmmmsmmmo', 'ommlmmmmmmmo',
    'ommmmmlmmmmo', '.ommmmmmmmo.', '..oommmmoo..', '....oooo....',
  ],
  vase: [
    '..oooooo..', '...olmo...', '..olllmmo.', '.olllmmmmo', '.olslmmmmo',
    '.olllmmmmo', '.ollllmmmo', '..olllmmo.', '...ommmo..', '...oooo...',
  ],
  nugget: [
    '...ooo....', '..olllo.oo', '.ollsllolo', 'olllmllmmo', 'ollmmmmmmo', '.ommmmmmo.', '..oooooo..',
  ],
  skull: [
    '...oooooo...', '..ollllllo..', '.ollllllllo.', '.olooloolmo.', '.olooloolmo.',
    '.ollllllllo.', '..ollooollo.', '..olmlmlmlo.', '...olmlmlo..', '....oooooo..',
  ],
  relic: [
    '..oooooo..', '.ollllllmo', 'olssllllmo', 'ollolollmo', 'olloolllmo',
    'ollolollmo', 'olllllsmmo', 'olllolllmo', 'ommmmmmmmo', '.oooooooo.',
  ],
};

const cache = new Map<string, HTMLCanvasElement>();

function proceduralShell(c: DiscoveryItem['colors']): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(12, 12);
  for (let y = 0; y < 12; y++) {
    for (let x = 0; x < 12; x++) {
      const dx = x - 5.5; const dy = y - 5.5;
      const r = Math.hypot(dx, dy);
      if (r > 5.6) continue;
      const a = Math.atan2(dy, dx);
      const spiral = (r * 1.3 - a / (Math.PI * 2) * 2.2 + 8) % 2;
      ctx.fillStyle = r > 4.7 ? c[0] : spiral < 0.45 ? c[0] : spiral < 1.2 ? c[2] : c[1];
      ctx.fillRect(x, y, 1, 1);
    }
  }
  ctx.fillStyle = c[3]; ctx.fillRect(3, 3, 1, 1);
  return canvas;
}

function proceduralCog(c: DiscoveryItem['colors']): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(12, 12);
  for (let y = 0; y < 12; y++) {
    for (let x = 0; x < 12; x++) {
      const dx = x - 5.5; const dy = y - 5.5;
      const r = Math.hypot(dx, dy);
      const a = Math.atan2(dy, dx);
      const tooth = Math.cos(a * 8) > 0.2 ? 5.9 : 4.6;
      if (r > tooth || r < 1.6) continue;
      ctx.fillStyle = r > tooth - 1 ? c[0] : (x + y) % 5 === 0 ? c[2] : c[1];
      ctx.fillRect(x, y, 1, 1);
    }
  }
  ctx.fillStyle = c[3]; ctx.fillRect(3, 3, 1, 1);
  return canvas;
}

function proceduralEgg(c: DiscoveryItem['colors']): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(10, 13);
  for (let y = 0; y < 13; y++) {
    for (let x = 0; x < 10; x++) {
      const dx = (x - 4.5) / (y < 6 ? 4.4 : 4.9);
      const dy = (y - 6.5) / 6.2;
      const d = dx * dx + dy * dy;
      if (d > 1) continue;
      ctx.fillStyle = d > 0.72 ? c[0] : (x - y) % 4 === 0 ? c[2] : c[1];
      ctx.fillRect(x, y, 1, 1);
    }
  }
  ctx.fillStyle = c[3]; ctx.fillRect(3, 3, 1, 2); ctx.fillRect(6, 7, 2, 1);
  return canvas;
}

/** Icon canvas for a discovery (cached). Drawn small; scale it up with nearest-neighbour. */
export function discoveryIcon(item: DiscoveryItem): HTMLCanvasElement {
  const hit = cache.get(item.id);
  if (hit) return hit;
  const [c0, c1, c2, c3] = item.colors;
  const pal = { o: c0, m: c1, l: c2, s: c3 };
  let icon: HTMLCanvasElement;
  if (item.kind === 'shell') icon = proceduralShell(item.colors);
  else if (item.kind === 'cog') icon = proceduralCog(item.colors);
  else if (item.kind === 'egg') icon = proceduralEgg(item.colors);
  else icon = spriteFromRows(`item:${item.id}`, SHAPES[item.kind] ?? (SHAPES.gem as readonly string[]), pal);
  cache.set(item.id, icon);
  return icon;
}

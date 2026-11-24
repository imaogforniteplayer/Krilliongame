import type { Biome } from '../biomes/biomes';
import { BIOMES } from '../biomes/biomes';
import { makeCanvas, seeded, shade, spriteFromRows } from './canvas';

export const TILE = 16;
export const TILE_VARIANTS = 4;

const tileCache = new Map<string, HTMLCanvasElement>();
const decoCache = new Map<string, HTMLCanvasElement>();

/** A 16x16 seamless terrain tile, unique to each biome, generated from code (no external art). */
export function terrainTile(biome: Biome, variant: number): HTMLCanvasElement {
  const key = `${biome.id}|${variant % TILE_VARIANTS}`;
  const hit = tileCache.get(key);
  if (hit) return hit;
  const tile = buildTile(biome, variant % TILE_VARIANTS);
  tileCache.set(key, tile);
  return tile;
}

function buildTile(biome: Biome, variant: number): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(TILE, TILE);
  const rnd = seeded(`${biome.id}|tile|${variant}`);
  const p = biome.palette;
  const px = (x: number, y: number, c: string, w = 1, h = 1) => {
    ctx.fillStyle = c;
    ctx.fillRect(((x % TILE) + TILE) % TILE, ((y % TILE) + TILE) % TILE, w, h);
  };
  const rint = (n: number) => Math.floor(rnd() * n);

  ctx.fillStyle = p.base;
  ctx.fillRect(0, 0, TILE, TILE);

  // Base speckle: gentle texture shared by every biome.
  for (let i = 0; i < 26; i++) px(rint(TILE), rint(TILE), p.dark);
  for (let i = 0; i < 16; i++) px(rint(TILE), rint(TILE), p.light);

  switch (biome.id) {
    case 'surface':
    case 'soft-soil': {
      for (let i = 0; i < 4; i++) { const x = rint(14); const y = rint(14); px(x, y, p.light, 2, 1); px(x, y + 1, p.dark, 2, 1); }
      break;
    }
    case 'root-caverns': {
      for (let i = 0; i < 2; i++) {
        let x = rint(TILE); let y = rint(4);
        for (let s = 0; s < 9; s++) { px(x, y, p.accent); x += rint(3) - 1; y += 1; px(x, y, p.dark); }
      }
      break;
    }
    case 'clay-depths': {
      for (const y of [3 + rint(3), 9 + rint(3)]) { for (let x = 0; x < TILE; x++) if (rnd() > 0.2) px(x, y, rnd() > 0.5 ? p.light : p.dark); }
      break;
    }
    case 'stone-caverns': {
      // Chunky rock blocks with dark seams.
      const rows = [0, 5, 11];
      rows.forEach((y, i) => {
        for (let x = 0; x < TILE; x++) px(x, y, p.dark);
        const off = i === 1 ? 6 : 2;
        for (let yy = y; yy < y + (rows[i + 1] ?? TILE + 0) - y; yy++) px(off, yy, p.dark);
        px(off + 8, y + 1, p.dark, 1, 4);
      });
      for (let i = 0; i < 6; i++) px(rint(TILE), rint(TILE), p.light, 2, 1);
      break;
    }
    case 'underground-lakes': {
      for (let i = 0; i < 4; i++) { const y = 2 + i * 4 + rint(2); const x = rint(8); px(x, y, p.light, 5 + rint(4), 1); px(x + 2, y + 1, p.dark, 4, 1); }
      for (let i = 0; i < 3; i++) px(rint(TILE), rint(TILE), p.glow);
      break;
    }
    case 'fossil-beds': {
      for (let y = 0; y < TILE; y += 4) {
        const c = (y / 4 + variant) % 2 === 0 ? p.light : p.dark;
        for (let x = 0; x < TILE; x++) if (rnd() > 0.15) px(x, y, c);
      }
      break;
    }
    case 'crystal-caverns': {
      for (let i = 0; i < 3; i++) { const x = rint(13); const y = rint(11); px(x + 1, y, p.glow); px(x, y + 1, p.accent, 3, 1); px(x + 1, y + 2, p.accent); }
      break;
    }
    case 'ancient-ruins': {
      for (const y of [0, 8]) for (let x = 0; x < TILE; x++) px(x, y, p.dark);
      for (const [y, xs] of [[1, [0, 8]], [9, [4, 12]]] as const) for (const x of xs) for (let yy = 0; yy < 7; yy++) px(x, y + yy, p.dark);
      for (let i = 0; i < 4; i++) px(rint(TILE), rint(TILE), p.accent);
      break;
    }
    case 'frozen-underground': {
      for (let i = 0; i < 3; i++) { const x = rint(12); const y = rint(12); for (let s = 0; s < 4; s++) px(x + s, y + s, p.accent); }
      for (let i = 0; i < 5; i++) px(rint(TILE), rint(TILE), p.glow);
      break;
    }
    case 'volcanic-depths': {
      for (let i = 0; i < 2; i++) {
        let x = rint(TILE); let y = rint(3);
        for (let s = 0; s < 10; s++) { px(x, y, p.accent); if (s % 3 === 0) px(x + 1, y, p.glow); x += rint(3) - 1; y += 1; }
      }
      break;
    }
    case 'forgotten-mines': {
      for (let i = 0; i < 5; i++) px(rint(TILE), rint(TILE), p.dark, 2, 2);
      px(rint(TILE), rint(TILE), p.accent); px(rint(TILE), rint(TILE), p.glow);
      break;
    }
    case 'the-hollow': {
      for (let i = 0; i < 5; i++) px(rint(TILE), rint(TILE), p.accent);
      for (let i = 0; i < 2; i++) px(rint(TILE), rint(TILE), p.glow);
      break;
    }
    case 'deep-core': {
      for (let i = 0; i < 2; i++) {
        let x = rint(TILE); let y = rint(3);
        for (let s = 0; s < 11; s++) { px(x, y, p.accent); x += rint(3) - 1; y += 1; if (rnd() > 0.7) px(x + 1, y, p.glow); }
      }
      break;
    }
    case 'the-unknown': {
      for (let i = 0; i < 4; i++) px(rint(TILE), rint(TILE), rnd() > 0.5 ? p.accent : p.glow);
      for (let i = 0; i < 6; i++) px(rint(TILE), rint(TILE), p.light);
      break;
    }
    default:
      break;
  }
  return canvas;
}

// ---------------------------------------------------------------------------------------------
// Decorations: small things embedded in or growing from the walls.
// d = dark, m = base, l = light, a = accent, g = glow. Fixed letters: P pink, o outline, y lantern yellow.
// ---------------------------------------------------------------------------------------------

const DECO: Record<string, readonly string[]> = {
  pebble: ['..ddd..', '.dmmld.', 'dmmmmmd', '.ddddd.'],
  root: ['.dd.....', '.dad....', '..dad...', '..dad...', '...dad..', '...dad..', '..dad...', '..dd....', '.dad....', '.dd.....'],
  worm: ['..PP....', '.P..P.PP', 'P....PP.'],
  mushroom: ['..aaa..', '.aaaaa.', 'aaglaaa', '.ddddd.', '...l...', '...l...', '...d...'],
  pottery: ['..dddd..', '.dmmmmd.', 'dmaaaamd', 'dmmmmmmd', 'dmaaaamd', '.dmmmmd.', '..dddd..'],
  stalactite: ['dddddddd', 'dlmmmmmd', '.dlmmmd.', '.dlmmd..', '..dmmd..', '..dmd...', '...dmd..', '...dd...', '....d...', '....d...'],
  ore: ['..dddd..', '.dmmmmd.', 'dmmgmmmd', 'dmmmmgmd', 'dmgmmmmd', '.dmmmmd.', '..dddd..'],
  puddle: ['..aaaaaa..', '.aglaaaaa.', '..aaaaaa..'],
  fossil: ['....a..a....', '...a.aa.a...', '..a..aa..a..', 'aaaaaaaaaaaa', '..a..aa..a..', '...a.aa.a...', '....a..a....'],
  crystal: ['.....a....', '....ala...', '....alaa..', '.a..alaa..', 'ala.alaaa.', 'alaaalaaa.', 'alaaaaaaa.', 'aaaaaaaaaa', '.dddddddd.'],
  brick: ['dddddddd', 'dmmmldmm', 'dddddddd', 'mmdmmmld', 'dddddddd'],
  icicle: ['llllll', 'lmmmml', '.lmml.', '.lmml.', '..lm..', '..lm..', '..l...', '..l...'],
  vent: ['..dddddd..', '.dmmmmmmd.', 'dmmaaaammd', 'daagggaaad', '.daaaaaad.', '..dddddd..'],
  beam: ['dwwd', 'dwwd', 'dwwd', 'dwwd', 'dwwd', 'dwwd', 'dwwd', 'dwwd', 'dwwd', 'dwwd', 'dwwd', 'dwwd'],
  lantern: ['..oo..', '.o..o.', 'oyyyyo', 'oyggyo', 'oyggyo', 'oyyyyo', '.oooo.'],
  eye: ['..aaaa..', '.aaggaa.', 'aagddgaa', '.aaggaa.', '..aaaa..'],
  crack: ['.a........', '.aa.......', '..a.......', '..aa..aa..', '...a..a...', '...aaaa...', '....a.a...', '.....aa...'],
};

export const DECO_KINDS = Object.keys(DECO);

export function decoSprite(kind: string, biome: Biome): HTMLCanvasElement {
  const key = `${kind}|${biome.id}`;
  const hit = decoCache.get(key);
  if (hit) return hit;
  const p = biome.palette;
  const rows = DECO[kind] ?? DECO.pebble as readonly string[];
  const pal: Record<string, string> = {
    d: shade(p.dark, -0.25), m: p.base, l: p.light, a: p.accent, g: p.glow,
    P: '#e98aa0', o: '#241408', y: '#ffb84a', w: '#8a6238',
  };
  if (kind === 'beam') pal.d = '#3a2410';
  if (kind === 'root') { pal.d = shade(p.dark, -0.3); pal.a = shade(p.accent, -0.1); }
  if (kind === 'eye') { pal.g = '#ffffff'; pal.d = '#120a20'; }
  if (kind === 'fossil') pal.a = shade(p.accent, -0.05);
  const sprite = spriteFromRows(`deco:${kind}`, rows, pal);
  decoCache.set(key, sprite);
  return sprite;
}

export function biomeByIndex(i: number): Biome {
  return BIOMES[Math.max(0, Math.min(BIOMES.length - 1, i))] as Biome;
}

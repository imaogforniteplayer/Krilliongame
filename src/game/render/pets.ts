import { spriteFromRows } from '../pixel/canvas';
import type { Palette } from '../pixel/canvas';

/**
 * Collectible pets. Each is a small original sprite with its own idle and movement style, and they
 * follow the miner automatically. Pets are cosmetic only.
 */

const O = '#1b1226';

interface PetDef {
  frames: { rows: string[]; pal: Palette }[];
  /** Pixels above the ground the pet hovers. */
  float: number;
  /** Idle bob height (px) and speed. */
  bob: number;
  bobSpeed: number;
  /** Extra hop height when the miner is busy. */
  hop: number;
  /** Frames per second when it has more than one frame. */
  fps: number;
}

const BAT_A = [
  'o.............o', 'oo....o.o....oo', 'oPo..oBBBo..oPo', 'oPPooBkBkBooPPo',
  'oPPPoBBBBBoPPPo', '.oPPoBBwBBoPPo.', '..ooo.oBBBo.ooo', '.......ooo.....',
];
const BAT_B = [
  '......o.o......', '.....oBBBo.....', 'oo..oBkBkBo..oo', 'oPPooBBBBBooPPo',
  '.oPPoBBwBBoPPo.', '..oPPoBBBoPPo..', '...oPoooooPo...', '....o.....o....',
];
const BAT_PAL = { o: O, P: '#6b4f9a', B: '#4a3a6a', k: '#ff4d5e', w: '#ffffff' };

const ROBOT = (light: string) => ({
  rows: [
    '.....oo.....', '.....oR.....', '..oooooooo..', '.oSSSSSSSSo.', '.oSwwSSwwSo.',
    '.oSwkSSwkSo.', '.oSSSSSSSSo.', '..oooooooo..', '.oTTTTTTTTo.', '..oooooooo..',
  ],
  pal: { o: O, S: '#9aa4c0', w: '#e8f8ff', k: '#1b1226', T: '#4a4f66', R: light },
});

const DINO_BODY = [
  '.......oooo..', '......oGGGGo.', '......oGkGGGo', '......oGGGGoo', '.o...oGGGGo..',
  'oGo.oGGGGGo..', 'oGGoGGGGGGo..', '.oGGGGgGGGo..', '..oGGGGGGGo..',
];
const DINO_PAL = { o: O, G: '#5ec26a', g: '#a6e8a0', k: '#1b1226' };

const PETS: Record<string, PetDef> = {
  'pet-mole': {
    frames: [{
      rows: [
        '............', '...oooooo...', '..oBBBBBBo..', '.oBBBBBBBBo.', '.oBBBBBkBBoo', '.oBBbBBBBBBP',
        '.oBbbbBBBBoo', '.oBbbbBBBoo.', '..occoocco..', '............',
      ],
      pal: { o: O, B: '#7a5238', b: '#a0765a', k: '#1b1226', P: '#ff9a9a', c: '#ffe0b0' },
    }],
    float: 0, bob: 0.6, bobSpeed: 4, hop: 3, fps: 1,
  },
  'pet-robot': {
    frames: [ROBOT('#ff4d5e'), ROBOT('#5a2a30')],
    float: 0, bob: 0.5, bobSpeed: 6, hop: 2, fps: 2,
  },
  'pet-dino': {
    frames: [
      { rows: [...DINO_BODY, '..oGo.oGo.oo.', '..ooo.ooo....'], pal: DINO_PAL },
      { rows: [...DINO_BODY, '..oGo.oGo....', '..ooo.ooo.oo.'], pal: DINO_PAL },
    ],
    float: 0, bob: 0.5, bobSpeed: 5, hop: 3, fps: 3,
  },
  'pet-bat': {
    frames: [{ rows: BAT_A, pal: BAT_PAL }, { rows: BAT_B, pal: BAT_PAL }],
    float: 12, bob: 3, bobSpeed: 3, hop: 4, fps: 6,
  },
  'pet-crystal': {
    frames: [{
      rows: [
        '......oo....', '.....oCCo...', '....oCcCCo..', '...oCCcCCCo.', '..oCCkCCkCCo',
        '..oCCCCCCCCo', '...oCCCCCCo.', '....oCCCCo..', '....oo..oo..', '....o....o..',
      ],
      pal: { o: O, C: '#b06bff', c: '#e8d0ff', k: '#1b1226' },
    }],
    float: 5, bob: 2, bobSpeed: 2.5, hop: 3, fps: 1,
  },
  'pet-golem': {
    frames: [{
      rows: [
        '...oooooo...', '..oGGGGGGo..', '..oGeGGeGo..', '..oGGggGGo..', '.ooGGGGGGoo.', 'oGGoGGGGoGGo',
        'oGGoGMGGoGGo', 'oggoGGGGoggo', '..ooGGGGoo..', '..oGGo..oGGo', '..oooo..oooo',
      ],
      pal: { o: O, G: '#8a8fa0', g: '#aab0c0', e: '#ff9a3a', M: '#5ec26a' },
    }],
    float: 0, bob: 0.4, bobSpeed: 2, hop: 1, fps: 1,
  },
  'pet-glow': {
    frames: [{
      rows: [
        '............', '........oo..', '.oo.oo.oGGo.', 'oLLooLLoGkGo', 'oLLooLLoGGGo', '.oo.oo..ooo.', '............',
      ],
      pal: { o: O, G: '#7ad0a0', L: '#e8ff6a', k: '#1b1226' },
    }],
    float: 4, bob: 1.5, bobSpeed: 2.2, hop: 2, fps: 1,
  },
};

const cache = new Map<string, HTMLCanvasElement[]>();

function framesFor(id: string): HTMLCanvasElement[] | null {
  const def = PETS[id];
  if (!def) return null;
  let f = cache.get(id);
  if (!f) {
    f = def.frames.map((fr, i) => spriteFromRows(`${id}#${i}`, fr.rows, fr.pal));
    cache.set(id, f);
  }
  return f;
}

export function hasPet(id: string): boolean {
  return id in PETS;
}

/** Sprite for menus (first frame). */
export function petSprite(id: string): HTMLCanvasElement | null {
  return framesFor(id)?.[0] ?? null;
}

/**
 * Draws a pet standing on `groundY` at horizontal centre `x`.
 * `excited` is true while the miner is busy, so pets hop along with the digging.
 */
export function drawPet(
  ctx: CanvasRenderingContext2D,
  id: string,
  x: number,
  groundY: number,
  time: number,
  excited: boolean,
  moving: boolean,
): void {
  const def = PETS[id];
  const frames = framesFor(id);
  if (!def || !frames) return;
  const frame = frames[Math.floor(time * def.fps) % frames.length] as HTMLCanvasElement;
  const speed = moving ? def.bobSpeed * 2.5 : def.bobSpeed;
  const bob = Math.sin(time * speed) * def.bob;
  const hop = excited ? Math.abs(Math.sin(time * 9)) * def.hop : 0;
  const px = Math.round(x - frame.width / 2);
  const py = Math.round(groundY - frame.height - def.float - hop - bob);

  if (id === 'pet-glow') {
    // Additive, cross-shaped halo so it reads as light on any background (not a flat square).
    const pulse = 0.5 + 0.5 * Math.sin(time * 3);
    const cx = px + 3;
    const cy = py + 4;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = '#e8ff6a';
    ctx.globalAlpha = 0.10 + 0.10 * pulse;
    ctx.fillRect(cx - 4, cy - 1, 9, 3);
    ctx.fillRect(cx - 1, cy - 4, 3, 9);
    ctx.globalAlpha = 0.06 + 0.06 * pulse;
    ctx.fillRect(cx - 6, cy - 2, 13, 5);
    ctx.fillRect(cx - 2, cy - 6, 5, 13);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.drawImage(frame, px, py);
  if (id === 'pet-crystal') {
    for (let i = 0; i < 3; i++) {
      if (Math.floor(time * 4 + i * 1.7) % 3 !== 0) continue;
      const sx = px + 1 + ((i * 5 + Math.floor(time * 2)) % (frame.width - 2));
      const sy = py + ((i * 3 + 1) % (frame.height - 2));
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(sx, sy, 1, 1);
    }
  }
}

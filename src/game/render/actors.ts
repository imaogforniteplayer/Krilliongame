import type { EquipmentId } from '../types';
import { getCosmetic } from '../cosmetics/cosmetics';
import type { Look } from '../cosmetics/cosmetics';
import { makeCanvas, pixelLine, spriteFromRows } from '../pixel/canvas';

/**
 * The miner and all six pieces of equipment, drawn from code as chunky pixel art.
 * Coordinates are logical pixels; (x, feetY) is the point between the miner's boots.
 */

export type Mood = 'idle' | 'walk' | 'work' | 'victory' | 'surprise' | 'sad' | 'discover';

export interface DiggerState {
  x: number;
  feetY: number;
  tool: EquipmentId | null;
  mood: Mood;
  /** Seconds, global animation clock. */
  time: number;
  /** 0..1 position inside the tool's repeating swing / scoop cycle. */
  cycle: number;
  /** 0..1 how far the equipment has arrived (slides / drops in). 1 = in place. */
  appear: number;
  /** Camera/impact shake already applied by the caller; actors add their own vibration. */
  vibrate: boolean;
  /** When the miner is riding a machine. */
  ride: boolean;
}

const C = {
  outline: '#1b1226', helmet: '#ffd94a', helmetDark: '#d9951e', lamp: '#fffbd0',
  skin: '#f4bf93', skinDark: '#cf8f66', shirt: '#3f7be0', shirtDark: '#2a56a8', belt: '#8a4a24',
  pants: '#5b4b8f', pantsDark: '#3e3266', boot: '#5a331b', bootSole: '#2a160a', glove: '#e8932c', gloveDark: '#b0651a',
  steel: '#c9d2e4', steelMid: '#8f9ab4', steelDark: '#59627a', wood: '#a56a34', woodDark: '#6e431f',
  orange: '#ff8a1f', orangeLight: '#ffb24a', orangeDark: '#b8510a', yellow: '#ffc21a', metalBlack: '#2a2e3a',
};

let bodySprite: HTMLCanvasElement | null = null;
let currentLook: Look | null = null;

/**
 * Applies cosmetics to the miner: helmet, outfit and glove colours, and the backpack. Purely
 * visual. The look is global because there is only ever one player's miner on screen.
 */
export function setMinerLook(look: Look): void {
  currentLook = look;
  const h = getCosmetic(look.helmet)?.colors;
  const o = getCosmetic(look.outfit)?.colors;
  const g = getCosmetic(look.gloves)?.colors;
  if (h) { C.helmet = h.main; C.helmetDark = h.dark; }
  if (o) { C.shirt = o.main; C.shirtDark = o.dark; }
  if (g) { C.glove = g.main; C.gloveDark = g.dark; }
  bodySprite = null;
}

/** Changes whenever the look changes, so callers can cache images safely. */
export function lookSignature(): string {
  return currentLook ? Object.values(currentLook).join('|') : 'default';
}

const PACK_PAL = { o: '#1b1226', B: '#a56a34', b: '#c98a4a', k: '#ffd94a', T: '#5ec8e8', t: '#bff3ff', y: '#ffd94a', L: '#ffd94a', l: '#fff3a0', W: '#8fd6ff', w: '#e8f8ff' };
const PACK_ROWS: Record<string, { rows: string[]; dy: number }> = {
  'pack-satchel': { dy: 4, rows: ['..ooooo', '.oBBBBo', 'oBBBBBo', 'oBbbbBo', 'oBBBBBo', 'oBBkBBo', 'oBBBBBo', 'oBBBBBo', '.oBBBBo', '..ooooo'] },
  'pack-tank': { dy: 1, rows: ['..oooo.', '..oyyo.', '.ooTTTo', 'oTTtTTo', 'oTTtTTo', 'oTTtTTo', 'oTTtTTo', 'oTTTTTo', 'oTTTTTo', '.ooooo.'] },
  'pack-lantern': { dy: -3, rows: ['...ooo.', '..oLlLo', '..oLLLo', '...ooo.', '....o..', '....o..', '....o..', '....o..', '....oo.', '....oo.'] },
  'pack-glider': { dy: 2, rows: ['....oo.', '...oWWo', '..oWWwo', '.oWWwoo', 'oWWwo..', '.oWo...', '..oo...'] },
};
const packSprites = new Map<string, HTMLCanvasElement>();

/** Small icon of a backpack for menus, or null for "no backpack". */
export function backpackIcon(id: string): HTMLCanvasElement | null {
  const def = PACK_ROWS[id];
  if (!def) return null;
  let sprite = packSprites.get(id);
  if (!sprite) {
    sprite = spriteFromRows(id, def.rows, PACK_PAL);
    packSprites.set(id, sprite);
  }
  return sprite;
}

function drawBackpack(ctx: CanvasRenderingContext2D, id: string, bx: number, top: number): void {
  const def = PACK_ROWS[id];
  if (!def) return;
  let sprite = packSprites.get(id);
  if (!sprite) {
    sprite = spriteFromRows(id, def.rows, PACK_PAL);
    packSprites.set(id, sprite);
  }
  // Drawn before the body so it appears to sit behind the miner's shoulder.
  ctx.drawImage(sprite, Math.round(bx + 4), Math.round(top + def.dy));
}

function body(): HTMLCanvasElement {
  if (!bodySprite) {
    bodySprite = spriteFromRows('miner-body', [
      '....oooooo....',
      '...oyyyyyyo...',
      '..oyyyllyyYo..',
      '..oyyyyyyyYo..',
      '.ooYYYYYYYYoo.',
      '.osssssssssso.',
      '.osssssssssso.',
      '.osssssssssso.',
      '.osssssssssSo.',
      '...oSSSSSSo...',
      '..obbbbbbbbo..',
      '.obbbbbbbbbbo.',
      '.obbBbbbbBbbo.',
      '.obbbbbbbbbbo.',
      '.orrrryyrrrro.',
    ], {
      o: C.outline, y: C.helmet, Y: C.helmetDark, l: C.lamp, s: C.skin, S: C.skinDark,
      b: C.shirt, B: C.shirtDark, r: C.belt,
    });
  }
  return bodySprite;
}

const rect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string) => {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
};

function drawArm(ctx: CanvasRenderingContext2D, sx: number, sy: number, hx: number, hy: number): void {
  pixelLine(ctx, sx, sy, hx, hy, C.outline, 4);
  pixelLine(ctx, sx + 1, sy + 1, hx + 1, hy + 1, C.shirt, 2);
  rect(ctx, hx - 1, hy - 1, 4, 4, C.outline);
  rect(ctx, hx, hy, 2, 2, C.glove);
  rect(ctx, hx, hy + 1, 2, 1, C.gloveDark);
}

function drawLegs(ctx: CanvasRenderingContext2D, x: number, feetY: number, step: 'stand' | 'a' | 'b' | 'wide'): void {
  const lift = (side: 'l' | 'r') => (step === 'a' && side === 'l') || (step === 'b' && side === 'r') ? 2 : 0;
  const spread = step === 'wide' ? 1 : 0;
  for (const side of ['l', 'r'] as const) {
    const sx = side === 'l' ? x - 5 - spread : x + 1 + spread;
    const up = lift(side);
    const legTop = feetY - 6 - up * 0;
    rect(ctx, sx, legTop, 4, 3, C.pants);
    rect(ctx, side === 'l' ? sx + 3 : sx, legTop, 1, 3, C.pantsDark);
    const bootY = feetY - 3 - up;
    rect(ctx, sx - (side === 'l' ? 1 : 0), bootY, 5, 3, C.boot);
    rect(ctx, sx - (side === 'l' ? 1 : 0), bootY + 2, 5, 1, C.bootSole);
    rect(ctx, sx - (side === 'l' ? 1 : 0), bootY, 5, 1, C.outline);
  }
}

function drawFace(ctx: CanvasRenderingContext2D, x: number, top: number, mood: Mood, time: number, looking: 'fwd' | 'down'): void {
  const ex = x - 7;
  const ey = top + 6 + (looking === 'down' ? 1 : 0);
  const blink = Math.floor(time * 10) % 37 === 0;
  const dark = C.outline;
  if (mood === 'surprise' || mood === 'discover') {
    rect(ctx, ex + 3, ey - 1, 3, 3, '#ffffff'); rect(ctx, ex + 8, ey - 1, 3, 3, '#ffffff');
    rect(ctx, ex + 4, ey, 1, 2, dark); rect(ctx, ex + 9, ey, 1, 2, dark);
    rect(ctx, ex + 6, top + 9, 2, 2, dark);
    return;
  }
  if (mood === 'sad') {
    rect(ctx, ex + 4, ey + 1, 1, 2, dark); rect(ctx, ex + 9, ey + 1, 1, 2, dark);
    rect(ctx, ex + 3, ey - 1, 3, 1, C.skinDark); rect(ctx, ex + 8, ey - 1, 3, 1, C.skinDark);
    rect(ctx, ex + 5, top + 10, 4, 1, dark); rect(ctx, ex + 4, top + 11, 1, 1, dark); rect(ctx, ex + 9, top + 11, 1, 1, dark);
    rect(ctx, ex + 11, ey + 2, 1, 2, '#7fd4ff');
    return;
  }
  if (blink) { rect(ctx, ex + 3, ey + 1, 3, 1, dark); rect(ctx, ex + 8, ey + 1, 3, 1, dark); }
  else { rect(ctx, ex + 4, ey, 1, 2, dark); rect(ctx, ex + 9, ey, 1, 2, dark); }
  if (mood === 'victory') {
    rect(ctx, ex + 4, top + 9, 6, 1, dark); rect(ctx, ex + 5, top + 10, 4, 1, '#ffffff'); rect(ctx, ex + 5, top + 10, 4, 1, dark);
  } else {
    rect(ctx, ex + 6, top + 9, 2, 1, '#a8503c');
  }
}

// ---------------------------------------------------------------------------------------------
// Small tools. Each returns the hand positions it wants the arms to reach.
// ---------------------------------------------------------------------------------------------

type Hands = { l: [number, number]; r: [number, number] };
const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.max(0, Math.min(1, t));
const ease = (t: number) => t * t * (3 - 2 * t);

function drawShovel(ctx: CanvasRenderingContext2D, x: number, feetY: number, cycle: number, appear: number): Hands {
  let tx: number; let ty: number; let loaded = false;
  if (cycle < 0.3) { const t = ease(cycle / 0.3); tx = 1; ty = lerp(-3, 7, t); }
  else if (cycle < 0.6) { const t = ease((cycle - 0.3) / 0.3); tx = lerp(1, 10, t); ty = lerp(7, -9, t); loaded = true; }
  else if (cycle < 0.7) { tx = 10; ty = -9; loaded = cycle < 0.64; }
  else { const t = ease((cycle - 0.7) / 0.3); tx = lerp(10, 1, t); ty = lerp(-9, -3, t); }
  const slide = (1 - appear) * 12;
  const gx = x + 4 + tx * 0.3 - slide; const gy = feetY - 13;
  const bx = x + tx - slide; const by = feetY + ty;
  pixelLine(ctx, gx, gy, bx, by, C.outline, 3);
  pixelLine(ctx, gx, gy, bx, by, C.wood, 1);
  rect(ctx, gx - 2, gy - 1, 5, 2, C.woodDark);
  rect(ctx, bx - 3, by - 1, 7, 5, C.outline);
  rect(ctx, bx - 2, by, 5, 3, C.steel);
  rect(ctx, bx - 2, by + 2, 5, 1, C.steelMid);
  if (loaded) { rect(ctx, bx - 2, by - 2, 5, 2, '#7a4c28'); rect(ctx, bx - 1, by - 3, 2, 1, '#9a6a3c'); }
  return { r: [gx, gy], l: [lerp(gx, bx, 0.45), lerp(gy, by, 0.45)] };
}

function drawPickaxe(ctx: CanvasRenderingContext2D, x: number, feetY: number, cycle: number, appear: number): Hands {
  let deg: number;
  if (cycle < 0.55) deg = lerp(8, 150, ease(cycle / 0.55));
  else if (cycle < 0.7) deg = lerp(150, 160, (cycle - 0.55) / 0.15);
  else if (cycle < 0.82) deg = lerp(160, 8, ((cycle - 0.7) / 0.12) ** 0.7);
  else deg = 8;
  const a = (deg * Math.PI) / 180;
  const dx = Math.sin(a); const dy = Math.cos(a);
  const slide = (1 - appear) * 12;
  const hx = x + 4 - slide; const hy = feetY - 11;
  const len = 14;
  const tx = hx + dx * len; const ty = hy + dy * len;
  pixelLine(ctx, hx, hy, tx, ty, C.outline, 3);
  pixelLine(ctx, hx, hy, tx, ty, C.wood, 1);
  const px = Math.cos(a); const py = -Math.sin(a);
  pixelLine(ctx, tx - px * 7, ty - py * 7, tx + px * 7, ty + py * 7, C.outline, 4);
  pixelLine(ctx, tx - px * 6, ty - py * 6, tx + px * 6, ty + py * 6, C.steel, 2);
  pixelLine(ctx, tx + px * 5, ty + py * 5, tx + px * 7, ty + py * 7, '#ffffff', 1);
  rect(ctx, tx - 1, ty - 1, 3, 3, C.steelMid);
  return { r: [hx, hy], l: [lerp(hx, tx, 0.3), lerp(hy, ty, 0.3)] };
}

function drawJackhammer(ctx: CanvasRenderingContext2D, x: number, feetY: number, time: number, appear: number): Hands {
  const jit = Math.floor(time * 38) % 2 === 0 ? 1 : 0;
  const drop = (1 - appear) * -26;
  const y0 = feetY - 18 + jit + drop;
  rect(ctx, x - 5, y0 - 1, 11, 4, C.outline);
  rect(ctx, x - 4, y0, 9, 2, C.steel);
  rect(ctx, x - 2, y0 + 2, 5, 2, C.steelDark);
  rect(ctx, x - 4, y0 + 4, 9, 11, C.outline);
  rect(ctx, x - 3, y0 + 5, 7, 9, C.orange);
  rect(ctx, x - 3, y0 + 5, 2, 9, C.orangeLight);
  rect(ctx, x + 2, y0 + 5, 2, 9, C.orangeDark);
  rect(ctx, x - 3, y0 + 8, 7, 1, C.metalBlack);
  rect(ctx, x - 3, y0 + 11, 7, 1, C.metalBlack);
  // electric flicker
  if (Math.floor(time * 20) % 3 === 0) { rect(ctx, x + 4, y0 + 6, 2, 1, '#7ff2ff'); rect(ctx, x + 5, y0 + 7, 1, 2, '#e6ffff'); }
  rect(ctx, x - 2, y0 + 15, 5, 3, C.steelMid);
  rect(ctx, x - 1, y0 + 18, 3, 11, C.steel);
  rect(ctx, x - 1, y0 + 18, 1, 11, '#ffffff');
  rect(ctx, x - 1, y0 + 29, 3, 2, C.steelDark);
  return { l: [x - 5, y0 + 1], r: [x + 5, y0 + 1] };
}

function drawDrill(ctx: CanvasRenderingContext2D, x: number, feetY: number, time: number, appear: number): Hands {
  const jit = Math.floor(time * 30) % 2;
  const drop = (1 - appear) * -30;
  const y0 = feetY - 24 + jit + drop;
  // handle bars
  rect(ctx, x - 9, y0 + 2, 19, 3, C.outline);
  rect(ctx, x - 8, y0 + 3, 17, 1, C.steelMid);
  // housing
  rect(ctx, x - 6, y0 + 4, 13, 15, C.outline);
  rect(ctx, x - 5, y0 + 5, 11, 13, '#6f86b8');
  rect(ctx, x - 5, y0 + 5, 3, 13, '#9db3e0');
  rect(ctx, x + 3, y0 + 5, 3, 13, '#46588a');
  rect(ctx, x - 5, y0 + 9, 11, 3, C.orange);
  rect(ctx, x - 5, y0 + 9, 11, 1, C.orangeLight);
  rect(ctx, x - 1, y0 + 6, 3, 2, '#ffe28a');
  // hose
  pixelLine(ctx, x + 6, y0 + 7, x + 11, y0 + 3, C.outline, 2);
  pixelLine(ctx, x + 11, y0 + 3, x + 12, y0 - 4, C.outline, 2);
  // chuck and spiral bit
  rect(ctx, x - 4, y0 + 19, 9, 3, C.steelDark);
  const spin = Math.floor(time * 24);
  for (let i = 0; i < 20; i++) {
    const w = Math.max(1, Math.round(9 * (1 - i / 21)));
    const stripe = (i + spin) % 4 < 2;
    rect(ctx, x - Math.floor(w / 2) - 1, y0 + 22 + i, w + 2, 1, C.outline);
    rect(ctx, x - Math.floor(w / 2), y0 + 22 + i, w, 1, stripe ? C.steel : C.steelMid);
  }
  return { l: [x - 8, y0 + 3], r: [x + 9, y0 + 3] };
}

// ---------------------------------------------------------------------------------------------
// Machines. The miner rides in the cab, so these also draw the miner.
// ---------------------------------------------------------------------------------------------

function bounce(t: number): number {
  const n = 7.5625; const d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) { const u = t - 1.5 / d; return n * u * u + 0.75; }
  if (t < 2.5 / d) { const u = t - 2.25 / d; return n * u * u + 0.9375; }
  const u = t - 2.625 / d; return n * u * u + 0.984375;
}

/** 0 → machine is off-screen above; 1 → settled. Bounces on arrival. */
export function machineDrop(ent: number): number {
  return bounce(Math.max(0, Math.min(1, ent)));
}

function drawExcavator(ctx: CanvasRenderingContext2D, s: DiggerState): void {
  const { x, time } = s;
  const drop = (1 - machineDrop(s.appear)) * -(s.feetY + 70);
  const fy = s.feetY + drop;
  const vib = Math.floor(time * 30) % 2 === 0 ? 1 : 0;
  const t = time;
  // treads
  for (const sx of [x - 25, x + 18]) {
    rect(ctx, sx - 1, fy - 22, 9, 31, C.outline);
    rect(ctx, sx, fy - 21, 7, 29, C.metalBlack);
    for (let i = 0; i < 6; i++) {
      const yy = fy - 21 + ((i * 5 + Math.floor(t * 40)) % 30);
      rect(ctx, sx + 1, yy, 5, 2, '#4a5066');
    }
  }
  // cutter drum
  rect(ctx, x - 22, fy + 1 + vib, 45, 12, C.outline);
  rect(ctx, x - 21, fy + 2 + vib, 43, 10, C.steelMid);
  rect(ctx, x - 21, fy + 2 + vib, 43, 2, C.steel);
  for (let i = -22; i < 22; i += 4) {
    const xx = x + i + (Math.floor(t * 30) % 4);
    if (xx > x - 21 && xx < x + 20) rect(ctx, xx, fy + 4 + vib, 2, 8, C.steelDark);
  }
  for (let i = -20; i < 21; i += 6) {
    const xx = x + i + (Math.floor(t * 18) % 6);
    if (xx > x - 21 && xx < x + 19) { rect(ctx, xx, fy + 12 + vib, 3, 2, C.steel); rect(ctx, xx + 1, fy + 14 + vib, 1, 2, '#ffe28a'); }
  }
  // hull
  rect(ctx, x - 20, fy - 23 + vib, 41, 25, C.outline);
  rect(ctx, x - 19, fy - 22 + vib, 39, 23, C.yellow);
  rect(ctx, x - 19, fy - 22 + vib, 39, 3, '#ffe27a');
  rect(ctx, x - 19, fy - 4 + vib, 39, 5, C.metalBlack);
  for (let i = -19; i < 20; i++) if (((i + 40) >> 2) % 2 === 0) rect(ctx, x + i, fy - 4 + vib, 1, 5, C.yellow);
  rect(ctx, x - 16, fy - 16 + vib, 6, 4, '#fff6b0'); rect(ctx, x + 11, fy - 16 + vib, 6, 4, '#fff6b0');
  rect(ctx, x - 2, fy - 16 + vib, 5, 8, C.orangeDark);
  // exhaust
  rect(ctx, x + 12, fy - 33 + vib, 5, 11, C.outline); rect(ctx, x + 13, fy - 32 + vib, 3, 9, C.steelDark);
  // cab
  rect(ctx, x - 10, fy - 39 + vib, 21, 17, C.outline);
  rect(ctx, x - 9, fy - 38 + vib, 19, 15, '#2a3a52');
  s.ride = true;
  drawMinerBody(ctx, { ...s, feetY: fy - 22 + vib, mood: 'work', tool: null }, { l: [x - 5, fy - 29 + vib], r: [x + 5, fy - 29 + vib] }, 'down', true);
  rect(ctx, x - 9, fy - 38 + vib, 19, 15, 'rgba(127,227,255,0.28)');
  rect(ctx, x - 9, fy - 38 + vib, 4, 15, 'rgba(255,255,255,0.18)');
  rect(ctx, x - 11, fy - 41 + vib, 23, 3, C.outline); rect(ctx, x - 10, fy - 40 + vib, 21, 1, C.steelMid);
  if (Math.floor(t * 4) % 2 === 0) { rect(ctx, x - 1, fy - 44 + vib, 3, 3, '#ff3a3a'); rect(ctx, x - 1, fy - 45 + vib, 3, 1, '#ffd0d0'); }
}

function drawBorer(ctx: CanvasRenderingContext2D, s: DiggerState): void {
  const { x, time: t } = s;
  const drop = (1 - machineDrop(s.appear)) * -(s.feetY + 120);
  const fy = s.feetY + drop;
  const v = Math.floor(t * 34) % 2;
  // cutter disc edge
  rect(ctx, x - 30, fy + 1 + v, 61, 14, C.outline);
  rect(ctx, x - 29, fy + 2 + v, 59, 12, '#6b7592');
  rect(ctx, x - 29, fy + 2 + v, 59, 3, '#b9c3dc');
  rect(ctx, x - 29, fy + 11 + v, 59, 3, '#3a4262');
  const off = Math.floor(t * 46) % 8;
  for (let i = -32; i < 32; i += 8) {
    const xx = x + i + off;
    if (xx > x - 29 && xx < x + 28) { rect(ctx, xx, fy + 6 + v, 3, 5, '#ffe28a'); rect(ctx, xx, fy + 6 + v, 3, 1, '#ffffff'); }
  }
  // roller cutters
  const off2 = Math.floor(t * 30) % 8;
  for (let i = -32; i < 32; i += 8) {
    const xx = x + i + off2;
    if (xx > x - 28 && xx < x + 26) {
      rect(ctx, xx, fy + 15 + v, 5, 2, C.steel);
      rect(ctx, xx + 1, fy + 17 + v, 3, 2, C.steelMid);
      rect(ctx, xx + 2, fy + 19 + v, 1, 2, '#fff2b0');
    }
  }
  // body
  rect(ctx, x - 27, fy - 36, 55, 38, C.outline);
  rect(ctx, x - 26, fy - 35, 53, 36, '#c2394a');
  rect(ctx, x - 26, fy - 35, 53, 3, '#ff7b88');
  rect(ctx, x - 26, fy - 35, 9, 36, '#e5505f');
  rect(ctx, x + 16, fy - 35, 11, 36, '#7a1f2e');
  for (const by of [-26, -14]) { rect(ctx, x - 26, fy + by, 53, 3, '#8a2434'); for (let i = -24; i < 26; i += 6) rect(ctx, x + i, fy + by + 1, 1, 1, '#ffd0d6'); }
  for (let i = -26; i < 27; i++) if (((i + 60) >> 2) % 2 === 0) rect(ctx, x + i, fy - 6, 1, 6, '#1a1a22'); else rect(ctx, x + i, fy - 6, 1, 6, '#ffc21a');
  const glow = 0.55 + 0.45 * Math.sin(t * 9);
  for (const gx of [-18, -6, 6, 18]) { rect(ctx, x + gx - 2, fy - 20, 5, 4, C.outline); rect(ctx, x + gx - 1, fy - 19, 3, 2, glow > 0.7 ? '#ffe28a' : '#ff9a3c'); }
  // stacks
  for (const sx of [-21, 18]) { rect(ctx, x + sx - 1, fy - 46, 6, 12, C.outline); rect(ctx, x + sx, fy - 45, 4, 10, '#59627a'); rect(ctx, x + sx, fy - 45, 4, 2, '#8f9ab4'); }
  // dome cockpit
  rect(ctx, x - 12, fy - 52, 25, 17, C.outline);
  rect(ctx, x - 11, fy - 51, 23, 15, '#27324c');
  s.ride = true;
  drawMinerBody(ctx, { ...s, feetY: fy - 36, mood: 'work', tool: null }, { l: [x - 5, fy - 43], r: [x + 5, fy - 43] }, 'down', true);
  rect(ctx, x - 11, fy - 51, 23, 15, 'rgba(127,227,255,0.26)');
  rect(ctx, x - 11, fy - 51, 5, 15, 'rgba(255,255,255,0.2)');
  rect(ctx, x - 13, fy - 54, 27, 3, C.outline); rect(ctx, x - 12, fy - 53, 25, 1, '#b9c3dc');
  if (Math.floor(t * 5) % 2 === 0) { rect(ctx, x - 1, fy - 58, 3, 4, '#ff3a3a'); rect(ctx, x - 1, fy - 59, 3, 1, '#ffd0d0'); }
}

// ---------------------------------------------------------------------------------------------
// The miner
// ---------------------------------------------------------------------------------------------

function drawMinerBody(
  ctx: CanvasRenderingContext2D, s: DiggerState, hands: Hands, looking: 'fwd' | 'down', seated = false,
): void {
  const top = s.feetY - 20;
  ctx.drawImage(body(), Math.round(s.x - 7), Math.round(top));
  drawFace(ctx, s.x, top, s.mood, s.time, looking);
  if (seated) {
    rect(ctx, s.x - 5, s.feetY - 6, 10, 6, C.pants);
    rect(ctx, s.x - 5, s.feetY - 1, 10, 1, C.pantsDark);
  }
  drawArm(ctx, s.x - 6, top + 11, hands.l[0] - 1, hands.l[1]);
  drawArm(ctx, s.x + 5, top + 11, hands.r[0] - 1, hands.r[1]);
}

/** Draws the miner (and the equipment for the current dig, if any). Returns nothing; all state is passed in. */
export function drawDigger(ctx: CanvasRenderingContext2D, s: DiggerState): void {
  const { x, feetY, tool, mood, time } = s;
  s.ride = false;

  if (tool === 'excavator') { drawExcavator(ctx, s); return; }
  if (tool === 'tunnel-borer') { drawBorer(ctx, s); return; }

  const jitter = mood === 'work' && (tool === 'jackhammer' || tool === 'pneumatic-drill') && s.vibrate
    ? (Math.floor(time * 34) % 2 === 0 ? 1 : 0) : 0;
  const bob = mood === 'idle' ? Math.round(Math.sin(time * 3) * 0.6 + 0.4) : mood === 'walk' ? (Math.floor(time * 8) % 2) : 0;
  const crouch = mood === 'work' && tool === 'shovel' && s.cycle < 0.3 ? 1 : 0;
  const fy = feetY;
  const bx = x + jitter;
  const by = fy - bob + crouch;

  const legStep = mood === 'walk' ? (Math.floor(time * 8) % 2 === 0 ? 'a' : 'b')
    : mood === 'work' ? 'wide' : 'stand';
  drawLegs(ctx, bx, fy, legStep);

  let hands: Hands = { l: [bx - 7, by - 3], r: [bx + 7, by - 3] };
  let looking: 'fwd' | 'down' = 'fwd';

  if (mood === 'walk') {
    const sw = Math.sin(time * 8) * 3;
    hands = { l: [bx - 7, by - 4 + sw], r: [bx + 7, by - 4 - sw] };
  } else if (mood === 'victory') {
    const w = Math.sin(time * 10) * 2;
    hands = { l: [bx - 8, by - 20 + w], r: [bx + 8, by - 20 - w] };
  } else if (mood === 'surprise') {
    hands = { l: [bx - 11, by - 13], r: [bx + 11, by - 13] };
  } else if (mood === 'discover') {
    const w = Math.sin(time * 6) * 1.5;
    hands = { l: [bx - 9, by - 8], r: [bx + 4, by - 25 + w] };
  } else if (mood === 'sad') {
    hands = { l: [bx - 6, by - 1], r: [bx + 6, by - 1] };
    looking = 'down';
  } else if (mood === 'work' && tool) {
    looking = 'down';
  }

  const top = by - 20;
  if (currentLook && currentLook.backpack !== 'pack-none') drawBackpack(ctx, currentLook.backpack, bx, top);
  ctx.drawImage(body(), Math.round(bx - 7), Math.round(top));
  drawFace(ctx, bx, top, mood, time, looking);

  if (mood === 'work' && tool) {
    const ap = s.appear;
    if (tool === 'shovel') hands = drawShovel(ctx, bx, by, s.cycle, ap);
    else if (tool === 'pickaxe') hands = drawPickaxe(ctx, bx, by, s.cycle, ap);
    else if (tool === 'jackhammer') hands = drawJackhammer(ctx, bx, by, time, ap);
    else if (tool === 'pneumatic-drill') hands = drawDrill(ctx, bx, by, time, ap);
  }
  drawArm(ctx, bx - 6, top + 11, hands.l[0] - 1, hands.l[1]);
  drawArm(ctx, bx + 5, top + 11, hands.r[0] - 1, hands.r[1]);
}

/** Small icon-sized canvas of the miner for menus (idle pose). */
export function minerPortrait(scale = 1): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(28 * scale, 28 * scale);
  ctx.scale(scale, scale);
  drawDigger(ctx, { x: 14, feetY: 24, tool: null, mood: 'idle', time: 0, cycle: 0, appear: 1, vibrate: false, ride: false });
  return canvas;
}

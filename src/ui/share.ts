import { BIOMES, biomeAtDepth } from '../game/biomes/biomes';
import { drawText, drawTextCentered, textWidth } from '../game/pixel/font';
import { makeCanvas, shade } from '../game/pixel/canvas';
import { minerPortrait } from '../game/render/actors';
import { summarizeRun } from '../game/session';
import type { RunMode, RunState } from '../game/session';
import { formatMetres } from '../game/scoring/scoring';
import { TIER_COLORS, TIER_NAMES } from '../game/tiers';
import type { RarityTier } from '../game/types';

const SQUARE: Record<RarityTier, string> = {
  pebble: '\u{1F7EB}', // brown
  copper: '\u{1F7E7}', // orange
  quartz: '\u{1F7E6}', // blue
  obsidian: '⬛', // black
  void: '\u{1F7EA}', // purple
  corebound: '\u{1F7E5}', // red
};
const MISS = '⬜'; // white

const MODE_TITLE: Record<RunMode, string> = { daily: 'Daily Dig', endless: 'Endless Dig', practice: 'Practice Dig' };

/** Plain text for clipboards, chat apps and social posts. Never contains the answers themselves. */
export function shareText(run: RunState, url = ''): string {
  const s = summarizeRun(run);
  const biome = biomeAtDepth(run.depth);
  const squares = run.answers.map((a) => (a.tier ? SQUARE[a.tier] : MISS)).join('');
  const lines = [
    `DEEPER ${MODE_TITLE[run.mode]}${run.mode === 'daily' ? ` ${run.key}` : ''}`,
    `${formatMetres(run.depth)} deep · ${run.points} pts · ${biome.name}`,
    squares,
    s.rarest?.tier ? `Rarest: ${TIER_NAMES[s.rarest.tier]}` : 'Rarest: none this time',
  ];
  if (url) lines.push(url);
  return lines.join('\n');
}

const W = 150;
const H = 188;
const OUT_SCALE = 5;

/** An original pixel-art result card (750 x 940 PNG). Spoiler-free: shows rarity colours, not answers. */
export function renderShareCard(run: RunState): HTMLCanvasElement {
  const summary = summarizeRun(run);
  const biome = biomeAtDepth(run.depth);
  const pal = biome.palette;
  const { canvas, ctx } = makeCanvas(W, H);

  // Night sky → strata
  ctx.fillStyle = '#120d24';
  ctx.fillRect(0, 0, W, H);
  for (let y = 0; y < 60; y += 4) {
    ctx.fillStyle = y % 8 === 0 ? '#181233' : '#1d1640';
    ctx.fillRect(0, y, W, 4);
  }
  // Stars
  for (let i = 0; i < 26; i++) {
    const x = (i * 53 + 11) % W;
    const y = (i * 29 + 5) % 56;
    ctx.fillStyle = i % 5 === 0 ? '#ffe28a' : '#8a82b8';
    ctx.fillRect(x, y, 1, 1);
  }
  // Layered terrain bands in the colours of the deepest biome reached
  const bands = [pal.light, pal.base, shade(pal.base, -0.12), pal.dark, shade(pal.dark, -0.2)];
  const top = 60;
  const bandH = (H - top) / bands.length;
  bands.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(0, Math.round(top + i * bandH), W, Math.ceil(bandH));
    for (let n = 0; n < 40; n++) {
      const x = (n * 37 + i * 17) % W;
      const y = Math.round(top + i * bandH) + ((n * 13 + i * 7) % Math.max(1, Math.floor(bandH)));
      ctx.fillStyle = n % 3 === 0 ? pal.light : shade(c, -0.18);
      ctx.fillRect(x, y, 1, 1);
    }
  });
  // Shaft
  ctx.fillStyle = '#0a0716';
  ctx.fillRect(W / 2 - 7, top, 14, H - top);
  ctx.fillStyle = '#1d1640';
  ctx.fillRect(W / 2 - 7, top, 1, H - top);
  ctx.fillRect(W / 2 + 6, top, 1, H - top);
  // Grass lip
  ctx.fillStyle = '#5ec26a';
  ctx.fillRect(0, top - 2, W / 2 - 7, 3);
  ctx.fillRect(W / 2 + 7, top - 2, W / 2 - 7, 3);

  // Miner at the shaft mouth
  const miner = minerPortrait(1);
  ctx.drawImage(miner, W / 2 - 14, top - 24);

  // Title and details on a dark plate
  ctx.fillStyle = 'rgba(10,7,22,0.82)';
  ctx.fillRect(10, 4, W - 20, 31);
  drawTextCentered(ctx, 'DEEPER', W / 2, 7, '#ffe28a', 4, '#6a3a12');
  drawTextCentered(ctx, `${MODE_TITLE[run.mode]}${run.mode === 'daily' ? ` ${run.key}` : ''}`, W / 2, 29, '#cfe8ff', 1);

  // Plate with the headline numbers
  ctx.fillStyle = 'rgba(10,7,22,0.88)';
  ctx.fillRect(8, 86, W - 16, 62);
  ctx.strokeStyle = pal.glow;
  ctx.lineWidth = 1;
  ctx.strokeRect(8.5, 86.5, W - 17, 61);
  drawTextCentered(ctx, formatMetres(run.depth).toUpperCase(), W / 2, 91, '#ffffff', 3, '#3a2a78');
  drawTextCentered(ctx, `${run.points} POINTS`, W / 2, 110, '#ffe28a', 2);
  drawTextCentered(ctx, biome.name.toUpperCase(), W / 2, 126, pal.glow, 1);
  const rarest = summary.rarest?.tier;
  drawTextCentered(ctx, rarest ? `RAREST: ${TIER_NAMES[rarest].toUpperCase()}` : 'NO RARE FINDS', W / 2, 136, rarest ? TIER_COLORS[rarest] : '#8a82b8', 1);

  // One block per question, coloured by rarity tier
  const n = run.questionIds.length;
  const size = 14;
  const gap = 3;
  const rowW = n * size + (n - 1) * gap;
  const x0 = Math.round((W - rowW) / 2);
  for (let i = 0; i < n; i++) {
    const a = run.answers[i];
    const color = a?.tier ? TIER_COLORS[a.tier] : '#3a3450';
    const x = x0 + i * (size + gap);
    ctx.fillStyle = '#0a0716';
    ctx.fillRect(x - 1, 156 - 1, size + 2, size + 2);
    ctx.fillStyle = color;
    ctx.fillRect(x, 156, size, size);
    ctx.fillStyle = shade(color, 0.3);
    ctx.fillRect(x, 156, size, 2);
    ctx.fillRect(x, 156, 2, size);
    ctx.fillStyle = shade(color, -0.3);
    ctx.fillRect(x, 156 + size - 2, size, 2);
    ctx.fillRect(x + size - 2, 156, 2, size);
  }
  const tag = 'ANSWER RARE. DIG DEEP.';
  drawText(ctx, tag, Math.round((W - textWidth(tag)) / 2), H - 10, '#cfe8ff', 1);

  // Biome list marker: tiny ladder showing how far through the world this run got
  const reached = BIOMES.filter((b) => run.depth >= b.startDepth).length;
  for (let i = 0; i < BIOMES.length; i++) {
    ctx.fillStyle = i < reached ? (BIOMES[i]?.palette.glow ?? '#fff') : '#3a3450';
    ctx.fillRect(10 + i * 9, 79, 7, 2);
  }

  const out = document.createElement('canvas');
  out.width = W * OUT_SCALE;
  out.height = H * OUT_SCALE;
  const octx = out.getContext('2d');
  if (!octx) return canvas;
  octx.imageSmoothingEnabled = false;
  octx.drawImage(canvas, 0, 0, out.width, out.height);
  return out;
}

export function downloadCard(run: RunState): void {
  const card = renderShareCard(run);
  card.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deeper-${run.mode}-${run.key}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  }, 'image/png');
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export async function nativeShare(run: RunState, url: string): Promise<boolean> {
  if (typeof navigator.share !== 'function') return false;
  try {
    const card = renderShareCard(run);
    const blob: Blob | null = await new Promise((res) => card.toBlob(res, 'image/png'));
    const data: ShareData = { title: 'DEEPER', text: shareText(run) };
    if (blob) {
      const file = new File([blob], `deeper-${run.key}.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) data.files = [file];
    }
    if (!data.files) data.url = url;
    await navigator.share(data);
    return true;
  } catch {
    return false;
  }
}

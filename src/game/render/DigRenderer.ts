import type { Biome } from '../biomes/biomes';
import { BIOMES, biomeAtDepth, nextBiome } from '../biomes/biomes';
import type { DiscoveryItem } from '../discoveries/discoveries';
import { DISCOVERIES } from '../discoveries/discoveries';
import { EQUIPMENT_BY_TIER } from '../digging/equipment';
import { drawText, drawTextCentered, textWidth } from '../pixel/font';
import { discoveryIcon } from '../pixel/items';
import { hash2, makeCanvas, mix, seeded, shade } from '../pixel/canvas';
import { decoSprite, TILE, TILE_VARIANTS, terrainTile } from '../pixel/terrain';
import { depthForPoints, pointsForTier } from '../scoring/scoring';
import { TIER_COLORS } from '../tiers';
import type { EquipmentId, RarityTier } from '../types';
import type { DiggerState, Mood } from './actors';
import { drawDigger, setMinerLook } from './actors';
import { ParticleSystem } from './particles';
import { drawPet } from './pets';
import { spawnTrail } from './effects';
import type { Look } from '../cosmetics/cosmetics';

/** Pixels of scroll per metre of depth. Chosen so a Pebble dig (100 m) is a satisfying small step. */
export const PX_PER_M = 0.9;
const BASE_HALF_WIDTH = 13;
const RULER_W = 24;

export interface DigSpec {
  tier: RarityTier;
  equipment: EquipmentId;
  fromDepth: number;
  toDepth: number;
  durationMs: number;
  intensity: number;
  discovery?: { atFraction: number; item: DiscoveryItem; holdMs: number };
}

export interface RendererHooks {
  onEquip?: (tier: RarityTier) => void;
  onImpact?: (tier: RarityTier, strength: number) => void;
  onDiscovery?: (item: DiscoveryItem) => void;
  onBiomeChange?: (biome: Biome) => void;
  onDigEnd?: (tier: RarityTier) => void;
  onFrame?: (depth: number) => void;
}

interface ActiveDig {
  spec: DigSpec;
  t: number;
  total: number;
  equipEnd: number;
  operEnd: number;
  hold: number;
  fired: boolean;
  cycleT: number;
  lastCycle: number;
  equipped: boolean;
  landed: boolean;
  emitAcc: number;
  resolve: () => void;
}

const ease = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * Math.max(0, Math.min(1, t)));
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const BIOME_TAG = ['', 'SOIL', 'ROOT', 'CLAY', 'STONE', 'LAKE', 'BONES', 'GEMS', 'RUINS', 'ICE', 'MAGMA', 'MINES', 'HOLE', 'CORE', '???'];
const SKY = ['#dff0fa', '#b4d6f6', '#86b6f0', '#5b8fe0', '#3c68c4', '#2b4d9b', '#223b7d'];
const HANGING = new Set(['root', 'stalactite', 'icicle']);

export class DigRenderer {
  private ctx: CanvasRenderingContext2D;
  private light: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null = null;
  private w = 160;
  private h = 120;
  private feetY = 62;
  private raf = 0;
  private last = 0;
  private time = 0;
  private depth = 0;
  private minerX = 80;
  private mood: Mood = 'idle';
  private moodUntil = 0;
  private dig: ActiveDig | null = null;
  private tool: EquipmentId | null = null;
  private shake = 0;
  private flash = 0;
  private flashColor = '#ffffff';
  private lastBiome = 0;
  private widths = new Map<number, number>();
  private lamps: { x: number; y: number }[] = [];
  private particles = new ParticleSystem();
  private ambient = new ParticleSystem();
  private rnd = seeded('deeper-fx');
  private reduced = false;
  private heldItem: DiscoveryItem | null = null;
  private walkTarget: { x: number; resolve: () => void } | null = null;
  private demo = false;
  private destroyed = false;
  private smokeAcc = 0;
  private look: Look | null = null;
  private petX = -40;
  private fx = new ParticleSystem();
  private fxAcc = 0;

  constructor(private canvas: HTMLCanvasElement, private hooks: RendererHooks = {}, reducedMotion = false) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D is not available in this browser.');
    this.ctx = ctx;
    this.reduced = reducedMotion;
    this.ambient.cap = 90;
    this.fx.cap = 70;
  }

  /** Applies the player's cosmetics: outfit colours, backpack, pet and trail effect. */
  setLook(look: Look): void {
    this.look = look;
    setMinerLook(look);
  }

  // -------------------------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------------------------

  start(): void {
    if (this.raf || this.destroyed) return;
    this.last = performance.now();
    const loop = (now: number) => {
      if (this.destroyed) return;
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.update(dt);
      this.draw();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.demo = false;
    if (this.dig) this.finishDig(true);
  }

  /** Fit the scene to a CSS-pixel box using the largest whole-number pixel scale. */
  resize(cssW: number, cssH: number, targetLogicalWidth = 200): void {
    const scale = Math.max(2, Math.floor(cssW / targetLogicalWidth));
    this.w = Math.max(96, Math.ceil(cssW / scale));
    this.h = Math.max(72, Math.ceil(cssH / scale));
    this.canvas.width = this.w;
    this.canvas.height = this.h;
    this.canvas.style.width = `${this.w * scale}px`;
    this.canvas.style.height = `${this.h * scale}px`;
    this.ctx.imageSmoothingEnabled = false;
    this.feetY = Math.round(this.h * 0.52);
    if (!this.walkTarget) this.minerX = Math.round((this.w - RULER_W) / 2);
    this.light = null;
    this.draw();
  }

  setReducedMotion(on: boolean): void {
    this.reduced = on;
  }

  getDepth(): number {
    return this.depth;
  }

  setDepth(metres: number): void {
    this.depth = Math.max(0, metres);
    this.lastBiome = biomeAtDepth(this.depth).index;
  }

  /** Start a fresh descent: clears the carved shaft and puts the miner on the surface. */
  reset(): void {
    this.widths.clear();
    this.depth = 0;
    this.lastBiome = 0;
    this.particles.clear();
    this.tool = null;
    this.heldItem = null;
    this.mood = 'idle';
    this.minerX = Math.round((this.w - RULER_W) / 2);
    this.fx.clear();
    this.petX = this.minerX - this.petOffset();
  }

  /** The miner walks out of the left edge of the screen to the mine entrance. */
  walkIn(): Promise<void> {
    if (this.reduced) { this.minerX = this.centerX(); return Promise.resolve(); }
    this.minerX = -12;
    this.petX = -12 - this.petOffset();
    this.mood = 'walk';
    return new Promise((resolve) => { this.walkTarget = { x: this.centerX(), resolve }; });
  }

  react(mood: 'victory' | 'sad' | 'surprise' | 'discover', ms = 900): void {
    this.mood = mood;
    this.moodUntil = this.time + ms / 1000;
  }

  play(spec: DigSpec, opts: { skip?: boolean } = {}): Promise<void> {
    if (this.dig) this.finishDig(true);
    const machine = spec.equipment === 'excavator' || spec.equipment === 'tunnel-borer';
    const total = this.reduced || opts.skip ? 500 : spec.durationMs;
    const equipEnd = this.reduced || opts.skip ? 80 : machine ? Math.min(total * 0.34, spec.equipment === 'tunnel-borer' ? 1600 : 1200) : total * 0.16;
    const operEnd = total * 0.92;
    return new Promise<void>((resolve) => {
      this.dig = {
        spec, t: 0, total, equipEnd, operEnd, hold: 0, fired: !spec.discovery, cycleT: 0, lastCycle: 0,
        equipped: false, landed: false, emitAcc: 0, resolve,
      };
      this.tool = spec.equipment;
      this.mood = 'work';
      this.heldItem = null;
      this.minerX = this.centerX();
      if (opts.skip) this.finishDig(false);
    });
  }

  /** Jump straight to the end of the current dig animation. */
  skip(): void {
    if (this.dig) this.finishDig(false);
  }

  isDigging(): boolean {
    return this.dig !== null;
  }

  startDemo(): void {
    if (this.demo) return;
    this.demo = true;
    void this.runDemo();
  }

  stopDemo(): void {
    this.demo = false;
  }

  // -------------------------------------------------------------------------------------------
  // Simulation
  // -------------------------------------------------------------------------------------------

  private centerX(): number {
    return Math.round((this.w - RULER_W) / 2);
  }

  private async runDemo(): Promise<void> {
    const tiers: RarityTier[] = ['pebble', 'copper', 'quartz', 'obsidian', 'void', 'corebound'];
    while (this.demo && !this.destroyed) {
      this.reset();
      await this.walkIn();
      await this.sleep(500);
      for (const tier of tiers) {
        if (!this.demo || this.destroyed) return;
        const eq = EQUIPMENT_BY_TIER[tier];
        const from = this.depth;
        const to = from + depthForPoints(pointsForTier(tier));
        const gem = tier === 'quartz' ? DISCOVERIES.find((d) => d.id === 'ruby') : undefined;
        await this.play({
          tier, equipment: eq.id, fromDepth: from, toDepth: to, durationMs: eq.durationMs, intensity: eq.intensity,
          discovery: gem ? { atFraction: 0.5, item: gem, holdMs: 1100 } : undefined,
        });
        await this.sleep(tier === 'corebound' ? 1800 : 450);
      }
      this.flashNow('#ffffff', 0.9);
      await this.sleep(500);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, this.reduced ? Math.min(ms, 200) : ms));
  }

  private shaftHalf(worldY: number): number {
    return this.widths.get(Math.floor(worldY / 4)) ?? BASE_HALF_WIDTH;
  }

  private carve(worldY: number, half: number): void {
    for (let y = worldY - 10; y <= worldY + 10; y += 4) {
      const k = Math.floor(y / 4);
      if (y >= 0 && (this.widths.get(k) ?? BASE_HALF_WIDTH) < half) this.widths.set(k, half);
    }
  }

  private flashNow(color: string, amount: number): void {
    if (this.reduced) return;
    this.flash = Math.max(this.flash, amount);
    this.flashColor = color;
  }

  private update(dt: number): void {
    this.time += dt;
    if (this.walkTarget) {
      const speed = 46;
      this.minerX += speed * dt;
      if (this.minerX >= this.walkTarget.x) {
        this.minerX = this.walkTarget.x;
        const done = this.walkTarget.resolve;
        this.walkTarget = null;
        this.mood = 'idle';
        done();
      }
    }
    if (this.mood !== 'work' && this.mood !== 'walk' && this.moodUntil > 0 && this.time > this.moodUntil) {
      this.mood = 'idle';
      this.moodUntil = 0;
    }
    if (this.dig) this.updateDig(dt);

    this.shake = Math.max(0, this.shake - dt * 14);
    this.flash = Math.max(0, this.flash - dt * 2.2);
    this.particles.update(dt);
    this.updateAmbient(dt);
    this.updatePetAndFx(dt);

    const biome = biomeAtDepth(this.depth);
    if (biome.index !== this.lastBiome) {
      this.lastBiome = biome.index;
      this.flashNow(biome.palette.glow, 0.35);
      this.hooks.onBiomeChange?.(biome);
    }
    this.hooks.onFrame?.(this.depth);
  }

  private updateDig(dt: number): void {
    const d = this.dig as ActiveDig;
    const { spec } = d;
    const eq = spec.equipment;
    const machine = eq === 'excavator' || eq === 'tunnel-borer';
    const feetWorld = this.depth * PX_PER_M;

    if (d.hold > 0) {
      d.hold -= dt * 1000;
      this.mood = 'discover';
      if (!this.reduced && this.rnd() < 0.5) this.sparkle(this.minerX + (this.rnd() - 0.5) * 30, this.feetY - 40 + (this.rnd() - 0.5) * 20, TIER_COLORS[spec.tier]);
      if (d.hold <= 0) { this.heldItem = null; this.mood = 'work'; }
      return;
    }

    d.t += dt * 1000;
    const eqId = eq;
    if (!d.equipped && d.t > 0) {
      d.equipped = true;
      this.hooks.onEquip?.(spec.tier);
      this.flashNow(TIER_COLORS[spec.tier], spec.tier === 'corebound' ? 0.7 : machine ? 0.35 : 0.18);
      if (!this.reduced) {
        this.particles.burst({ x: this.minerX, y: this.feetY - 8, count: machine ? 26 : 12, colors: ['#ffffff', TIER_COLORS[spec.tier], '#ffe28a'], speed: 60, spread: Math.PI * 2, up: 0, life: 0.5, gravity: 20, rnd: this.rnd, mode: 'blink' });
      }
    }

    const appear = clamp01(d.t / d.equipEnd);
    if (machine && !d.landed && appear >= 0.62) {
      d.landed = true;
      if (!this.reduced) {
        this.shake = Math.max(this.shake, eq === 'tunnel-borer' ? 7 : 4);
        this.particles.burst({ x: this.minerX - 20, y: this.feetY + 4, count: 20, colors: ['#8a6a4a', '#b09070', '#6a5238'], speed: 70, spread: Math.PI * 0.55, up: Math.PI, life: 0.8, gravity: 90, rnd: this.rnd });
        this.particles.burst({ x: this.minerX + 20, y: this.feetY + 4, count: 20, colors: ['#8a6a4a', '#b09070', '#6a5238'], speed: 70, spread: Math.PI * 0.55, up: 0, life: 0.8, gravity: 90, rnd: this.rnd });
      }
      this.hooks.onImpact?.(spec.tier, 1);
    }

    const prog = d.t <= d.equipEnd ? 0 : clamp01((d.t - d.equipEnd) / (d.operEnd - d.equipEnd));
    const newDepth = spec.fromDepth + (spec.toDepth - spec.fromDepth) * ease(prog);
    const moved = newDepth - this.depth;
    this.depth = newDepth;

    if (spec.discovery && !d.fired && prog >= spec.discovery.atFraction) {
      d.fired = true;
      d.hold = this.reduced ? Math.min(900, spec.discovery.holdMs) : spec.discovery.holdMs;
      this.heldItem = spec.discovery.item;
      this.flashNow('#ffffff', 0.5);
      this.hooks.onDiscovery?.(spec.discovery.item);
      return;
    }

    if (eq === 'excavator') this.carve(this.depth * PX_PER_M, 25);
    else if (eq === 'tunnel-borer') this.carve(this.depth * PX_PER_M, 31);

    const operating = d.t > d.equipEnd && d.t < d.operEnd;
    if (operating) {
      const periods: Partial<Record<EquipmentId, number>> = { shovel: 0.5, pickaxe: 0.68 };
      const period = periods[eqId];
      if (period) {
        d.cycleT += dt / period;
        const cycle = d.cycleT % 1;
        this.cycleEvents(d.lastCycle, cycle, eq, spec);
        d.lastCycle = cycle;
      } else {
        d.cycleT += dt;
      }
      this.emitContinuous(dt, d, eq, spec, moved / Math.max(dt, 0.001));
      if (!this.reduced) {
        const amp = spec.intensity * (machine ? 2.4 : 1.5);
        if (eq === 'jackhammer' || eq === 'pneumatic-drill' || machine) this.shake = Math.max(this.shake, amp);
      }
    }

    if (d.t >= d.total) this.finishDig(false);
    void feetWorld;
  }

  private cycleEvents(prev: number, cur: number, eq: EquipmentId, spec: DigSpec): void {
    const crossed = (at: number) => (prev < at && cur >= at) || (cur < prev && (at > prev || at <= cur));
    if (eq === 'shovel') {
      if (crossed(0.28)) {
        this.hooks.onImpact?.(spec.tier, 0.4);
        if (!this.reduced) this.particles.burst({ x: this.minerX + 1, y: this.feetY + 2, count: 6, colors: this.dirtColors(), speed: 40, spread: Math.PI * 0.9, life: 0.45, gravity: 150, rnd: this.rnd });
      }
      if (crossed(0.64)) {
        if (!this.reduced) this.particles.burst({ x: this.minerX + 10, y: this.feetY - 9, count: 10, colors: this.dirtColors(), speed: 55, spread: Math.PI * 0.6, up: -0.5, life: 0.7, gravity: 190, rnd: this.rnd });
      }
    } else if (eq === 'pickaxe' && crossed(0.82)) {
      this.hooks.onImpact?.(spec.tier, 0.7);
      if (!this.reduced) {
        this.shake = Math.max(this.shake, 1.6);
        this.particles.burst({ x: this.minerX, y: this.feetY + 3, count: 12, colors: this.chipColors(), speed: 70, spread: Math.PI * 1.1, life: 0.6, gravity: 190, rnd: this.rnd });
        this.particles.burst({ x: this.minerX, y: this.feetY + 3, count: 4, colors: ['#ffe28a', '#ffffff'], speed: 90, spread: Math.PI, life: 0.25, gravity: 0, rnd: this.rnd, mode: 'blink' });
      }
    }
  }

  private emitContinuous(dt: number, d: ActiveDig, eq: EquipmentId, spec: DigSpec, _speed: number): void {
    if (this.reduced) {
      if (Math.floor(d.t / 120) !== Math.floor((d.t - dt * 1000) / 120)) this.particles.burst({ x: this.minerX, y: this.feetY + 2, count: 3, colors: this.chipColors(), speed: 30, spread: Math.PI, life: 0.4, rnd: this.rnd });
      return;
    }
    const rates: Partial<Record<EquipmentId, number>> = { jackhammer: 55, 'pneumatic-drill': 85, excavator: 70, 'tunnel-borer': 120 };
    const rate = rates[eq] ?? 0;
    if (!rate) return;
    d.emitAcc += rate * dt;
    const n = Math.floor(d.emitAcc);
    d.emitAcc -= n;
    const half = eq === 'tunnel-borer' ? 28 : eq === 'excavator' ? 21 : 6;
    const baseY = this.feetY + (eq === 'tunnel-borer' ? 16 : eq === 'excavator' ? 12 : 9);
    for (let i = 0; i < n; i++) {
      const x = this.minerX + (this.rnd() - 0.5) * 2 * half;
      const r = this.rnd();
      if (eq === 'pneumatic-drill' && r < 0.55) {
        this.particles.spawn({ x, y: baseY, vx: (this.rnd() - 0.5) * 140, vy: -40 - this.rnd() * 90, life: 0.3 + this.rnd() * 0.2, color: r < 0.2 ? '#ffffff' : r < 0.4 ? '#ffe28a' : '#ff9a3c', gravity: 120, mode: 'blink' });
      } else if (eq === 'tunnel-borer' && r < 0.3) {
        this.particles.spawn({ x, y: baseY, vx: (this.rnd() - 0.5) * 170, vy: -60 - this.rnd() * 110, life: 0.35 + this.rnd() * 0.25, color: r < 0.1 ? '#ffffff' : '#ffb24a', gravity: 160, mode: 'blink' });
      } else {
        const big = eq === 'tunnel-borer' || eq === 'excavator';
        this.particles.spawn({
          x, y: baseY, vx: (this.rnd() - 0.5) * (big ? 130 : 90), vy: -(big ? 60 : 40) - this.rnd() * (big ? 120 : 80),
          life: 0.5 + this.rnd() * 0.5, color: this.rnd() < 0.5 ? this.chipColors()[Math.floor(this.rnd() * 3)] as string : this.dirtColors()[Math.floor(this.rnd() * 3)] as string,
          gravity: 200, size: big && this.rnd() < 0.5 ? 3 : this.rnd() < 0.4 ? 2 : 1,
        });
      }
    }
    if (eq === 'tunnel-borer' || eq === 'excavator') {
      // Falling rocks from the top of the shaft and chimney smoke.
      if (this.rnd() < (eq === 'tunnel-borer' ? 9 : 4) * dt) {
        this.particles.spawn({ x: this.minerX + (this.rnd() - 0.5) * 50, y: -4, vx: (this.rnd() - 0.5) * 10, vy: 30, life: 1.6, color: this.chipColors()[Math.floor(this.rnd() * 3)] as string, gravity: 260, size: 2, mode: 'solid' });
      }
      this.smokeAcc += dt;
      if (this.smokeAcc > 0.09) {
        this.smokeAcc = 0;
        const sx = eq === 'tunnel-borer' ? [this.minerX - 19, this.minerX + 20] : [this.minerX + 14];
        for (const x of sx) this.particles.spawn({ x, y: this.feetY - (eq === 'tunnel-borer' ? 48 : 35), vx: (this.rnd() - 0.5) * 10, vy: -28 - this.rnd() * 10, life: 0.9, color: '#8a8aa0', gravity: -10, size: 2, alpha: 0.7 });
      }
    }
    void spec;
  }

  private sparkle(x: number, y: number, color: string): void {
    this.particles.spawn({ x, y, vx: (this.rnd() - 0.5) * 30, vy: -10 - this.rnd() * 20, life: 0.6, color: this.rnd() < 0.5 ? '#ffffff' : color, gravity: 10, mode: 'blink' });
  }

  private dirtColors(): string[] {
    const p = biomeAtDepth(this.depth).palette;
    return [p.base, p.dark, p.light];
  }

  private chipColors(): string[] {
    const p = biomeAtDepth(this.depth).palette;
    return [shade(p.base, 0.1), p.light, '#9aa0b0'];
  }

  private finishDig(interrupted: boolean): void {
    const d = this.dig;
    if (!d) return;
    this.dig = null;
    this.depth = d.spec.toDepth;
    this.tool = null;
    this.heldItem = null;
    const big = d.spec.tier !== 'pebble' && d.spec.tier !== 'copper';
    if (!interrupted && big && !this.reduced) { this.mood = 'victory'; this.moodUntil = this.time + 0.8; }
    else this.mood = 'idle';
    this.hooks.onDigEnd?.(d.spec.tier);
    d.resolve();
  }

  private updateAmbient(dt: number): void {
    this.ambient.update(dt);
    if (this.reduced) return;
    const biome = biomeAtDepth(this.depth);
    if (biome.ambient === 'none') return;
    const underground = this.depth > 8;
    if (!underground) return;
    const rate = biome.ambient === 'snow' ? 7 : biome.ambient === 'embers' ? 6 : biome.ambient === 'stars' ? 4 : 4;
    if (this.rnd() < rate * dt) {
      const x = this.minerX + (this.rnd() - 0.5) * 70;
      const y = this.rnd() * this.feetY;
      const p = biome.palette;
      switch (biome.ambient) {
        case 'dust': this.ambient.spawn({ x, y, vx: 2, vy: 3, life: 3, color: p.light, alpha: 0.5, mode: 'fade' }); break;
        case 'spores': this.ambient.spawn({ x, y: y + 20, vx: (this.rnd() - 0.5) * 5, vy: -5, life: 3.5, color: p.glow, alpha: 0.8, mode: 'fade' }); break;
        case 'snow': this.ambient.spawn({ x, y: 0, vx: (this.rnd() - 0.5) * 6, vy: 14, life: 5, color: '#ffffff', alpha: 0.85, mode: 'solid' }); break;
        case 'embers': this.ambient.spawn({ x, y: this.feetY + 20, vx: (this.rnd() - 0.5) * 8, vy: -16, life: 3, color: p.accent, alpha: 0.9, mode: 'fade' }); break;
        case 'drips': this.ambient.spawn({ x, y: 0, vx: 0, vy: 10, gravity: 60, life: 2, color: p.glow, alpha: 0.8, mode: 'solid' }); break;
        case 'motes': this.ambient.spawn({ x, y, vx: (this.rnd() - 0.5) * 4, vy: (this.rnd() - 0.5) * 4, life: 3, color: this.rnd() > 0.5 ? p.glow : p.accent, alpha: 0.9, mode: 'blink' }); break;
        case 'stars': this.ambient.spawn({ x, y, vx: 0, vy: 0, life: 1.6, color: this.rnd() > 0.5 ? '#ffffff' : p.accent, alpha: 1, mode: 'blink' }); break;
        default: break;
      }
    }
  }

  // -------------------------------------------------------------------------------------------
  // Drawing
  // -------------------------------------------------------------------------------------------

  private draw(): void {
    const { ctx, w, h } = this;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#0b0818';
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    if (this.shake > 0.2 && !this.reduced) {
      const a = Math.round(this.shake);
      ctx.translate(Math.round((this.rnd() - 0.5) * 2 * a), Math.round((this.rnd() - 0.5) * 2 * a));
    }

    const camY = this.depth * PX_PER_M;
    const topWorld = camY - this.feetY;
    const groundY = Math.round(-topWorld);
    this.lamps = [];

    this.drawSky(groundY);
    this.drawTerrain(topWorld);
    this.drawShaft(topWorld, camY);
    if (groundY > -40) this.drawEntrance(groundY);
    this.drawActor();
    this.fx.draw(ctx);
    this.particles.draw(ctx);
    this.ambient.draw(ctx);
    ctx.restore();

    this.drawLighting(groundY);
    this.drawRuler(topWorld);
    if (this.flash > 0.02) {
      ctx.globalAlpha = Math.min(0.85, this.flash);
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
  }

  private drawSky(groundY: number): void {
    if (groundY <= 0) return;
    const { ctx, w } = this;
    const top = Math.min(groundY, this.h);
    for (let i = SKY.length - 1; i >= 0; i--) {
      const yTo = groundY - i * 20;
      const yFrom = i === SKY.length - 1 ? 0 : groundY - (i + 1) * 20;
      if (yTo <= 0 || yFrom >= top) continue;
      ctx.fillStyle = SKY[i] as string;
      ctx.fillRect(0, Math.max(0, yFrom), w, Math.min(top, yTo) - Math.max(0, yFrom));
    }
    // sun
    const sx = Math.round(w * 0.72); const sy = groundY - 68;
    if (sy > -20 && sy < this.h + 20) {
      ctx.fillStyle = '#fff3b0'; ctx.fillRect(sx - 9, sy - 6, 18, 12); ctx.fillRect(sx - 6, sy - 9, 12, 18);
      ctx.fillStyle = '#ffe066'; ctx.fillRect(sx - 7, sy - 5, 14, 10); ctx.fillRect(sx - 5, sy - 7, 10, 14);
    }
    // clouds
    for (let i = 0; i < 4; i++) {
      const cx = Math.round(((this.time * (3 + i) + i * 61) % (w + 60)) - 30);
      const cy = groundY - 54 - i * 17;
      if (cy < -12 || cy > this.h) continue;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx, cy, 24, 4); ctx.fillRect(cx + 4, cy - 3, 14, 4); ctx.fillRect(cx + 8, cy - 5, 8, 3);
      ctx.fillStyle = '#dbe9f7'; ctx.fillRect(cx, cy + 3, 24, 1);
    }
    // hills
    for (const [col, base, amp, freq, ph] of [['#4f8f6e', 22, 9, 0.045, 1], ['#3d7a58', 12, 6, 0.08, 4]] as const) {
      ctx.fillStyle = col;
      for (let x = 0; x < w; x += 2) {
        const hh = Math.round(base + Math.sin(x * freq + ph) * amp);
        ctx.fillRect(x, groundY - hh, 2, hh);
      }
    }
    // trees
    for (const tx of [Math.round(w * 0.12), Math.round(w * 0.3), Math.round(w * 0.62)]) {
      const ty = groundY;
      ctx.fillStyle = '#5a3a1c'; ctx.fillRect(tx, ty - 10, 3, 10);
      ctx.fillStyle = '#2f7a3c'; ctx.fillRect(tx - 5, ty - 20, 13, 11); ctx.fillRect(tx - 3, ty - 24, 9, 4);
      ctx.fillStyle = '#48a455'; ctx.fillRect(tx - 5, ty - 20, 5, 3); ctx.fillRect(tx - 3, ty - 24, 4, 2);
    }
  }

  private tileBiome(row: number, col: number): Biome {
    const a = biomeAtDepth((row * TILE) / PX_PER_M);
    const b = biomeAtDepth((row * TILE + TILE - 1) / PX_PER_M);
    if (a.index === b.index) return a;
    return hash2(col, row, 3) < 0.5 ? a : b;
  }

  private drawTerrain(topWorld: number): void {
    const { ctx, w, h } = this;
    const firstRow = Math.max(0, Math.floor(topWorld / TILE));
    const lastRow = Math.ceil((topWorld + h) / TILE);
    const cols = Math.ceil(w / TILE);
    for (let r = firstRow; r <= lastRow; r++) {
      const y = Math.round(r * TILE - topWorld);
      for (let c = 0; c < cols; c++) {
        const biome = this.tileBiome(r, c);
        const variant = Math.floor(hash2(c, r, 1) * TILE_VARIANTS);
        ctx.drawImage(terrainTile(biome, variant), c * TILE, y);
        const dh = hash2(c, r, 7);
        if (dh < 0.2 && r > 0) {
          const kinds = biome.decorations;
          const kind = kinds[Math.floor(hash2(c, r, 8) * kinds.length)] as string;
          const spr = decoSprite(kind, biome);
          const ox = Math.floor(hash2(c, r, 9) * Math.max(1, TILE - spr.width + 1));
          const oy = HANGING.has(kind) ? 0 : Math.floor(hash2(c, r, 10) * Math.max(1, TILE - spr.height + 1));
          ctx.drawImage(spr, c * TILE + ox, y + oy);
        }
      }
    }
  }

  private drawShaft(topWorld: number, camY: number): void {
    const { ctx } = this;
    const cx = this.centerX();
    const start = Math.max(0, Math.floor(topWorld / 4) * 4);
    const end = Math.min(camY + 4, topWorld + this.h);
    for (let wy = start; wy < end; wy += 4) {
      const half = this.shaftHalf(wy);
      const biome = biomeAtDepth(wy / PX_PER_M);
      const p = biome.palette;
      const sy = Math.round(wy - topWorld);
      const back = shade(p.dark, -0.55);
      const x0 = cx - half;
      const width = half * 2;
      ctx.fillStyle = back; ctx.fillRect(x0, sy, width, 4);
      ctx.fillStyle = shade(p.dark, -0.4); ctx.fillRect(x0 + 2, sy, width - 4, 4);
      ctx.fillStyle = shade(p.dark, -0.7); ctx.fillRect(x0 + 5, sy, width - 10, 4);
      // wall edges
      ctx.fillStyle = p.light; ctx.fillRect(x0 - 1, sy, 1, 4);
      ctx.fillStyle = shade(p.dark, -0.7); ctx.fillRect(x0 + width, sy, 1, 4);
      // supports every 64px
      if (wy % 64 === 0 && wy > 0) {
        ctx.fillStyle = '#2a1608'; ctx.fillRect(x0 - 1, sy, width + 2, 4);
        ctx.fillStyle = '#7a5028'; ctx.fillRect(x0, sy, width, 3);
        ctx.fillStyle = '#9a6c38'; ctx.fillRect(x0, sy, width, 1);
        ctx.fillStyle = '#2a1608'; ctx.fillRect(x0 + 2, sy + 1, 1, 1); ctx.fillRect(x0 + width - 3, sy + 1, 1, 1);
        if (wy % 128 === 0 && half <= BASE_HALF_WIDTH) {
          this.lamps.push({ x: cx - half + 4, y: sy + 8 });
          ctx.fillStyle = '#2a1608'; ctx.fillRect(cx - half + 3, sy + 4, 3, 2);
          ctx.fillStyle = '#ffb84a'; ctx.fillRect(cx - half + 3, sy + 6, 3, 4);
          ctx.fillStyle = '#fff3a0'; ctx.fillRect(cx - half + 4, sy + 7, 1, 2);
        }
      }
    }
    // rubble at the dig face
    const faceY = Math.round(camY - topWorld);
    if (camY > 0) {
      const half = this.shaftHalf(camY);
      const p = biomeAtDepth(this.depth).palette;
      ctx.fillStyle = shade(p.dark, -0.2);
      for (let x = -half; x < half; x += 3) {
        const bump = Math.round(hash2(x, 4, 99) * 2);
        ctx.fillRect(cx + x, faceY - bump, 3, bump + 2);
      }
    }
  }

  private drawEntrance(groundY: number): void {
    const { ctx } = this;
    const cx = this.centerX();
    const half = BASE_HALF_WIDTH;
    // grass
    ctx.fillStyle = '#5ec26a'; ctx.fillRect(0, groundY, this.w, 3);
    ctx.fillStyle = '#3f9a4c'; ctx.fillRect(0, groundY + 3, this.w, 1);
    for (let x = 0; x < this.w; x += 5) { const t = hash2(x, 1, 5); if (t > 0.4) { ctx.fillStyle = '#7ddc86'; ctx.fillRect(x, groundY - 1 - Math.floor(t * 2), 1, 2); } }
    // hole
    ctx.fillStyle = '#120a1a'; ctx.fillRect(cx - half, groundY, half * 2, 4);
    // frame
    ctx.fillStyle = '#2a1608'; ctx.fillRect(cx - half - 5, groundY - 31, 6, 32); ctx.fillRect(cx + half, groundY - 31, 6, 32);
    ctx.fillStyle = '#8a5a2c'; ctx.fillRect(cx - half - 4, groundY - 30, 4, 30); ctx.fillRect(cx + half + 1, groundY - 30, 4, 30);
    ctx.fillStyle = '#b07a3c'; ctx.fillRect(cx - half - 4, groundY - 30, 1, 30); ctx.fillRect(cx + half + 1, groundY - 30, 1, 30);
    ctx.fillStyle = '#2a1608'; ctx.fillRect(cx - half - 9, groundY - 36, half * 2 + 19, 7);
    ctx.fillStyle = '#7a5028'; ctx.fillRect(cx - half - 8, groundY - 35, half * 2 + 17, 5);
    ctx.fillStyle = '#9a6c38'; ctx.fillRect(cx - half - 8, groundY - 35, half * 2 + 17, 1);
    const label = 'DEEPER';
    const tw = textWidth(label, 1);
    ctx.fillStyle = '#2a1608'; ctx.fillRect(cx - Math.floor(tw / 2) - 3, groundY - 49, tw + 6, 11);
    ctx.fillStyle = '#d9b46a'; ctx.fillRect(cx - Math.floor(tw / 2) - 2, groundY - 48, tw + 4, 9);
    drawText(ctx, label, cx - Math.floor(tw / 2), groundY - 46, '#3a2410', 1);
    ctx.fillStyle = '#2a1608'; ctx.fillRect(cx - 1, groundY - 38, 2, 2);
    // lantern
    ctx.fillStyle = '#ffb84a'; ctx.fillRect(cx - half - 3, groundY - 24, 3, 4);
    ctx.fillStyle = '#fff3a0'; ctx.fillRect(cx - half - 2, groundY - 23, 1, 2);
    this.lamps.push({ x: cx - half - 2, y: groundY - 22 });
  }

  /** How far behind the miner the pet waits. Machines are wide, so the pet keeps clear of them. */
  private petOffset(): number {
    return this.tool === 'tunnel-borer' ? 42 : this.tool === 'excavator' ? 34 : 17;
  }

  private isExcited(): boolean {
    return this.mood === 'work' || this.mood === 'victory' || this.mood === 'discover' || this.mood === 'surprise';
  }

  private updatePetAndFx(dt: number): void {
    // The pet follows the miner with a little lag, so it trots after them when they walk in.
    const target = this.minerX - this.petOffset();
    this.petX += (target - this.petX) * Math.min(1, dt * (this.mood === 'walk' ? 6 : 4));

    const fxId = this.look?.effect ?? 'fx-none';
    if (fxId === 'fx-none' || this.reduced) return;
    this.fx.update(dt);
    this.fxAcc += dt * (this.isExcited() ? 36 : 5);
    while (this.fxAcc >= 1) {
      this.fxAcc -= 1;
      spawnTrail(this.fx, fxId, this.minerX, this.feetY, this.rnd);
    }
  }

  private drawActor(): void {
    if (this.look && this.look.pet !== 'pet-none') {
      drawPet(this.ctx, this.look.pet, Math.round(this.petX), this.feetY, this.time, this.isExcited(), this.mood === 'walk');
    }
    const s: DiggerState = {
      x: Math.round(this.minerX),
      feetY: this.feetY,
      tool: this.tool,
      mood: this.mood,
      time: this.time,
      cycle: this.dig ? this.dig.cycleT % 1 : 0,
      appear: this.dig ? clamp01(this.dig.t / Math.max(1, this.dig.equipEnd)) : 1,
      vibrate: !this.reduced,
      ride: false,
    };
    drawDigger(this.ctx, s);
    if (this.heldItem) {
      const icon = discoveryIcon(this.heldItem);
      const sc = 2;
      const bob = Math.round(Math.sin(this.time * 6) * 1.5);
      const ix = Math.round(this.minerX + 4 - (icon.width * sc) / 2);
      const iy = this.feetY - 24 - icon.height * sc + bob;
      const rc = TIER_COLORS[this.dig?.spec.tier ?? 'pebble'];
      this.ctx.globalAlpha = 0.5;
      this.ctx.fillStyle = rc;
      this.ctx.fillRect(ix - 4, iy - 4, icon.width * sc + 8, icon.height * sc + 8);
      this.ctx.globalAlpha = 1;
      this.ctx.drawImage(icon, ix, iy, icon.width * sc, icon.height * sc);
    }
  }

  private ensureLight(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
    if (!this.light) this.light = makeCanvas(this.w, this.h);
    return this.light;
  }

  private drawLighting(groundY: number): void {
    const depthFactor = clamp01(this.depth / 7000);
    const dark = this.depth < 4 ? 0 : 0.16 + depthFactor * 0.5;
    if (dark <= 0.01) return;
    const { canvas, ctx: lc } = this.ensureLight();
    lc.globalCompositeOperation = 'source-over';
    lc.clearRect(0, 0, this.w, this.h);
    lc.fillStyle = `rgba(6,3,16,${dark.toFixed(3)})`;
    lc.fillRect(0, Math.max(0, groundY), this.w, this.h);
    lc.globalCompositeOperation = 'destination-out';
    const glow = (x: number, y: number, r: number, a: number) => {
      const g = lc.createRadialGradient(x, y, 2, x, y, r);
      g.addColorStop(0, `rgba(0,0,0,${a})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      lc.fillStyle = g;
      lc.fillRect(x - r, y - r, r * 2, r * 2);
    };
    const machine = this.tool === 'tunnel-borer' ? 1.5 : this.tool === 'excavator' ? 1.25 : 1;
    glow(this.minerX, this.feetY - 6, 58 * machine, 0.95);
    for (const l of this.lamps) glow(l.x, l.y, 26, 0.85);
    this.ctx.drawImage(canvas, 0, 0);
    // warm lamp tint
    this.ctx.globalCompositeOperation = 'lighter';
    this.ctx.globalAlpha = 0.07;
    this.ctx.fillStyle = '#ffb060';
    this.ctx.fillRect(Math.round(this.minerX - 30), this.feetY - 36, 60, 56);
    this.ctx.globalAlpha = 1;
    this.ctx.globalCompositeOperation = 'source-over';
  }

  private drawRuler(topWorld: number): void {
    const { ctx, w, h } = this;
    const x0 = w - RULER_W;
    ctx.fillStyle = 'rgba(10,6,22,0.78)';
    ctx.fillRect(x0, 0, RULER_W, h);
    ctx.fillStyle = '#37285f'; ctx.fillRect(x0, 0, 1, h);
    const mTop = topWorld / PX_PER_M;
    const mBot = (topWorld + h) / PX_PER_M;
    const first = Math.max(0, Math.floor(mTop / 20) * 20);
    for (let m = first; m <= mBot; m += 20) {
      const y = Math.round(m * PX_PER_M - topWorld);
      if (y < 0 || y >= h) continue;
      const major = m % 100 === 0;
      ctx.fillStyle = major ? '#c9b8ff' : '#6a5a9a';
      ctx.fillRect(w - (major ? 7 : 4), y, major ? 7 : 4, 1);
      if (major && m > 0) drawText(ctx, String(m), w - 9 - textWidth(String(m)), y - 2, '#b8a8f0', 1);
    }
    for (const b of BIOMES) {
      if (b.index === 0) continue;
      const y = Math.round(b.startDepth * PX_PER_M - topWorld);
      if (y < -6 || y > h + 6) continue;
      ctx.fillStyle = b.palette.accent; ctx.fillRect(x0 + 1, y, RULER_W - 1, 2);
      const tag = BIOME_TAG[b.index] as string;
      ctx.fillStyle = 'rgba(10,6,22,0.85)'; ctx.fillRect(x0 + 2, y + 2, textWidth(tag) + 2, 7);
      drawText(ctx, tag, x0 + 3, y + 3, b.palette.glow, 1);
    }
    // current depth arrow
    const ay = this.feetY;
    ctx.fillStyle = '#ff9a3c';
    ctx.fillRect(x0 - 5, ay - 1, 5, 3);
    ctx.fillRect(x0 - 3, ay - 3, 1, 7); ctx.fillRect(x0 - 4, ay - 2, 1, 5);
    ctx.fillStyle = '#ffd94a'; ctx.fillRect(x0, ay, RULER_W, 1);
    const cur = `${Math.round(this.depth)}M`;
    ctx.fillStyle = '#120d24'; ctx.fillRect(x0 + 1, ay + 2, textWidth(cur) + 3, 8);
    drawText(ctx, cur, x0 + 2, ay + 4, '#ffd94a', 1);
    const nb = nextBiome(this.depth);
    if (nb) {
      const left = Math.max(0, Math.round(nb.startDepth - this.depth));
      const t = `${BIOME_TAG[nb.index]} ${left}M`;
      drawTextCentered(ctx, t, x0 / 2, h - 8, '#e0d4ff', 1, '#120d24');
    }
    void mix;
  }
}

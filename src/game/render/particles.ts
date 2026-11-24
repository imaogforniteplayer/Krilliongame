export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
  gravity: number;
  /** 'fade' shrinks to nothing; 'blink' flickers (sparks); 'solid' stays full until it dies. */
  mode: 'fade' | 'blink' | 'solid';
  alpha: number;
}

export class ParticleSystem {
  list: Particle[] = [];
  /** Hard cap so a Corebound dig can never tank the frame rate on a phone. */
  cap = 420;

  spawn(p: Partial<Particle> & Pick<Particle, 'x' | 'y' | 'color'>): void {
    if (this.list.length >= this.cap) this.list.shift();
    this.list.push({
      vx: 0, vy: 0, life: 0.6, max: 0.6, size: 1, gravity: 0, mode: 'fade', alpha: 1, ...p,
    });
    const last = this.list[this.list.length - 1] as Particle;
    last.max = last.life;
  }

  burst(opts: {
    x: number; y: number; count: number; colors: readonly string[]; speed: number; spread?: number; up?: number;
    life?: number; gravity?: number; size?: number; mode?: Particle['mode']; rnd: () => number;
  }): void {
    const { x, y, count, colors, speed, rnd } = opts;
    for (let i = 0; i < count; i++) {
      const a = (opts.up !== undefined ? opts.up : -Math.PI / 2) + (rnd() - 0.5) * (opts.spread ?? Math.PI);
      const s = speed * (0.4 + rnd() * 0.9);
      this.spawn({
        x: x + (rnd() - 0.5) * 4, y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: (opts.life ?? 0.7) * (0.6 + rnd() * 0.7),
        color: colors[Math.floor(rnd() * colors.length)] as string,
        gravity: opts.gravity ?? 160,
        size: opts.size ?? (rnd() > 0.7 ? 2 : 1),
        mode: opts.mode ?? 'fade',
      });
    }
  }

  update(dt: number): void {
    for (const p of this.list) {
      p.life -= dt;
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.list = this.list.filter((p) => p.life > 0);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const p of this.list) {
      const t = p.life / p.max;
      if (p.mode === 'blink' && Math.floor(p.life * 40) % 2 === 0) continue;
      const size = p.mode === 'fade' ? Math.max(1, Math.round(p.size * Math.min(1, t * 1.6))) : p.size;
      ctx.globalAlpha = p.alpha * (p.mode === 'fade' ? Math.min(1, t * 2) : 1);
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), size, size);
    }
    ctx.globalAlpha = 1;
  }

  clear(): void {
    this.list = [];
  }
}

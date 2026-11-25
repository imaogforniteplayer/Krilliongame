import { useEffect, useRef, useState } from 'react';
import { SLOTS, getCosmetic, isUnlocked, itemsInSlot, unlockText } from '../../game/cosmetics/cosmetics';
import type { Cosmetic, CosmeticSlot } from '../../game/cosmetics/cosmetics';
import { unlockContext } from '../../game/progression/context';
import { backpackIcon, drawDigger } from '../../game/render/actors';
import { EFFECT_COLORS, spawnTrail } from '../../game/render/effects';
import { ParticleSystem } from '../../game/render/particles';
import { drawPet } from '../../game/render/pets';
import { Panel } from '../components/Panel';
import { petIconUrl } from '../icons';
import { useLook, useSave } from '../store';

type PreviewMood = 'idle' | 'victory' | 'surprise' | 'discover';

const W = 80;
const H = 56;
const FEET = 48;

/** Live preview of the equipped look. The miner and pet animate on their own; nothing to control. */
function LookPreview({ mood, reduced }: { mood: PreviewMood; reduced: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const moodRef = useRef(mood);
  moodRef.current = mood;
  const look = useLook();
  const lookRef = useRef(look);
  lookRef.current = look;

  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !ctx) return;
    ctx.imageSmoothingEnabled = false;
    const fx = new ParticleSystem();
    fx.cap = 60;
    let raf = 0;
    let last = performance.now();
    let t = 0;
    let acc = 0;
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += reduced ? 0 : dt;
      const m = moodRef.current;
      const l = lookRef.current;
      ctx.fillStyle = '#3a2a1c';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#5b3f28';
      for (let i = 0; i < 40; i++) ctx.fillRect((i * 37) % W, ((i * 17) % (H - 12)) + 2, 2, 1);
      ctx.fillStyle = '#6b4a30';
      ctx.fillRect(0, FEET, W, H - FEET);
      ctx.fillStyle = '#2b1d12';
      ctx.fillRect(0, FEET, W, 1);

      if (!reduced && l.effect !== 'fx-none') {
        fx.update(dt);
        acc += dt * (m === 'idle' ? 6 : 36);
        while (acc >= 1) {
          acc -= 1;
          spawnTrail(fx, l.effect, W / 2 + 6, FEET, Math.random);
        }
      }
      if (l.pet !== 'pet-none') drawPet(ctx, l.pet, W / 2 - 18, FEET, t, m !== 'idle', false);
      drawDigger(ctx, { x: W / 2 + 6, feetY: FEET, tool: null, mood: m, time: t, cycle: 0, appear: 1, vibrate: false, ride: false });
      fx.draw(ctx);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  return <canvas ref={ref} className="preview" width={W} height={H} role="img" aria-label="Your miner wearing the equipped items" />;
}

function Swatch({ item }: { item: Cosmetic }) {
  if (item.colors) {
    return (
      <span className="swatch" aria-hidden="true">
        <i style={{ background: item.colors.main }} />
        <i style={{ background: item.colors.dark }} />
      </span>
    );
  }
  if (item.slot === 'pet') {
    const url = petIconUrl(item.id);
    return url ? <img className="pixel-img swatch swatch--img" src={url} alt="" /> : <span className="swatch swatch--none" aria-hidden="true" />;
  }
  if (item.slot === 'backpack') {
    const icon = backpackIcon(item.id);
    return icon ? <img className="pixel-img swatch swatch--img" src={icon.toDataURL()} alt="" /> : <span className="swatch swatch--none" aria-hidden="true" />;
  }
  if (item.slot === 'effect') {
    const colors = EFFECT_COLORS[item.id];
    return colors ? (
      <span className="swatch" aria-hidden="true">
        {colors.map((c) => (
          <i key={c} style={{ background: c }} />
        ))}
      </span>
    ) : (
      <span className="swatch swatch--none" aria-hidden="true" />
    );
  }
  return <span className="swatch swatch--none" aria-hidden="true" />;
}

export function Garage() {
  const { save, update, reducedMotion } = useSave();
  const look = useLook();
  const ctx = unlockContext(save);
  const [mood, setMood] = useState<PreviewMood>('idle');
  const timer = useRef(0);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function preview(m: PreviewMood) {
    setMood(m);
    window.clearTimeout(timer.current);
    if (m !== 'idle') timer.current = window.setTimeout(() => setMood('idle'), 1800);
  }

  function equip(slot: CosmeticSlot, id: string) {
    update((s) => ({ ...s, look: { ...s.look, [slot]: id } }));
    if (slot === 'emote') preview(id === 'emote-gasp' ? 'surprise' : id === 'emote-point' ? 'discover' : 'victory');
  }

  const total = SLOTS.reduce((n, { slot }) => n + itemsInSlot(slot).length, 0);
  const owned = SLOTS.reduce((n, { slot }) => n + itemsInSlot(slot).filter((c) => isUnlocked(c, ctx)).length, 0);

  return (
    <div className="page">
      <h1 className="title">Garage</h1>
      <p className="muted">
        Cosmetics change how your miner looks and nothing else. No item, free or otherwise, ever changes your score or depth. Unlock items by
        levelling up, keeping streaks, digging deep, finding things, earning achievements, and from the daily mystery reward.
      </p>

      <Panel title="Your miner">
        <div className="garage__preview">
          <LookPreview mood={mood} reduced={reducedMotion} />
          <div className="garage__moods">
            <span className="muted">Preview:</span>
            <button type="button" className="btn btn--small" onClick={() => preview('victory')}>
              Cheer
            </button>
            <button type="button" className="btn btn--small" onClick={() => preview('surprise')}>
              Gasp
            </button>
            <button type="button" className="btn btn--small" onClick={() => preview('discover')}>
              Discover
            </button>
          </div>
        </div>
        <p className="muted">
          {owned} of {total} items unlocked.
        </p>
      </Panel>

      {SLOTS.map(({ slot, label }) => (
        <Panel key={slot} title={label}>
          <ul className="cosmetics">
            {itemsInSlot(slot).map((item) => {
              const open = isUnlocked(item, ctx);
              const on = look[slot] === item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`cosmetic${on ? ' cosmetic--on' : ''}${open ? '' : ' cosmetic--locked'}`}
                    disabled={!open}
                    aria-pressed={on}
                    onClick={() => equip(slot, item.id)}
                  >
                    <Swatch item={item} />
                    <span className="cosmetic__name">{item.name}</span>
                    <span className="cosmetic__note">{on ? 'Wearing' : open ? 'Unlocked' : unlockText(item)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Panel>
      ))}
      <p className="muted">{getCosmetic(look.pet)?.name === 'No Pet' ? 'Unlock a pet to have a companion follow your miner.' : ''}</p>
    </div>
  );
}

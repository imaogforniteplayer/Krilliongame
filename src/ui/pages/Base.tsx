import { useMemo } from 'react';
import { BASE_THEMES, ROOMS, availableThemes, getTheme } from '../../game/base/base';
import { ACHIEVEMENTS } from '../../game/progression/achievements';
import { COSMETICS, isUnlocked } from '../../game/cosmetics/cosmetics';
import { unlockContext } from '../../game/progression/context';
import { DISCOVERIES } from '../../game/discoveries/discoveries';
import { BIOMES } from '../../game/biomes/biomes';
import { EQUIPMENT_BY_TIER } from '../../game/digging/equipment';
import { TIER_ORDER } from '../../game/types';
import { levelFromXp, xpOf } from '../../game/storage';
import { TIER_COLORS } from '../../game/tiers';
import { Panel } from '../components/Panel';
import { discoveryIconUrl, minerPortraitUrl, petIconUrl } from '../icons';
import { useSave } from '../store';

const TIER_RANK = Object.fromEntries(TIER_ORDER.map((t, i) => [t, i])) as Record<string, number>;

export function Base() {
  const { save, update } = useSave();
  const level = levelFromXp(xpOf(save)).level;
  const ctx = unlockContext(save);
  const themes = availableThemes(ctx.deepest);
  const theme = getTheme(save.base.theme, ctx.deepest);

  const rarest = useMemo(
    () =>
      DISCOVERIES.filter((d) => save.collection[d.id])
        .sort((a, b) => (TIER_RANK[b.rarity] ?? 0) - (TIER_RANK[a.rarity] ?? 0))
        .slice(0, 6),
    [save.collection],
  );
  const pets = COSMETICS.filter((c) => c.slot === 'pet' && c.id !== 'pet-none' && isUnlocked(c, ctx));
  const reachedBiomes = BIOMES.filter((b) => b.startDepth <= Math.max(save.deepestEver, save.survivalBest.depth)).length;
  const earned = ACHIEVEMENTS.filter((a) => save.achievements[a.id] !== undefined);

  function room(id: (typeof ROOMS)[number]['id']) {
    switch (id) {
      case 'shaft':
        return (
          <div className="room__body">
            <img className="pixel-img room__miner" src={minerPortraitUrl()} alt="Your miner" />
            <p>Level {level} miner. Every dig starts here.</p>
          </div>
        );
      case 'trophy':
        return earned.length === 0 ? (
          <p className="muted">Earn achievements to fill the shelves.</p>
        ) : (
          <ul className="chips">
            {earned.map((a) => (
              <li key={a.id} className="chip chip--good">
                {a.name}
              </li>
            ))}
          </ul>
        );
      case 'bay':
        return (
          <ul className="chips">
            {TIER_ORDER.map((t) => {
              const used = save.tierTotals[t] > 0;
              return (
                <li key={t} className="chip" style={used ? { borderColor: TIER_COLORS[t] } : { opacity: 0.45 }}>
                  {EQUIPMENT_BY_TIER[t].name}
                  {used ? ` x${save.tierTotals[t]}` : ' (not used yet)'}
                </li>
              );
            })}
          </ul>
        );
      case 'den':
        return pets.length === 0 ? (
          <p className="muted">Unlock pets in the Garage and they will live here.</p>
        ) : (
          <ul className="den">
            {pets.map((p) => (
              <li key={p.id}>
                <img className="pixel-img den__pet" src={petIconUrl(p.id) ?? ''} alt="" />
                <span>{p.name}</span>
              </li>
            ))}
          </ul>
        );
      case 'storage':
        return (
          <ul className="chips">
            <li className="chip">{save.lifetime.runs} digs</li>
            <li className="chip">{save.lifetime.answers} answers</li>
            <li className="chip">{save.lifetime.depth.toLocaleString('en-US')} m dug</li>
            <li className="chip">{save.lifetime.points.toLocaleString('en-US')} points</li>
          </ul>
        );
      case 'wing':
        return rarest.length === 0 ? (
          <p className="muted">Discoveries made while digging appear here, rarest first.</p>
        ) : (
          <ul className="finds">
            {rarest.map((d) => (
              <li key={d.id} className="find" style={{ ['--tier' as string]: TIER_COLORS[d.rarity] }}>
                <img className="pixel-img find__icon" src={discoveryIconUrl(d)} alt="" />
                <span>{d.name}</span>
              </li>
            ))}
          </ul>
        );
      case 'deck':
        return (
          <p>
            You have reached {reachedBiomes} of {BIOMES.length} biomes. Deepest dig: {ctx.deepest.toLocaleString('en-US')} m.
          </p>
        );
    }
  }

  return (
    <div className="page">
      <h1 className="title">Your base</h1>
      <p className="muted">
        An optional showcase. Rooms open as you level up and display what you already have. There is nothing to build, feed or maintain.
      </p>

      <Panel title="Style">
        <ul className="chips">
          {BASE_THEMES.map((t) => {
            const open = themes.some((x) => x.id === t.id);
            return (
              <li key={t.id}>
                <button
                  type="button"
                  className={`chip chip--btn${theme.id === t.id ? ' chip--on' : ''}`}
                  disabled={!open}
                  aria-pressed={theme.id === t.id}
                  onClick={() => update((s) => ({ ...s, base: { theme: t.id } }))}
                  style={{ borderColor: t.accent }}
                >
                  {t.name}
                  {open ? '' : ` (reach ${t.depth.toLocaleString('en-US')} m)`}
                </button>
              </li>
            );
          })}
        </ul>
      </Panel>

      <div className="rooms">
        {ROOMS.map((r) => {
          const open = level >= r.unlockLevel;
          return (
            <section
              key={r.id}
              className={`room${open ? '' : ' room--locked'}`}
              style={{ ['--wall' as string]: theme.wall, ['--floor' as string]: theme.floor, ['--accent' as string]: theme.accent }}
            >
              <h2 className="room__title">{r.name}</h2>
              {open ? (
                <>
                  <p className="muted">{r.blurb}</p>
                  {room(r.id)}
                </>
              ) : (
                <p className="muted">Unlocks at level {r.unlockLevel}.</p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

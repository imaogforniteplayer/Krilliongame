import { useState } from 'react';
import { BIOMES } from '../../game/biomes/biomes';
import { DISCOVERIES } from '../../game/discoveries/discoveries';
import type { DiscoveryItem } from '../../game/discoveries/discoveries';
import { formatMetres } from '../../game/scoring/scoring';
import { TIER_COLORS, TIER_NAMES } from '../../game/tiers';
import { TIER_ORDER } from '../../game/types';
import type { RarityTier } from '../../game/types';
import { Meter, Panel } from '../components/Panel';
import { TierBadge } from '../components/TierBadge';
import { discoveryIconUrl } from '../icons';
import { useSave } from '../store';

export function Museum() {
  const { save } = useSave();
  const [filter, setFilter] = useState<RarityTier | 'all'>('all');
  const [open, setOpen] = useState<DiscoveryItem | null>(null);
  const found = Object.keys(save.collection).length;
  const list = DISCOVERIES.filter((d) => filter === 'all' || d.rarity === filter);

  const where = (d: DiscoveryItem) => {
    const a = BIOMES[d.minBiome]?.name ?? '?';
    const b = BIOMES[d.maxBiome]?.name ?? '?';
    return a === b ? a : `${a} to ${b}`;
  };

  return (
    <div className="page">
      <h1 className="title">Underground Museum</h1>
      <p className="muted">
        Everything your miner digs up is added here automatically. You never have to search: discoveries turn up during your digs, and rarer answers find rarer things.
      </p>
      <Panel>
        <p className="results__lvl">
          {found} of {DISCOVERIES.length} discovered ({Math.round((found / DISCOVERIES.length) * 100)}%)
        </p>
        <Meter value={found} max={DISCOVERIES.length} label="Collection completion" />
      </Panel>

      <div className="filters" role="group" aria-label="Filter by rarity">
        <button type="button" className={`btn btn--small${filter === 'all' ? ' btn--primary' : ''}`} onClick={() => setFilter('all')}>
          All
        </button>
        {TIER_ORDER.map((t) => (
          <button
            key={t}
            type="button"
            className={`btn btn--small${filter === t ? ' btn--primary' : ''}`}
            style={{ ['--tier' as string]: TIER_COLORS[t] }}
            onClick={() => setFilter(t)}
          >
            {TIER_NAMES[t]}
          </button>
        ))}
      </div>

      <ul className="shelf">
        {list.map((d) => {
          const entry = save.collection[d.id];
          return (
            <li key={d.id}>
              <button
                type="button"
                className={`slot${entry ? '' : ' slot--locked'}`}
                style={{ ['--tier' as string]: TIER_COLORS[d.rarity] }}
                onClick={() => setOpen(d)}
                aria-label={entry ? d.name : 'Undiscovered item'}
              >
                <img className="pixel-img slot__icon" src={discoveryIconUrl(d)} alt="" />
                <span className="slot__name">{entry ? d.name : '???'}</span>
                {entry && entry.count > 1 ? <span className="slot__count">x{entry.count}</span> : null}
              </button>
            </li>
          );
        })}
      </ul>

      {open ? (
        <div className="modal" role="dialog" aria-modal="true" aria-label="Item details" onClick={() => setOpen(null)}>
          <div className="modal__card" style={{ ['--tier' as string]: TIER_COLORS[open.rarity] }} onClick={(e) => e.stopPropagation()}>
            <img className={`pixel-img modal__icon${save.collection[open.id] ? '' : ' slot--locked-img'}`} src={discoveryIconUrl(open)} alt="" />
            <h2>{save.collection[open.id] ? open.name : 'Undiscovered'}</h2>
            <TierBadge tier={open.rarity} />
            <p>{save.collection[open.id] ? open.blurb : 'Keep digging to find out what this is.'}</p>
            <p className="muted">Found in: {where(open)}</p>
            {save.collection[open.id] ? (
              <p className="muted">
                Found {save.collection[open.id]?.count}x · first at {formatMetres(save.collection[open.id]?.firstDepth ?? 0)}
              </p>
            ) : null}
            <button type="button" className="btn" onClick={() => setOpen(null)}>
              Close
            </button>
          </div>
        </div>
      ) : null}

      <Panel title="Coming later">
        <p className="muted">
          Museum extensions, display customisation and friend visits are planned and not built yet. They need the online backend.
        </p>
      </Panel>
    </div>
  );
}

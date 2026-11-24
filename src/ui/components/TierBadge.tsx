import { TIER_COLORS, TIER_NAMES } from '../../game/tiers';
import type { RarityTier } from '../../game/types';

export function TierBadge({ tier, big = false }: { tier: RarityTier; big?: boolean }) {
  return (
    <span className={`tier-badge${big ? ' tier-badge--big' : ''}`} style={{ ['--tier' as string]: TIER_COLORS[tier] }}>
      <i className="tier-badge__gem" aria-hidden="true" />
      {TIER_NAMES[tier]}
    </span>
  );
}

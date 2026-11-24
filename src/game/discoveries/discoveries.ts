import { biomeAtDepth } from '../biomes/biomes';
import { pickWeighted, rngFromString } from '../rng';
import type { RarityTier } from '../types';

export type DiscoveryKind =
  | 'gem'
  | 'coin'
  | 'bone'
  | 'crystal'
  | 'meteor'
  | 'vase'
  | 'nugget'
  | 'skull'
  | 'shell'
  | 'cog'
  | 'egg'
  | 'relic';

export interface DiscoveryItem {
  id: string;
  name: string;
  kind: DiscoveryKind;
  rarity: RarityTier;
  /** Inclusive biome index range where it can turn up. */
  minBiome: number;
  maxBiome: number;
  /** Four colours the icon uses: dark outline, mid, light, sparkle. */
  colors: [string, string, string, string];
  blurb: string;
}

const c = (
  id: string, name: string, kind: DiscoveryKind, rarity: RarityTier,
  minBiome: number, maxBiome: number, colors: [string, string, string, string], blurb: string,
): DiscoveryItem => ({ id, name, kind, rarity, minBiome, maxBiome, colors, blurb });

export const DISCOVERIES: readonly DiscoveryItem[] = [
  c('rusty-coin', 'Rusty Coin', 'coin', 'pebble', 1, 6, ['#4a2a14', '#a8642c', '#d89050', '#fff0c0'], 'Somebody dropped this a very long time ago.'),
  c('copper-nugget', 'Copper Nugget', 'nugget', 'pebble', 1, 5, ['#4a2210', '#c0652a', '#e89050', '#ffd9a8'], 'Raw copper, still warm from the earth.'),
  c('cave-crystal', 'Cave Crystal', 'crystal', 'pebble', 4, 8, ['#2a3a58', '#6a8ac0', '#a8c8f0', '#ffffff'], 'A small crystal with a surprising glint.'),
  c('miners-watch', 'Miner\'s Pocket Watch', 'cog', 'pebble', 11, 12, ['#3a3020', '#a89860', '#d8c888', '#ffffff'], 'Stopped at ten past three. Forever.'),
  c('gold-nugget', 'Gold Nugget', 'nugget', 'copper', 2, 12, ['#5a3a08', '#d8a020', '#ffd84a', '#fff8c0'], 'A proper lump of gold.'),
  c('amber-chunk', 'Amber Chunk', 'gem', 'copper', 2, 9, ['#5a2c08', '#d88418', '#ffb840', '#fff0b0'], 'Fossilised tree resin with something tiny inside.'),
  c('ammonite', 'Ammonite Shell', 'shell', 'copper', 6, 7, ['#4a3a28', '#b89868', '#e8d0a0', '#fff8e0'], 'A perfect spiral from an ancient sea.'),
  c('trilobite', 'Trilobite Fossil', 'shell', 'copper', 6, 7, ['#3a3a40', '#8a8a98', '#c0c0d0', '#f0f0ff'], 'Older than the dinosaurs.'),
  c('ancient-vase', 'Ancient Vase', 'vase', 'copper', 8, 9, ['#4a2210', '#b8582c', '#e88a50', '#ffd0a0'], 'Painted clay, impossibly intact.'),
  c('forgotten-lantern', 'Forgotten Lantern', 'relic', 'copper', 11, 12, ['#3a2a10', '#a87820', '#ffb838', '#fff0a8'], 'Still flickers faintly.'),
  c('emerald', 'Emerald', 'gem', 'quartz', 3, 10, ['#0a3a22', '#1ea860', '#5ae898', '#d0ffe0'], 'Deep green and flawless.'),
  c('ruby', 'Ruby', 'gem', 'quartz', 5, 11, ['#4a0a18', '#d02040', '#ff6880', '#ffd0d8'], 'Blood-red and very, very shiny.'),
  c('sapphire-shard', 'Sapphire Shard', 'gem', 'quartz', 5, 11, ['#0a1a4a', '#2850d8', '#6a90ff', '#d0e0ff'], 'A shard of deep blue.'),
  c('dino-rib', 'Dino Rib', 'bone', 'quartz', 6, 8, ['#4a3a28', '#c8b088', '#f0e0b8', '#ffffff'], 'A rib from something enormous.'),
  c('pterosaur-bone', 'Pterosaur Wing Bone', 'bone', 'quartz', 6, 8, ['#3a3a30', '#b0a888', '#e0d8b8', '#ffffff'], 'Hollow, light and ancient.'),
  c('amethyst-cluster', 'Amethyst Cluster', 'crystal', 'quartz', 7, 10, ['#2a0a4a', '#8a40d8', '#c088ff', '#f0d8ff'], 'Purple spikes in a perfect ring.'),
  c('cyan-geode', 'Cyan Geode', 'crystal', 'quartz', 7, 9, ['#0a3a48', '#20b0c8', '#6ae8f8', '#e0ffff'], 'Cracked open, glittering inside.'),
  c('ice-crystal', 'Ice Crystal', 'crystal', 'quartz', 9, 10, ['#2a4a68', '#78b8e0', '#c0eaff', '#ffffff'], 'It never melts down here.'),
  c('clockwork-cog', 'Clockwork Cog', 'cog', 'quartz', 8, 11, ['#2a2a30', '#8a8a98', '#c8c8d8', '#ffffff'], 'Machinery from a civilisation that should not have had any.'),
  c('meteor-fragment', 'Meteor Fragment', 'meteor', 'quartz', 4, 14, ['#1a1420', '#4a4258', '#8a7ea0', '#ffb86a'], 'Fell from the sky and kept going down.'),
  c('diamond', 'Diamond', 'gem', 'obsidian', 7, 13, ['#1a3a58', '#58c0f0', '#b0f0ff', '#ffffff'], 'Pure, clear, brilliant.'),
  c('dino-skull', 'Dino Skull', 'skull', 'obsidian', 6, 8, ['#4a3a28', '#d0b890', '#f4e8c8', '#ffffff'], 'It is smiling at you. Probably.'),
  c('tyrant-tooth', 'Tyrant Tooth', 'bone', 'obsidian', 6, 8, ['#4a4030', '#d8c8a0', '#fff4d8', '#ffffff'], 'Longer than your hand.'),
  c('mammoth-tusk', 'Frozen Mammoth Tusk', 'bone', 'obsidian', 9, 10, ['#3a4a58', '#c8d8e0', '#f0faff', '#ffffff'], 'Perfectly preserved in the ice.'),
  c('temple-idol', 'Temple Idol', 'relic', 'obsidian', 8, 9, ['#4a3808', '#c8a028', '#ffd860', '#fff8c0'], 'A golden idol with watchful eyes.'),
  c('obsidian-blade', 'Obsidian Blade', 'relic', 'obsidian', 10, 12, ['#08060e', '#2a2438', '#5a4e78', '#b09aff'], 'Sharper than anything modern.'),
  c('magma-pearl', 'Magma Pearl', 'gem', 'obsidian', 10, 12, ['#4a1008', '#e84a18', '#ffa038', '#fff0a0'], 'Glows like a tiny sun.'),
  c('star-iron', 'Star Iron', 'meteor', 'obsidian', 8, 14, ['#1a1a28', '#5a5a78', '#a0a0d0', '#7affff'], 'Iron from a dead star.'),
  c('vault-key', 'Vault Key', 'relic', 'obsidian', 11, 13, ['#3a2a08', '#b88a20', '#f0c850', '#fff4b0'], 'It fits no lock you have ever seen.'),
  c('crystal-skull', 'Crystal Skull', 'skull', 'void', 7, 13, ['#2a1a5a', '#9a6af0', '#d0b0ff', '#ffffff'], 'Do not look into its eyes.'),
  c('void-egg', 'Void Egg', 'egg', 'void', 12, 14, ['#0a0a1a', '#3a2a78', '#7a5ae0', '#e0a0ff'], 'Warm. It might be moving.'),
  c('hollow-heart', 'Hollow Heart', 'crystal', 'void', 12, 14, ['#0a1a3a', '#20a0d8', '#5ee7ff', '#ffffff'], 'It beats, slowly.'),
  c('core-shard', 'Core Shard', 'crystal', 'corebound', 13, 14, ['#3a0a14', '#ff2a4a', '#ff8a9a', '#ffffff'], 'A fragment of the planet\'s heart.'),
  c('unknown-relic', 'Unknown Relic', 'relic', 'corebound', 14, 14, ['#0a0614', '#7a3ad8', '#ff5ee7', '#ffffff'], 'Nobody knows what it is. It knows you.'),
] as const;

/** Chance that a dig turns up something, by the rarity of the answer that powered it. */
export const DISCOVERY_CHANCE: Record<RarityTier, number> = {
  pebble: 0.06,
  copper: 0.1,
  quartz: 0.18,
  obsidian: 0.28,
  void: 0.4,
  corebound: 0.55,
};

const RARITY_WEIGHT: Record<RarityTier, number> = {
  pebble: 40, copper: 24, quartz: 12, obsidian: 6, void: 2, corebound: 1,
};

export interface DiscoveryRoll {
  item: DiscoveryItem;
  /** How far through the dig (0..1) the find turns up. */
  atFraction: number;
  /** Absolute depth in metres where it was found. */
  depth: number;
}

/**
 * Deterministic: the same seed key, answer rarity and dig range always give the same result,
 * so a refresh or replay cannot re-roll a discovery.
 */
export function rollDiscovery(opts: {
  seedKey: string;
  tier: RarityTier;
  depthBefore: number;
  depthAfter: number;
}): DiscoveryRoll | null {
  const { seedKey, tier, depthBefore, depthAfter } = opts;
  if (depthAfter <= depthBefore) return null;
  const rng = rngFromString(`discovery|${seedKey}`);
  if (rng() >= DISCOVERY_CHANCE[tier]) return null;

  const atFraction = 0.35 + rng() * 0.4;
  const depth = depthBefore + (depthAfter - depthBefore) * atFraction;
  const biomeIdx = biomeAtDepth(depth).index;
  const eligible = DISCOVERIES.filter((d) => biomeIdx >= d.minBiome && biomeIdx <= d.maxBiome);
  if (eligible.length === 0) return null;
  const item = pickWeighted(eligible, eligible.map((d) => RARITY_WEIGHT[d.rarity]), rng);
  return { item, atFraction, depth };
}

export function getDiscovery(id: string): DiscoveryItem | undefined {
  return DISCOVERIES.find((d) => d.id === id);
}

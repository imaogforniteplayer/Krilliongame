export interface BiomePalette {
  /** Main terrain colour. */
  base: string;
  /** Darker shade for texture speckles and shaft walls. */
  dark: string;
  /** Lighter shade for highlights. */
  light: string;
  /** Accent used by decorations (crystals, lava, ice, moss…). */
  accent: string;
  /** Glow / bright highlight for particles and light. */
  glow: string;
}

export type AmbientKind = 'dust' | 'spores' | 'snow' | 'embers' | 'drips' | 'motes' | 'stars' | 'none';

export interface Biome {
  id: string;
  index: number;
  name: string;
  /** Depth in metres at which this biome begins. */
  startDepth: number;
  palette: BiomePalette;
  ambient: AmbientKind;
  /** Decoration kinds scattered in the walls of this biome (see pixel/art.ts). */
  decorations: readonly string[];
  blurb: string;
}

export const BIOMES: readonly Biome[] = [
  {
    id: 'surface', index: 0, name: 'Surface', startDepth: 0,
    palette: { base: '#7a5a38', dark: '#5a4028', light: '#9a7448', accent: '#5ec26a', glow: '#fff3b0' },
    ambient: 'none', decorations: ['pebble', 'root'],
    blurb: 'Fresh air, green grass and a very big hole.',
  },
  {
    id: 'soft-soil', index: 1, name: 'Soft Soil', startDepth: 40,
    palette: { base: '#8b5a32', dark: '#6a4224', light: '#b07a46', accent: '#c9a064', glow: '#ffe1a8' },
    ambient: 'dust', decorations: ['pebble', 'root', 'worm'],
    blurb: 'Loose, rich earth. Easy digging and the occasional worm.',
  },
  {
    id: 'root-caverns', index: 2, name: 'Root Caverns', startDepth: 200,
    palette: { base: '#6b4a2c', dark: '#4a3320', light: '#8a6238', accent: '#8bd45a', glow: '#d9ff9a' },
    ambient: 'spores', decorations: ['root', 'root', 'pebble', 'mushroom'],
    blurb: 'Ancient tree roots twist through hollow chambers.',
  },
  {
    id: 'clay-depths', index: 3, name: 'Clay Depths', startDepth: 400,
    palette: { base: '#b0603a', dark: '#8a4628', light: '#d08258', accent: '#e8a070', glow: '#ffd2b0' },
    ambient: 'dust', decorations: ['pebble', 'pottery', 'worm'],
    blurb: 'Dense red clay, sticky and surprisingly warm.',
  },
  {
    id: 'stone-caverns', index: 4, name: 'Stone Caverns', startDepth: 650,
    palette: { base: '#6e7078', dark: '#4a4c54', light: '#9094a0', accent: '#b8bcc8', glow: '#e0e6f5' },
    ambient: 'drips', decorations: ['pebble', 'stalactite', 'ore'],
    blurb: 'Grey stone halls echo with distant dripping.',
  },
  {
    id: 'underground-lakes', index: 5, name: 'Underground Lakes', startDepth: 900,
    palette: { base: '#3d5a78', dark: '#26405a', light: '#5a82a8', accent: '#4fd0e8', glow: '#aef3ff' },
    ambient: 'drips', decorations: ['stalactite', 'ore', 'pebble', 'puddle'],
    blurb: 'Black water mirrors glowing cave ceilings.',
  },
  {
    id: 'fossil-beds', index: 6, name: 'Fossil Beds', startDepth: 1200,
    palette: { base: '#a8895e', dark: '#7e6240', light: '#cdb084', accent: '#f0e6c8', glow: '#fff6d8' },
    ambient: 'dust', decorations: ['fossil', 'fossil', 'pebble', 'ore'],
    blurb: 'Ancient bones sleep in the layers of old seabeds.',
  },
  {
    id: 'crystal-caverns', index: 7, name: 'Crystal Caverns', startDepth: 1600,
    palette: { base: '#4a3a78', dark: '#2f2358', light: '#6e58a8', accent: '#b47cff', glow: '#e6ccff' },
    ambient: 'motes', decorations: ['crystal', 'crystal', 'crystal', 'ore'],
    blurb: 'Giant crystals hum with purple and cyan light.',
  },
  {
    id: 'ancient-ruins', index: 8, name: 'Ancient Ruins', startDepth: 2100,
    palette: { base: '#7a6a50', dark: '#544834', light: '#a28e6c', accent: '#d9b24a', glow: '#ffe9a0' },
    ambient: 'dust', decorations: ['brick', 'brick', 'pottery', 'fossil'],
    blurb: 'Carved walls from a civilisation nobody remembers.',
  },
  {
    id: 'frozen-underground', index: 9, name: 'Frozen Underground', startDepth: 2700,
    palette: { base: '#5a8aa8', dark: '#3a6482', light: '#9ccae0', accent: '#d6f4ff', glow: '#ffffff' },
    ambient: 'snow', decorations: ['icicle', 'icicle', 'crystal', 'fossil'],
    blurb: 'Ice older than the surface world, perfectly preserved.',
  },
  {
    id: 'volcanic-depths', index: 10, name: 'Volcanic Depths', startDepth: 3400,
    palette: { base: '#4a2a28', dark: '#2e1818', light: '#7a3c30', accent: '#ff7a2a', glow: '#ffd070' },
    ambient: 'embers', decorations: ['vent', 'vent', 'ore', 'pebble'],
    blurb: 'Rivers of magma glow behind blackened rock.',
  },
  {
    id: 'forgotten-mines', index: 11, name: 'Forgotten Mines', startDepth: 4200,
    palette: { base: '#4a4238', dark: '#2e2820', light: '#6e6454', accent: '#ffb84a', glow: '#ffe3a0' },
    ambient: 'dust', decorations: ['beam', 'lantern', 'ore', 'brick'],
    blurb: 'Rotten timbers and lanterns left by miners long gone.',
  },
  {
    id: 'the-hollow', index: 12, name: 'The Hollow', startDepth: 5000,
    palette: { base: '#22203a', dark: '#14122a', light: '#3a3660', accent: '#5ee7ff', glow: '#a8f4ff' },
    ambient: 'spores', decorations: ['mushroom', 'eye', 'crystal', 'puddle'],
    blurb: 'A cavern so large it has its own weather.',
  },
  {
    id: 'deep-core', index: 13, name: 'Deep Core', startDepth: 5900,
    palette: { base: '#3a1420', dark: '#220a14', light: '#6a2030', accent: '#ff3d5e', glow: '#ffb0bc' },
    ambient: 'embers', decorations: ['vent', 'crack', 'crystal'],
    blurb: 'The planet\'s heart beats beneath your boots.',
  },
  {
    id: 'the-unknown', index: 14, name: 'The Unknown', startDepth: 6800,
    palette: { base: '#0e0a1c', dark: '#06040e', light: '#241a44', accent: '#ff5ee7', glow: '#ffffff' },
    ambient: 'stars', decorations: ['eye', 'crack', 'crystal'],
    blurb: 'Nobody has been this deep. Something is watching.',
  },
] as const;

export function biomeAtDepth(depth: number): Biome {
  let found = BIOMES[0] as Biome;
  for (const b of BIOMES) {
    if (depth >= b.startDepth) found = b;
    else break;
  }
  return found;
}

export function nextBiome(depth: number): Biome | null {
  const cur = biomeAtDepth(depth);
  return BIOMES[cur.index + 1] ?? null;
}

/** 0..1 progress from the current biome's start to the next biome's start. */
export function progressInBiome(depth: number): number {
  const cur = biomeAtDepth(depth);
  const nxt = nextBiome(depth);
  if (!nxt) return 1;
  return (depth - cur.startDepth) / (nxt.startDepth - cur.startDepth);
}

export function hexToInt(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

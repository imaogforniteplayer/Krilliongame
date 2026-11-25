/**
 * The personal underground base. It is an optional showcase: rooms open as the player levels up and
 * display things the player already has. There is nothing to manage, build or maintain.
 */
export interface Room {
  id: 'shaft' | 'trophy' | 'bay' | 'den' | 'storage' | 'wing' | 'deck';
  name: string;
  unlockLevel: number;
  blurb: string;
}

export const ROOMS: readonly Room[] = [
  { id: 'shaft', name: 'Entrance Shaft', unlockLevel: 1, blurb: 'Where every dig begins.' },
  { id: 'trophy', name: 'Trophy Room', unlockLevel: 2, blurb: 'Your achievement badges, on display.' },
  { id: 'bay', name: 'Equipment Bay', unlockLevel: 3, blurb: 'Every machine your answers have powered.' },
  { id: 'den', name: 'Pet Den', unlockLevel: 4, blurb: 'Companions you have unlocked.' },
  { id: 'storage', name: 'Storage', unlockLevel: 5, blurb: 'Lifetime totals, neatly shelved.' },
  { id: 'wing', name: 'Museum Wing', unlockLevel: 6, blurb: 'Your rarest discoveries.' },
  { id: 'deck', name: 'Observation Deck', unlockLevel: 9, blurb: 'Look back over the biomes you have reached.' },
];

export function unlockedRooms(level: number): Room[] {
  return ROOMS.filter((r) => level >= r.unlockLevel);
}

export interface BaseTheme {
  id: string;
  name: string;
  /** Deepest single dig (m) needed to unlock. */
  depth: number;
  wall: string;
  floor: string;
  accent: string;
}

export const BASE_THEMES: readonly BaseTheme[] = [
  { id: 'soil', name: 'Soft Soil', depth: 0, wall: '#4a3322', floor: '#2f2015', accent: '#c9904a' },
  { id: 'stone', name: 'Stone Caverns', depth: 650, wall: '#454a5c', floor: '#2b2e3a', accent: '#9aa4c0' },
  { id: 'crystal', name: 'Crystal Caverns', depth: 1600, wall: '#3b2a63', floor: '#241940', accent: '#c58aff' },
  { id: 'frozen', name: 'Frozen Underground', depth: 2700, wall: '#2d4a66', floor: '#1d3045', accent: '#9de3ff' },
  { id: 'volcanic', name: 'Volcanic Depths', depth: 3400, wall: '#5a2a22', floor: '#391812', accent: '#ff8a3a' },
  { id: 'core', name: 'Deep Core', depth: 5900, wall: '#2a1740', floor: '#160b26', accent: '#ff4d5e' },
];

export function availableThemes(deepest: number): BaseTheme[] {
  return BASE_THEMES.filter((t) => deepest >= t.depth);
}

export function getTheme(id: string, deepest: number): BaseTheme {
  const ok = availableThemes(deepest);
  return ok.find((t) => t.id === id) ?? (BASE_THEMES[0] as BaseTheme);
}

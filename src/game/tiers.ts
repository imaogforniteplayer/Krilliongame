import type { RarityTier } from './types';

export const TIER_COLORS: Record<RarityTier, string> = {
  pebble: '#a89f91',
  copper: '#d9822b',
  quartz: '#cfe8ff',
  obsidian: '#8a6cff',
  void: '#c04dff',
  corebound: '#ff4d5e',
};

export const TIER_NAMES: Record<RarityTier, string> = {
  pebble: 'Pebble',
  copper: 'Copper',
  quartz: 'Quartz',
  obsidian: 'Obsidian',
  void: 'Void',
  corebound: 'Corebound',
};

export const TIER_BLURB: Record<RarityTier, string> = {
  pebble: 'Common answer',
  copper: 'Uncommon answer',
  quartz: 'Rare answer',
  obsidian: 'Very rare answer',
  void: 'Extremely rare answer',
  corebound: 'Exceptionally rare answer',
};

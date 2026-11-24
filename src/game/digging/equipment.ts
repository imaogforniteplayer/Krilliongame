import type { EquipmentId, RarityTier } from '../types';

export interface EquipmentSpec {
  id: EquipmentId;
  name: string;
  tier: RarityTier;
  /** Full dig animation length at normal speed. */
  durationMs: number;
  /** 0 = none … 1 = huge. Drives camera shake and particle volume. */
  intensity: number;
  blurb: string;
}

export const EQUIPMENT_BY_TIER: Record<RarityTier, EquipmentSpec> = {
  pebble: {
    id: 'shovel', name: 'Basic Shovel', tier: 'pebble', durationMs: 2000, intensity: 0.15,
    blurb: 'A trusty shovel. Small scoops, steady progress.',
  },
  copper: {
    id: 'pickaxe', name: 'Reinforced Pickaxe', tier: 'copper', durationMs: 2600, intensity: 0.3,
    blurb: 'Reinforced head, heavy swings.',
  },
  quartz: {
    id: 'jackhammer', name: 'Electric Jackhammer', tier: 'quartz', durationMs: 3200, intensity: 0.5,
    blurb: 'The ground shakes. Stone flies.',
  },
  obsidian: {
    id: 'pneumatic-drill', name: 'Pneumatic Drill', tier: 'obsidian', durationMs: 3800, intensity: 0.7,
    blurb: 'A roaring drill bit with a shower of sparks.',
  },
  void: {
    id: 'excavator', name: 'Industrial Excavator', tier: 'void', durationMs: 4400, intensity: 0.85,
    blurb: 'A huge machine rolls in and carves out the earth.',
  },
  corebound: {
    id: 'tunnel-borer', name: 'Giant Tunnel Borer', tier: 'corebound', durationMs: 5000, intensity: 1,
    blurb: 'A planet-grade cutterhead. Everything shakes.',
  },
};

export function equipmentForTier(tier: RarityTier): EquipmentSpec {
  return EQUIPMENT_BY_TIER[tier];
}

/** Used when an answer is rejected: the miner just shrugs and trudges down a tiny bit. */
export const NO_EQUIPMENT_DEPTH = 0;

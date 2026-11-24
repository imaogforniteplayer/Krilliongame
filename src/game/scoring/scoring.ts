import { GAME_CONFIG } from '../config';
import type { RarityTier } from '../types';

export function pointsForTier(tier: RarityTier): number {
  return GAME_CONFIG.pointsByTier[tier];
}

export function depthForPoints(points: number): number {
  return points * GAME_CONFIG.metresPerPoint;
}

export function maxRunPoints(): number {
  return GAME_CONFIG.questionsPerRun * GAME_CONFIG.pointsByTier.corebound;
}

export function maxRunDepth(): number {
  return depthForPoints(maxRunPoints());
}

export function formatMetres(m: number): string {
  return `${Math.round(m).toLocaleString('en-US')} m`;
}

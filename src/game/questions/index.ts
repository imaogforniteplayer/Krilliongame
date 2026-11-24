import type { Question } from '../types';
import { gamingQuestions } from './bank/gaming';
import { moreAnimalsNature } from './bank/more-animals-nature';
import { moreGeography } from './bank/more-geography';
import { moreHistoryMining } from './bank/more-history-mining';
import { moreScienceTech } from './bank/more-science-tech';
import { moviesFoodQuestions } from './bank/movies-food';
import { sportQuestions } from './bank/sport';
import { animalQuestions } from './bank/animals';
import { cultureQuestions } from './bank/culture';
import { geographyQuestions } from './bank/geography';
import { historyQuestions } from './bank/history';
import { miningQuestions, natureQuestions } from './bank/nature';
import { scienceQuestions } from './bank/science';
import { techQuestions } from './bank/tech';

/** Every question in the game. Add new banks here. */
export const ALL_QUESTIONS: readonly Question[] = [
  ...animalQuestions,
  ...geographyQuestions,
  ...historyQuestions,
  ...scienceQuestions,
  ...cultureQuestions,
  ...techQuestions,
  ...natureQuestions,
  ...miningQuestions,
  ...moreAnimalsNature,
  ...moreGeography,
  ...moreHistoryMining,
  ...moreScienceTech,
  ...gamingQuestions,
  ...sportQuestions,
  ...moviesFoodQuestions,
];

const byId = new Map(ALL_QUESTIONS.map((q) => [q.id, q] as const));

export function getQuestion(id: string): Question | undefined {
  return byId.get(id);
}

export function activeQuestions(): Question[] {
  return ALL_QUESTIONS.filter((q) => q.status === 'active');
}

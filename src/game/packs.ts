import type { Category, Question } from './types';

/**
 * Themed Dig Packs. A pack is just a named filter over the question bank, so adding a new pack
 * is one entry here (plus questions in the bank). `categories: null` means "everything".
 */
export interface Pack {
  id: string;
  name: string;
  blurb: string;
  categories: readonly Category[] | null;
}

export const PACKS: readonly Pack[] = [
  { id: 'general', name: 'General Knowledge', blurb: 'A bit of everything.', categories: null },
  { id: 'animals', name: 'Animals', blurb: 'Creatures great, small and strange.', categories: ['Animals'] },
  { id: 'geography', name: 'Geography', blurb: 'Countries, rivers, mountains and more.', categories: ['Geography'] },
  { id: 'history', name: 'History', blurb: 'Empires, explorers and ancient things.', categories: ['History'] },
  { id: 'gaming', name: 'Gaming', blurb: 'Consoles, characters and classics.', categories: ['Gaming'] },
  { id: 'sport', name: 'Sport', blurb: 'Athletes, teams and tournaments.', categories: ['Sport'] },
  { id: 'movies', name: 'Movies', blurb: 'Films, directors and franchises.', categories: ['Movies'] },
  { id: 'science', name: 'Science', blurb: 'Elements, forces and discoveries.', categories: ['Science'] },
  { id: 'technology', name: 'Technology', blurb: 'Computers, code and inventions.', categories: ['Technology'] },
  { id: 'nature', name: 'Nature', blurb: 'Plants, weather and wild places.', categories: ['Nature'] },
  { id: 'food', name: 'Food', blurb: 'Dishes, ingredients and drinks.', categories: ['Food'] },
  { id: 'mining', name: 'Mining & Underground', blurb: 'Minerals, tools and tunnels.', categories: ['Mining'] },
];

export function getPack(id: string): Pack | undefined {
  return PACKS.find((p) => p.id === id);
}

export function questionsForPack(pack: Pack, pool: readonly Question[]): Question[] {
  const cats = pack.categories;
  return pool.filter((q) => q.status === 'active' && (cats === null || cats.includes(q.category)));
}

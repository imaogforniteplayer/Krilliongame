import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { audio } from '../game/audio/audio';
import { dailyKey } from '../game/daily/challenge';
import { resolveLook } from '../game/cosmetics/cosmetics';
import type { Look } from '../game/cosmetics/cosmetics';
import { unlockContext } from '../game/progression/context';
import { setMinerLook } from '../game/render/actors';
import { loadSave, persistSave } from '../game/storage';
import type { SaveData } from '../game/storage';

interface SaveContextValue {
  save: SaveData;
  /** Applies a pure update and persists it immediately. Updates queued in one tick compose correctly. */
  update: (fn: (s: SaveData) => SaveData) => void;
  /** Effective reduced-motion value (player setting, falling back to the OS preference). */
  reducedMotion: boolean;
}

const Ctx = createContext<SaveContextValue | null>(null);

function systemPrefersReducedMotion(): boolean {
  try {
    return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  } catch {
    return false;
  }
}

export function SaveProvider({ children }: { children: ReactNode }) {
  const [save, setSave] = useState<SaveData>(() => loadSave());
  const latest = useRef(save);

  const update = useCallback((fn: (s: SaveData) => SaveData) => {
    const next = fn(latest.current);
    if (next === latest.current) return;
    latest.current = next;
    persistSave(next);
    setSave(next);
  }, []);

  const reducedMotion = save.settings.reducedMotion ?? systemPrefersReducedMotion();

  // Apply the equipped cosmetics to the miner everywhere (menus, share card, game scene).
  setMinerLook(resolveLook(save.look, unlockContext(save)));

  useEffect(() => {
    audio.configure({ volume: save.settings.volume, musicOn: save.settings.musicOn, sfxOn: save.settings.sfxOn });
  }, [save.settings.volume, save.settings.musicOn, save.settings.sfxOn]);

  useEffect(() => {
    document.documentElement.dataset.reduced = reducedMotion ? 'true' : 'false';
  }, [reducedMotion]);

  // Browsers only allow audio after a real user gesture.
  useEffect(() => {
    const unlock = () => audio.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  return <Ctx.Provider value={{ save, update, reducedMotion }}>{children}</Ctx.Provider>;
}

export function useSave(): SaveContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSave must be used inside <SaveProvider>');
  return v;
}

/** The current Daily Dig key; flips at 00:00 UTC while the page is open. */
export function useDailyKey(): string {
  const [key, setKey] = useState(() => dailyKey());
  useEffect(() => {
    const id = window.setInterval(() => setKey(dailyKey()), 15_000);
    return () => window.clearInterval(id);
  }, []);
  return key;
}

/** Re-renders every `ms` milliseconds and returns Date.now(). */
export function useNow(ms = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return now;
}

/** The cosmetics the player is actually wearing (locked or unknown items fall back to defaults). */
export function useLook(): Look {
  const { save } = useSave();
  return resolveLook(save.look, unlockContext(save));
}

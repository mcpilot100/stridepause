import AsyncStorage from '@react-native-async-storage/async-storage';

import { STORAGE_KEYS } from './constants';
import { totalDistanceM } from './geo';
import type { ActiveRun, SavedRun, TrackPoint } from './types';

// The background task and the UI both touch the active run, so writes are
// serialised through this queue to avoid one overwriting the other.
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const next = queue.then(fn, fn);
  queue = next.catch(() => undefined);
  return next;
}

async function readJSON<T>(key: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(key);
  return raw ? (JSON.parse(raw) as T) : null;
}

export function getActiveRun(): Promise<ActiveRun | null> {
  return readJSON<ActiveRun>(STORAGE_KEYS.activeRun);
}

export function beginRun(): Promise<ActiveRun> {
  return serial(async () => {
    const run: ActiveRun = {
      id: String(Date.now()),
      startedAt: Date.now(),
      points: [],
    };
    await AsyncStorage.setItem(STORAGE_KEYS.activeRun, JSON.stringify(run));
    return run;
  });
}

export function appendPoints(points: TrackPoint[]): Promise<void> {
  return serial(async () => {
    const run = await readJSON<ActiveRun>(STORAGE_KEYS.activeRun);
    if (!run) return; // run already stopped; drop late fixes
    run.points.push(...points.filter((p) => p.t >= run.startedAt));
    await AsyncStorage.setItem(STORAGE_KEYS.activeRun, JSON.stringify(run));
  });
}

export function finishRun(): Promise<SavedRun | null> {
  return serial(async () => {
    const run = await readJSON<ActiveRun>(STORAGE_KEYS.activeRun);
    if (!run) return null;
    const saved: SavedRun = {
      ...run,
      endedAt: Date.now(),
      distanceM: totalDistanceM(run.points),
    };
    const history = (await readJSON<SavedRun[]>(STORAGE_KEYS.runHistory)) ?? [];
    history.unshift(saved);
    await AsyncStorage.setItem(STORAGE_KEYS.runHistory, JSON.stringify(history));
    await AsyncStorage.removeItem(STORAGE_KEYS.activeRun);
    return saved;
  });
}

export async function getRunHistory(): Promise<SavedRun[]> {
  return (await readJSON<SavedRun[]>(STORAGE_KEYS.runHistory)) ?? [];
}

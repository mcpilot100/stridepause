import AsyncStorage from '@react-native-async-storage/async-storage';

import { loadSettings } from '../settings';
import { STORAGE_KEYS } from './constants';
import { ingestPoints, movingMsAt, pausedMsAt } from './cues';
import { totalDistanceM } from './geo';
import { readStepCounter, startStepCounter, stepsAreRaw } from './steps';
import { ingestStepSample, replayWithStride, resetTreadmillState } from './treadmill';
import type { ActiveRun, RunMode, SavedRun, TrackPoint } from './types';

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

export function beginRun(mode: RunMode = 'outdoor', strideM?: number): Promise<ActiveRun> {
  return serial(async () => {
    const run: ActiveRun = {
      mode,
      id: String(Date.now()),
      startedAt: Date.now(),
      points: [],
      distanceM: 0,
      lastGood: null,
      mileMoving: [],
      fuelCount: 0,
      paused: false,
      stillSince: null,
      movingStreak: 0,
      pauses: [],
    };
    if (mode === 'treadmill') {
      run.strideM = strideM;
      run.stepSamples = [];
      run.stepBase = null;
      run.lastRaw = null;
      resetTreadmillState(run);
    }
    await AsyncStorage.setItem(STORAGE_KEYS.activeRun, JSON.stringify(run));
    return run;
  });
}

/** Saves new fixes and returns any voice cues (mile updates, fuel reminders) now due. */
export function appendPoints(points: TrackPoint[]): Promise<string[]> {
  return serial(async () => {
    const run = await readJSON<ActiveRun>(STORAGE_KEYS.activeRun);
    if (!run) return []; // run already stopped; drop late fixes
    // Treadmill runs ignore GPS: location updates only keep the app awake and act as a
    // once-a-second heartbeat to read the step counter.
    if (run.mode === 'treadmill') return tickRun(run);
    const settings = await loadSettings();
    const fresh = points.filter((p) => p.t >= run.startedAt).sort((a, b) => a.t - b.t);
    const phrases = ingestPoints(run, fresh, settings);
    await AsyncStorage.setItem(STORAGE_KEYS.activeRun, JSON.stringify(run));
    return phrases;
  });
}

let lastTickAt = 0;

/**
 * Treadmill: reads the step counter and adds a sample to the active run. Called from the
 * background location task, on Android step events and from the screen's refresh timer;
 * calls less than a second apart are skipped. Returns voice cues now due.
 */
export function tickSteps(): Promise<string[]> {
  if (Date.now() - lastTickAt < 900) return Promise.resolve([]);
  return serial(async () => {
    const run = await readJSON<ActiveRun>(STORAGE_KEYS.activeRun);
    if (!run || run.mode !== 'treadmill') return [];
    return tickRun(run);
  });
}

/** Must run inside serial(). */
async function tickRun(run: ActiveRun): Promise<string[]> {
  const now = Date.now();
  if (now - lastTickAt < 900) return [];
  lastTickAt = now;
  // Android: (re)start the step listener in case the app's JS was restarted mid-run.
  startStepCounter();
  const reading = await readStepCounter(run.startedAt, now);
  let steps: number;
  if (reading == null) {
    // Nothing from the step counter yet: still record a zero-step sample, so a run where
    // you never start moving pauses instead of sitting at "moving".
    steps = run.stepSamples?.[run.stepSamples.length - 1]?.steps ?? 0;
  } else if (stepsAreRaw) {
    const prevSteps = run.stepSamples?.[run.stepSamples.length - 1]?.steps ?? 0;
    if (run.stepBase == null) run.stepBase = reading - prevSteps;
    // The counter restarts at 0 when the phone reboots: carry on from where we were.
    if (run.lastRaw != null && reading < run.lastRaw) run.stepBase = reading - prevSteps;
    run.lastRaw = reading;
    steps = reading - run.stepBase;
  } else {
    steps = reading;
  }
  const settings = await loadSettings();
  const phrases = ingestStepSample(run, { t: now, steps }, settings);
  await AsyncStorage.setItem(STORAGE_KEYS.activeRun, JSON.stringify(run));
  return phrases;
}

/**
 * Calibrates a saved treadmill run against the real distance (from the treadmill's screen,
 * or a known course). Replays the run with the corrected stride, saves it, and returns
 * the new run and stride, or null if the run has no steps to calibrate from.
 */
export function calibrateRun(
  runId: string,
  actualM: number,
): Promise<{ run: SavedRun; strideM: number } | null> {
  return serial(async () => {
    const history = (await readJSON<SavedRun[]>(STORAGE_KEYS.runHistory)) ?? [];
    const i = history.findIndex((r) => r.id === runId);
    const run = history[i];
    if (!run || !run.countedSteps || actualM <= 0) return null;
    const strideM = actualM / run.countedSteps;
    const updated = replayWithStride(run, strideM);
    history[i] = updated;
    await AsyncStorage.setItem(STORAGE_KEYS.runHistory, JSON.stringify(history));
    return { run: updated, strideM };
  });
}

export function finishRun(): Promise<SavedRun | null> {
  return serial(async () => {
    const run = await readJSON<ActiveRun>(STORAGE_KEYS.activeRun);
    if (!run) return null;
    const endedAt = Date.now();
    if (run.mode === 'treadmill') {
      // One last reading so the final steps make it into the run.
      lastTickAt = 0;
      await tickRun(run).catch(() => undefined);
    }
    const open = run.pauses?.[run.pauses.length - 1];
    if (open && open.end == null) open.end = endedAt;
    const saved: SavedRun = {
      ...run,
      paused: false,
      endedAt,
      distanceM: run.distanceM ?? totalDistanceM(run.points),
      movingMs: movingMsAt(run, endedAt),
      pausedMs: pausedMsAt(run, endedAt),
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

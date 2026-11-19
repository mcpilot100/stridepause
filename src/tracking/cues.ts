import type { Settings } from '../settings';
import { MAX_ACCURACY_M, METERS_PER_MILE } from './constants';
import { haversineM } from './geo';
import type { ActiveRun, TrackPoint } from './types';

/** Stopped for this long → auto-pause (the pause is back-dated to when you stopped). */
export const PAUSE_AFTER_MS = 5000;
/** Below this speed you count as stopped (≈1.1 mph). */
const STOPPED_MPS = 0.5;
/** Above this speed, for two fixes in a row, a paused run resumes (≈2.2 mph). */
const RESUME_MPS = 1.0;
const RESUME_FIXES = 2;

/** "8 minutes 32 seconds" — reads naturally through text-to-speech. */
export function spokenDuration(totalSec: number): string {
  const sec = Math.round(totalSec);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const parts: string[] = [];
  if (h) parts.push(`${h} ${h === 1 ? 'hour' : 'hours'}`);
  if (m) parts.push(`${m} ${m === 1 ? 'minute' : 'minutes'}`);
  if (s || parts.length === 0) parts.push(`${s} ${s === 1 ? 'second' : 'seconds'}`);
  return parts.join(' ');
}

/** Total paused ms between the run start and time `t`. */
export function pausedMsAt(run: ActiveRun, t: number): number {
  let total = 0;
  for (const p of run.pauses ?? []) {
    if (p.start >= t) break;
    total += Math.min(p.end ?? t, t) - p.start;
  }
  return total;
}

/** Moving time in ms at time `t` (elapsed minus pauses). */
export function movingMsAt(run: ActiveRun, t: number): number {
  return Math.max(0, t - run.startedAt - pausedMsAt(run, t));
}

/** Device speed if valid, else speed derived from the previous accurate fix. */
function speedOf(p: TrackPoint, prev: TrackPoint | null): number | null {
  if (p.speed != null && p.speed >= 0) return p.speed;
  if (prev && p.t > prev.t) return haversineM(prev, p) / ((p.t - prev.t) / 1000);
  return null;
}

/**
 * Adds new points to the run: handles auto-pause, keeps moving distance and
 * mile split times up to date, and returns anything that should be spoken.
 * Mutates `run`.
 */
export function ingestPoints(run: ActiveRun, newPoints: TrackPoint[], settings: Settings): string[] {
  run.distanceM ??= 0;
  run.lastGood ??= null;
  run.mileMoving ??= [];
  run.fuelCount ??= 0;
  run.paused ??= false;
  run.stillSince ??= null;
  run.movingStreak ??= 0;
  run.pauses ??= [];

  const phrases: string[] = [];
  const milesBefore = run.mileMoving.length;

  for (const p of newPoints) {
    run.points.push(p);
    if (p.acc != null && p.acc > MAX_ACCURACY_M) continue;

    const prev = run.lastGood;
    const v = speedOf(p, prev);

    if (run.paused) {
      run.movingStreak = v != null && v >= RESUME_MPS ? run.movingStreak + 1 : 0;
      if (run.movingStreak >= RESUME_FIXES) {
        run.paused = false;
        run.stillSince = null;
        run.movingStreak = 0;
        const open = run.pauses[run.pauses.length - 1];
        if (open && open.end == null) open.end = p.t;
        if (settings.voiceMiles) phrases.push('Resumed.');
      }
      // Don't count GPS drift while stopped: distance restarts from here.
      run.lastGood = p;
      continue;
    }

    // Moving (or just stopped).
    if (v != null && v < STOPPED_MPS) {
      run.stillSince ??= p.t;
      if (p.t - run.stillSince >= PAUSE_AFTER_MS) {
        run.paused = true;
        run.movingStreak = 0;
        run.pauses.push({ start: run.stillSince, end: null });
        if (settings.voiceMiles) phrases.push('Paused.');
        run.lastGood = p;
        continue;
      }
    } else {
      run.stillSince = null;
    }

    run.lastGood = p;
    if (!prev) continue;
    const step = haversineM(prev, p);
    const before: number = run.distanceM;
    const after = before + step;
    run.distanceM = after;
    // Record moving time at each mile boundary, interpolated between fixes.
    while (after >= (run.mileMoving.length + 1) * METERS_PER_MILE) {
      const boundary = (run.mileMoving.length + 1) * METERS_PER_MILE;
      const frac = step > 0 ? (boundary - before) / step : 1;
      run.mileMoving.push(movingMsAt(run, prev.t + frac * (p.t - prev.t)));
    }
  }

  const last = newPoints[newPoints.length - 1];
  const now = last ? last.t : Date.now();

  // Per-mile update.
  if (settings.voiceMiles && run.mileMoving.length > milesBefore) {
    const n = run.mileMoving.length;
    const end = run.mileMoving[n - 1];
    const start = n > 1 ? run.mileMoving[n - 2] : 0;
    phrases.push(
      `Mile ${n}. Split ${spokenDuration((end - start) / 1000)}. ` +
        `Average pace ${spokenDuration(end / 1000 / n)} per mile.`,
    );
  }

  // Fuel reminder, counted on moving time so stops don't trigger it early.
  if (settings.fuelEnabled) {
    const due =
      settings.fuelMode === 'time'
        ? Math.floor(movingMsAt(run, now) / (settings.fuelMinutes * 60000))
        : Math.floor(run.mileMoving.length / settings.fuelMiles);
    if (due > run.fuelCount) {
      run.fuelCount = due;
      phrases.push(settings.fuelMessage.endsWith('.') ? settings.fuelMessage : `${settings.fuelMessage}.`);
    }
  }

  return phrases;
}

/** Split times in ms for each full mile, plus the partial last mile. */
export function splitsOf(run: {
  startedAt: number;
  mileMoving?: number[];
  mileTimes?: number[];
  distanceM?: number;
  movingMs?: number;
}) {
  // Runs from v0.2 stored epoch times per mile (no auto-pause back then).
  const miles = run.mileMoving ?? run.mileTimes?.map((t) => t - run.startedAt) ?? [];
  const splits = miles.map((m, i) => ({ mile: i + 1, ms: m - (i ? miles[i - 1] : 0), miles: 1 }));
  const totalMiles = (run.distanceM ?? 0) / METERS_PER_MILE;
  const rest = totalMiles - miles.length;
  if (rest >= 0.05 && run.movingMs != null) {
    splits.push({
      mile: miles.length + 1,
      ms: run.movingMs - (miles.length ? miles[miles.length - 1] : 0),
      miles: rest,
    });
  }
  return splits;
}

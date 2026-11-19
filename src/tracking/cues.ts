import type { Settings } from '../settings';
import { METERS_PER_MILE, MAX_ACCURACY_M } from './constants';
import { haversineM } from './geo';
import type { ActiveRun, TrackPoint } from './types';

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

/**
 * Adds new points to the run, keeps distance and mile split times up to date,
 * and returns anything that should be spoken. Mutates `run`.
 */
export function ingestPoints(run: ActiveRun, newPoints: TrackPoint[], settings: Settings): string[] {
  run.distanceM ??= 0;
  run.lastGood ??= null;
  run.mileTimes ??= [];
  run.fuelCount ??= 0;

  const milesBefore = run.mileTimes.length;

  for (const p of newPoints) {
    run.points.push(p);
    if (p.acc != null && p.acc > MAX_ACCURACY_M) continue;
    const prev = run.lastGood;
    run.lastGood = p;
    if (!prev) continue;
    const step = haversineM(prev, p);
    const before: number = run.distanceM;
    const after = before + step;
    run.distanceM = after;
    // Record the moment each mile boundary was crossed, interpolated between fixes.
    while (after >= (run.mileTimes.length + 1) * METERS_PER_MILE) {
      const boundary = (run.mileTimes.length + 1) * METERS_PER_MILE;
      const frac = step > 0 ? (boundary - before) / step : 1;
      run.mileTimes.push(prev.t + frac * (p.t - prev.t));
    }
  }

  const phrases: string[] = [];
  const last = newPoints[newPoints.length - 1];
  const now = last ? last.t : Date.now();

  // Per-mile update.
  if (settings.voiceMiles && run.mileTimes.length > milesBefore) {
    const n = run.mileTimes.length;
    const end = run.mileTimes[n - 1];
    const start = n > 1 ? run.mileTimes[n - 2] : run.startedAt;
    const avg = (end - run.startedAt) / 1000 / n;
    phrases.push(
      `Mile ${n}. Split ${spokenDuration((end - start) / 1000)}. ` +
        `Average pace ${spokenDuration(avg)} per mile.`,
    );
  }

  // Fuel reminder.
  if (settings.fuelEnabled) {
    let due = 0;
    if (settings.fuelMode === 'time') {
      due = Math.floor((now - run.startedAt) / (settings.fuelMinutes * 60000));
    } else {
      due = Math.floor(run.mileTimes.length / settings.fuelMiles);
    }
    if (due > run.fuelCount) {
      run.fuelCount = due;
      phrases.push(settings.fuelMessage.endsWith('.') ? settings.fuelMessage : `${settings.fuelMessage}.`);
    }
  }

  return phrases;
}

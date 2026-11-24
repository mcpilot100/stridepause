// Treadmill mode: no GPS. Distance = steps × stride length, with auto-pause driven by
// whether steps are still coming in. Pure functions, so a saved run can be replayed
// with a new stride after calibration.
import type { Settings } from '../settings';
import { addMovingDistance, dueCues, movingMsAt, pausedMsAt } from './cues';
import type { ActiveRun, SavedRun, StepSample } from './types';

/**
 * No new steps for this long → auto-pause, back-dated to the last step. Longer than the
 * outdoor 5 s because the iPhone step counter reports in batches a few seconds late.
 */
export const TREADMILL_PAUSE_AFTER_MS = 8000;
/** Steps needed after a pause before the run resumes (a shuffle or two doesn't count). */
const RESUME_STEPS = 6;
/** Stray steps further apart than this while paused don't add up toward resuming. */
const RESUME_WINDOW_MS = 4000;
/** A burst slower than this over a long gap means you had stopped, not run slowly. */
const MIN_RUNNING_SPM = 60;
/** Cadence is averaged over this window for the live display. */
const CADENCE_WINDOW_MS = 15000;

/** Clears the derived treadmill state so samples can be (re)played from the start. */
export function resetTreadmillState(run: ActiveRun) {
  run.distanceM = 0;
  run.mileMoving = [];
  run.fuelCount = 0;
  run.paused = false;
  run.pauses = [];
  run.countedSteps = 0;
  run.lastStepAt = run.startedAt;
  run.resumeSteps = 0;
  run.resumeStartAt = null;
}

/**
 * Adds one step sample (cumulative steps since the run started) and returns anything that
 * should be spoken. Mutates `run`.
 */
export function ingestStepSample(run: ActiveRun, sample: StepSample, settings: Settings): string[] {
  run.stepSamples ??= [];
  run.countedSteps ??= 0;
  run.lastStepAt ??= run.startedAt;
  run.resumeSteps ??= 0;
  run.resumeStartAt ??= null;
  run.pauses ??= [];
  run.mileMoving ??= [];
  run.paused ??= false;

  const prev = run.stepSamples[run.stepSamples.length - 1] ?? { t: run.startedAt, steps: 0 };
  if (sample.t <= prev.t) return [];
  run.stepSamples.push(sample);
  return applySample(run, prev, sample, settings);
}

function applySample(run: ActiveRun, prev: StepSample, sample: StepSample, settings: Settings): string[] {
  const stride = run.strideM ?? 1;
  const phrases: string[] = [];
  const milesBefore = run.mileMoving!.length;
  const d = Math.max(0, sample.steps - prev.steps);
  const lastStepAt = run.lastStepAt!;
  const gap = sample.t - lastStepAt;
  // Stay quiet about the wait before the first steps (getting on the treadmill).
  const speak = settings.voiceMiles && run.countedSteps! > 0;
  let pausedNow = false;

  // Stopped? Either no steps for a while, or only a trickle of steps after a long gap
  // (for example the first steps back after the phone held its readings).
  if (!run.paused && gap >= TREADMILL_PAUSE_AFTER_MS && d < (gap / 60000) * MIN_RUNNING_SPM) {
    run.paused = true;
    run.resumeSteps = 0;
    run.resumeStartAt = null;
    run.pauses!.push({ start: lastStepAt, end: null });
    pausedNow = true;
  }

  if (run.paused) {
    if (d > 0) {
      if (run.resumeStartAt == null || sample.t - lastStepAt > RESUME_WINDOW_MS) {
        run.resumeSteps = 0;
        const pauseStart = run.pauses![run.pauses!.length - 1]?.start ?? prev.t;
        // Steps came in at roughly 2.5 a second at most; estimate when they started.
        run.resumeStartAt = Math.max(pauseStart, prev.t, sample.t - d * 400);
      }
      run.resumeSteps! += d;
      run.lastStepAt = sample.t;
      if (run.resumeSteps! >= RESUME_STEPS) {
        run.paused = false;
        const open = run.pauses![run.pauses!.length - 1];
        if (open && open.end == null) open.end = run.resumeStartAt!;
        // The steps that restarted the run were real running steps: count them.
        run.countedSteps! += run.resumeSteps!;
        addMovingDistance(run, run.resumeSteps! * stride, run.resumeStartAt!, sample.t);
        run.resumeSteps = 0;
        run.resumeStartAt = null;
        // Paused and resumed within one reading (after a gap): nothing worth saying.
        if (speak && !pausedNow) phrases.push('Resumed.');
        pausedNow = false;
      }
    }
  } else if (d > 0) {
    run.lastStepAt = sample.t;
    run.countedSteps! += d;
    addMovingDistance(run, d * stride, prev.t, sample.t);
  }

  if (pausedNow && speak) phrases.push('Paused.');
  return [...phrases, ...dueCues(run, milesBefore, sample.t, settings)];
}

const SILENT: Settings = {
  voiceMiles: false,
  fuelEnabled: false,
  fuelMode: 'time',
  fuelMinutes: 30,
  fuelMiles: 3,
  fuelMessage: '',
  runMode: 'treadmill',
  strideM: 1,
  strideCalibratedAt: null,
};

/**
 * Replays a saved treadmill run with a new stride (after calibration), recomputing
 * distance, mile splits and pauses. Returns a new run object.
 */
export function replayWithStride(run: SavedRun, strideM: number): SavedRun {
  const out: SavedRun = { ...run, strideM, stepSamples: [] };
  resetTreadmillState(out);
  let prev: StepSample = { t: run.startedAt, steps: 0 };
  for (const s of run.stepSamples ?? []) {
    if (s.t <= prev.t) continue;
    out.stepSamples!.push(s);
    applySample(out, prev, s, SILENT);
    prev = s;
  }
  const open = out.pauses?.[out.pauses.length - 1];
  if (open && open.end == null) open.end = run.endedAt;
  out.paused = false;
  out.movingMs = movingMsAt(out, run.endedAt);
  out.pausedMs = pausedMsAt(out, run.endedAt);
  return out;
}

/** Live cadence in steps per minute over the last few seconds, or null if unknown. */
export function currentCadence(run: ActiveRun, now: number): number | null {
  const samples = run.stepSamples ?? [];
  if (samples.length < 2 || run.paused) return null;
  const last = samples[samples.length - 1];
  if (now - last.t > TREADMILL_PAUSE_AFTER_MS) return null;
  let first = last;
  for (let i = samples.length - 1; i >= 0 && last.t - samples[i].t <= CADENCE_WINDOW_MS; i--) {
    first = samples[i];
  }
  const dt = last.t - first.t;
  if (dt < 3000) return null;
  return Math.round(((last.steps - first.steps) / dt) * 60000);
}

/** Average cadence over moving time, or null when there isn't enough to go on. */
export function averageCadence(steps: number | undefined, movingMs: number): number | null {
  if (!steps || movingMs < 30000) return null;
  return Math.round(steps / (movingMs / 60000));
}

export const metersToInches = (m: number) => m / 0.0254;

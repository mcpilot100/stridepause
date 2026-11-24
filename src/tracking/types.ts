export type TrackPoint = {
  t: number; // epoch ms
  lat: number;
  lon: number;
  acc: number | null; // horizontal accuracy, meters
  speed: number | null; // m/s as reported by the device
};

export type Pause = { start: number; end: number | null };

export type RunMode = 'outdoor' | 'treadmill';

/** Treadmill runs: cumulative steps since the run started, sampled about once a second. */
export type StepSample = { t: number; steps: number };

export type ActiveRun = {
  id: string;
  startedAt: number;
  points: TrackPoint[];
  /** Moving distance over accurate fixes, kept up to date as points arrive. */
  distanceM?: number;
  /** Last accurate fix used for distance. */
  lastGood?: TrackPoint | null;
  /** Moving time (ms since start, pauses excluded) at which each full mile was reached. */
  mileMoving?: number[];
  /** How many fuel reminders have been given so far. */
  fuelCount?: number;
  /** Auto-pause state. */
  paused?: boolean;
  stillSince?: number | null;
  movingStreak?: number;
  pauses?: Pause[];
  /** Outdoor (GPS) unless set. */
  mode?: RunMode;
  /** Treadmill: meters per step used for distance. */
  strideM?: number;
  /** Treadmill: step samples, enough to replay the run with a new stride. */
  stepSamples?: StepSample[];
  /** Treadmill: steps counted toward distance (steps while auto-paused are left out). */
  countedSteps?: number;
  /** Treadmill: time steps were last seen increasing. */
  lastStepAt?: number | null;
  /** Treadmill: steps seen since auto-pause, and when they started (to detect a restart). */
  resumeSteps?: number;
  resumeStartAt?: number | null;
  /** Treadmill (Android): raw step counter at the start of the run, and the last raw value. */
  stepBase?: number | null;
  lastRaw?: number | null;
  /** @deprecated v0.2 epoch ms per mile; superseded by mileMoving. */
  mileTimes?: number[];
};

export type SavedRun = ActiveRun & {
  endedAt: number;
  distanceM: number;
  movingMs?: number;
  pausedMs?: number;
};

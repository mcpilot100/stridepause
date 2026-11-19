export type TrackPoint = {
  t: number; // epoch ms
  lat: number;
  lon: number;
  acc: number | null; // horizontal accuracy, meters
  speed: number | null; // m/s as reported by the device
};

export type Pause = { start: number; end: number | null };

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
  /** @deprecated v0.2 epoch ms per mile; superseded by mileMoving. */
  mileTimes?: number[];
};

export type SavedRun = ActiveRun & {
  endedAt: number;
  distanceM: number;
  movingMs?: number;
  pausedMs?: number;
};

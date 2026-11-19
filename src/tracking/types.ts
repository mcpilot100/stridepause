export type TrackPoint = {
  t: number; // epoch ms
  lat: number;
  lon: number;
  acc: number | null; // horizontal accuracy, meters
  speed: number | null; // m/s as reported by the device
};

export type ActiveRun = {
  id: string;
  startedAt: number;
  points: TrackPoint[];
  /** Running distance over accurate fixes, kept up to date as points arrive. */
  distanceM?: number;
  /** Last accurate fix used for distance. */
  lastGood?: TrackPoint | null;
  /** Epoch ms at which each full mile was reached (index 0 = mile 1). */
  mileTimes?: number[];
  /** How many fuel reminders have been given so far. */
  fuelCount?: number;
};

export type SavedRun = ActiveRun & {
  endedAt: number;
  distanceM: number;
};

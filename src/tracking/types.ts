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
};

export type SavedRun = ActiveRun & {
  endedAt: number;
  distanceM: number;
};

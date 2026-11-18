import { MAX_ACCURACY_M, METERS_PER_MILE } from './constants';
import type { TrackPoint } from './types';

const R = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;

export function haversineM(a: TrackPoint, b: TrackPoint): number {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Total distance using only reasonably accurate fixes. */
export function totalDistanceM(points: TrackPoint[]): number {
  let total = 0;
  let prev: TrackPoint | null = null;
  for (const p of points) {
    if (p.acc != null && p.acc > MAX_ACCURACY_M) continue;
    if (prev) total += haversineM(prev, p);
    prev = p;
  }
  return total;
}

export const metersToMiles = (m: number) => m / METERS_PER_MILE;

/** "7:53" style pace per mile, or "--:--" when there is not enough distance yet. */
export function formatPace(elapsedMs: number, distanceM: number): string {
  const miles = metersToMiles(distanceM);
  if (miles < 0.01) return '--:--';
  const secPerMile = elapsedMs / 1000 / miles;
  if (!isFinite(secPerMile) || secPerMile > 99 * 60) return '--:--';
  const m = Math.floor(secPerMile / 60);
  const s = Math.round(secPerMile % 60);
  return s === 60 ? `${m + 1}:00` : `${m}:${String(s).padStart(2, '0')}`;
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

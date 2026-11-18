// Must be imported from index.ts before the app registers, so the task is
// defined even when the OS wakes the JS runtime with no UI on screen.
import type { LocationObject } from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { LOCATION_TASK } from './constants';
import { appendPoints } from './runStore';
import type { TrackPoint } from './types';

TaskManager.defineTask<{ locations: LocationObject[] }>(
  LOCATION_TASK,
  async ({ data, error }) => {
    if (error) {
      console.warn('[StridePause] location task error', error.message);
      return;
    }
    const locations = data?.locations ?? [];
    if (locations.length === 0) return;
    const points: TrackPoint[] = locations.map((l) => ({
      t: l.timestamp,
      lat: l.coords.latitude,
      lon: l.coords.longitude,
      acc: l.coords.accuracy ?? null,
      speed: l.coords.speed ?? null,
    }));
    await appendPoints(points);
  },
);

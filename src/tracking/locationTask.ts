// Must be imported from index.ts before the app registers, so the task is
// defined even when the OS wakes the JS runtime with no UI on screen.
import type { LocationObject } from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { LOCATION_TASK } from './constants';
import { say } from '../speech';
import { appendPoints, tickSteps } from './runStore';
import { onStep } from './steps';
import type { TrackPoint } from './types';

// Treadmill mode on Android: each step event updates the run, so distance and voice cues
// keep up even when location updates are sparse indoors. (iPhone uses the location
// heartbeat below.) Registered here so it is in place even when the OS starts the app's
// JS in the background with no screen.
onStep(() => {
  tickSteps()
    .then((phrases) => phrases.forEach((p) => say(p)))
    .catch((e) => console.warn('[StridePause] step tick', e));
});

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
    const phrases = await appendPoints(points);
    for (const phrase of phrases) say(phrase);
  },
);

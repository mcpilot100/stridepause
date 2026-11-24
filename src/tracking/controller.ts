import * as Location from 'expo-location';

import { LOCATION_TASK } from './constants';
import { beginRun, finishRun, tickSteps } from './runStore';
import { ensureStepPermission, startStepCounter, stopStepCounter } from './steps';
import type { RunMode } from './types';

export type PermissionResult =
  | 'ok'
  | 'foreground-denied'
  | 'background-denied'
  | 'motion-denied'
  | 'motion-unavailable';

/**
 * Treadmill mode still asks for location: the background location service is what keeps
 * the app running (and the step count updating) when it's minimized. GPS fixes are ignored.
 */
export async function ensurePermissions(mode: RunMode = 'outdoor'): Promise<PermissionResult> {
  if (mode === 'treadmill') {
    const motion = await ensureStepPermission();
    if (motion === 'unavailable') return 'motion-unavailable';
    if (motion === 'denied') return 'motion-denied';
  }
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') return 'foreground-denied';
  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status !== 'granted') return 'background-denied';
  return 'ok';
}

export async function startTracking(mode: RunMode = 'outdoor', strideM?: number): Promise<void> {
  await beginRun(mode, strideM);
  if (mode === 'treadmill') {
    startStepCounter();
    tickSteps().catch(() => undefined);
  }
  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: 1000, // Android: aim for ~1 fix per second
    distanceInterval: 0,
    // iOS
    activityType: Location.LocationActivityType.Fitness,
    pausesUpdatesAutomatically: false, // never let iOS pause us mid-run
    showsBackgroundLocationIndicator: true,
    // Android: a foreground service keeps tracking alive behind Spotify etc.
    foregroundService: {
      notificationTitle:
        mode === 'treadmill' ? 'StridePause is tracking your treadmill run' : 'StridePause is tracking your run',
      notificationBody:
        mode === 'treadmill'
          ? 'Steps, distance and pace keep recording in the background.'
          : 'Pace and route keep recording in the background.',
      notificationColor: '#B8F04A',
      killServiceOnDestroy: false,
    },
  });
}

export async function stopTracking() {
  if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  }
  const saved = await finishRun();
  stopStepCounter();
  return saved;
}

export function isTracking(): Promise<boolean> {
  return Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
}

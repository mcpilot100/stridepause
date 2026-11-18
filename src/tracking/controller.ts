import * as Location from 'expo-location';

import { LOCATION_TASK } from './constants';
import { beginRun, finishRun } from './runStore';

export type PermissionResult = 'ok' | 'foreground-denied' | 'background-denied';

export async function ensurePermissions(): Promise<PermissionResult> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') return 'foreground-denied';
  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status !== 'granted') return 'background-denied';
  return 'ok';
}

export async function startTracking(): Promise<void> {
  await beginRun();
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
      notificationTitle: 'StridePause is tracking your run',
      notificationBody: 'Pace and route keep recording in the background.',
      notificationColor: '#B8F04A',
      killServiceOnDestroy: false,
    },
  });
}

export async function stopTracking() {
  if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  }
  return finishRun();
}

export function isTracking(): Promise<boolean> {
  return Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
}

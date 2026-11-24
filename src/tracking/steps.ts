// Step counting for treadmill mode.
//   iPhone: asks Core Motion how many steps were taken since the run started. Core Motion
//           counts on its own chip even while the app sleeps, so nothing is missed.
//   Android: our StepCounter module listens to the hardware step counter and, unlike
//           expo-sensors' Pedometer, keeps listening when the app is in the background.
import { Pedometer } from 'expo-sensors';
import { Platform } from 'react-native';

import { StepCounter } from '../../modules/step-counter';

export type StepPermission = 'ok' | 'denied' | 'unavailable';

export async function ensureStepPermission(): Promise<StepPermission> {
  if (Platform.OS === 'android') {
    if (!StepCounter?.isAvailable()) return 'unavailable';
  } else if (!(await Pedometer.isAvailableAsync().catch(() => false))) {
    return 'unavailable';
  }
  const res = await Pedometer.requestPermissionsAsync();
  return res.granted ? 'ok' : 'denied';
}

/**
 * Starts the Android step listener (no-op on iPhone). Safe to call repeatedly; every tick
 * calls it so a restarted JS runtime picks it back up.
 */
export function startStepCounter() {
  if (Platform.OS === 'android') StepCounter?.start();
}

export function stopStepCounter() {
  if (Platform.OS === 'android') StepCounter?.stop();
}

/** Android: calls `cb` on every new step. Returns an unsubscribe function. */
export function onStep(cb: () => void): () => void {
  const sub = StepCounter?.addListener('onStepCount', cb);
  return () => sub?.remove();
}

/**
 * iPhone: steps since `startedAt`. Android: the raw counter (steps since the phone booted),
 * which the run store turns into steps since the run started. null if not available yet.
 */
export async function readStepCounter(startedAt: number, now: number): Promise<number | null> {
  if (Platform.OS === 'android') {
    if (!StepCounter) return null;
    const raw = StepCounter.read();
    return raw >= 0 ? raw : null;
  }
  try {
    const res = await Pedometer.getStepCountAsync(new Date(startedAt), new Date(now));
    return res.steps;
  } catch {
    return null;
  }
}

export const stepsAreRaw = Platform.OS === 'android';

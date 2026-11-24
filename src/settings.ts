import AsyncStorage from '@react-native-async-storage/async-storage';

import type { RunMode } from './tracking/types';

export type FuelMode = 'time' | 'distance';

export type Settings = {
  voiceMiles: boolean;
  fuelEnabled: boolean;
  fuelMode: FuelMode;
  fuelMinutes: number;
  fuelMiles: number;
  fuelMessage: string;
  /** Outdoor (GPS) or treadmill (steps × stride). */
  runMode: RunMode;
  /** Meters per step for treadmill runs. */
  strideM: number;
  /** When the stride was last calibrated from a known distance (epoch ms), or null if estimated. */
  strideCalibratedAt: number | null;
};

/** About 39 in per step: a typical easy-run step before calibration. */
export const DEFAULT_STRIDE_M = 1.0;

export const FUEL_MESSAGES = [
  'Time to refuel',
  'Time for a gel',
  'Time for your gummies',
  'Drink some water',
  'Take a salt tablet',
];
export const FUEL_MINUTE_OPTIONS = [20, 25, 30, 35, 40, 45];
export const FUEL_MILE_OPTIONS = [1, 2, 3, 4, 5];

export const DEFAULT_SETTINGS: Settings = {
  voiceMiles: true,
  fuelEnabled: true,
  fuelMode: 'time',
  fuelMinutes: 30,
  fuelMiles: 3,
  fuelMessage: 'Time for a gel',
  runMode: 'outdoor',
  strideM: DEFAULT_STRIDE_M,
  strideCalibratedAt: null,
};

const KEY = 'stridepause/settings';

export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(s: Settings): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(s));
}

/**
 * Merges `patch` into the saved settings. Screens keep their own copy of the settings,
 * so saving a whole stale copy could undo a change made elsewhere (e.g. a new stride).
 */
export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await loadSettings()), ...patch };
  await saveSettings(next);
  return next;
}

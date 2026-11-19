import AsyncStorage from '@react-native-async-storage/async-storage';

export type FuelMode = 'time' | 'distance';

export type Settings = {
  voiceMiles: boolean;
  fuelEnabled: boolean;
  fuelMode: FuelMode;
  fuelMinutes: number;
  fuelMiles: number;
  fuelMessage: string;
};

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

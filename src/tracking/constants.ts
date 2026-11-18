export const LOCATION_TASK = 'stridepause-location-task';

export const STORAGE_KEYS = {
  activeRun: 'stridepause/activeRun',
  runHistory: 'stridepause/runHistory',
} as const;

/** GPS fixes worse than this (meters) are stored but ignored for distance. */
export const MAX_ACCURACY_M = 30;

export const METERS_PER_MILE = 1609.344;

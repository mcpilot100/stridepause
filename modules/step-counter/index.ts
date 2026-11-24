import { requireOptionalNativeModule, type EventSubscription } from 'expo';

type StepCounterNative = {
  isAvailable(): boolean;
  start(): boolean;
  read(): number;
  stop(): void;
  addListener(event: 'onStepCount', cb: (e: { total: number }) => void): EventSubscription;
};

/** Android only. null on iOS, web and Expo Go (needs a development or EAS build). */
export const StepCounter = requireOptionalNativeModule<StepCounterNative>('StrideStepCounter');

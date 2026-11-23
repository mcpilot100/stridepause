import { setAudioModeAsync, setIsAudioActiveAsync } from 'expo-audio';
import * as Speech from 'expo-speech';
import { Platform } from 'react-native';

// iPhone: we own the audio session so we can end it as soon as speech finishes.
// Ending it with "notify others" tells Spotify/Apple Music to go back to full
// volume immediately, instead of staying ducked until the next announcement.
let configured: Promise<void> | null = null;
function configure() {
  configured ??= setAudioModeAsync({
    playsInSilentMode: true,
    interruptionMode: 'duckOthers',
    shouldPlayInBackground: true,
    allowsRecording: false,
  }).catch((e) => {
    configured = null;
    console.warn('[StridePause] audio mode', e);
  });
  return configured;
}

let pending = 0;

function finished() {
  pending = Math.max(0, pending - 1);
  if (pending === 0 && Platform.OS === 'ios') {
    setIsAudioActiveAsync(false).catch(() => undefined);
  }
}

export async function say(text: string) {
  await configure();
  pending += 1;
  Speech.speak(text, {
    rate: 1.0,
    useApplicationAudioSession: true,
    onDone: finished,
    onStopped: finished,
    onError: finished,
  });
}

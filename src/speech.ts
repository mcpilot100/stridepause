import * as Speech from 'expo-speech';

/**
 * Speaks over whatever is playing. On iPhone, a system-managed audio session
 * briefly lowers Spotify/Apple Music while the phrase plays, then restores it.
 */
export function say(text: string) {
  Speech.speak(text, {
    rate: 1.0,
    useApplicationAudioSession: false,
  });
}

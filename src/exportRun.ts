import { File, Paths } from 'expo-file-system';
import { Platform, Share } from 'react-native';

import type { SavedRun } from './tracking/types';

/** Writes the run (every GPS point plus pauses and splits) to a file and opens the share sheet. */
export async function shareRun(run: SavedRun) {
  const stamp = new Date(run.startedAt).toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const file = new File(Paths.cache, `stridepause-run-${stamp}.json`);
  file.create({ overwrite: true });
  file.writeSync(JSON.stringify({ app: 'StridePause', format: 1, run }));
  if (Platform.OS === 'ios') {
    await Share.share({ url: file.uri });
  } else {
    await Share.share({ message: file.textSync() });
  }
}

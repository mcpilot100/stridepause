import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import {
  ensurePermissions,
  isTracking,
  startTracking,
  stopTracking,
} from './src/tracking/controller';
import { formatDuration, formatPace, metersToMiles, totalDistanceM } from './src/tracking/geo';
import { getActiveRun, getRunHistory } from './src/tracking/runStore';
import type { ActiveRun, SavedRun } from './src/tracking/types';

const C = {
  bg: '#0B0F0A',
  card: '#12170F',
  border: '#232B1F',
  text: '#F2F5EE',
  muted: '#8A9483',
  lime: '#B8F04A',
  limeDim: '#2A3A12',
  red: '#E5484D',
};

type BackgroundReport = { awayMs: number; points: number };

export default function App() {
  return (
    <SafeAreaProvider>
      <RunScreen />
    </SafeAreaProvider>
  );
}

function RunScreen() {
  const [run, setRun] = useState<ActiveRun | null>(null);
  const [tracking, setTracking] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [history, setHistory] = useState<SavedRun[]>([]);
  const [report, setReport] = useState<BackgroundReport | null>(null);
  const [busy, setBusy] = useState(false);
  const leftAt = useRef<{ t: number; points: number } | null>(null);

  const refresh = useCallback(async () => {
    const [active, on] = await Promise.all([getActiveRun(), isTracking()]);
    setRun(active);
    setTracking(on && !!active);
    setNow(Date.now());
    return active;
  }, []);

  useEffect(() => {
    refresh();
    getRunHistory().then(setHistory);
    const id = setInterval(refresh, 1000);
    return () => clearInterval(id);
  }, [refresh]);

  // The key test: how many GPS points arrived while the app was hidden?
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state) => {
      if (state === 'background') {
        const active = await getActiveRun();
        leftAt.current = active ? { t: Date.now(), points: active.points.length } : null;
      } else if (state === 'active' && leftAt.current) {
        const active = await refresh();
        const before = leftAt.current;
        leftAt.current = null;
        if (active) {
          setReport({
            awayMs: Date.now() - before.t,
            points: active.points.length - before.points,
          });
        }
      }
    });
    return () => sub.remove();
  }, [refresh]);

  const onStart = async () => {
    setBusy(true);
    try {
      const perm = await ensurePermissions();
      if (perm !== 'ok') {
        Alert.alert(
          'Location needed',
          perm === 'background-denied'
            ? 'To keep tracking when the app is minimized, set Location to "Always" (iPhone) or "Allow all the time" (Android).'
            : 'StridePause needs your location to track your run.',
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ],
        );
        return;
      }
      setReport(null);
      await startTracking();
      await refresh();
    } catch (e) {
      Alert.alert('Could not start tracking', String(e));
    } finally {
      setBusy(false);
    }
  };

  const onStop = async () => {
    setBusy(true);
    try {
      await stopTracking();
      await refresh();
      setHistory(await getRunHistory());
    } finally {
      setBusy(false);
    }
  };

  const points = run?.points ?? [];
  const distanceM = totalDistanceM(points);
  const elapsed = run ? now - run.startedAt : 0;
  const lastFix = points.length ? points[points.length - 1] : null;
  const lastFixAge = lastFix ? Math.max(0, Math.round((now - lastFix.t) / 1000)) : null;

  return (
    <SafeAreaView style={s.root}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.eyebrow}>STRIDE</Text>
        <Text style={s.title}>Background test</Text>

        <View style={s.statusRow}>
          <View style={[s.dot, { backgroundColor: tracking ? C.lime : C.muted }]} />
          <Text style={s.statusText}>
            {tracking
              ? lastFixAge == null
                ? 'WAITING FOR GPS'
                : `TRACKING · LAST FIX ${lastFixAge}s AGO`
              : 'READY'}
          </Text>
        </View>

        <View style={s.ring}>
          <Text style={s.pace}>{formatPace(elapsed, distanceM)}</Text>
          <Text style={s.ringLabel}>AVG PACE / MI</Text>
        </View>

        <View style={s.stats}>
          <Stat label="DISTANCE" value={metersToMiles(distanceM).toFixed(2)} />
          <Stat label="ELAPSED" value={formatDuration(elapsed)} />
          <Stat label="GPS POINTS" value={String(points.length)} />
        </View>

        {report && (
          <View style={[s.report, report.points > 0 ? s.reportOk : s.reportBad]}>
            <Text style={s.reportTitle}>
              {report.points > 0 ? 'Background tracking worked' : 'No points while minimized'}
            </Text>
            <Text style={s.reportBody}>
              Away for {formatDuration(report.awayMs)} and recorded {report.points} GPS points
              {report.points > 0 ? '.' : '. Check that location is set to "Always".'}
            </Text>
          </View>
        )}

        <Pressable
          disabled={busy}
          onPress={tracking ? onStop : onStart}
          style={({ pressed }) => [
            s.button,
            tracking ? s.buttonStop : s.buttonStart,
            (pressed || busy) && { opacity: 0.7 },
          ]}
        >
          <Text style={[s.buttonText, tracking && { color: C.text }]}>
            {tracking ? 'Stop & save run' : 'Start run'}
          </Text>
        </Pressable>

        <Text style={s.hint}>
          Start a run, then switch to Spotify or lock your phone. When you come back, this screen
          shows how many GPS points were recorded while the app was hidden.
        </Text>

        {history.length > 0 && (
          <>
            <Text style={[s.eyebrow, { marginTop: 28 }]}>SAVED RUNS</Text>
            {history.slice(0, 10).map((r) => (
              <View key={r.id} style={s.historyRow}>
                <Text style={s.historyDate}>
                  {new Date(r.startedAt).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </Text>
                <Text style={s.historyMain}>
                  {metersToMiles(r.distanceM).toFixed(2)} mi ·{' '}
                  {formatDuration(r.endedAt - r.startedAt)} ·{' '}
                  {formatPace(r.endedAt - r.startedAt, r.distanceM)}/mi · {r.points.length} pts
                </Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.stat}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const mono = { fontVariant: ['tabular-nums' as const] };

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { padding: 20, paddingBottom: 48 },
  eyebrow: { color: C.muted, fontSize: 11, letterSpacing: 2, fontWeight: '600' },
  title: { color: C.text, fontSize: 24, fontWeight: '700', marginTop: 4 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 8 },
  statusText: { color: C.muted, fontSize: 11, letterSpacing: 2, fontWeight: '600' },
  ring: {
    alignSelf: 'center',
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 6,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  pace: { color: C.text, fontSize: 56, fontWeight: '700', ...mono },
  ringLabel: { color: C.muted, fontSize: 11, letterSpacing: 2, marginTop: 6 },
  stats: {
    flexDirection: 'row',
    marginTop: 24,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    backgroundColor: C.card,
  },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 16 },
  statValue: { color: C.text, fontSize: 20, fontWeight: '700', ...mono },
  statLabel: { color: C.muted, fontSize: 10, letterSpacing: 1.5, marginTop: 4 },
  report: { marginTop: 16, padding: 14, borderRadius: 14, borderWidth: 1 },
  reportOk: { borderColor: C.lime, backgroundColor: C.limeDim },
  reportBad: { borderColor: C.red, backgroundColor: '#2A1414' },
  reportTitle: { color: C.text, fontWeight: '700', fontSize: 15 },
  reportBody: { color: C.text, marginTop: 4, fontSize: 13 },
  button: { marginTop: 24, borderRadius: 999, paddingVertical: 16, alignItems: 'center' },
  buttonStart: { backgroundColor: C.lime },
  buttonStop: { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.red },
  buttonText: { color: '#0B0F0A', fontSize: 16, fontWeight: '700' },
  hint: { color: C.muted, fontSize: 13, marginTop: 14, lineHeight: 19, textAlign: 'center' },
  historyRow: {
    marginTop: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
  },
  historyDate: { color: C.muted, fontSize: 11, letterSpacing: 1 },
  historyMain: { color: C.text, fontSize: 15, marginTop: 4, ...mono },
});

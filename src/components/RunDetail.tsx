import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { shareRun } from '../exportRun';
import { splitsOf } from '../tracking/cues';
import { formatDuration, formatPace, metersToMiles } from '../tracking/geo';
import type { SavedRun } from '../tracking/types';

const C = {
  bg: '#0B0F0A',
  card: '#12170F',
  border: '#232B1F',
  text: '#F2F5EE',
  muted: '#8A9483',
  lime: '#B8F04A',
};

/** Moving time for a saved run (older runs without auto-pause use elapsed). */
export function runMovingMs(r: SavedRun): number {
  return r.movingMs ?? r.endedAt - r.startedAt;
}

export function RunDetail({ run, onBack }: { run: SavedRun; onBack: () => void }) {
  const moving = runMovingMs(run);
  const paused = run.pausedMs ?? 0;
  const splits = splitsOf({ ...run, movingMs: moving });
  const fastest = splits.filter((x) => x.miles === 1).reduce(
    (min, x) => (x.ms < min ? x.ms : min),
    Infinity,
  );

  return (
    <SafeAreaView style={st.root}>
      <ScrollView contentContainerStyle={st.content}>
        <Pressable onPress={onBack} hitSlop={12}>
          <Text style={st.back}>‹ Back</Text>
        </Pressable>

        <Text style={st.eyebrow}>
          {new Date(run.startedAt)
            .toLocaleString(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })
            .toUpperCase()}
        </Text>
        <Text style={st.big}>
          {metersToMiles(run.distanceM).toFixed(2)}
          <Text style={st.unit}> mi</Text>
        </Text>

        <View style={st.stats}>
          <Stat label="AVG PACE" value={`${formatPace(moving, run.distanceM)}`} />
          <Stat label="MOVING" value={formatDuration(moving)} />
          <Stat label="PAUSED" value={formatDuration(paused)} />
        </View>

        <Text style={[st.eyebrow, { marginTop: 28 }]}>SPLITS</Text>
        <View style={st.card}>
          {splits.length === 0 ? (
            <Text style={st.empty}>
              {run.mileMoving || run.mileTimes
                ? 'No full mile on this run yet.'
                : 'Splits are recorded on runs from this version onward.'}
            </Text>
          ) : (
            <>
              <View style={[st.splitRow, st.splitHead]}>
                <Text style={[st.cellMile, st.headText]}>MILE</Text>
                <Text style={[st.cell, st.headText]}>SPLIT</Text>
                <Text style={[st.cell, st.headText]}>PACE / MI</Text>
                <Text style={[st.cell, st.headText]}>PAUSED</Text>
              </View>
              {splits.map((x) => (
                <View key={x.mile} style={st.splitRow}>
                  <Text style={st.cellMile}>
                    {x.miles === 1 ? x.mile : `${x.mile} (${x.miles.toFixed(2)})`}
                  </Text>
                  <Text style={[st.cell, x.ms === fastest && { color: C.lime }]}>
                    {formatDuration(x.ms)}
                  </Text>
                  <Text style={st.cell}>
                    {formatPace(x.ms, x.miles * 1609.344)}
                  </Text>
                  <Text style={[st.cell, x.pausedMs > 0 ? st.pausedCell : st.mutedCell]}>
                    {x.pausedMs > 0 ? formatDuration(x.pausedMs) : '–'}
                  </Text>
                </View>
              ))}
            </>
          )}
        </View>

        <Text style={[st.eyebrow, { marginTop: 28 }]}>ROUTE</Text>
        <View style={[st.card, { alignItems: 'center', paddingVertical: 28 }]}>
          <Text style={st.empty}>Route map coming soon. Your GPS route is already saved.</Text>
        </View>

        <Pressable
          onPress={() =>
            shareRun(run).catch((e) => Alert.alert('Could not share run', String(e)))
          }
          style={({ pressed }) => [st.share, pressed && { opacity: 0.7 }]}
        >
          <Text style={st.shareText}>Share run data</Text>
        </Pressable>
        <Text style={st.shareHint}>
          Sends this run's GPS file ({run.points.length.toLocaleString()} points) so it can be
          checked for accuracy.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={st.stat}>
      <Text style={st.statValue}>{value}</Text>
      <Text style={st.statLabel}>{label}</Text>
    </View>
  );
}

const mono = { fontVariant: ['tabular-nums' as const] };

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { padding: 20, paddingBottom: 48 },
  back: { color: C.lime, fontSize: 16, marginBottom: 16 },
  eyebrow: { color: C.muted, fontSize: 11, letterSpacing: 2, fontWeight: '600', marginBottom: 8 },
  big: { color: C.text, fontSize: 48, fontWeight: '700', ...mono },
  unit: { color: C.muted, fontSize: 18, fontWeight: '600' },
  stats: {
    flexDirection: 'row',
    marginTop: 16,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    backgroundColor: C.card,
  },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 16 },
  statValue: { color: C.text, fontSize: 20, fontWeight: '700', ...mono },
  statLabel: { color: C.muted, fontSize: 10, letterSpacing: 1.5, marginTop: 4 },
  card: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    backgroundColor: C.card,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  empty: { color: C.muted, fontSize: 13, paddingVertical: 10, textAlign: 'center' },
  splitRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  splitHead: { paddingVertical: 8 },
  headText: { color: C.muted, fontSize: 10, letterSpacing: 1.5 },
  cellMile: { flex: 1.2, color: C.text, fontSize: 15, ...mono },
  cell: { flex: 1, color: C.text, fontSize: 15, textAlign: 'right', ...mono },
  pausedCell: { color: '#F5B841' },
  mutedCell: { color: C.muted },
  share: {
    marginTop: 28,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.lime,
    paddingVertical: 14,
    alignItems: 'center',
  },
  shareText: { color: C.lime, fontSize: 15, fontWeight: '700' },
  shareHint: { color: C.muted, fontSize: 12, marginTop: 8, textAlign: 'center' },
});

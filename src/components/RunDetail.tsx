import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { shareRun } from '../exportRun';
import { updateSettings } from '../settings';
import { METERS_PER_MILE } from '../tracking/constants';
import { splitsOf } from '../tracking/cues';
import { formatDuration, formatPace, metersToMiles } from '../tracking/geo';
import { calibrateRun } from '../tracking/runStore';
import { averageCadence, metersToInches } from '../tracking/treadmill';
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

export function RunDetail({
  run,
  onBack,
  onChange,
}: {
  run: SavedRun;
  onBack: () => void;
  onChange?: (run: SavedRun) => void;
}) {
  const treadmill = run.mode === 'treadmill';
  const moving = runMovingMs(run);
  const paused = run.pausedMs ?? 0;
  const splits = splitsOf({ ...run, movingMs: moving });
  const fastest = splits.filter((x) => x.miles === 1).reduce(
    (min, x) => (x.ms < min ? x.ms : min),
    Infinity,
  );

  return (
    <SafeAreaView style={st.root}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={st.content} keyboardShouldPersistTaps="handled">
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
          {treadmill ? '  ·  TREADMILL' : ''}
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
        {treadmill ? (
          <View style={[st.stats, { marginTop: 10 }]}>
            <Stat label="STEPS" value={(run.countedSteps ?? 0).toLocaleString()} />
            <Stat
              label="CADENCE"
              value={`${averageCadence(run.countedSteps, moving) ?? '–'}`}
            />
            <Stat
              label="STRIDE"
              value={run.strideM ? `${metersToInches(run.strideM).toFixed(1)}″` : '–'}
            />
          </View>
        ) : null}

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

        {treadmill ? (
          <Calibrate run={run} onChange={onChange} />
        ) : (
          <>
            <Text style={[st.eyebrow, { marginTop: 28 }]}>ROUTE</Text>
            <View style={[st.card, { alignItems: 'center', paddingVertical: 28 }]}>
              <Text style={st.empty}>Route map coming soon. Your GPS route is already saved.</Text>
            </View>
          </>
        )}

        <Pressable
          onPress={() =>
            shareRun(run).catch((e) => Alert.alert('Could not share run', String(e)))
          }
          style={({ pressed }) => [st.share, pressed && { opacity: 0.7 }]}
        >
          <Text style={st.shareText}>Share run data</Text>
        </Pressable>
        <Text style={st.shareHint}>
          {treadmill
            ? `Sends this run's step data (${(run.stepSamples?.length ?? 0).toLocaleString()} readings) so it can be checked for accuracy.`
            : `Sends this run's GPS file (${run.points.length.toLocaleString()} points) so it can be checked for accuracy.`}
        </Text>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/**
 * Treadmill calibration: enter the real distance (treadmill screen or a known course).
 * The run is recalculated and the new stride is saved for future treadmill runs.
 */
function Calibrate({ run, onChange }: { run: SavedRun; onChange?: (run: SavedRun) => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const steps = run.countedSteps ?? 0;

  const save = async () => {
    const miles = parseFloat(text.replace(',', '.'));
    if (!isFinite(miles) || miles <= 0) {
      Alert.alert('Enter a distance', 'Type the distance in miles, for example 3.10.');
      return;
    }
    const strideM = (miles * METERS_PER_MILE) / steps;
    const inches = metersToInches(strideM);
    if (inches < 15 || inches > 80) {
      Alert.alert(
        'That looks off',
        `${miles} mi over ${steps.toLocaleString()} steps would be a ${inches.toFixed(0)} in stride. Check the distance and try again.`,
      );
      return;
    }
    setBusy(true);
    try {
      const res = await calibrateRun(run.id, miles * METERS_PER_MILE);
      if (!res) throw new Error('This run has no steps to calibrate from.');
      await updateSettings({ strideM: res.strideM, strideCalibratedAt: Date.now() });
      onChange?.(res.run);
      setText('');
      setDone(
        `Stride set to ${metersToInches(res.strideM).toFixed(1)} in. This run is updated and future treadmill runs will use it.`,
      );
    } catch (e) {
      Alert.alert('Could not calibrate', String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Text style={[st.eyebrow, { marginTop: 28 }]}>CALIBRATE STRIDE</Text>
      <View style={[st.card, { paddingVertical: 14 }]}>
        {steps < 100 ? (
          <Text style={st.empty}>Not enough steps on this run to calibrate from.</Text>
        ) : (
          <>
            <Text style={st.calText}>
              What distance did the treadmill's screen show (or the known course you ran)?
            </Text>
            <View style={st.calRow}>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder={metersToMiles(run.distanceM).toFixed(2)}
                placeholderTextColor={C.muted}
                keyboardType="decimal-pad"
                returnKeyType="done"
                onSubmitEditing={save}
                style={st.input}
              />
              <Text style={st.calUnit}>mi</Text>
              <Pressable
                disabled={busy || !text}
                onPress={save}
                style={({ pressed }) => [st.calButton, (pressed || busy || !text) && { opacity: 0.5 }]}
              >
                <Text style={st.calButtonText}>Calibrate</Text>
              </Pressable>
            </View>
            {done ? <Text style={st.calDone}>{done}</Text> : null}
          </>
        )}
      </View>
    </>
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
  calText: { color: C.muted, fontSize: 13, lineHeight: 18 },
  calRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  input: {
    flex: 1,
    color: C.text,
    fontSize: 20,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    ...mono,
  },
  calUnit: { color: C.muted, fontSize: 15, marginLeft: 8, marginRight: 12 },
  calButton: { backgroundColor: C.lime, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 16 },
  calButtonText: { color: C.bg, fontSize: 14, fontWeight: '700' },
  calDone: { color: C.lime, fontSize: 13, marginTop: 12, lineHeight: 18 },
  shareHint: { color: C.muted, fontSize: 12, marginTop: 8, textAlign: 'center' },
});

import { StyleSheet, Text, View } from 'react-native';

import type { Settings } from '../settings';
import { metersToInches } from '../tracking/treadmill';

const C = {
  card: '#12170F',
  border: '#232B1F',
  text: '#F2F5EE',
  muted: '#8A9483',
  lime: '#B8F04A',
  amber: '#F5B841',
};

/** Shown on the run screen in treadmill mode: current stride and how to calibrate it. */
export function TreadmillCard({ settings }: { settings: Settings }) {
  const calibrated = settings.strideCalibratedAt != null;
  return (
    <View>
      <Text style={st.eyebrow}>TREADMILL</Text>
      <View style={st.card}>
        <View style={st.row}>
          <View style={{ flex: 1 }}>
            <Text style={st.label}>Stride length</Text>
            <Text style={st.sub}>
              {calibrated
                ? `Calibrated ${new Date(settings.strideCalibratedAt!).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  })}`
                : 'Estimated, not calibrated yet'}
            </Text>
          </View>
          <Text style={[st.value, !calibrated && { color: C.amber }]}>
            {metersToInches(settings.strideM).toFixed(1)} in
          </Text>
        </View>
        <Text style={st.body}>
          No GPS indoors: distance is your steps × your stride. Keep the phone on you (pocket,
          waistband or armband), not on the treadmill console.
        </Text>
        <Text style={st.body}>
          {calibrated
            ? 'To recalibrate, open any treadmill run under Saved runs and enter the real distance.'
            : "To calibrate: run, stop, then open the run under Saved runs and enter the distance from the treadmill's screen (or a known course, like 4 laps of a track). Future runs use your real stride."}
        </Text>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  eyebrow: { color: C.muted, fontSize: 11, letterSpacing: 2, fontWeight: '600', marginBottom: 8 },
  card: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    backgroundColor: C.card,
    padding: 14,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  label: { color: C.text, fontSize: 15, fontWeight: '600' },
  sub: { color: C.muted, fontSize: 12, marginTop: 2 },
  value: { color: C.lime, fontSize: 20, fontWeight: '700', fontVariant: ['tabular-nums'] },
  body: { color: C.muted, fontSize: 13, marginTop: 12, lineHeight: 18 },
});

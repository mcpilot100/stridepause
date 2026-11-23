import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import {
  DEFAULT_SETTINGS,
  FUEL_MESSAGES,
  FUEL_MILE_OPTIONS,
  FUEL_MINUTE_OPTIONS,
  loadSettings,
  saveSettings,
  type Settings,
} from '../settings';
import { say } from '../speech';

const C = {
  card: '#12170F',
  border: '#232B1F',
  text: '#F2F5EE',
  muted: '#8A9483',
  lime: '#B8F04A',
  limeDim: '#2A3A12',
};

export function VoiceSettings() {
  const [s, setS] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    loadSettings().then(setS);
  }, []);

  const update = (patch: Partial<Settings>) => {
    const next = { ...s, ...patch };
    setS(next);
    saveSettings(next);
  };

  return (
    <View>
      <Text style={st.eyebrow}>VOICE</Text>
      <View style={st.card}>
        <Row label="Mile updates" sub="Split and average pace at every mile">
          <Switch
            value={s.voiceMiles}
            onValueChange={(v) => update({ voiceMiles: v })}
            trackColor={{ true: C.lime, false: C.border }}
          />
        </Row>
        <Pressable
          onPress={() =>
            say('Mile 1. Split 8 minutes 32 seconds. Average pace 8 minutes 32 seconds per mile.')
          }
        >
          <Text style={st.link}>🔊 Hear a sample</Text>
        </Pressable>
      </View>

      <Text style={[st.eyebrow, { marginTop: 20 }]}>FUEL REMINDERS</Text>
      <View style={st.card}>
        <Row label="Fuel reminders">
          <Switch
            value={s.fuelEnabled}
            onValueChange={(v) => update({ fuelEnabled: v })}
            trackColor={{ true: C.lime, false: C.border }}
          />
        </Row>

        {s.fuelEnabled && (
          <>
            <Segmented
              options={[
                { key: 'time', label: 'TIME' },
                { key: 'distance', label: 'DISTANCE' },
              ]}
              value={s.fuelMode}
              onChange={(k) => update({ fuelMode: k as Settings['fuelMode'] })}
            />

            <Text style={st.label}>Remind me every</Text>
            <View style={st.chips}>
              {s.fuelMode === 'time'
                ? FUEL_MINUTE_OPTIONS.map((m) => (
                    <Chip
                      key={m}
                      label={`${m} min`}
                      on={s.fuelMinutes === m}
                      onPress={() => update({ fuelMinutes: m })}
                    />
                  ))
                : FUEL_MILE_OPTIONS.map((m) => (
                    <Chip
                      key={m}
                      label={m === 1 ? 'mile' : `${m} mi`}
                      on={s.fuelMiles === m}
                      onPress={() => update({ fuelMiles: m })}
                    />
                  ))}
            </View>

            <Text style={st.label}>Say</Text>
            <View style={st.chips}>
              {FUEL_MESSAGES.map((msg) => (
                <Chip
                  key={msg}
                  label={msg}
                  on={s.fuelMessage === msg}
                  onPress={() => update({ fuelMessage: msg })}
                />
              ))}
            </View>

            <Pressable onPress={() => say(s.fuelMessage)}>
              <Text style={st.link}>🔊 Hear it</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

function Row({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <View style={st.row}>
      <View style={{ flex: 1 }}>
        <Text style={st.rowLabel}>{label}</Text>
        {sub ? <Text style={st.rowSub}>{sub}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[st.chip, on && st.chipOn]}>
      <Text style={[st.chipText, on && { color: C.lime }]}>{label}</Text>
    </Pressable>
  );
}

function Segmented({
  options,
  value,
  onChange,
}: {
  options: { key: string; label: string }[];
  value: string;
  onChange: (k: string) => void;
}) {
  return (
    <View style={st.seg}>
      {options.map((o) => (
        <Pressable
          key={o.key}
          onPress={() => onChange(o.key)}
          style={[st.segItem, value === o.key && { backgroundColor: C.lime }]}
        >
          <Text style={[st.segText, value === o.key && { color: '#0B0F0A' }]}>{o.label}</Text>
        </Pressable>
      ))}
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
  rowLabel: { color: C.text, fontSize: 15, fontWeight: '600' },
  rowSub: { color: C.muted, fontSize: 12, marginTop: 2 },
  link: { color: C.muted, fontSize: 13, marginTop: 12 },
  label: { color: C.muted, fontSize: 13, marginTop: 14, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  chipOn: { borderColor: C.lime, backgroundColor: C.limeDim },
  chipText: { color: C.text, fontSize: 13 },
  seg: {
    flexDirection: 'row',
    marginTop: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.border,
    padding: 3,
  },
  segItem: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 999 },
  segText: { color: C.muted, fontSize: 12, fontWeight: '700', letterSpacing: 1.5 },
});

import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

import { MAX_ACCURACY_M } from '../tracking/constants';
import { epochAtMoving } from '../tracking/cues';
import type { SavedRun, TrackPoint } from '../tracking/types';

const LIME = '#B8F04A';
const AMBER = '#F5B841';
const RED = '#E5484D';
const MAX_LINE_POINTS = 1500;

type LatLng = { latitude: number; longitude: number };
const ll = (p: TrackPoint): LatLng => ({ latitude: p.lat, longitude: p.lon });

/** The accurate fix closest in time to `t`. */
function pointAt(points: TrackPoint[], t: number): TrackPoint | null {
  if (!points.length) return null;
  let lo = 0;
  let hi = points.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid].t < t) lo = mid + 1;
    else hi = mid;
  }
  const a = points[Math.max(0, lo - 1)];
  const b = points[lo];
  return Math.abs(a.t - t) < Math.abs(b.t - t) ? a : b;
}

export function RouteMap({ run }: { run: SavedRun }) {
  const data = useMemo(() => {
    const good = run.points.filter((p) => p.acc == null || p.acc <= MAX_ACCURACY_M);
    if (good.length < 2) return null;

    const step = Math.ceil(good.length / MAX_LINE_POINTS);
    const line = good.filter((_, i) => i % step === 0 || i === good.length - 1).map(ll);

    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLon = Infinity;
    let maxLon = -Infinity;
    for (const p of good) {
      minLat = Math.min(minLat, p.lat);
      maxLat = Math.max(maxLat, p.lat);
      minLon = Math.min(minLon, p.lon);
      maxLon = Math.max(maxLon, p.lon);
    }
    const region = {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLon + maxLon) / 2,
      latitudeDelta: Math.max(0.004, (maxLat - minLat) * 1.3),
      longitudeDelta: Math.max(0.004, (maxLon - minLon) * 1.3),
    };

    const miles = (run.mileMoving ?? [])
      .map((m, i) => {
        const p = pointAt(good, epochAtMoving(run, m));
        return p ? { n: i + 1, at: ll(p) } : null;
      })
      .filter((x): x is { n: number; at: LatLng } => !!x);

    const pauses = (run.pauses ?? [])
      .map((ps, i) => {
        const p = pointAt(good, ps.start);
        return p ? { key: i, at: ll(p) } : null;
      })
      .filter((x): x is { key: number; at: LatLng } => !!x);

    return { line, region, miles, pauses, start: line[0], end: line[line.length - 1] };
  }, [run]);

  if (!data) {
    return (
      <View style={[st.box, st.empty]}>
        <Text style={st.emptyText}>Not enough GPS points to draw this route.</Text>
      </View>
    );
  }

  return (
    <View style={st.box}>
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={data.region}
        userInterfaceStyle="dark"
        pitchEnabled={false}
        rotateEnabled={false}
        showsPointsOfInterests={false}
        toolbarEnabled={false}
      >
        <Polyline coordinates={data.line} strokeColor={LIME} strokeWidth={4} />
        <Marker coordinate={data.start} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
          <View style={[st.dot, { backgroundColor: LIME }]} />
        </Marker>
        {data.miles.map((m) => (
          <Marker key={`m${m.n}`} coordinate={m.at} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
            <View style={st.mile}>
              <Text style={st.mileText}>{m.n}</Text>
            </View>
          </Marker>
        ))}
        {data.pauses.map((p) => (
          <Marker key={`p${p.key}`} coordinate={p.at} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
            <View style={st.pause}>
              <Text style={st.pauseText}>II</Text>
            </View>
          </Marker>
        ))}
        <Marker coordinate={data.end} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
          <View style={[st.dot, { backgroundColor: RED }]} />
        </Marker>
      </MapView>
    </View>
  );
}

export function RouteLegend() {
  return (
    <View style={st.legend}>
      <Legend color={LIME} label="Start" />
      <Legend color={RED} label="Finish" />
      <Legend color={AMBER} label="Pause" />
      <Legend color="#0B0F0A" border={LIME} label="Mile" />
    </View>
  );
}

function Legend({ color, label, border }: { color: string; label: string; border?: string }) {
  return (
    <View style={st.legendItem}>
      <View style={[st.legendDot, { backgroundColor: color }, border ? { borderColor: border, borderWidth: 1.5 } : null]} />
      <Text style={st.legendText}>{label}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  box: { height: 300, borderRadius: 14, overflow: 'hidden', backgroundColor: '#12170F' },
  empty: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#232B1F' },
  emptyText: { color: '#8A9483', fontSize: 13 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: '#0B0F0A' },
  mile: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#0B0F0A',
    borderWidth: 1.5,
    borderColor: LIME,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  mileText: { color: LIME, fontSize: 10, fontWeight: '700' },
  pause: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: AMBER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseText: { color: '#0B0F0A', fontSize: 9, fontWeight: '900' },
  legend: { flexDirection: 'row', gap: 14, marginTop: 10, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: '#8A9483', fontSize: 12 },
});

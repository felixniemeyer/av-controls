import type { TimelineLane, TimelinePoint } from '../messages';

type Point2 = { t: number; v: number };

function isPos(point: TimelinePoint) {
  return (point.kind ?? 'pos') === 'pos';
}

function sortByTime(points: TimelinePoint[]) {
  return [...points].sort((a, b) => a.t - b.t);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function deCasteljau(points: Point2[], t: number): Point2 {
  let current = points.map(p => ({ ...p }));
  for (let k = current.length - 1; k > 0; k--) {
    for (let i = 0; i < k; i++) {
      current[i] = {
        t: lerp(current[i]!.t, current[i + 1]!.t, t),
        v: lerp(current[i]!.v, current[i + 1]!.v, t),
      };
    }
  }
  return current[0]!;
}

function clampValue(value: number, min?: number, max?: number) {
  if (min === undefined || max === undefined) return value;
  if (min > max) return value;
  return Math.max(min, Math.min(max, value));
}

function buildSegments(points: TimelinePoint[]) {
  const sorted = sortByTime(points);
  const segments: TimelinePoint[][] = [];
  let current: TimelinePoint[] = [];
  for (const point of sorted) {
    if (isPos(point)) {
      if (current.length) {
        current.push(point);
        segments.push(current);
        current = [point];
      } else {
        current.push(point);
      }
    } else {
      if (!current.length) continue;
      current.push(point);
    }
  }
  return segments;
}

function segmentToBezierPoints(segment: TimelinePoint[]) {
  const points: Point2[] = segment.map(p => ({ t: p.t, v: p.v }));
  return points;
}

export function sampleLane(points: TimelinePoint[], samplesPerSegment = 32, min?: number, max?: number): Point2[] {
  if (points.length === 0) return [];
  const segments = buildSegments(points);
  if (!segments.length) return [];
  const samples: Point2[] = [];
  for (const segment of segments) {
    if (segment.length === 2) {
      samples.push({ t: segment[0]!.t, v: clampValue(segment[0]!.v, min, max) });
      samples.push({ t: segment[1]!.t, v: clampValue(segment[1]!.v, min, max) });
      continue;
    }
    const controlPoints = segmentToBezierPoints(segment);
    for (let i = 0; i <= samplesPerSegment; i++) {
      const t = i / samplesPerSegment;
      const sample = deCasteljau(controlPoints, t);
      samples.push({ t: sample.t, v: clampValue(sample.v, min, max) });
    }
  }
  return samples.sort((a, b) => a.t - b.t);
}

export function evalLane(points: TimelinePoint[], time: number, samplesPerSegment = 32, min?: number, max?: number): number | null {
  if (!points.length) return null;
  const sorted = sortByTime(points);
  if (sorted.length === 1) return clampValue(sorted[0]!.v, min, max);
  if (time <= sorted[0]!.t) return clampValue(sorted[0]!.v, min, max);
  const last = sorted[sorted.length - 1]!;
  if (time >= last.t) return clampValue(last.v, min, max);

  const segments = buildSegments(sorted);
  for (const segment of segments) {
    const start = segment[0]!;
    const end = segment[segment.length - 1]!;
    if (time < start.t || time > end.t) continue;
    if (segment.length === 2) {
      const span = end.t - start.t;
      if (span <= 0) return clampValue(start.v, min, max);
      const factor = (time - start.t) / span;
      return clampValue(start.v + (end.v - start.v) * factor, min, max);
    }
    const samples = sampleLane(segment, samplesPerSegment, min, max);
    for (let i = 0; i < samples.length - 1; i++) {
      const a = samples[i]!;
      const b = samples[i + 1]!;
      if (time >= a.t && time <= b.t) {
        const span = b.t - a.t;
        if (span <= 0) return clampValue(a.v, min, max);
        const factor = (time - a.t) / span;
        return clampValue(a.v + (b.v - a.v) * factor, min, max);
      }
    }
  }
  return null;
}

export function ensureLaneHasPos(points: TimelinePoint[]) {
  return points.some(p => isPos(p));
}

export function normalizeLane(points: TimelinePoint[]) {
  const sorted = sortByTime(points);
  return sorted;
}

export function getLaneKind(point: TimelinePoint) {
  return point.kind ?? 'pos';
}

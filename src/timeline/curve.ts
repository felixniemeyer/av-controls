import type { TimelinePoint } from '../messages';

type Point2 = { t: number; v: number };
type WrapOptions = { min: number; max: number; wrap: true } | { min?: number; max?: number; wrap?: false };

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

function wrapValue(value: number, min: number, max: number) {
  const range = max - min;
  if (!Number.isFinite(range) || range <= 0) return value;
  return ((((value - min) % range) + range) % range) + min;
}

function shortestWrappedDelta(from: number, to: number, min: number, max: number) {
  const range = max - min;
  if (!Number.isFinite(range) || range <= 0) return to - from;
  let delta = (to - from) % range;
  if (delta > range / 2) delta -= range;
  if (delta < -range / 2) delta += range;
  return delta;
}

function mapValueForOutput(value: number, options?: WrapOptions) {
  if (options?.wrap && options.min !== undefined && options.max !== undefined) {
    return wrapValue(value, options.min, options.max);
  }
  return clampValue(value, options?.min, options?.max);
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

function segmentToWrappedBezierPoints(segment: TimelinePoint[], min: number, max: number) {
  const points: Point2[] = [];
  let previousValue: number | null = null;
  for (const point of segment) {
    if (previousValue === null) {
      previousValue = point.v;
      points.push({ t: point.t, v: point.v });
      continue;
    }
    const nextValue: number = previousValue + shortestWrappedDelta(previousValue, point.v, min, max);
    points.push({ t: point.t, v: nextValue });
    previousValue = nextValue;
  }
  return points;
}

export function sampleLane(points: TimelinePoint[], samplesPerSegment = 32, min?: number, max?: number, wrap = false): Point2[] {
  if (points.length === 0) return [];
  const segments = buildSegments(points);
  if (!segments.length) return [];
  const samples: Point2[] = [];
  const wrapOptions: WrapOptions = wrap && min !== undefined && max !== undefined
    ? { min, max, wrap: true }
    : { min, max, wrap: false };
  for (const segment of segments) {
    if (segment.length === 2) {
      const start = segment[0]!;
      const end = segment[1]!;
      samples.push({ t: start.t, v: mapValueForOutput(start.v, wrapOptions) });
      if (wrapOptions.wrap) {
        samples.push({
          t: end.t,
          v: mapValueForOutput(start.v + shortestWrappedDelta(start.v, end.v, min!, max!), wrapOptions),
        });
      } else {
        samples.push({ t: end.t, v: mapValueForOutput(end.v, wrapOptions) });
      }
      continue;
    }
    const controlPoints = wrapOptions.wrap
      ? segmentToWrappedBezierPoints(segment, min!, max!)
      : segmentToBezierPoints(segment);
    for (let i = 0; i <= samplesPerSegment; i++) {
      const t = i / samplesPerSegment;
      const sample = deCasteljau(controlPoints, t);
      samples.push({ t: sample.t, v: mapValueForOutput(sample.v, wrapOptions) });
    }
  }
  return samples.sort((a, b) => a.t - b.t);
}

export function evalLane(points: TimelinePoint[], time: number, samplesPerSegment = 32, min?: number, max?: number, wrap = false): number | null {
  if (!points.length) return null;
  const sorted = sortByTime(points);
  const wrapOptions: WrapOptions = wrap && min !== undefined && max !== undefined
    ? { min, max, wrap: true }
    : { min, max, wrap: false };
  if (sorted.length === 1) return mapValueForOutput(sorted[0]!.v, wrapOptions);
  if (time <= sorted[0]!.t) return mapValueForOutput(sorted[0]!.v, wrapOptions);
  const last = sorted[sorted.length - 1]!;
  if (time >= last.t) return mapValueForOutput(last.v, wrapOptions);

  const segments = buildSegments(sorted);
  for (const segment of segments) {
    const start = segment[0]!;
    const end = segment[segment.length - 1]!;
    if (time < start.t || time > end.t) continue;
    if (segment.length === 2) {
      const span = end.t - start.t;
      if (span <= 0) return mapValueForOutput(start.v, wrapOptions);
      const factor = (time - start.t) / span;
      if (wrapOptions.wrap) {
        const delta = shortestWrappedDelta(start.v, end.v, min!, max!);
        return mapValueForOutput(start.v + delta * factor, wrapOptions);
      }
      return mapValueForOutput(start.v + (end.v - start.v) * factor, wrapOptions);
    }
    const samples = sampleLane(segment, samplesPerSegment, min, max, wrap);
    for (let i = 0; i < samples.length - 1; i++) {
      const a = samples[i]!;
      const b = samples[i + 1]!;
      if (time >= a.t && time <= b.t) {
        const span = b.t - a.t;
        if (span <= 0) return mapValueForOutput(a.v, wrapOptions);
        const factor = (time - a.t) / span;
        if (wrapOptions.wrap) {
          const delta = shortestWrappedDelta(a.v, b.v, min!, max!);
          return mapValueForOutput(a.v + delta * factor, wrapOptions);
        }
        return mapValueForOutput(a.v + (b.v - a.v) * factor, wrapOptions);
      }
    }
  }
  return null;
}

export function evalStepLane(points: TimelinePoint[], time: number, min?: number, max?: number): number | null {
  if (!points.length) return null;
  const sorted = sortByTime(points);
  let current = sorted[0]!;
  for (const point of sorted) {
    if (point.t > time) break;
    current = point;
  }
  return clampValue(current.v, min, max);
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

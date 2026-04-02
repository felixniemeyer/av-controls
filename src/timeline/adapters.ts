import * as Controls from '../controls';
import type { TimelineKeyframe, TimelineLane } from '../messages';

type Quaternion = [number, number, number, number];
type Vec3 = [number, number, number];
type Dot = [number, number];
type Player3DPose = {
  position: Vec3;
  rotation: Quaternion;
};

type SanitizedPlayer3DKeyframe = TimelineKeyframe & {
  value: Player3DPose;
};

type Player3DSegment = {
  startTime: number;
  endTime: number;
  duration: number;
  positionStart: Vec3;
  positionEnd: Vec3;
  positionStartTangent: Vec3;
  positionEndTangent: Vec3;
  rotationControls: [Quaternion, Quaternion, Quaternion, Quaternion];
};

type PreparedPlayer3DCurve = {
  keyframes: SanitizedPlayer3DKeyframe[];
  segments: Player3DSegment[];
};

export type TimelineAdapter = {
  kind: 'curve' | 'step' | 'trigger' | 'keyframes';
  capturePayload: (state: unknown) => unknown;
  evaluateKeyframes?: (lane: TimelineLane, time: number) => unknown | null;
};

function cloneUnknown<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value)) as T;
}

function clamp01(value: number | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0.5;
  return Math.max(0, Math.min(1, value));
}

function endpointSmoothness(left: number | undefined, right: number | undefined) {
  return Math.sqrt(clamp01(left) * clamp01(right));
}

function sortKeyframes(keyframes: TimelineKeyframe[]) {
  return [...keyframes].sort((a, b) => a.t - b.t);
}

function normalizeQuaternion(values: Quaternion): Quaternion {
  const length = Math.hypot(values[0], values[1], values[2], values[3]);
  if (length <= 1e-8) return [0, 0, 0, 1];
  return [
    values[0] / length,
    values[1] / length,
    values[2] / length,
    values[3] / length,
  ];
}

function alignQuaternionHemisphere(reference: Quaternion, value: Quaternion): Quaternion {
  const dot = reference[0] * value[0] + reference[1] * value[1] + reference[2] * value[2] + reference[3] * value[3];
  if (dot >= 0) return value;
  return [-value[0], -value[1], -value[2], -value[3]];
}

function quaternionMultiply(a: Quaternion, b: Quaternion): Quaternion {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}

function quaternionConjugate(value: Quaternion): Quaternion {
  return [-value[0], -value[1], -value[2], value[3]];
}

function quaternionLog(value: Quaternion): Vec3 {
  const q = normalizeQuaternion(value);
  const vNorm = Math.hypot(q[0], q[1], q[2]);
  if (vNorm <= 1e-8) return [0, 0, 0];
  const angle = Math.atan2(vNorm, q[3]);
  const scale = angle / vNorm;
  return [q[0] * scale, q[1] * scale, q[2] * scale];
}

function quaternionExp(value: Vec3): Quaternion {
  const angle = Math.hypot(value[0], value[1], value[2]);
  if (angle <= 1e-8) return [0, 0, 0, 1];
  const sinAngle = Math.sin(angle);
  const scale = sinAngle / angle;
  return normalizeQuaternion([
    value[0] * scale,
    value[1] * scale,
    value[2] * scale,
    Math.cos(angle),
  ]);
}

function slerpQuaternion(a: Quaternion, b: Quaternion, t: number): Quaternion {
  let from = normalizeQuaternion(a);
  let to = normalizeQuaternion(b);
  let dot = from[0] * to[0] + from[1] * to[1] + from[2] * to[2] + from[3] * to[3];
  if (dot < 0) {
    dot = -dot;
    to = [-to[0], -to[1], -to[2], -to[3]];
  }
  if (dot > 0.9995) {
    return normalizeQuaternion([
      from[0] + (to[0] - from[0]) * t,
      from[1] + (to[1] - from[1]) * t,
      from[2] + (to[2] - from[2]) * t,
      from[3] + (to[3] - from[3]) * t,
    ]);
  }
  const theta0 = Math.acos(Math.max(-1, Math.min(1, dot)));
  const theta = theta0 * t;
  const sinTheta = Math.sin(theta);
  const sinTheta0 = Math.sin(theta0);
  const s0 = Math.cos(theta) - dot * sinTheta / sinTheta0;
  const s1 = sinTheta / sinTheta0;
  return normalizeQuaternion([
    s0 * from[0] + s1 * to[0],
    s0 * from[1] + s1 * to[1],
    s0 * from[2] + s1 * to[2],
    s0 * from[3] + s1 * to[3],
  ]);
}

function squadQuaternion(a: Quaternion, b: Quaternion, s0: Quaternion, s1: Quaternion, t: number): Quaternion {
  const ab = slerpQuaternion(a, b, t);
  const ss = slerpQuaternion(s0, s1, t);
  return slerpQuaternion(ab, ss, 2 * t * (1 - t));
}

function vec3Add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function vec3Sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function vec3Scale(a: Vec3, factor: number): Vec3 {
  return [a[0] * factor, a[1] * factor, a[2] * factor];
}

function vec3Length(a: Vec3) {
  return Math.hypot(a[0], a[1], a[2]);
}

function vec3Normalize(a: Vec3): Vec3 {
  const length = vec3Length(a);
  if (length <= 1e-8) return [0, 0, 0];
  return vec3Scale(a, 1 / length);
}

function vec3WeightedAverage(a: Vec3, aWeight: number, b: Vec3, bWeight: number): Vec3 {
  const total = aWeight + bWeight;
  if (total <= 1e-8) return [0, 0, 0];
  return [
    (a[0] * aWeight + b[0] * bWeight) / total,
    (a[1] * aWeight + b[1] * bWeight) / total,
    (a[2] * aWeight + b[2] * bWeight) / total,
  ];
}

function dotSub(a: Dot, b: Dot): Dot {
  return [a[0] - b[0], a[1] - b[1]];
}

function dotScale(a: Dot, factor: number): Dot {
  return [a[0] * factor, a[1] * factor];
}

function hermiteScalar(p0: number, p1: number, m0: number, m1: number, t: number) {
  const t2 = t * t;
  const t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * p0
    + (t3 - 2 * t2 + t) * m0
    + (-2 * t3 + 3 * t2) * p1
    + (t3 - t2) * m1;
}

function hermiteVec3(p0: Vec3, p1: Vec3, m0: Vec3, m1: Vec3, t: number): Vec3 {
  return [
    hermiteScalar(p0[0], p1[0], m0[0], m1[0], t),
    hermiteScalar(p0[1], p1[1], m0[1], m1[1], t),
    hermiteScalar(p0[2], p1[2], m0[2], m1[2], t),
  ];
}

function hermiteDot(p0: Dot, p1: Dot, m0: Dot, m1: Dot, t: number): Dot {
  return [
    hermiteScalar(p0[0], p1[0], m0[0], m1[0], t),
    hermiteScalar(p0[1], p1[1], m0[1], m1[1], t),
  ];
}

function shapeSegmentParameter(u: number, startSmoothness: number, endSmoothness: number) {
  return clamp01(hermiteScalar(0, 1, startSmoothness, endSmoothness, u));
}

function findKeyframeSegment(keyframes: TimelineKeyframe[], time: number) {
  const sorted = sortKeyframes(keyframes);
  if (!sorted.length) return null;
  if (time <= sorted[0]!.t) return { sorted, index: 0, atStart: true, atEnd: false };
  if (time >= sorted[sorted.length - 1]!.t) return { sorted, index: sorted.length - 1, atStart: false, atEnd: true };
  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i]!;
    const next = sorted[i + 1]!;
    if (time >= current.t && time <= next.t) {
      return { sorted, index: i, atStart: false, atEnd: false };
    }
  }
  return { sorted, index: sorted.length - 1, atStart: false, atEnd: true };
}

function sanitizePlayer3DPose(value: any): Player3DPose {
  const position = Array.isArray(value?.position) ? value.position : [];
  const rotation = Array.isArray(value?.rotation) ? value.rotation : [];
  return {
    position: [
      typeof position[0] === 'number' ? position[0] : 0,
      typeof position[1] === 'number' ? position[1] : 0,
      typeof position[2] === 'number' ? position[2] : 0,
    ] as Vec3,
    rotation: normalizeQuaternion([
      typeof rotation[0] === 'number' ? rotation[0] : 0,
      typeof rotation[1] === 'number' ? rotation[1] : 0,
      typeof rotation[2] === 'number' ? rotation[2] : 0,
      typeof rotation[3] === 'number' ? rotation[3] : 1,
    ]),
  };
}

function sanitizePlayer3DKeyframes(keyframes: TimelineKeyframe[]): SanitizedPlayer3DKeyframe[] {
  const sorted = sortKeyframes(keyframes).map((keyframe) => ({
    ...keyframe,
    value: sanitizePlayer3DPose(keyframe.value),
  }));

  for (let i = 1; i < sorted.length; i++) {
    sorted[i] = {
      ...sorted[i]!,
      value: {
        ...sorted[i]!.value,
        rotation: alignQuaternionHemisphere(sorted[i - 1]!.value.rotation, sorted[i]!.value.rotation),
      },
    };
  }

  return sorted;
}

function player3DKeyframeSignature(keyframes: SanitizedPlayer3DKeyframe[]) {
  return JSON.stringify(keyframes.map((keyframe) => ({
    t: keyframe.t,
    leftSmooth: keyframe.leftSmooth ?? null,
    rightSmooth: keyframe.rightSmooth ?? null,
    position: keyframe.value.position,
    rotation: keyframe.value.rotation,
  })));
}

function sanitizeDotsValue(value: any) {
  if (!Array.isArray(value?.values)) {
    return { values: [] as Dot[] };
  }
  return {
    values: value.values
      .filter((dot: any) => Array.isArray(dot) && typeof dot[0] === 'number' && typeof dot[1] === 'number')
      .map((dot: Dot) => [dot[0], dot[1]] as Dot),
  };
}

function getPositionVelocity(
  prev: Vec3 | null,
  current: Vec3,
  next: Vec3 | null,
  dtPrev: number | null,
  dtNext: number | null,
): Vec3 {
  if (prev && next && dtPrev && dtNext) {
    const vPrev = vec3Scale(vec3Sub(current, prev), 1 / Math.max(1e-6, dtPrev));
    const vNext = vec3Scale(vec3Sub(next, current), 1 / Math.max(1e-6, dtNext));
    return vec3WeightedAverage(vPrev, dtNext, vNext, dtPrev);
  }
  if (next && dtNext) {
    return vec3Scale(vec3Sub(next, current), 1 / Math.max(1e-6, dtNext));
  }
  if (prev && dtPrev) {
    return vec3Scale(vec3Sub(current, prev), 1 / Math.max(1e-6, dtPrev));
  }
  return [0, 0, 0];
}

function quaternionDistance(a: Quaternion, b: Quaternion) {
  const aligned = alignQuaternionHemisphere(a, b);
  return vec3Length(quaternionLog(quaternionMultiply(quaternionConjugate(a), aligned)));
}

function quaternionApplyTangent(base: Quaternion, tangent: Vec3): Quaternion {
  return normalizeQuaternion(quaternionMultiply(base, quaternionExp(tangent)));
}

function getPositionDirection(
  prev: Vec3 | null,
  current: Vec3,
  next: Vec3 | null,
  dtPrev: number | null,
  dtNext: number | null,
): Vec3 {
  const velocity = getPositionVelocity(prev, current, next, dtPrev, dtNext);
  if (vec3Length(velocity) > 1e-8) return vec3Normalize(velocity);
  if (next) {
    const forward = vec3Sub(next, current);
    if (vec3Length(forward) > 1e-8) return vec3Normalize(forward);
  }
  if (prev) {
    const backward = vec3Sub(current, prev);
    if (vec3Length(backward) > 1e-8) return vec3Normalize(backward);
  }
  return [0, 0, 0];
}

function getRotationVelocity(
  prev: Quaternion | null,
  current: Quaternion,
  next: Quaternion | null,
  dtPrev: number | null,
  dtNext: number | null,
): Vec3 {
  if (prev && next && dtPrev && dtNext) {
    const prevDelta = vec3Scale(
      quaternionLog(quaternionMultiply(quaternionConjugate(current), alignQuaternionHemisphere(current, prev))),
      -1 / Math.max(1e-6, dtPrev),
    );
    const nextDelta = vec3Scale(
      quaternionLog(quaternionMultiply(quaternionConjugate(current), alignQuaternionHemisphere(current, next))),
      1 / Math.max(1e-6, dtNext),
    );
    return vec3WeightedAverage(prevDelta, dtNext, nextDelta, dtPrev);
  }
  if (next && dtNext) {
    return vec3Scale(
      quaternionLog(quaternionMultiply(quaternionConjugate(current), alignQuaternionHemisphere(current, next))),
      1 / Math.max(1e-6, dtNext),
    );
  }
  if (prev && dtPrev) {
    return vec3Scale(
      quaternionLog(quaternionMultiply(quaternionConjugate(current), alignQuaternionHemisphere(current, prev))),
      -1 / Math.max(1e-6, dtPrev),
    );
  }
  return [0, 0, 0];
}

function getRotationDirection(
  prev: Quaternion | null,
  current: Quaternion,
  next: Quaternion | null,
  dtPrev: number | null,
  dtNext: number | null,
): Vec3 {
  const velocity = getRotationVelocity(prev, current, next, dtPrev, dtNext);
  if (vec3Length(velocity) > 1e-8) return vec3Normalize(velocity);
  if (next) {
    const forward = quaternionLog(quaternionMultiply(quaternionConjugate(current), alignQuaternionHemisphere(current, next)));
    if (vec3Length(forward) > 1e-8) return vec3Normalize(forward);
  }
  if (prev) {
    const backward = vec3Scale(
      quaternionLog(quaternionMultiply(quaternionConjugate(current), alignQuaternionHemisphere(current, prev))),
      -1,
    );
    if (vec3Length(backward) > 1e-8) return vec3Normalize(backward);
  }
  return [0, 0, 0];
}

function quaternionRelativeLog(from: Quaternion, to: Quaternion): Vec3 {
  return quaternionLog(quaternionMultiply(quaternionConjugate(from), alignQuaternionHemisphere(from, to)));
}

function getRotationTCBBaseTangent(
  prev: Quaternion | null,
  current: Quaternion,
  next: Quaternion | null,
): Vec3 {
  if (prev && next) {
    const incoming = vec3Scale(quaternionRelativeLog(current, prev), -1);
    const outgoing = quaternionRelativeLog(current, next);
    return vec3Scale(vec3Add(incoming, outgoing), 0.5);
  }
  if (next) return quaternionRelativeLog(current, next);
  if (prev) return vec3Scale(quaternionRelativeLog(current, prev), -1);
  return [0, 0, 0];
}

function sphericalBezierQuaternion(points: [Quaternion, Quaternion, Quaternion, Quaternion], t: number): Quaternion {
  const q01 = slerpQuaternion(points[0], points[1], t);
  const q12 = slerpQuaternion(points[1], points[2], t);
  const q23 = slerpQuaternion(points[2], points[3], t);
  const q012 = slerpQuaternion(q01, q12, t);
  const q123 = slerpQuaternion(q12, q23, t);
  return slerpQuaternion(q012, q123, t);
}

function quaternionAngle(a: Quaternion, b: Quaternion) {
  return 2 * quaternionDistance(a, b);
}

function findSegmentIndexFromTime(keyframes: SanitizedPlayer3DKeyframe[], time: number) {
  if (time <= keyframes[0]!.t) return 0;
  if (time >= keyframes[keyframes.length - 1]!.t) return keyframes.length - 2;
  let low = 0;
  let high = keyframes.length - 2;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const start = keyframes[mid]!.t;
    const end = keyframes[mid + 1]!.t;
    if (time < start) {
      high = mid - 1;
    } else if (time > end) {
      low = mid + 1;
    } else {
      return mid;
    }
  }
  return Math.max(0, Math.min(keyframes.length - 2, low));
}

const player3DCurveCache = new WeakMap<TimelineLane, { signature: string; curve: PreparedPlayer3DCurve }>();

function preparePlayer3DCurve(lane: TimelineLane): PreparedPlayer3DCurve | null {
  if (lane.type !== 'keyframes') return null;
  const keyframes = sanitizePlayer3DKeyframes(lane.keyframes);
  if (!keyframes.length) return null;
  if (keyframes.length === 1) {
    return {
      keyframes,
      segments: [],
    };
  }

  const signature = player3DKeyframeSignature(keyframes);
  const cached = player3DCurveCache.get(lane);
  if (cached && cached.signature === signature) return cached.curve;

  const positionVelocities: Vec3[] = [];
  const rotationInTangents: Vec3[] = [];
  const rotationOutTangents: Vec3[] = [];
  for (let i = 0; i < keyframes.length; i++) {
    const prev = i > 0 ? keyframes[i - 1]!.value : null;
    const currentKeyframe = keyframes[i]!;
    const current = currentKeyframe.value;
    const next = i + 1 < keyframes.length ? keyframes[i + 1]!.value : null;
    const dtPrev = i > 0 ? keyframes[i]!.t - keyframes[i - 1]!.t : null;
    const dtNext = i + 1 < keyframes.length ? keyframes[i + 1]!.t - keyframes[i]!.t : null;
    positionVelocities.push(getPositionVelocity(prev?.position ?? null, current.position, next?.position ?? null, dtPrev, dtNext));
    const baseTangent = getRotationTCBBaseTangent(prev?.rotation ?? null, current.rotation, next?.rotation ?? null);
    rotationInTangents.push(vec3Scale(baseTangent, clamp01(currentKeyframe.leftSmooth)));
    rotationOutTangents.push(vec3Scale(baseTangent, clamp01(currentKeyframe.rightSmooth)));
  }

  const segments: Player3DSegment[] = [];
  for (let i = 0; i < keyframes.length - 1; i++) {
    const start = keyframes[i]!;
    const end = keyframes[i + 1]!;
    const outAmount = clamp01(start.rightSmooth);
    const inAmount = clamp01(end.leftSmooth);
    const duration = Math.max(1e-6, end.t - start.t);
    const positionStartTangent = vec3Scale(positionVelocities[i]!, duration * outAmount);
    const positionEndTangent = vec3Scale(positionVelocities[i + 1]!, duration * inAmount);

    const startRotationControl = quaternionApplyTangent(start.value.rotation, vec3Scale(rotationOutTangents[i]!, 1 / 3));
    const endRotationControl = quaternionApplyTangent(end.value.rotation, vec3Scale(rotationInTangents[i + 1]!, -1 / 3));
    const rotationControls: [Quaternion, Quaternion, Quaternion, Quaternion] = [
      start.value.rotation,
      alignQuaternionHemisphere(start.value.rotation, startRotationControl),
      alignQuaternionHemisphere(startRotationControl, endRotationControl),
      alignQuaternionHemisphere(endRotationControl, end.value.rotation),
    ];

    segments.push({
      startTime: start.t,
      endTime: end.t,
      duration,
      positionStart: start.value.position,
      positionEnd: end.value.position,
      positionStartTangent,
      positionEndTangent,
      rotationControls,
    });
  }

  const curve = {
    keyframes,
    segments,
  };
  player3DCurveCache.set(lane, { signature, curve });
  return curve;
}

function evaluatePlayer3DKeyframes(lane: TimelineLane, time: number) {
  const prepared = preparePlayer3DCurve(lane);
  if (!prepared) return null;
  const { keyframes, segments } = prepared;
  if (keyframes.length === 1 || !segments.length) return keyframes[0]!.value;
  if (time <= keyframes[0]!.t) return keyframes[0]!.value;
  if (time >= keyframes[keyframes.length - 1]!.t) return keyframes[keyframes.length - 1]!.value;

  const segmentIndex = findSegmentIndexFromTime(keyframes, time);
  const segment = segments[segmentIndex]!;
  const localTime = time - segment.startTime;
  const uPosition = clamp01(localTime / segment.duration);
  const uRotation = clamp01(localTime / segment.duration);

  return {
    position: hermiteVec3(segment.positionStart, segment.positionEnd, segment.positionStartTangent, segment.positionEndTangent, uPosition),
    rotation: sphericalBezierQuaternion(segment.rotationControls, uRotation),
  };
}

function evaluateDotsKeyframes(lane: TimelineLane, time: number) {
  if (lane.type !== 'keyframes') return null;
  const segment = findKeyframeSegment(lane.keyframes, time);
  if (!segment) return null;
  const { sorted, index, atStart, atEnd } = segment;
  if (atStart || atEnd || index >= sorted.length - 1) {
    return sanitizeDotsValue(sorted[Math.min(index, sorted.length - 1)]!.value);
  }

  const current = sorted[index]!;
  const next = sorted[index + 1]!;
  const a = sanitizeDotsValue(current.value);
  const b = sanitizeDotsValue(next.value);
  if (a.values.length !== b.values.length) {
    return time - current.t <= next.t - time ? a : b;
  }
  const dt = Math.max(1e-6, next.t - current.t);
  const u = (time - current.t) / dt;
  const currentSmoothness = endpointSmoothness(current.leftSmooth, current.rightSmooth);
  const nextSmoothness = endpointSmoothness(next.leftSmooth, next.rightSmooth);
  const shapedU = shapeSegmentParameter(u, currentSmoothness, nextSmoothness);
  if (sorted.length < 3) {
    return {
      values: a.values.map((dot: Dot, indexDot: number) => {
        const nextDot = b.values[indexDot]!;
        return [
          dot[0] + (nextDot[0] - dot[0]) * shapedU,
          dot[1] + (nextDot[1] - dot[1]) * shapedU,
        ] as Dot;
      }),
    };
  }

  const prev = index > 0 ? sanitizeDotsValue(sorted[index - 1]!.value) : a;
  const after = index + 2 < sorted.length ? sanitizeDotsValue(sorted[index + 2]!.value) : b;
  if (prev.values.length !== a.values.length || after.values.length !== b.values.length) {
    return {
      values: a.values.map((dot: Dot, indexDot: number) => {
        const nextDot = b.values[indexDot]!;
        return [
          dot[0] + (nextDot[0] - dot[0]) * shapedU,
          dot[1] + (nextDot[1] - dot[1]) * shapedU,
        ] as Dot;
      }),
    };
  }

  const rightStrength = clamp01(current.rightSmooth);
  const leftStrength = clamp01(next.leftSmooth);
  const span = Math.max(1e-6, (sorted[Math.min(index + 2, sorted.length - 1)]!.t - sorted[Math.max(index - 1, 0)]!.t) || dt);

  return {
    values: a.values.map((dot: Dot, indexDot: number) => {
      const prevDot = prev.values[indexDot]!;
      const nextDot = b.values[indexDot]!;
      const afterDot = after.values[indexDot]!;
      const tangentOut = dotScale(dotSub(afterDot, prevDot), (0.5 * rightStrength * dt) / span);
      const tangentIn = dotScale(dotSub(afterDot, prevDot), (0.5 * leftStrength * dt) / span);
      return hermiteDot(dot, nextDot, tangentOut, tangentIn, shapedU);
    }),
  };
}

const curveAdapter: TimelineAdapter = {
  kind: 'curve',
  capturePayload: (state) => cloneUnknown(state),
};

const triggerAdapter: TimelineAdapter = {
  kind: 'trigger',
  capturePayload: (state) => cloneUnknown(state),
};

const player3dAdapter: TimelineAdapter = {
  kind: 'keyframes',
  capturePayload: (state) => sanitizePlayer3DPose(state),
  evaluateKeyframes: evaluatePlayer3DKeyframes,
};

const dotsAdapter: TimelineAdapter = {
  kind: 'keyframes',
  capturePayload: (state) => sanitizeDotsValue(state),
  evaluateKeyframes: evaluateDotsKeyframes,
};

export function getTimelineAdapter(spec: Controls.Base.Spec): TimelineAdapter {
  if (spec.type === Controls.Player3D.Spec.type) return player3dAdapter;
  if (spec.type === Controls.Dots.Spec.type) return dotsAdapter;
  if (spec.type === Controls.Switch.Spec.type || spec.type === Controls.ConfirmSwitch.Spec.type || spec.type === Controls.Pad.Spec.type) return triggerAdapter;
  return curveAdapter;
}

export function sortTimelineKeyframes(keyframes: TimelineKeyframe[]) {
  return sortKeyframes(keyframes);
}

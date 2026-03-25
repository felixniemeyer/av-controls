import * as Controls from '../controls';
import { Base } from '../controls';
import type {
  TimelineState,
  TimelineControl,
  TimelineLane,
  TimelinePoint,
  TimelineEdit,
} from '../messages';
import {
  TimelineStateMessage,
  TimelineEditMessage,
  TimelineRequestState,
} from '../messages';
import { evalLane } from './curve';

type ControlPath = string[];

type ControlIndexEntry = {
  path: ControlPath;
  receiver: Base.Receiver;
  spec: Base.Spec;
};

type ControlAutomationState = {
  path: ControlPath;
  enabled: boolean;
  manualOverride: boolean;
  lanes: TimelineLane[];
};

type TimelineOptions = {
  autoplay?: boolean;
  initialTime?: number;
  initialState?: TimelineStateKind;
  alwaysRender?: boolean;
  loopEnabled?: boolean;
  loopDurationSec?: number;
  onRender?: (timeContext: TimeContext) => void | Promise<void>;
};

export type TimelineStateKind = 'playing' | 'paused' | 'scrubbing' | 'rendering';

export type TimeContext = {
  now: number;
  /** Timeline-time delta (how much timeline time advanced this frame). */
  deltaTime: number;
  /** Wall-clock delta between rAF frames. */
  worldDeltaTime: number;
  state: TimelineStateKind;
};

const containerTypes = new Set([
  Controls.Group.Spec.type,
  Controls.Tabs.Spec.type,
  Controls.Modal.Spec.type,
]);

function isContainerSpec(spec: Base.Spec): boolean {
  return containerTypes.has(spec.type);
}

function hasChildren(receiver: Base.Receiver): receiver is Base.Receiver & { controls: Record<string, Base.Receiver> } {
  return typeof (receiver as any).controls === 'object';
}

function getPathKey(path: ControlPath): string {
  return path.join('.');
}

function walkReceivers(
  receiver: Base.Receiver,
  path: ControlPath,
  onNode: (entry: ControlIndexEntry) => void,
) {
  onNode({ path, receiver, spec: receiver.spec });
  if (hasChildren(receiver)) {
    for (const id in receiver.controls) {
      const child = receiver.controls[id];
      if (child) {
        walkReceivers(child, [...path, id], onNode);
      }
    }
  }
}

function ensureSorted(points: TimelinePoint[]): TimelinePoint[] {
  return [...points].sort((a, b) => a.t - b.t);
}

function extractSignalPath(signal: Base.Signal): { path: ControlPath; leaf: any } {
  const path: string[] = [];
  let current: any = signal;
  while (current && typeof current === 'object' && 'controlId' in current && 'signal' in current) {
    path.push(current.controlId);
    current = current.signal;
  }
  return { path, leaf: current };
}

function extractUpdatePath(update: Base.Update): { path: ControlPath; leaf: any } {
  const path: string[] = [];
  let current: any = update;
  while (current && typeof current === 'object' && 'controlId' in current && 'update' in current) {
    path.push(current.controlId);
    current = current.update;
  }
  return { path, leaf: current };
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !Number.isNaN(value);
}

function normalizeQuaternion(values: [number, number, number, number]): [number, number, number, number] {
  const length = Math.hypot(values[0], values[1], values[2], values[3]);
  if (length <= 1e-8) {
    return [0, 0, 0, 1];
  }
  return [
    values[0] / length,
    values[1] / length,
    values[2] / length,
    values[3] / length,
  ];
}

function slerpQuaternion(
  a: [number, number, number, number],
  b: [number, number, number, number],
  t: number,
): [number, number, number, number] {
  let ax = a[0];
  let ay = a[1];
  let az = a[2];
  let aw = a[3];
  let bx = b[0];
  let by = b[1];
  let bz = b[2];
  let bw = b[3];

  let dot = ax * bx + ay * by + az * bz + aw * bw;
  if (dot < 0) {
    dot = -dot;
    bx = -bx;
    by = -by;
    bz = -bz;
    bw = -bw;
  }

  if (dot > 0.9995) {
    return normalizeQuaternion([
      ax + (bx - ax) * t,
      ay + (by - ay) * t,
      az + (bz - az) * t,
      aw + (bw - aw) * t,
    ]);
  }

  const theta0 = Math.acos(Math.max(-1, Math.min(1, dot)));
  const theta = theta0 * t;
  const sinTheta = Math.sin(theta);
  const sinTheta0 = Math.sin(theta0);

  const s0 = Math.cos(theta) - dot * sinTheta / sinTheta0;
  const s1 = sinTheta / sinTheta0;

  return [
    s0 * ax + s1 * bx,
    s0 * ay + s1 * by,
    s0 * az + s1 * bz,
    s0 * aw + s1 * bw,
  ];
}

function getControlValues(spec: Base.Spec, payload: any): Record<string, number> {
  const current: Record<string, number> = {};
  if (!payload || typeof payload !== 'object') return current;

  if (spec.type === Controls.Joystick.Spec.type) {
    if (isNumber(payload.x)) current.x = payload.x;
    if (isNumber(payload.y)) current.y = payload.y;
    return current;
  }
  if (spec.type === Controls.Switch.Spec.type) {
    if (typeof payload.on === 'boolean') current.on = payload.on ? 1 : 0;
    return current;
  }
  if (spec.type === Controls.Selector.Spec.type) {
    if (isNumber(payload.index)) current.index = payload.index;
    return current;
  }
  if (spec.type === Controls.Player3D.Spec.type) {
    const position = Array.isArray(payload.position) ? payload.position : [];
    const rotation = Array.isArray(payload.rotation) ? payload.rotation : [];
    if (isNumber(position[0])) current.x = position[0];
    if (isNumber(position[1])) current.y = position[1];
    if (isNumber(position[2])) current.z = position[2];
    if (isNumber(rotation[0])) current.qx = rotation[0];
    if (isNumber(rotation[1])) current.qy = rotation[1];
    if (isNumber(rotation[2])) current.qz = rotation[2];
    if (isNumber(rotation[3])) current.qw = rotation[3];
    return current;
  }
  if (isNumber(payload.value)) current.value = payload.value;
  return current;
}

function getLaneValueMap(spec: Base.Spec, currentValues: Record<string, number>, laneValues: Record<string, number>): Record<string, number> {
  if (spec.type === Controls.Joystick.Spec.type) {
    return {
      x: laneValues.x ?? currentValues.x ?? 0,
      y: laneValues.y ?? currentValues.y ?? 0,
    };
  }
  if (spec.type === Controls.Switch.Spec.type) {
    return { on: laneValues.on ?? laneValues.value ?? currentValues.on ?? 0 };
  }
  if (spec.type === Controls.Selector.Spec.type) {
    return { index: laneValues.index ?? laneValues.value ?? currentValues.index ?? 0 };
  }
  if (spec.type === Controls.Player3D.Spec.type) {
    return {
      x: laneValues.x ?? currentValues.x ?? 0,
      y: laneValues.y ?? currentValues.y ?? 0,
      z: laneValues.z ?? currentValues.z ?? 0,
      qx: laneValues.qx ?? currentValues.qx ?? 0,
      qy: laneValues.qy ?? currentValues.qy ?? 0,
      qz: laneValues.qz ?? currentValues.qz ?? 0,
      qw: laneValues.qw ?? currentValues.qw ?? 1,
    };
  }
  return { value: laneValues.value ?? currentValues.value ?? 0 };
}

function getSpecRange(spec: Base.Spec): { min?: number; max?: number } {
  if (spec.type === Controls.Fader.Spec.type || spec.type === Controls.Knob.Spec.type) {
    const s = spec as Controls.Fader.Spec;
    return { min: s.min, max: s.max };
  }
  if (spec.type === Controls.Switch.Spec.type) {
    return { min: 0, max: 1 };
  }
  if (spec.type === Controls.Selector.Spec.type) {
    const s = spec as Controls.Selector.Spec;
    return { min: 0, max: Math.max(0, s.options.length - 1) };
  }
  if (spec.type === Controls.Joystick.Spec.type) {
    return { min: -1, max: 1 };
  }
  if (spec.type === Controls.Player3D.Spec.type) {
    return { min: -1, max: 1 };
  }
  return {};
}

function applyLaneValues(receiver: Base.Receiver, spec: Base.Spec, values: Record<string, number>) {
  Base.Receiver.withUpdateOrigin({ kind: 'timeline' }, () => {
    if (spec.type === Controls.Fader.Spec.type || spec.type === Controls.Knob.Spec.type) {
      const value = values.value;
      if (isNumber(value)) {
        receiver.handleSignal({ value });
      }
      return;
    }
    if (spec.type === Controls.Switch.Spec.type) {
      const on = values.on ?? values.value;
      if (isNumber(on)) {
        receiver.handleSignal({ on: on >= 0.5 });
      }
      return;
    }
    if (spec.type === Controls.Joystick.Spec.type) {
      const x = values.x ?? 0;
      const y = values.y ?? 0;
      if (isNumber(x) && isNumber(y)) {
        receiver.handleSignal({ x, y });
      }
      return;
    }
    if (spec.type === Controls.Selector.Spec.type) {
      const index = values.index ?? values.value;
      if (isNumber(index)) {
        receiver.handleSignal({ index: Math.round(index) });
      }
      return;
    }
    if (spec.type === Controls.Player3D.Spec.type) {
      const position: [number, number, number] = [
        values.x ?? 0,
        values.y ?? 0,
        values.z ?? 0,
      ];
      const rotation = normalizeQuaternion([
        values.qx ?? 0,
        values.qy ?? 0,
        values.qz ?? 0,
        values.qw ?? 1,
      ]);
      receiver.handleSignal({ position, rotation });
    }
  });
}

function getQuaternionLaneValue(
  state: ControlAutomationState,
  laneKey: 'qx' | 'qy' | 'qz' | 'qw',
  time: number,
  useRenderLanes: boolean,
): number | null {
  const lane = state.lanes.find(candidate => candidate.key === laneKey);
  if (!lane) return null;
  const points = useRenderLanes && lane.renderPoints !== undefined ? lane.renderPoints : lane.points;
  return evalLane(points, time, 32, -1, 1);
}

function getQuaternionAtTime(
  state: ControlAutomationState,
  time: number,
  useRenderLanes: boolean,
  fallback: [number, number, number, number],
): [number, number, number, number] {
  const lanes = ['qx', 'qy', 'qz', 'qw'] as const;
  const keyTimes = new Set<number>();

  for (const laneKey of lanes) {
    const lane = state.lanes.find(candidate => candidate.key === laneKey);
    if (!lane) continue;
    const points = useRenderLanes && lane.renderPoints !== undefined ? lane.renderPoints : lane.points;
    for (const point of points) {
      if ((point.kind ?? 'pos') === 'pos') {
        keyTimes.add(point.t);
      }
    }
  }

  if (keyTimes.size === 0) {
    return fallback;
  }

  const sortedTimes = Array.from(keyTimes).sort((a, b) => a - b);
  const first = sortedTimes[0]!;
  const last = sortedTimes[sortedTimes.length - 1]!;

  const sampleQuaternion = (sampleTime: number) => normalizeQuaternion([
    getQuaternionLaneValue(state, 'qx', sampleTime, useRenderLanes) ?? fallback[0],
    getQuaternionLaneValue(state, 'qy', sampleTime, useRenderLanes) ?? fallback[1],
    getQuaternionLaneValue(state, 'qz', sampleTime, useRenderLanes) ?? fallback[2],
    getQuaternionLaneValue(state, 'qw', sampleTime, useRenderLanes) ?? fallback[3],
  ]);

  if (time <= first) {
    return sampleQuaternion(first);
  }
  if (time >= last) {
    return sampleQuaternion(last);
  }

  let previousTime = first;
  let nextTime = last;
  for (let i = 0; i < sortedTimes.length - 1; i++) {
    const a = sortedTimes[i]!;
    const b = sortedTimes[i + 1]!;
    if (time >= a && time <= b) {
      previousTime = a;
      nextTime = b;
      break;
    }
  }

  if (nextTime <= previousTime) {
    return sampleQuaternion(previousTime);
  }

  const from = sampleQuaternion(previousTime);
  const to = sampleQuaternion(nextTime);
  const factor = (time - previousTime) / (nextTime - previousTime);
  return slerpQuaternion(from, to, factor);
}

export class Timeline {
  private controlIndex = new Map<string, ControlIndexEntry>();
  private automationState = new Map<string, ControlAutomationState>();
  private lastValues = new Map<string, Record<string, number>>();

  private lastDelta = 0;
  private lastWorldDelta = 0;
  public time = 0;
  public playing = false;
  public alwaysRender = true;
  public loopEnabled = false;
  public loopDurationSec = 4;
  private timelineState: TimelineStateKind = 'paused';
  private renderingDelta = 1 / 30;
  private _debug = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('timeline-debug') === '1';
  private _debugVerbose = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('timeline-debug-verbose') === '1';
  private _logTimeEachFrame = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('timeline-log-time') === '1';
  private _debugLastAt = 0;
  private _debugFrames = 0;

  // Render loop state
  private _rafId = 0;
  private _lastFrameTime = 0;
  private _running = false;
  private _pendingRender = false;
  private _pendingRenderFrame = false;
  private _onRender: ((timeContext: TimeContext) => void | Promise<void>) | null = null;
  private controlChangeDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private controlChangeDebounceMs = 500;

  public onMessage: ((message: any) => void) | null = null;

  constructor(
    private rootReceiver: Base.Receiver,
    options?: TimelineOptions,
  ) {
    this.time = options?.initialTime ?? 0;
    this.playing = options?.autoplay ?? false;
    this.timelineState = options?.initialState ?? (this.playing ? 'playing' : 'paused');
    this.alwaysRender = options?.alwaysRender ?? true;
    this.loopEnabled = options?.loopEnabled ?? false;
    this.loopDurationSec = options?.loopDurationSec ?? 4;
    this._onRender = options?.onRender ?? null;
    this.buildIndex();
  }

  /**
   * Start the render loop. The Timeline will call onRender each frame.
   */
  start() {
    if (this._running) return;
    this._running = true;
    this._lastFrameTime = performance.now();
    this._scheduleFrame();
  }

  /**
   * Stop the render loop.
   */
  stop() {
    this._running = false;
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = 0;
    }
  }

  /**
   * Request a single render frame (useful when paused and alwaysRender is off).
   */
  requestRender() {
    this._pendingRender = true;
    if (!this._running) {
      this._lastFrameTime = performance.now();
      this._scheduleFrame();
    }
  }

  requestRenderFrame() {
    this._pendingRenderFrame = true;
    this.requestRender();
  }

  private _scheduleFrame() {
    this._rafId = requestAnimationFrame(this._loop.bind(this));
  }

  private async _loop() {
    this._rafId = 0;
    const now = performance.now();
    const deltaMs = now - this._lastFrameTime;
    this._lastFrameTime = now;
    const worldDeltaSeconds = deltaMs * 0.001;
    const renderPass = this.timelineState === 'rendering' || this._pendingRenderFrame;
    const deltaSeconds = this.timelineState === 'rendering'
      ? this.renderingDelta
      : worldDeltaSeconds;
    const previousState = renderPass ? this.rootReceiver.getState() : null;
    const frameState: TimelineStateKind = renderPass ? 'rendering' : this.state();

    // Advance time and apply automation
    this.tick(deltaSeconds, worldDeltaSeconds, renderPass);
    if (this.timelineState === 'playing' || this.timelineState === 'rendering') {
      this.sendState();
    }
    this._debugFrames += 1;
    if (this._logTimeEachFrame) {
      console.log(
        `[Timeline][time] state=${this.timelineState}`
        + ` now=${this.time.toFixed(6)}`
        + ` delta=${this.lastDelta.toFixed(6)}`
        + ` worldDelta=${this.lastWorldDelta.toFixed(6)}`
      );
    }
    this._logVerbose(
      `frame state=${this.timelineState} now=${this.time.toFixed(3)} dt=${deltaSeconds.toFixed(4)}`
    );

    // Call render callback with timeline-owned context.
    if (this._onRender) {
      try {
        await this._onRender(this.getTimeContext(frameState));
      } catch (error) {
        console.error('[Timeline] onRender failed:', error);
      }
    }
    if (previousState) {
      this.rootReceiver.restoreState(previousState);
    }

    // Decide whether to continue
    const shouldContinue = this._running
      && (this.timelineState === 'playing' || this.timelineState === 'rendering' || this.alwaysRender || this._pendingRender);
    this._pendingRender = false;
    this._pendingRenderFrame = false;

    if (shouldContinue) {
      this._scheduleFrame();
    }
  }

  private _ensureLoopRunning() {
    if (this._running && !this._rafId) {
      this._lastFrameTime = performance.now();
      this._scheduleFrame();
    }
  }

  now() {
    return this.time;
  }

  state(): TimelineStateKind {
    return this.timelineState;
  }

  setState(state: TimelineStateKind) {
    const prev = this.timelineState;
    this.timelineState = state;
    this.playing = state === 'playing';
    if (this._debug && prev !== state) {
      console.log(`[Timeline] state ${prev} -> ${state} @ t=${this.time.toFixed(3)}`);
    }
    if (state === 'playing' || state === 'rendering') {
      this._ensureLoopRunning();
    }
  }

  private isRunningState(state: TimelineStateKind) {
    return state === 'playing' || state === 'rendering';
  }

  private applyTimelineState(state: TimelineStateKind) {
    const wasRunning = this.isRunningState(this.timelineState);
    this.setState(state);
    const isRunning = this.isRunningState(state);
    if (!wasRunning && isRunning) {
      this._ensureLoopRunning();
    }
  }

  setRenderingFps(fps: number) {
    if (!Number.isFinite(fps) || fps <= 0) return;
    this.renderingDelta = 1 / fps;
    if (this._debug) {
      console.log(`[Timeline] rendering fps=${fps.toFixed(3)} delta=${this.renderingDelta.toFixed(6)}s`);
    }
  }

  getTimeContext(stateOverride?: TimelineStateKind): TimeContext {
    return {
      now: this.time,
      deltaTime: this.lastDelta,
      worldDeltaTime: this.lastWorldDelta,
      state: stateOverride ?? this.state(),
    };
  }

  deltaTime() {
    return this.lastDelta;
  }

  tick(deltaSeconds: number, worldDeltaSeconds = deltaSeconds, useRenderLanes = false) {
    this.lastWorldDelta = worldDeltaSeconds;
    if (this.timelineState === 'playing' || this.timelineState === 'rendering') {
      this.lastDelta = deltaSeconds;
      let nextTime = this.time + deltaSeconds;
      if (this.loopEnabled && this.loopDurationSec > 0 && nextTime >= this.loopDurationSec) {
        nextTime = 0;
      }
      this.time = Math.max(0, nextTime);
      this.applyAutomation(useRenderLanes);
    } else {
      this.lastDelta = 0;
      if (useRenderLanes) {
        this.applyAutomation(true);
      }
    }
    this._logStatsOncePerSecond();
  }

  seek(time: number) {
    this.time = Math.max(0, time);
    this.lastDelta = 0;
    this.applyAutomation();
    this._logVerbose(`seek now=${this.time.toFixed(3)}`);
  }

  setPlaying(playing: boolean) {
    this.setState(playing ? 'playing' : 'paused');
  }

  private _logVerbose(message: string) {
    if (!this._debug || !this._debugVerbose) return;
    console.log(`[Timeline][v] ${message}`);
  }

  private _logStatsOncePerSecond() {
    if (!this._debug) return;
    const now = performance.now();
    if (this._debugLastAt === 0) {
      this._debugLastAt = now;
      return;
    }
    const dt = (now - this._debugLastAt) / 1000;
    if (dt < 1) return;
    const fps = this._debugFrames / dt;
    console.log(
      `[Timeline][stats] state=${this.timelineState}`
      + ` t=${this.time.toFixed(3)} dt=${this.lastDelta.toFixed(4)} worldDt=${this.lastWorldDelta.toFixed(4)}`
      + ` fps=${fps.toFixed(1)} alwaysRender=${this.alwaysRender}`
    );
    this._debugLastAt = now;
    this._debugFrames = 0;
  }

  handleMessage(message: any) {
    if (message?.type === TimelineRequestState.type) {
      this.sendState();
      return;
    }
    if (message?.type === TimelineEditMessage.type) {
      const payload = message as TimelineEditMessage;
      this.applyEdit(payload.edit, payload.seq);
      this.sendState(payload.seq);
    }
  }

  onControlSignal(signal: Base.Signal) {
    const { path } = extractSignalPath(signal);
    const key = getPathKey(path);
    const state = this.automationState.get(key);
    if (state) {
      state.enabled = false;
      state.manualOverride = true;
    }
    this.scheduleControlChangeRender();
  }

  private scheduleControlChangeRender() {
    // If already rendering continuously, no need to debounce
    if (this.playing || this.alwaysRender) return;

    if (this.controlChangeDebounceTimer) {
      clearTimeout(this.controlChangeDebounceTimer);
    }
    this.controlChangeDebounceTimer = setTimeout(() => {
      this.controlChangeDebounceTimer = null;
      this.requestRender();
    }, this.controlChangeDebounceMs);
  }

  onControlUpdate(update: Base.Update) {
    const { path, leaf } = extractUpdatePath(update);
    const key = getPathKey(path);
    const entry = this.controlIndex.get(key);
    if (!entry) return;
    const current = this.lastValues.get(key) ?? {};
    if (entry.spec.type === Controls.Fader.Spec.type || entry.spec.type === Controls.Knob.Spec.type) {
      const value = (leaf as any)?.value;
      if (isNumber(value)) current.value = value;
    } else if (entry.spec.type === Controls.Switch.Spec.type) {
      const on = (leaf as any)?.on;
      if (typeof on === 'boolean') current.on = on ? 1 : 0;
    } else if (entry.spec.type === Controls.Joystick.Spec.type) {
      const x = (leaf as any)?.x;
      const y = (leaf as any)?.y;
      if (isNumber(x)) current.x = x;
      if (isNumber(y)) current.y = y;
    } else if (entry.spec.type === Controls.Player3D.Spec.type) {
      Object.assign(current, getControlValues(entry.spec, leaf));
    } else if (entry.spec.type === Controls.Selector.Spec.type) {
      const index = (leaf as any)?.index;
      if (isNumber(index)) current.index = index;
    }
    this.lastValues.set(key, current);
  }

  private buildIndex() {
    this.controlIndex.clear();
    walkReceivers(this.rootReceiver, [], (entry) => {
      if (isContainerSpec(entry.spec)) return;
      const key = getPathKey(entry.path);
      this.controlIndex.set(key, entry);
      this.lastValues.set(key, getControlValues(entry.spec, entry.receiver.getState()));
    });
  }

  private ensureControlState(path: ControlPath): ControlAutomationState {
    const key = getPathKey(path);
    let state = this.automationState.get(key);
    if (!state) {
      state = {
        path,
        enabled: true,
        manualOverride: false,
        lanes: [],
      };
      this.automationState.set(key, state);
    }
    return state;
  }

  private applyEdit(edit: TimelineEdit, seq?: number) {
    switch (edit.type) {
      case 'set-control-enabled': {
        const state = this.ensureControlState(edit.path);
        state.enabled = edit.enabled;
        if (edit.enabled) {
          state.manualOverride = false;
        }
        break;
      }
      case 'set-lane-enabled': {
        const state = this.ensureControlState(edit.path);
        const lane = state.lanes.find(l => l.key === edit.laneKey);
        if (lane) lane.enabled = edit.enabled;
        break;
      }
      case 'set-lane-points': {
        const state = this.ensureControlState(edit.path);
        const lane = state.lanes.find(l => l.key === edit.laneKey);
        if (lane) {
          lane.points = ensureSorted(edit.points);
          if (seq !== undefined) lane.seq = seq;
        }
        break;
      }
      case 'set-render-lane-points': {
        const state = this.ensureControlState(edit.path);
        const lane = state.lanes.find(l => l.key === edit.laneKey);
        if (lane) {
          lane.renderPoints = ensureSorted(edit.points);
          if (seq !== undefined) lane.renderSeq = seq;
        }
        break;
      }
      case 'add-lane': {
        const state = this.ensureControlState(edit.path);
        const exists = state.lanes.find(l => l.key === edit.lane.key);
        if (!exists) {
          state.lanes.push({
            ...edit.lane,
            points: ensureSorted(edit.lane.points ?? []),
          });
        }
        break;
      }
      case 'add-render-lane': {
        const state = this.ensureControlState(edit.path);
        const lane = state.lanes.find(l => l.key === edit.laneKey);
        if (lane && lane.renderPoints === undefined) {
          lane.renderPoints = [];
        }
        break;
      }
      case 'remove-lane': {
        const state = this.ensureControlState(edit.path);
        state.lanes = state.lanes.filter(l => l.key !== edit.laneKey);
        break;
      }
      case 'remove-render-lane': {
        const state = this.ensureControlState(edit.path);
        const lane = state.lanes.find(l => l.key === edit.laneKey);
        if (lane) {
          delete lane.renderPoints;
          delete lane.renderSeq;
        }
        break;
      }
      case 'set-playing': {
        this.applyTimelineState(edit.playing ? 'playing' : 'paused');
        break;
      }
      case 'set-state': {
        this.applyTimelineState(edit.state);
        break;
      }
      case 'render-frame': {
        this.requestRenderFrame();
        break;
      }
      case 'seek': {
        this.seek(edit.time);
        this.requestRender();
        break;
      }
      case 'set-always-render': {
        const wasAlwaysRender = this.alwaysRender;
        this.alwaysRender = edit.alwaysRender;
        if (!wasAlwaysRender && edit.alwaysRender) {
          this._ensureLoopRunning();
        }
        break;
      }
      case 'set-loop-enabled': {
        this.loopEnabled = edit.loopEnabled;
        break;
      }
      case 'set-loop-duration': {
        if (Number.isFinite(edit.loopDurationSec) && edit.loopDurationSec > 0) {
          this.loopDurationSec = edit.loopDurationSec;
          if (this.loopEnabled && this.time >= this.loopDurationSec) {
            this.time = this.time % this.loopDurationSec;
          }
        }
        break;
      }
    }
  }

  private applyAutomation(useRenderLanes = false) {
    for (const [key, state] of this.automationState.entries()) {
      if (!state.enabled || state.manualOverride) continue;
      const entry = this.controlIndex.get(key);
      if (!entry) continue;

      const laneValues: Record<string, number> = {};
      const range = getSpecRange(entry.spec);
      for (const lane of state.lanes) {
        if (!lane.enabled) continue;
        const points = useRenderLanes && lane.renderPoints !== undefined
          ? lane.renderPoints
          : lane.points;
        const value = evalLane(points, this.time, 32, range.min, range.max);
        if (value === null) continue;
        laneValues[lane.key] = value;
      }
      if (Object.keys(laneValues).length === 0) continue;

      if (entry.spec.type === Controls.Player3D.Spec.type) {
        const currentValues = this.lastValues.get(key) ?? {};
        const quaternion = getQuaternionAtTime(
          state,
          this.time,
          useRenderLanes,
          normalizeQuaternion([
            currentValues.qx ?? 0,
            currentValues.qy ?? 0,
            currentValues.qz ?? 0,
            currentValues.qw ?? 1,
          ]),
        );
        laneValues.qx = quaternion[0];
        laneValues.qy = quaternion[1];
        laneValues.qz = quaternion[2];
        laneValues.qw = quaternion[3];
      }

      const mapped = getLaneValueMap(entry.spec, this.lastValues.get(key) ?? {}, laneValues);
      applyLaneValues(entry.receiver, entry.spec, mapped);
    }
  }

  private buildStateSnapshot(): TimelineState {
    return {
      time: this.time,
      state: this.timelineState,
      playing: this.playing,
      alwaysRender: this.alwaysRender,
      loopEnabled: this.loopEnabled,
      loopDurationSec: this.loopDurationSec,
      controls: Array.from(this.automationState.values()).map(control => ({
        path: [...control.path],
        enabled: control.enabled,
        manualOverride: control.manualOverride,
        lanes: control.lanes.map(lane => ({
          ...lane,
          points: [...lane.points],
          renderPoints: lane.renderPoints ? [...lane.renderPoints] : undefined,
        })),
      })),
    };
  }

  private sendState(seq?: number) {
    if (!this.onMessage) return;
    const state = this.buildStateSnapshot();
    this.onMessage(new TimelineStateMessage(state, seq));
  }

  getState(): TimelineState {
    return this.buildStateSnapshot();
  }
}

export type {
  TimelineState,
  TimelineControl,
  TimelineLane,
  TimelinePoint,
  TimelineEdit,
  TimelineOptions,
};

export * from './client';
export * from './curve';

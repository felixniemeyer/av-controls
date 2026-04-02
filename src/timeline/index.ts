import * as Controls from '../controls';
import { Base } from '../controls';
import type {
  TimelineState,
  TimelineControl,
  TimelineLane,
  TimelineCurveLane,
  TimelineStepLane,
  TimelineTriggerLane,
  TimelineTrigger,
  TimelineKeyframeLane,
  TimelinePoint,
  TimelineKeyframe,
  TimelineEdit,
  RenderConfig,
} from '../messages';
import {
  TimelineStateMessage,
  TimelineEditMessage,
  TimelineRequestState,
} from '../messages';
import { evalLane, evalStepLane } from './curve';
import { getTimelineAdapter, sortTimelineKeyframes } from './adapters';

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

function ensureSortedTriggers(triggers: TimelineTrigger[]): TimelineTrigger[] {
  return [...triggers]
    .map(trigger => ({
      on: { t: trigger.on.t, value: trigger.on.value },
      off: { t: trigger.off.t },
    }))
    .sort((a, b) => a.on.t - b.on.t);
}

function flattenTriggerLane(lane: TimelineTriggerLane): TimelinePoint[] {
  const points: TimelinePoint[] = [];
  for (const trigger of lane.triggers) {
    points.push(
      { t: trigger.on.t, v: trigger.on.value, kind: 'pos' as const },
      { t: trigger.off.t, v: -0.5, kind: 'pos' as const },
    );
  }
  return points;
}

function evalTriggerLane(lane: TimelineTriggerLane, time: number): number | null {
  const triggers = ensureSortedTriggers(lane.triggers);
  if (!triggers.length) return null;
  for (const trigger of triggers) {
    if (time < trigger.on.t) {
      return -0.5;
    }
    if (time < trigger.off.t) {
      return Math.max(0, trigger.on.value);
    }
  }
  return -0.5;
}

function isBezierCurveLane(lane: TimelineLane): lane is TimelineCurveLane {
  return lane.type !== 'keyframes' && lane.type !== 'step' && lane.type !== 'trigger';
}

function isStepLane(lane: TimelineLane): lane is TimelineStepLane {
  return lane.type === 'step';
}

function isTriggerLane(lane: TimelineLane): lane is TimelineTriggerLane {
  return lane.type === 'trigger';
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

function getControlValues(spec: Base.Spec, payload: any): Record<string, number> {
  const current: Record<string, number> = {};
  if (!payload || typeof payload !== 'object') return current;

  if (spec.type === Controls.Joystick.Spec.type) {
    if (isNumber(payload.x)) current.x = payload.x;
    if (isNumber(payload.y)) current.y = payload.y;
    return current;
  }
  if (spec.type === Controls.Switch.Spec.type) {
    if (typeof payload.on === 'boolean') current.on = payload.on ? 0 : -1;
    return current;
  }
  if (spec.type === Controls.ConfirmSwitch.Spec.type) {
    if (typeof payload.on === 'boolean') current.on = payload.on ? 0 : -1;
    return current;
  }
  if (spec.type === Controls.Pad.Spec.type) {
    if (typeof payload.pressed === 'boolean') {
      const velocity = isNumber(payload.velocity) ? payload.velocity : (payload.pressed ? 1 : 0);
      current.value = payload.pressed ? Math.max(0, velocity) : -1;
    }
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
    return { on: laneValues.on ?? laneValues.value ?? currentValues.on ?? -1 };
  }
  if (spec.type === Controls.ConfirmSwitch.Spec.type) {
    return { on: laneValues.on ?? laneValues.value ?? currentValues.on ?? -1 };
  }
  if (spec.type === Controls.Pad.Spec.type) {
    return { value: laneValues.value ?? currentValues.value ?? -1 };
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

function didTriggerStateChange(spec: Base.Spec, previousValues: Record<string, number>, nextValues: Record<string, number>) {
  if (spec.type === Controls.Switch.Spec.type || spec.type === Controls.ConfirmSwitch.Spec.type) {
    const prev = previousValues.on ?? previousValues.value ?? -1;
    const next = nextValues.on ?? nextValues.value ?? -1;
    return (prev >= 0) !== (next >= 0);
  }
  if (spec.type === Controls.Pad.Spec.type) {
    const prev = previousValues.value ?? -1;
    const next = nextValues.value ?? -1;
    return Math.abs(prev - next) > 1e-6;
  }
  return true;
}

function getSpecRange(spec: Base.Spec): { min?: number; max?: number; wrap?: boolean } {
  if (spec.type === Controls.Fader.Spec.type || spec.type === Controls.Knob.Spec.type) {
    const s = spec as Controls.Fader.Spec | Controls.Knob.Spec;
    return { min: s.min, max: s.max, wrap: 'wrap' in s ? s.wrap : false };
  }
  if (spec.type === Controls.Switch.Spec.type) {
    return { min: -1 };
  }
  if (spec.type === Controls.ConfirmSwitch.Spec.type) {
    return { min: -1 };
  }
  if (spec.type === Controls.Pad.Spec.type) {
    return { min: -1 };
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
        receiver.handleSignal({ on: on >= 0 });
      }
      return;
    }
    if (spec.type === Controls.ConfirmSwitch.Spec.type) {
      const on = values.on ?? values.value;
      if (isNumber(on)) {
        receiver.handleSignal({ on: on >= 0 });
      }
      return;
    }
    if (spec.type === Controls.Pad.Spec.type) {
      const value = values.value ?? -1;
      if (isNumber(value)) {
        receiver.handleSignal({
          pressed: value >= 0,
          velocity: value >= 0 ? Math.max(0, value) : 0,
        });
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

function applyTimelinePayload(receiver: Base.Receiver, spec: Base.Spec, payload: unknown) {
  Base.Receiver.withUpdateOrigin({ kind: 'timeline' }, () => {
    if (spec.type === Controls.Player3D.Spec.type) {
      const value = payload as Controls.Player3D.State | Controls.Player3D.Signal;
      receiver.handleSignal({
        position: value.position,
        rotation: normalizeQuaternion(value.rotation),
      });
      return;
    }
    if (spec.type === Controls.Dots.Spec.type) {
      const value = payload as Controls.Dots.State | Controls.Dots.Update;
      receiver.handleSignal({
        type: 'full',
        dots: value.values.map(dot => [dot[0], dot[1]]),
      });
    }
  });
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
  private renderSequenceConfig: RenderConfig | null = null;
  private _debug = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('timeline-debug') === '1';
  private _debugVerbose = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('timeline-debug-verbose') === '1';
  private _logTimeEachFrame = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('timeline-log-time') === '1';
  private _triggerLog = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('timeline-trigger-log') === '1';
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
  private stateSeq = 0;

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

    // Check if render sequence should stop
    if (this.renderSequenceConfig && this.timelineState === 'rendering') {
      const config = this.renderSequenceConfig

      // Check if we've reached the end time
      if (this.time >= config.endTime) {
        console.log('[Timeline] Render sequence complete: reached end time')
        this.renderSequenceConfig = null
        this.setState('paused')
      }
      // Check if we've hit the frame limit (test mode)
      else if (config.testMode && config.frameLimit) {
        const frameNumber = Math.floor((this.time - config.startTime) / this.renderingDelta)
        if (frameNumber >= config.frameLimit - 1) {
          console.log('[Timeline] Render sequence paused: reached frame limit')
          // Don't null out config - it will be resumed or cancelled
          this.setState('paused')
        }
      }
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
    if (!this.alwaysRender && this.timelineState === 'scrubbing') {
      this.requestRender();
    }
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
      if (typeof on === 'boolean') current.on = on ? 0 : -1;
    } else if (entry.spec.type === Controls.ConfirmSwitch.Spec.type) {
      const on = (leaf as any)?.on;
      if (typeof on === 'boolean') current.on = on ? 0 : -1;
    } else if (entry.spec.type === Controls.Pad.Spec.type) {
      const pressed = (leaf as any)?.pressed;
      if (typeof pressed === 'boolean') {
        const velocity = isNumber((leaf as any)?.velocity) ? (leaf as any).velocity : (pressed ? 1 : 0);
        current.value = pressed ? Math.max(0, velocity) : -1;
      }
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
    if (this._triggerLog) {
      const adapter = getTimelineAdapter(entry.spec);
      if (adapter.kind === 'trigger') {
        console.info('[timeline:trigger:update]', {
          path: key,
          update,
          current,
        });
      }
    }
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
        if (lane && lane.type !== 'keyframes' && lane.type !== 'trigger') {
          lane.points = ensureSorted(edit.points);
          if (seq !== undefined) lane.seq = seq;
        }
        break;
      }
      case 'set-lane-triggers': {
        const state = this.ensureControlState(edit.path);
        const lane = state.lanes.find(l => l.key === edit.laneKey);
        if (lane && lane.type === 'trigger') {
          lane.triggers = ensureSortedTriggers(edit.triggers);
          if (seq !== undefined) lane.seq = seq;
          if (this._triggerLog) {
            console.info('[timeline:trigger:apply-edit]', {
              path: edit.path.join('.'),
              laneKey: edit.laneKey,
              seq,
              triggerCount: lane.triggers.length,
              triggers: lane.triggers.map(trigger => ({
                onT: trigger.on.t,
                onValue: trigger.on.value,
                offT: trigger.off.t,
              })),
            });
          }
        }
        break;
      }
      case 'set-lane-keyframes': {
        const state = this.ensureControlState(edit.path);
        const lane = state.lanes.find(l => l.key === edit.laneKey);
        if (lane && lane.type === 'keyframes') {
          lane.keyframes = sortTimelineKeyframes(edit.keyframes);
          if (seq !== undefined) lane.seq = seq;
        }
        break;
      }
      case 'set-render-lane-points': {
        const state = this.ensureControlState(edit.path);
        const lane = state.lanes.find(l => l.key === edit.laneKey);
        if (lane && isBezierCurveLane(lane)) {
          lane.renderPoints = ensureSorted(edit.points);
          if (seq !== undefined) lane.renderSeq = seq;
        }
        break;
      }
      case 'add-lane': {
        const state = this.ensureControlState(edit.path);
        const exists = state.lanes.find(l => l.key === edit.lane.key);
        if (!exists) {
          if (edit.lane.type === 'keyframes') {
            state.lanes.push({
              ...edit.lane,
              keyframes: sortTimelineKeyframes(edit.lane.keyframes ?? []),
            });
          } else if (edit.lane.type === 'step' || edit.lane.type === 'trigger') {
            if (edit.lane.type === 'trigger') {
              state.lanes.push({
                ...edit.lane,
                triggers: ensureSortedTriggers(edit.lane.triggers ?? []),
              });
              if (this._triggerLog) {
                console.info('[timeline:trigger:add-lane]', {
                  path: edit.path.join('.'),
                  laneKey: edit.lane.key,
                  triggerCount: edit.lane.triggers?.length ?? 0,
                });
              }
            } else {
              state.lanes.push({
                ...edit.lane,
                points: ensureSorted(edit.lane.points ?? []),
              });
            }
          } else {
            state.lanes.push({
              ...edit.lane,
              points: ensureSorted(edit.lane.points ?? []),
            });
          }
        }
        break;
      }
      case 'add-render-lane': {
        const state = this.ensureControlState(edit.path);
        const lane = state.lanes.find(l => l.key === edit.laneKey);
        if (lane && isBezierCurveLane(lane) && lane.renderPoints === undefined) {
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
        if (lane && isBezierCurveLane(lane)) {
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
      case 'start-render-sequence': {
        this.renderSequenceConfig = edit.config;
        this.setRenderingFps(edit.config.fps);
        this.seek(edit.config.startTime);
        this.setState('rendering');
        console.log('[Timeline] Starting render sequence:', edit.config);
        break;
      }
      case 'pause-render-sequence': {
        if (this.renderSequenceConfig) {
          this.renderSequenceConfig.testMode = false;
          this.renderSequenceConfig.frameLimit = undefined;
          console.log('[Timeline] Resuming render sequence');
        }
        break;
      }
      case 'cancel-render-sequence': {
        this.renderSequenceConfig = null;
        this.setState('paused');
        console.log('[Timeline] Cancelled render sequence');
        break;
      }
    }
  }

  private applyAutomation(useRenderLanes = false) {
    for (const [key, state] of this.automationState.entries()) {
      if (!state.enabled || state.manualOverride) continue;
      const entry = this.controlIndex.get(key);
      if (!entry) continue;
      const adapter = getTimelineAdapter(entry.spec);

      if (adapter.kind === 'keyframes') {
        const lane = state.lanes.find(candidate => candidate.enabled && candidate.type === 'keyframes');
        if (!lane || !adapter.evaluateKeyframes) continue;
        const payload = adapter.evaluateKeyframes(lane, this.time);
        if (payload === null || payload === undefined) continue;
        applyTimelinePayload(entry.receiver, entry.spec, payload);
        this.lastValues.set(key, getControlValues(entry.spec, payload));
        continue;
      }

      const laneValues: Record<string, number> = {};
      const range = getSpecRange(entry.spec);
      for (const lane of state.lanes) {
        if (!lane.enabled || lane.type === 'keyframes') continue;
        const value = lane.type === 'trigger'
          ? evalTriggerLane(lane, this.time)
          : (() => {
              const points = isBezierCurveLane(lane) && useRenderLanes && lane.renderPoints !== undefined
                ? lane.renderPoints
                : lane.points;
              return adapter.kind === 'step' || isStepLane(lane)
                ? evalStepLane(points, this.time, range.min, range.max)
                : evalLane(points, this.time, 32, range.min, range.max, range.wrap ?? false);
            })();
        if (value === null) continue;
        laneValues[lane.key] = value;
      }
      if (Object.keys(laneValues).length === 0) continue;

      const previousValues = this.lastValues.get(key) ?? {};
      const mapped = getLaneValueMap(entry.spec, previousValues, laneValues);
      if (this._triggerLog && adapter.kind === 'trigger') {
        console.info('[timeline:trigger:evaluate]', {
          path: key,
          time: this.time,
          state: this.timelineState,
          lanes: state.lanes
            .filter((lane): lane is TimelineTriggerLane => lane.enabled && lane.type === 'trigger')
            .map(lane => ({
              laneKey: lane.key,
              evaluated: laneValues[lane.key],
              triggers: lane.triggers.map(trigger => ({
                onT: trigger.on.t,
                onValue: trigger.on.value,
                offT: trigger.off.t,
              })),
            })),
          previousValues,
          mapped,
        });
      }
      if (adapter.kind === 'trigger' && !didTriggerStateChange(entry.spec, previousValues, mapped)) {
        this.lastValues.set(key, mapped);
        continue;
      }
      applyLaneValues(entry.receiver, entry.spec, mapped);
      if (this._triggerLog && adapter.kind === 'trigger') {
        console.info('[timeline:trigger:emit]', {
          path: key,
          time: this.time,
          mapped,
        });
      }
      this.lastValues.set(key, mapped);
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
        lanes: control.lanes.map(lane => {
          if (lane.type === 'keyframes') {
            return {
              ...lane,
              keyframes: lane.keyframes.map((keyframe: TimelineKeyframe) => ({
                ...keyframe,
                value: JSON.parse(JSON.stringify(keyframe.value)),
              })),
            };
          }
          return {
            ...lane,
            ...(lane.type === 'trigger'
              ? {
                  triggers: lane.triggers.map(trigger => ({
                    on: { ...trigger.on },
                    off: { ...trigger.off },
                  })),
                }
              : {
                  points: [...lane.points],
                  renderPoints: isBezierCurveLane(lane) && lane.renderPoints !== undefined ? [...lane.renderPoints] : undefined,
                }),
          };
        }),
      })),
    };
  }

  private sendState(seq?: number) {
    if (!this.onMessage) return;
    const state = this.buildStateSnapshot();
    this.onMessage(new TimelineStateMessage(state, seq, ++this.stateSeq));
  }

  getState(): TimelineState {
    return this.buildStateSnapshot();
  }
}

export type {
  TimelineState,
  TimelineControl,
  TimelineLane,
  TimelineCurveLane,
  TimelineStepLane,
  TimelineTrigger,
  TimelineTriggerLane,
  TimelineKeyframeLane,
  TimelinePoint,
  TimelineKeyframe,
  TimelineEdit,
  TimelineOptions,
};

export * from './client';
export * from './curve';
export * from './adapters';

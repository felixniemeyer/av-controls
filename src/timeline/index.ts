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
  alwaysRender?: boolean;
  onRender?: (deltaSeconds: number) => void;
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

function getLaneValueMap(spec: Base.Spec, laneValues: Record<string, number>): Record<string, number> {
  if (spec.type === Controls.Joystick.Spec.type) {
    return {
      x: laneValues.x ?? 0,
      y: laneValues.y ?? 0,
    };
  }
  if (spec.type === Controls.Switch.Spec.type) {
    return { on: laneValues.on ?? laneValues.value ?? 0 };
  }
  if (spec.type === Controls.Selector.Spec.type) {
    return { index: laneValues.index ?? laneValues.value ?? 0 };
  }
  return { value: laneValues.value ?? 0 };
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
  return {};
}

function applyLaneValues(receiver: Base.Receiver, spec: Base.Spec, values: Record<string, number>) {
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
}

export class Timeline {
  private controlIndex = new Map<string, ControlIndexEntry>();
  private automationState = new Map<string, ControlAutomationState>();
  private lastValues = new Map<string, Record<string, number>>();

  private lastDelta = 0;
  public time = 0;
  public playing = false;
  public alwaysRender = true;

  // Render loop state
  private _rafId = 0;
  private _lastFrameTime = 0;
  private _running = false;
  private _pendingRender = false;
  private _onRender: ((deltaSeconds: number) => void) | null = null;
  private controlChangeDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private controlChangeDebounceMs = 500;

  public onMessage: ((message: any) => void) | null = null;

  constructor(
    private rootReceiver: Base.Receiver,
    options?: TimelineOptions,
  ) {
    this.time = options?.initialTime ?? 0;
    this.playing = options?.autoplay ?? false;
    this.alwaysRender = options?.alwaysRender ?? true;
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

  private _scheduleFrame() {
    this._rafId = requestAnimationFrame(this._loop.bind(this));
  }

  private _loop() {
    const now = performance.now();
    const deltaMs = now - this._lastFrameTime;
    this._lastFrameTime = now;
    const deltaSeconds = deltaMs * 0.001;

    // Advance time and apply automation
    this.tick(deltaSeconds);

    // Call render callback
    if (this._onRender) {
      this._onRender(deltaSeconds);
    }

    // Decide whether to continue
    const shouldContinue = this._running && (this.playing || this.alwaysRender);
    this._pendingRender = false;

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

  deltaTime() {
    return this.lastDelta;
  }

  tick(deltaSeconds: number) {
    this.lastDelta = deltaSeconds;
    if (this.playing) {
      this.time += deltaSeconds;
      this.applyAutomation();
    }
  }

  seek(time: number) {
    this.time = Math.max(0, time);
    this.lastDelta = 0;
    this.applyAutomation();
  }

  setPlaying(playing: boolean) {
    this.playing = playing;
  }

  handleMessage(message: any) {
    if (message?.type === TimelineRequestState.type) {
      this.sendState();
      return;
    }
    if (message?.type === TimelineEditMessage.type) {
      const payload = message as TimelineEditMessage;
      this.applyEdit(payload.edit, payload.seq);
      this.sendState();
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
      case 'remove-lane': {
        const state = this.ensureControlState(edit.path);
        state.lanes = state.lanes.filter(l => l.key !== edit.laneKey);
        break;
      }
      case 'set-playing': {
        const wasPlaying = this.playing;
        this.playing = edit.playing;
        if (!wasPlaying && edit.playing) {
          this._ensureLoopRunning();
        }
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
    }
  }

  private applyAutomation() {
    for (const [key, state] of this.automationState.entries()) {
      if (!state.enabled || state.manualOverride) continue;
      const entry = this.controlIndex.get(key);
      if (!entry) continue;

      const laneValues: Record<string, number> = {};
      const range = getSpecRange(entry.spec);
      for (const lane of state.lanes) {
        if (!lane.enabled) continue;
        const value = evalLane(lane.points, this.time, 32, range.min, range.max);
        if (value === null) continue;
        laneValues[lane.key] = value;
      }
      if (Object.keys(laneValues).length === 0) continue;

      const mapped = getLaneValueMap(entry.spec, laneValues);
      applyLaneValues(entry.receiver, entry.spec, mapped);
    }
  }

  private sendState() {
    if (!this.onMessage) return;
    const state: TimelineState = {
      time: this.time,
      playing: this.playing,
      alwaysRender: this.alwaysRender,
      controls: Array.from(this.automationState.values()).map(control => ({
        path: [...control.path],
        enabled: control.enabled,
        manualOverride: control.manualOverride,
        lanes: control.lanes.map(lane => ({
          ...lane,
          points: [...lane.points],
        })),
      })),
    };
    this.onMessage(new TimelineStateMessage(state));
  }

  getState(): TimelineState {
    return {
      time: this.time,
      playing: this.playing,
      alwaysRender: this.alwaysRender,
      controls: Array.from(this.automationState.values()).map(control => ({
        path: [...control.path],
        enabled: control.enabled,
        manualOverride: control.manualOverride,
        lanes: control.lanes.map(lane => ({
          ...lane,
          points: [...lane.points],
        })),
      })),
    };
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

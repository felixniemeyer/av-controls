import * as Controls from '../controls';
import { Base } from '../controls';
import {
  TimelineState,
  TimelineControl,
  TimelineLane,
  TimelinePoint,
  TimelineEdit,
  TimelineStateMessage,
  TimelineEditMessage,
  TimelineRequestState,
} from '../messages';

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

function evalLinear(points: TimelinePoint[], t: number): number | null {
  if (!points.length) return null;
  if (points.length === 1) return points[0]!.v;
  if (t <= points[0]!.t) return points[0]!.v;
  const last = points[points.length - 1]!;
  if (t >= last.t) return last.v;

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    if (t >= a.t && t <= b.t) {
      const span = b.t - a.t;
      if (span <= 0) return a.v;
      const factor = (t - a.t) / span;
      return a.v + (b.v - a.v) * factor;
    }
  }
  return last.v;
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

  public onMessage: ((message: any) => void) | null = null;

  constructor(
    private rootReceiver: Base.Receiver,
    options?: TimelineOptions,
  ) {
    this.time = options?.initialTime ?? 0;
    this.playing = options?.autoplay ?? false;
    this.buildIndex();
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
      this.applyEdit(payload.edit);
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

  private applyEdit(edit: TimelineEdit) {
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
        const lane = state.lanes.find(l => l.id === edit.laneId);
        if (lane) lane.enabled = edit.enabled;
        break;
      }
      case 'set-lane-points': {
        const state = this.ensureControlState(edit.path);
        const lane = state.lanes.find(l => l.id === edit.laneId);
        if (lane) {
          lane.points = ensureSorted(edit.points);
        }
        break;
      }
      case 'add-lane': {
        const state = this.ensureControlState(edit.path);
        const exists = state.lanes.find(l => l.id === edit.lane.id);
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
        state.lanes = state.lanes.filter(l => l.id !== edit.laneId);
        break;
      }
      case 'set-playing': {
        this.playing = edit.playing;
        break;
      }
      case 'seek': {
        this.seek(edit.time);
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
      for (const lane of state.lanes) {
        if (!lane.enabled) continue;
        const value = evalLinear(lane.points, this.time);
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

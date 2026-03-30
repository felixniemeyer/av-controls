import { Base } from './controls';
import packageJson from '../package.json'; 

// Base interface for all messages
export interface Message {
  type: string;
  protocol?: string;
}

export type UpdateOrigin =
  | { kind: 'controller' }
  | { kind: 'timeline' }
  | { kind: 'artwork' };

export class RootSpecification implements Message {
  static type = 'controller-specification' as const;
  type = RootSpecification.type;
  version = packageJson.version;

  constructor(
    public name: string,
    public rootControlSpec: Base.Spec,
    public currentState: Base.State,
  ) {}
}

// signals go from the controller to the visuals
export class ControlSignal implements Message {
  static type = 'control-signal' as const;
  type = ControlSignal.type;

  constructor(
    public signal: Base.Signal,
    public seq?: number,
  ) {}
}

// updates go from the visuals to the controller
export class ControlUpdate implements Message {
  static type = 'control-update' as const;
  type = ControlUpdate.type;

  constructor(
    public update: Base.Update,
    public origin: UpdateOrigin = { kind: 'artwork' },
    public seq?: number,
  ) {}
}

// timeline messages
export class TimelineRequestState implements Message {
  static type = 'timeline-request-state' as const;
  type = TimelineRequestState.type;
}

export type TimelinePoint = {
  t: number;
  v: number;
  kind?: 'pos' | 'ctrl';
};

export type TimelineKeyframe = {
  t: number;
  value: unknown;
  leftSmooth?: number;
  rightSmooth?: number;
};

export type TimelineCurveLane = {
  key: string;
  type?: 'curve';
  enabled: boolean;
  points: TimelinePoint[];
  seq?: number;
  renderPoints?: TimelinePoint[];
  renderSeq?: number;
};

export type TimelineStepLane = {
  key: string;
  type: 'step';
  enabled: boolean;
  points: TimelinePoint[];
  seq?: number;
};

export type TimelineTrigger = {
  on: {
    t: number;
    value: number;
  };
  off: {
    t: number;
  };
};

export type TimelineTriggerLane = {
  key: string;
  type: 'trigger';
  enabled: boolean;
  triggers: TimelineTrigger[];
  seq?: number;
};

export type TimelineKeyframeLane = {
  key: string;
  type: 'keyframes';
  enabled: boolean;
  keyframes: TimelineKeyframe[];
  seq?: number;
};

export type TimelineLane = TimelineCurveLane | TimelineStepLane | TimelineTriggerLane | TimelineKeyframeLane;

export type TimelineControl = {
  path: string[];
  enabled: boolean;
  manualOverride: boolean;
  lanes: TimelineLane[];
};

export type TimelineState = {
  time: number;
  state: 'playing' | 'paused' | 'scrubbing' | 'rendering';
  playing: boolean;
  alwaysRender: boolean;
  loopEnabled: boolean;
  loopDurationSec: number;
  controls: TimelineControl[];
};

export type TimelineEdit =
  | { type: 'set-control-enabled'; path: string[]; enabled: boolean }
  | { type: 'set-lane-enabled'; path: string[]; laneKey: string; enabled: boolean }
  | { type: 'set-lane-points'; path: string[]; laneKey: string; points: TimelinePoint[] }
  | { type: 'set-lane-triggers'; path: string[]; laneKey: string; triggers: TimelineTrigger[] }
  | { type: 'set-lane-keyframes'; path: string[]; laneKey: string; keyframes: TimelineKeyframe[] }
  | { type: 'set-render-lane-points'; path: string[]; laneKey: string; points: TimelinePoint[] }
  | { type: 'add-lane'; path: string[]; lane: TimelineLane }
  | { type: 'add-render-lane'; path: string[]; laneKey: string }
  | { type: 'remove-lane'; path: string[]; laneKey: string }
  | { type: 'remove-render-lane'; path: string[]; laneKey: string }
  | { type: 'set-playing'; playing: boolean }
  | { type: 'set-state'; state: 'playing' | 'paused' | 'scrubbing' | 'rendering' }
  | { type: 'render-frame' }
  | { type: 'seek'; time: number }
  | { type: 'set-always-render'; alwaysRender: boolean }
  | { type: 'set-loop-enabled'; loopEnabled: boolean }
  | { type: 'set-loop-duration'; loopDurationSec: number };

export class TimelineStateMessage implements Message {
  static type = 'timeline-state' as const;
  type = TimelineStateMessage.type;

  constructor(
    public state: TimelineState,
    public seq?: number,
    public stateSeq?: number,
  ) {}
}

export class TimelineEditMessage implements Message {
  static type = 'timeline-edit' as const;
  type = TimelineEditMessage.type;

  constructor(
    public edit: TimelineEdit,
    public seq?: number,
  ) {}
}

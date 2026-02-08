import { Base } from './controls';
import packageJson from '../package.json'; 

// Base interface for all messages
export interface Message {
  type: string;
  protocol?: string;
}

export class RootSpecification implements Message {
  static type = 'controller-specification' as const;
  type = RootSpecification.type;
  version = packageJson.version;

  constructor(
    public name: string,
    public rootControlSpec: Base.Spec,
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

export type TimelineLane = {
  key: string;
  enabled: boolean;
  points: TimelinePoint[];
  seq?: number;
};

export type TimelineControl = {
  path: string[];
  enabled: boolean;
  manualOverride: boolean;
  lanes: TimelineLane[];
};

export type TimelineState = {
  time: number;
  playing: boolean;
  alwaysRender: boolean;
  controls: TimelineControl[];
};

export type TimelineEdit =
  | { type: 'set-control-enabled'; path: string[]; enabled: boolean }
  | { type: 'set-lane-enabled'; path: string[]; laneKey: string; enabled: boolean }
  | { type: 'set-lane-points'; path: string[]; laneKey: string; points: TimelinePoint[] }
  | { type: 'add-lane'; path: string[]; lane: TimelineLane }
  | { type: 'remove-lane'; path: string[]; laneKey: string }
  | { type: 'set-playing'; playing: boolean }
  | { type: 'seek'; time: number }
  | { type: 'set-always-render'; alwaysRender: boolean };

export class TimelineStateMessage implements Message {
  static type = 'timeline-state' as const;
  type = TimelineStateMessage.type;

  constructor(
    public state: TimelineState,
    public seq?: number,
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

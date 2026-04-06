import { Base } from './controls';
import packageJson from '../package.json'; 

// Base interface for all messages
export interface Message {
  type: string;
  protocol?: string;
}

export type UpdateOrigin =
  | { kind: 'controller'; clientId?: string }
  | { kind: 'timeline'; clientId?: string }
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
    public origin?: UpdateOrigin,
  ) {}
}

export type ControlSignalBatchNode = {
  controlId: string;
  signal?: Base.Signal;
  children?: ControlSignalBatchNode[];
};

export class ControlSignalBatch implements Message {
  static type = 'control-signal-batch' as const;
  type = ControlSignalBatch.type;

  constructor(
    public signals: ControlSignalBatchNode[],
    public seq?: number,
    public origin?: UpdateOrigin,
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

export type ArtworkMode = 'live' | 'playing' | 'paused';

export type ArtworkRuntimeCommand =
  | { type: 'set-artwork-mode'; mode: ArtworkMode }
  | { type: 'reset-render-state' }
  | { type: 'render-artwork'; time: number; capture?: { downloadName?: string } }
  | { type: 'probe-render-latency'; probeId: string };

export class ArtworkRuntimeCommandMessage implements Message {
  static type = 'artwork-runtime-command' as const;
  type = ArtworkRuntimeCommandMessage.type;

  constructor(
    public command: ArtworkRuntimeCommand,
  ) {}
}

export class ArtworkRuntimeStatusMessage implements Message {
  static type = 'artwork-runtime-status' as const;
  type = ArtworkRuntimeStatusMessage.type;

  constructor(
    public mode: ArtworkMode,
    public time: number,
  ) {}
}

export class ArtworkRenderAckMessage implements Message {
  static type = 'artwork-render-ack' as const;
  type = ArtworkRenderAckMessage.type;

  constructor(
    public time: number,
    public captured: boolean,
    public ok: boolean,
    public error?: string,
    public probeId?: string,
  ) {}
}

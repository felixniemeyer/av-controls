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
  ) {}
}

// updates go from the visuals to the controller
export class ControlUpdate implements Message {
  static type = 'control-update' as const;
  type = ControlUpdate.type;

  constructor(
    public update: Base.Update,
  ) {}
}
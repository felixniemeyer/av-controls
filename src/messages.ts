import { Base } from './controls';
import packageJson from '../package.json'; 

// Base interface for all messages
export interface Message {
  type: string;
  protocol?: string;
}

export class Ready implements Message {
  static type = 'ready' as const;
  type = Ready.type;

  constructor() {}
}

export class Nudge implements Message {
  static type = 'nudge' as const;
  type = Nudge.type;
  
  constructor() {}
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

export class TabClosed implements Message {
  static type = 'tab-closed' as const;
  type = TabClosed.type;
}

export class CloseTab implements Message {
  static type = 'close-tab' as const;
  type = CloseTab.type;
}

export class Test implements Message {
  static type = 'test' as const;
  type = Test.type;
}

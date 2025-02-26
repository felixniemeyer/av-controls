import type { ControlSpecsDict } from './control-specs';

export type ControlId = string[]

export class Ready {
  static type = 'ready';
  type = Ready.type;

  constructor() {}
}

export class Nudge {
  static type = 'nudge';
  type = Nudge.type;
  constructor() {}
}

export class ControllerSpecification {
  static type = 'controller-specification';
  type = ControllerSpecification.type;

  constructor(
    public name: string,
    public controlSpecs: ControlSpecsDict,
  ) { }
}

// signals go from the controller to the visuals, e.g. the bar cake, showing the percentage of the current bar
export class ControlSignal {
  static type = 'control-signal';
  type = ControlSignal.type;

  constructor(
    public controlId: ControlId,
    public payload: any,
  ) {}
}

// updates go from the visuals to the controller, e.g. the bar cake, showing the percentage of the current bar
export class ControlUpdate {
  static type = 'control-update';
  type = ControlUpdate.type;

  constructor(
    public controlId: ControlId,
    public payload: any,
  ) {}
}

export class TabClosing {
  static type = 'tab-closing';
  type = TabClosing.type;
}

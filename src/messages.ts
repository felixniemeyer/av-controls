import type { ControlSpecsDict } from './control-specs';

export type ControlId = string[]

export class Ready {
  static type = 'ready';

  type = Ready.type;
  constructor() {}
}

export class Nudge {
  type = 'nudge';
  constructor() {}
}

export class AnnounceReceiver {
  type = 'announce-receiver';

  constructor(
    public name: string,
    public controlSpecs: ControlSpecsDict,
  ) { }
}

export class ControlMessage {
  type = 'control-message';

  constructor(
    public controlId: ControlId,
    public payload: any,
  ) {}
}

export class MeterMessage {
  type = 'meter-message';

  constructor(
    public controlId: ControlId,
    public payload: any,
  ) {}
}

export class TabClosing {
  type = 'tab-closing';
}

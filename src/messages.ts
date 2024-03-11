import { ControlSpecsDict } from './control-specs';

export type ControlId = string[]

namespace Messages {
  export class AnnounceReceiver {
    static type = 'announce-receiver';

    type = AnnounceReceiver.type;

    constructor(
      public name: string,
      public info: string,
      public controlSpecs: ControlSpecsDict,
      public receiverId: string,
    ) { }
  }

  export class ControlMessage {
    static type = 'control-message';

    type = ControlMessage.type;

    constructor(
      public controlId: ControlId,
      public payload: any,
    ) {}
  }

  export class MeterMessage {
    static type = 'meter-message';

    type = MeterMessage.type;

    constructor(
      public controlId: ControlId,
      public payload: any,
      public receiverId: string,
    ) {}
  }

  export class TabClosing {
    static type = 'tab-closing';

    type = TabClosing.type;
  }
}

export default Messages;

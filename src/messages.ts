import { type Dict } from './dict';

import { ControlSpec } from './control-specs';
import { MeterSpec } from './meter-specs';

namespace Messages {
  export class AnnounceReceiver {
    static type = 'announce-receiver';

    type = AnnounceReceiver.type;

    constructor(
      public name: string,
      public controlSpecs: Dict<ControlSpec>, 
      public meterSpecs: Dict<MeterSpec>,
      public receiverId: string,
    ) { }
  }

  export class ControlMessage {
    static type = 'control-message';

    type = ControlMessage.type;

    constructor(
      public controlId: string,
      public payload: any,
    ) {}
  }

  export class MeterMessage {
    static type = 'meter-message';

    type = MeterMessage.type;

    constructor(
      public meterId: string,
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

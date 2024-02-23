import { ControlSpec } from './control-specs';

namespace Messages {
  export class AnnounceReceiver {
    static type = 'announce-receiver';

    type = AnnounceReceiver.type;

    constructor(
      public name: string,
      public specs: ControlSpec[], 
    ) { }
  }

  export class ControlMessage {
    static type = 'control-message';

    type = ControlMessage.type;

    constructor(
      public controlIndex: number,
      public payload: any,
    ) {}
  }

  export class TabClosing {
    static type = 'tab-closing';

    type = TabClosing.type;
  }
}

export default Messages;

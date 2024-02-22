import { ControlSpecification } from './control-specification';

namespace Messages {
  export class AnnounceReceiver {
    static type = 'announce-receiver';

    type = AnnounceReceiver.type;

    constructor(
      public origin: string,
      public receiverId: string,
      public specs: ControlSpecification[], 
      public name: string,
    ) { }

  }

  export class SearchForReceivers {
    static type = 'search-for-receivers';

    type = SearchForReceivers.type;

    constructor(
      public origin: string,
    ) { }
  }

  export class ControlMessage {
    static type = 'control-message';

    type = ControlMessage.type;

    constructor(
      public receiverId: string,
      public controlIndex: number,
      public payload: any,
    ) {}
  }
}

export default Messages;

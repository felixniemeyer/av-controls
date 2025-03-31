import { Sender as BaseSender } from './base';
import { CommunicationError, Logger } from '../error';

import * as AvControlsMessages from '../messages';
import { Base } from '../controls';

namespace Messages {
  interface Message {
    type: string;
  }

  export class WrappedMessage implements Message {
    static type = 'wrapped-message' as const;
    type = WrappedMessage.type;

    constructor(
      public message: AvControlsMessages.Message
    ) {}
  }
}

/**
 * Main receiver class for handling control communication
 */
export class Receiver {
  constructor(
    private otherWindow: Window,
    private name: string,
    private rootReceiver: Base.Receiver
  ) {
    this.handlePostMessage = this.handlePostMessage.bind(this);
    window.addEventListener('message', this.handlePostMessage.bind(this));
    
    // Send initial ready message
    this.send(new AvControlsMessages.RootSpecification(this.name, this.rootReceiver.spec)); 

    this.rootReceiver.onUpdate = (update: Base.Update) => {
      this.send(new AvControlsMessages.ControlUpdate(update))
    }
  }

  private handlePostMessage(event: MessageEvent): void {
    const data = event.data;
    if (data.type === Messages.WrappedMessage.type) {
      if(data.message.type === AvControlsMessages.ControlSignal.type) {
        this.rootReceiver.handleSignal((data.message as AvControlsMessages.ControlSignal).signal)
      }
    }
  }

  send(message: AvControlsMessages.Message): void {
    try {
      this.otherWindow.postMessage(new Messages.WrappedMessage(message), '*');
    } catch (error) {
      Logger.error('Failed to send message', { error, message });
      throw new CommunicationError(`Failed to send message: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

export class Sender extends BaseSender {
  constructor(
    private tab: Window
  ) {
    super();
    this.handlePostMessage = this.handlePostMessage.bind(this);
    window.addEventListener('message', this.handlePostMessage)
  }

  destroy() {
    window.removeEventListener('message', this.handlePostMessage)
  }

  send(message: AvControlsMessages.Message): void {
    this.tab.postMessage(new Messages.WrappedMessage(message), '*');
  }

  handlePostMessage(event: MessageEvent) {
    if(event.source === this.tab) {
      if(event.data.type == Messages.WrappedMessage.type) {
        this.broadcastAvMessage(event.data.message)
      }
    }
  }

  private listeners: ((message: AvControlsMessages.Message) => void)[] = []
  addListener(listener: (message: AvControlsMessages.Message) => void): void {
    this.listeners.push(listener)
  }

  private broadcastAvMessage(message: AvControlsMessages.Message): void {
    this.listeners.forEach(listener => listener(message))
  }
}

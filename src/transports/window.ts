import { Sender as BaseSender } from './base';
import { CommunicationError, Logger } from '../error';

import * as AvControlsMessages from '../messages';
import { Timeline } from '../timeline';
import { Base } from '../controls';
import { StatePersistence } from '../persistence';
import type { PersistenceOptions } from '../persistence';

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
  private persistence: StatePersistence | null = null
  public ready: Promise<void>

  constructor(
    private otherWindow: Window,
    private name: string,
    private rootReceiver: Base.Receiver,
    private timeline?: Timeline,
    persistenceOptions?: PersistenceOptions,
  ) {
    this.handlePostMessage = this.handlePostMessage.bind(this);
    window.addEventListener('message', this.handlePostMessage.bind(this));

    if (this.timeline) {
      this.timeline.onMessage = (message: AvControlsMessages.Message) => {
        this.send(message)
      }
    }

    // Initialize with or without persistence
    if (persistenceOptions && persistenceOptions.enabled !== false) {
      this.persistence = new StatePersistence(persistenceOptions)
      this.ready = this.initWithPersistence()
    } else {
      this.initWithoutPersistence()
      this.ready = Promise.resolve()
    }
  }

  private async initWithPersistence(): Promise<void> {
    try {
      await this.persistence!.init()
      const storedState = await this.persistence!.loadState()
      this.persistence!.applyStoredState(this.rootReceiver, storedState)
    } catch (e) {
      Logger.warn('Failed to load persisted state', { error: e })
    }

    // Send spec after applying stored state
    this.send(new AvControlsMessages.RootSpecification(this.name, this.rootReceiver.spec, this.rootReceiver.getState()))

    // Hook onUpdate for persistence
    this.rootReceiver.onUpdate = (update: Base.Update) => {
      const origin = Base.Receiver.currentUpdateOrigin() ?? { kind: 'artwork' as const }
      this.send(new AvControlsMessages.ControlUpdate(update, origin))
      this.timeline?.onControlUpdate(update)
      this.persistence?.handleUpdate(update)
    }
  }

  private initWithoutPersistence(): void {
    this.send(new AvControlsMessages.RootSpecification(this.name, this.rootReceiver.spec, this.rootReceiver.getState()))

    this.rootReceiver.onUpdate = (update: Base.Update) => {
      const origin = Base.Receiver.currentUpdateOrigin() ?? { kind: 'artwork' as const }
      this.send(new AvControlsMessages.ControlUpdate(update, origin))
      this.timeline?.onControlUpdate(update)
    }
  }

  private handlePostMessage(event: MessageEvent): void {
    const data = event.data;
    if (data.type === Messages.WrappedMessage.type) {
      if(data.message.type === AvControlsMessages.ControlSignal.type) {
        Base.Receiver.withUpdateOrigin({ kind: 'controller' }, () => {
          this.rootReceiver.handleSignal((data.message as AvControlsMessages.ControlSignal).signal)
        })
        this.timeline?.onControlSignal((data.message as AvControlsMessages.ControlSignal).signal)
      } else if(
        data.message.type === AvControlsMessages.TimelineEditMessage.type ||
        data.message.type === AvControlsMessages.TimelineRequestState.type
      ) {
        this.timeline?.handleMessage(data.message)
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

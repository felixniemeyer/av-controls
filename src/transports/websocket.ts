/**
 * WebSocket communication adapter for AV Controls
 */

import { Sender as BaseSender } from './base';

import { CommunicationError, Logger } from '../error';
import { Messages as AvControlsMessages } from '..';

import { Base } from '../controls'

// Create a namespace to group the messages
export namespace Messages {
  export interface Message {
    type: string;
  }

  // ws messages
  export class RegisterReceiver implements Message {
    static type = 'register-receiver' as const;
    type = RegisterReceiver.type;

    constructor() {}
  }

  export class RegisterSender implements Message {
    static type = 'register-sender' as const;
    type = RegisterSender.type;

    constructor() {}
  }

  export class AddNetPanel implements Message {
    static type = 'add-net-panel' as const;
    type = AddNetPanel.type;

    constructor(
      public id: string,
      public rootSpecification: AvControlsMessages.RootSpecification
    ) {}
  }

  export class WrappedMessage implements Message {
    static type = 'wrapped-message' as const;
    type = WrappedMessage.type;

    constructor(
      public panelId: string, 
      public message: AvControlsMessages.Message,
    ) {}
  }

  export class PanelList implements Message {
    static type = 'panel-list' as const;
    type = PanelList.type;

    constructor(
      public panelIds: string[]
    ) {}
  }

  export class ChoosePanel implements Message {
    static type = 'choose-panel' as const;
    type = ChoosePanel.type;

    constructor(
      public panelId: string
    ) {}
  }
}

/**
 * Options for the WebSocket adapter
 */
export interface WebSocketAdapterOptions {
  /**
   * Auto reconnect on disconnection
   */
  autoReconnect?: boolean;
  
  /**
   * Time in milliseconds between reconnection attempts
   */
  reconnectInterval?: number;
  
  /**
   * Maximum number of reconnection attempts
   */
  maxReconnectAttempts?: number;
}

/**
 * WebSocket-based communication adapter
 */
abstract class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectTimeout: any = null;
  private isConnecting = false;
  
  private options: WebSocketAdapterOptions = {
    autoReconnect: true,
    reconnectInterval: 3000,
    maxReconnectAttempts: 10,
  };
  
  /**
   * Create a new WebSocket adapter
   */
  constructor(
    private url: string,
    options?: WebSocketAdapterOptions
  ) {
    // Apply defaults
    Object.assign(this.options, options)
  }
  
  public initialize() {
    return this.connect();
  }

  abstract onConnectionOpened(): void;

  abstract handleWsMessage(message: Messages.Message): void;
  
  /**
   * Connect to the WebSocket server
   */
  private async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      return;
    }
    
    this.isConnecting = true;
    
    return new Promise<void>((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);
        
        this.ws.onopen = () => {
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          Logger.info('WebSocket connected', { url: this.url });

          // Send 
          this.onConnectionOpened()
          
          resolve();
        };
        
        this.ws.onclose = (event) => {
          Logger.warn('WebSocket closed', { code: event.code, reason: event.reason });
          this.isConnecting = false;
          
          if (this.options.autoReconnect && this.reconnectAttempts < (this.options.maxReconnectAttempts || 10)) {
            this.scheduleReconnect();
          }
        };
        
        this.ws.onerror = (error) => {
          Logger.error('WebSocket error', { error });
          this.isConnecting = false;
          
          if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            reject(new CommunicationError('WebSocket connection failed'));
          }
        };
        
        this.ws.onmessage = (event) => {
          try{
            const deserialized = JSON.parse(event.data as string);
            this.handleWsMessage(deserialized as Messages.Message);
          } catch (error) {
            Logger.error('Error processing WebSocket message', { error, data: event.data });
          }
        };
      } catch (error) {
        this.isConnecting = false;
        Logger.error('Error creating WebSocket', { error, url: this.url });
        reject(new CommunicationError(`Failed to create WebSocket: ${error instanceof Error ? error.message : String(error)}`));
      }
    });
  }
  
  /**
   * Schedule a reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      Logger.info('Attempting to reconnect WebSocket', { 
        attempt: this.reconnectAttempts, 
        maxAttempts: this.options.maxReconnectAttempts 
      });
      
      this.connect().catch(() => {
        // Error is already logged in connect
      });
    }, this.options.reconnectInterval);
  }
  

  sendWsMessage(message: Messages.Message): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    try {
      const serialized = JSON.stringify(message)
      this.ws.send(serialized);
    } catch (error) {
      Logger.error('Error sending WebSocket message', { error, message });
      throw new CommunicationError(`Failed to send message: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Clean up resources
   */
  dispose(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.ws) {
      // Prevent reconnect on intentional close
      this.options.autoReconnect = false;
      
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
      
      this.ws = null;
    }
  }
}

export class Receiver extends WebSocketClient {
  constructor(
    private rootReceivers: {[id: string]: Base.Receiver},
    url: string,
    options?: WebSocketAdapterOptions
  ) {
    super(url, options)
    this.initialize()
  }

  onConnectionOpened(): void {
    this.sendWsMessage(new Messages.RegisterReceiver());
    for(const id in this.rootReceivers) {
      const rootReceiver = this.rootReceivers[id]!
      this.sendWsMessage(new Messages.AddNetPanel(id, new AvControlsMessages.RootSpecification(id, rootReceiver.spec)));
      rootReceiver.onUpdate = (update: Base.Update) => {
        this.sendWsMessage(new Messages.WrappedMessage(id, new AvControlsMessages.ControlUpdate(update)))
      }
    }
  }

  handleWsMessage(msg: Messages.Message): void {
    switch(msg.type) {
      case Messages.WrappedMessage.type:
        const wsMessage = msg as Messages.WrappedMessage
        switch(wsMessage.message.type) {
          case AvControlsMessages.ControlSignal.type:
            const avMessage = wsMessage.message as AvControlsMessages.ControlSignal
            const receiver = this.rootReceivers[wsMessage.panelId]
            if (receiver) {
              receiver.handleSignal(avMessage.signal)
            }
            break;
        }
        break;
    }
  }
}

export class Sender extends WebSocketClient implements BaseSender {
  panelId: string | null = null

  constructor(
    url: string,
    private chooseNetPanel: (panelIdList: string[]) => Promise<string>, 
    options?: WebSocketAdapterOptions,
  ) {
    super(url, options)
  }

  onConnectionOpened(): void {
    this.sendWsMessage(new Messages.RegisterSender());
  }

  async handleWsMessage(message: Messages.Message): Promise<void> {
    switch(message.type) {
      case Messages.PanelList.type:
        const panelIds = (message as Messages.PanelList).panelIds
        this.panelId = await this.chooseNetPanel(panelIds)
        this.sendWsMessage(new Messages.ChoosePanel(this.panelId))
        break;
      case Messages.WrappedMessage.type:
        this.broadcastAvMessage((message as Messages.WrappedMessage).message); 
    }
  }
  
  /**
   * Actual send implementation
   */
  send(message: AvControlsMessages.Message): void {
    if(this.panelId) {
      this.sendWsMessage(new Messages.WrappedMessage(this.panelId, message));
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


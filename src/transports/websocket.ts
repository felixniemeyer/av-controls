/**
 * WebSocket communication adapter for AV Controls
 */

import { Sender as BaseSender } from './base';

import { CommunicationError, Logger } from '../error';
import { Messages as AvControlsMessages } from '..';

import { Base } from '../controls'
import { StatePersistence } from '../persistence'
import type { PersistenceOptions } from '../persistence'

const websocketConnectionLog = typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).get('ws-log') === '1';

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

function logWsConnection(role: 'sender' | 'receiver', event: string, data?: Record<string, unknown>) {
  if (!websocketConnectionLog) {
    return;
  }
  const relativeTimestamp = typeof performance !== 'undefined'
    ? performance.now().toFixed(1)
    : Date.now().toString();
  const isoTimestamp = new Date().toISOString();
  console.info(`[${isoTimestamp}] [ws:${role}] ${event} @${relativeTimestamp}ms`, data ?? {});
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

export interface WebSocketSenderOptions extends WebSocketAdapterOptions {
  /**
   * Observe the latest available panel ids announced by the broker.
   */
  onPanelList?: (panelIds: string[]) => void;
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

  protected abstract connectionRole(): 'sender' | 'receiver';
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
    logWsConnection(this.connectionRole(), 'connect-attempt', {
      url: this.url,
      reconnectAttempts: this.reconnectAttempts,
    });
    
    return new Promise<void>((resolve, reject) => {
      try {
        if (Logger && typeof Logger.debug === 'function') {
          Logger.debug('WebSocket create', { url: this.url });
        }
        this.ws = new WebSocket(this.url);
        
        this.ws.onopen = () => {
          if (Logger && typeof Logger.debug === 'function') {
            Logger.debug('WebSocket open', { url: this.url });
          }
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          Logger.info('WebSocket connected', { url: this.url });
          logWsConnection(this.connectionRole(), 'socket-open', { url: this.url });

          // Send 
          this.onConnectionOpened()
          
          resolve();
        };
        
        this.ws.onclose = (event) => {
          if (Logger && typeof Logger.debug === 'function') {
            Logger.debug('WebSocket close', { url: this.url, code: event.code, reason: event.reason });
          }
          Logger.warn('WebSocket closed', { code: event.code, reason: event.reason });
          logWsConnection(this.connectionRole(), 'socket-close', {
            url: this.url,
            code: event.code,
            reason: event.reason,
          });
          this.isConnecting = false;
          
          if (this.options.autoReconnect && this.reconnectAttempts < (this.options.maxReconnectAttempts || 10)) {
            this.scheduleReconnect();
          }
        };
        
        this.ws.onerror = (error) => {
          if (Logger && typeof Logger.debug === 'function') {
            Logger.debug('WebSocket error', { url: this.url, error });
          }
          Logger.error('WebSocket error', { error });
          logWsConnection(this.connectionRole(), 'socket-error', { url: this.url, error });
          this.isConnecting = false;
          
          if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            reject(new CommunicationError('WebSocket connection failed'));
          }
        };
        
        this.ws.onmessage = (event) => {
          if (Logger && typeof Logger.debug === 'function') {
            Logger.debug('WebSocket message', { preview: typeof event.data === 'string' ? event.data.slice(0, 200) : event.data });
          }
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
      logWsConnection(this.connectionRole(), 'reconnect-scheduled', {
        url: this.url,
        attempt: this.reconnectAttempts,
        maxAttempts: this.options.maxReconnectAttempts,
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
        logWsConnection(this.connectionRole(), 'dispose-close', {
          url: this.url,
          readyState: this.ws.readyState,
        });
        this.ws.close();
      }
      
      this.ws = null;
    }
  }
}

export class Receiver extends WebSocketClient {
  private persistenceByPanel = new Map<string, StatePersistence>()
  public ready: Promise<void>

  constructor(
    private rootReceivers: {[id: string]: Base.Receiver},
    url: string,
    options?: WebSocketAdapterOptions,
    private artworkRuntimeHandlers?: {[id: string]: { handleMessage(message: AvControlsMessages.ArtworkRuntimeCommandMessage): void }},
    private persistenceOptions?: {[id: string]: PersistenceOptions},
  ) {
    super(url, options)

    // Initialize persistence for each panel before connecting
    if (persistenceOptions) {
      this.ready = this.initPersistence().then(() => {
        this.initialize()
      })
    } else {
      this.ready = Promise.resolve()
      this.initialize()
    }
  }

  private async initPersistence(): Promise<void> {
    for (const id in this.persistenceOptions) {
      const opts = this.persistenceOptions[id]
      if (opts && opts.enabled !== false) {
        const persistence = new StatePersistence(opts)
        this.persistenceByPanel.set(id, persistence)

        try {
          await persistence.init()
          const storedState = await persistence.loadState()
          const receiver = this.rootReceivers[id]
          if (receiver) {
            persistence.applyStoredState(receiver, storedState)
          }
        } catch (e) {
          Logger.warn('Failed to load persisted state for panel', { panelId: id, error: e })
        }
      }
    }
  }

  protected connectionRole(): 'receiver' {
    return 'receiver'
  }

  onConnectionOpened(): void {
    logWsConnection('receiver', 'register-receiver', {
      panelIds: Object.keys(this.rootReceivers),
    })
    this.sendWsMessage(new Messages.RegisterReceiver());
    for(const id in this.rootReceivers) {
      const rootReceiver = this.rootReceivers[id]!
      const persistence = this.persistenceByPanel.get(id)

      logWsConnection('receiver', 'announce-panel', {
        panelId: id,
        hasPersistence: Boolean(persistence),
      })
      this.sendWsMessage(new Messages.AddNetPanel(id, new AvControlsMessages.RootSpecification(id, rootReceiver.spec, rootReceiver.getState())));

      rootReceiver.onUpdate = (update: Base.Update) => {
        const origin = Base.Receiver.currentUpdateOrigin() ?? { kind: 'artwork' as const }
        this.sendWsMessage(new Messages.WrappedMessage(id, new AvControlsMessages.ControlUpdate(update, origin)))
        persistence?.handleUpdate(update)
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
              Base.Receiver.withUpdateOrigin(avMessage.origin ?? { kind: 'controller' }, () => {
                receiver.handleSignal(avMessage.signal)
              })
            }
            break;
          case AvControlsMessages.ArtworkRuntimeCommandMessage.type:
            this.artworkRuntimeHandlers?.[wsMessage.panelId]?.handleMessage(
              wsMessage.message as AvControlsMessages.ArtworkRuntimeCommandMessage,
            )
            break;
        }
        break;
    }
  }

  send(message: AvControlsMessages.Message, panelId?: string): void {
    const resolvedPanelId = panelId ?? this.resolveDefaultPanelId()
    if (!resolvedPanelId) {
      Logger.warn('Receiver send skipped: no panelId available for outgoing message', { message })
      return
    }
    this.sendWsMessage(new Messages.WrappedMessage(resolvedPanelId, message))
  }

  private resolveDefaultPanelId(): string | null {
    const panelIds = Object.keys(this.rootReceivers)
    if (panelIds.length === 1) {
      return panelIds[0] ?? null
    }
    return null
  }
}

export class Sender extends WebSocketClient implements BaseSender {
  panelId: string | null = null
  private isPanelAttached = false
  private lastSeqByPath = new Map<string, number>()

  constructor(
    url: string,
    private chooseNetPanel: (panelIdList: string[]) => Promise<string>, 
    private senderOptions?: WebSocketSenderOptions,
  ) {
    super(url, senderOptions)
    this.initialize()
  }

  protected connectionRole(): 'sender' {
    return 'sender'
  }

  onConnectionOpened(): void {
    this.isPanelAttached = false
    logWsConnection('sender', 'register-sender', { selectedPanelId: this.panelId })
    this.sendWsMessage(new Messages.RegisterSender());
  }

  async handleWsMessage(message: Messages.Message): Promise<void> {
    switch(message.type) {
      case Messages.PanelList.type:
        await this.handlePanelList((message as Messages.PanelList).panelIds)
        break;
      case Messages.WrappedMessage.type:
        const wrapped = message as Messages.WrappedMessage
        const avMessage = wrapped.message as AvControlsMessages.Message
        if (avMessage.type === AvControlsMessages.RootSpecification.type) {
          this.panelId = wrapped.panelId
          this.isPanelAttached = true
          this.lastSeqByPath.clear()
          logWsConnection('sender', 'panel-attached', {
            panelId: this.panelId,
            specName: (avMessage as AvControlsMessages.RootSpecification).name,
          })
        }
        if (avMessage.type === AvControlsMessages.ControlUpdate.type) {
          const updateMsg = avMessage as AvControlsMessages.ControlUpdate
          const seq = updateMsg.seq
          if (typeof seq === 'number') {
            const path = extractUpdatePath(updateMsg.update)
            const key = path.join('.')
            const last = this.lastSeqByPath.get(key) ?? 0
            if (seq <= last) {
              return
            }
            this.lastSeqByPath.set(key, seq)
          }
        }
        this.broadcastAvMessage(avMessage); 
    }
  }
  
  /**
   * Actual send implementation
   */
  send(message: AvControlsMessages.Message): void {
    if(this.panelId && this.isPanelAttached) {
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

  private async handlePanelList(panelIds: string[]): Promise<void> {
    this.senderOptions?.onPanelList?.([...panelIds])
    logWsConnection('sender', 'panel-list', {
      panelIds,
      currentPanelId: this.panelId,
      isPanelAttached: this.isPanelAttached,
    })

    if (panelIds.length === 0) {
      this.isPanelAttached = false
      return
    }

    if (this.panelId && panelIds.includes(this.panelId)) {
      if (!this.isPanelAttached) {
        logWsConnection('sender', 'reattach-panel', { panelId: this.panelId })
        this.sendWsMessage(new Messages.ChoosePanel(this.panelId))
      }
      return
    }

    const nextPanelId = await this.chooseNetPanel(panelIds)
    if (!nextPanelId || !panelIds.includes(nextPanelId)) {
      Logger.warn('Ignoring invalid panel selection', { nextPanelId, panelIds })
      this.isPanelAttached = false
      logWsConnection('sender', 'invalid-panel-selection', { nextPanelId, panelIds })
      return
    }

    this.panelId = nextPanelId
    this.isPanelAttached = false
    this.lastSeqByPath.clear()
    logWsConnection('sender', 'choose-panel', { panelId: this.panelId })
    this.sendWsMessage(new Messages.ChoosePanel(this.panelId))
  }
}

function extractUpdatePath(update: any): string[] {
  const path: string[] = [];
  let current = update;
  while (current && typeof current === 'object' && 'controlId' in current && 'update' in current) {
    path.push(current.controlId);
    current = current.update;
  }
  return path;
}

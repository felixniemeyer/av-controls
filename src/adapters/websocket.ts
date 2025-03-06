/**
 * WebSocket communication adapter for AV Controls
 */

import { CommunicationAdapter } from './base';
import { CommunicationError, Logger } from '../error';
import type { Message } from '../messages';

/**
 * Options for the WebSocket adapter
 */
export interface WebSocketAdapterOptions {
  /**
   * The URL to connect to
   */
  url: string;
  
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
  
  /**
   * Protocol to be used
   */
  protocol?: string;
}

/**
 * WebSocket-based communication adapter
 */
export class WebSocketAdapter implements CommunicationAdapter {
  private ws: WebSocket | null = null;
  private listener: ((message: any) => void) | null = null;
  private reconnectAttempts = 0;
  private reconnectTimeout: any = null;
  private isConnecting = false;
  private messageQueue: Message[] = [];
  
  /**
   * Create a new WebSocket adapter
   */
  constructor(private options: WebSocketAdapterOptions) {
    // Apply defaults
    this.options = {
      autoReconnect: true,
      reconnectInterval: 3000,
      maxReconnectAttempts: 10,
      protocol: 'av-controls',
      ...options
    };
  }
  
  /**
   * Initialize the connection
   */
  async initialize(): Promise<void> {
    return this.connect();
  }
  
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
        this.ws = new WebSocket(this.options.url);
        
        this.ws.onopen = () => {
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          Logger.info('WebSocket connected', { url: this.options.url });
          
          // Send any queued messages
          this.flushQueue();
          
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
          try {
            const data = JSON.parse(event.data as string);
            
            // Check protocol
            if (data.protocol !== this.options.protocol) {
              return;
            }
            
            if (this.listener) {
              this.listener(data);
            }
          } catch (error) {
            Logger.error('Error processing WebSocket message', { error, data: event.data });
          }
        };
      } catch (error) {
        this.isConnecting = false;
        Logger.error('Error creating WebSocket', { error, url: this.options.url });
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
  
  /**
   * Send queued messages
   */
  private flushQueue(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.doSend(message);
      }
    }
  }
  
  /**
   * Actual send implementation
   */
  private doSend(message: any): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    
    try {
      const serialized = JSON.stringify({
        protocol: this.options.protocol,
        ...message
      });
      
      this.ws.send(serialized);
    } catch (error) {
      Logger.error('Error sending WebSocket message', { error, message });
      throw new CommunicationError(`Failed to send message: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Send a message
   */
  send(message: Message): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      // Queue the message for later sending
      this.messageQueue.push(message);
      
      // Try to connect if not already connecting
      if (!this.isConnecting && (!this.ws || this.ws.readyState === WebSocket.CLOSED)) {
        this.connect().catch(() => {
          // Error is already logged in connect
        });
      }
      
      return;
    }
    
    this.doSend(message);
  }
  
  /**
   * Register a message listener
   */
  addListener(listener: (message: any) => void): void {
    this.listener = listener;
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
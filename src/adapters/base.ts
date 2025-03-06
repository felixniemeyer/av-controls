import { Message } from '../messages';

/**
 * Communication adapter interface for different transport methods
 */
export abstract class CommunicationAdapter {
  /**
   * Send a message to the target
   */
  abstract send(message: Message): void;
  
  /**
   * Register a listener for incoming messages
   */
  abstract addListener(listener: (message: any) => void): void;
  
  /**
   * Initialize the adapter
   */
  abstract initialize?(): Promise<void>;
  
  /**
   * Close the adapter
   */
  abstract close?(): void;
  
  /**
   * Clean up resources
   */
  abstract dispose?(): void;
}
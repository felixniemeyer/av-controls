import { type Message } from '../messages';

/**
 * Communication adapter interface for different transport methods
 */
export abstract class Sender {
  /**
   * Send a message to the target
   */
  abstract send(message: Message): void;

  getBufferedAmount(): number {
    return 0;
  }
  
  /**
   * Register a listener for incoming messages
   */
  abstract addListener(listener: (message: Message) => void): () => void;
}

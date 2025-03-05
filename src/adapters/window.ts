import { type CommunicationAdapter } from '../common';
import { CommunicationError, Logger } from '../error';

/**
 * Browser window communication adapter 
 */
export class WindowCommunicationAdapter implements CommunicationAdapter {
  private listener: ((message: any) => void) | null = null;
  
  constructor(
    private target: Window,
    private protocol: string = 'av-controls'
  ) {}
  
  send(message: any): void {
    try {
      this.target.postMessage({
        protocol: this.protocol,
        ...message
      }, '*');
    } catch (error) {
      Logger.error('Failed to send message', { error, message });
      throw new CommunicationError(`Failed to send message: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  setListener(listener: (message: any) => void): void {
    this.listener = listener;
    
    if (typeof window !== 'undefined') {
      window.addEventListener('message', (event) => {
        try {
          const data = event.data;
          if (!data || typeof data !== 'object' || data.protocol !== this.protocol) {
            return; // Not for us
          }
          
          if (this.listener) {
            this.listener(data);
          }
        } catch (error) {
          Logger.error('Error processing message event', { error, event });
        }
      });
    } else {
      Logger.warn('Window object not available, messaging disabled');
    }
  }
  
  dispose(): void {
    // No resources to clean up
  }
}

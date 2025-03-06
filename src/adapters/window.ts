import { CommunicationAdapter } from './base';
import { CommunicationError, Logger } from '../error';

/**
 * Browser window communication adapter 
 */
export class WindowCommunicationAdapter implements CommunicationAdapter {
  private listeners: ((message: any) => void)[] = [];

  constructor(
    private controllerWindow: Window,
    private protocol: string = 'av-controls'
  ) {
    this.handleMessage = this.handleMessage.bind(this);
    window.addEventListener('message', this.handleMessage.bind(this));
  }
  
  send(message: any): void {
    try {
      this.controllerWindow.postMessage({
        protocol: this.protocol,
        ...message
      }, '*');
    } catch (error) {
      Logger.error('Failed to send message', { error, message });
      throw new CommunicationError(`Failed to send message: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  addListener(listener: (message: any) => void): void {
    this.listeners.push(listener);
  }

  handleMessage(event: MessageEvent): void {
    const data = event.data;
    console.log('this: ', this);
    this.listeners.forEach(listener => listener(data));
  }

  close(): void {
    window.close();
  }
  
  dispose(): void {
    window.removeEventListener('message', this.handleMessage)
    // No resources to clean up
  }
}

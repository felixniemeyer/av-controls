import * as Messages from './messages';
import { Logger } from './error';
import { ControlContainer, type CommunicationAdapter, type ReceiversDict } from './common';

import { WindowCommunicationAdapter } from './adapters';

/**
 * Main receiver class for handling control communication
 */
export class Receiver {
  private communicationAdapter: CommunicationAdapter;
  
  constructor(
    private name: string,
    private receivers: ReceiversDict, 
    communicationTarget: Window | CommunicationAdapter = 
      typeof window !== 'undefined' ? (window.opener || window.parent) : null,
  ) {
    // Set up communication
    if (communicationTarget instanceof Window) {
      this.communicationAdapter = new WindowCommunicationAdapter(communicationTarget)
    } else {
      this.communicationAdapter = communicationTarget
    }
    
    // Set up event handlers
    this.setupCommunication();
    this.setupControlListeners(); 
    
    // Send initial ready message
    this.send(new Messages.Ready());
    
    // Set up tab closing handler
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.sendTabClosing();
      });
    }
  }

  /**
   * Send a message to the controller
   */
  send(message: Messages.Message): void {
    this.communicationAdapter.send(message);
  }

  /**
   * Set up listeners for all controls recursively
   */
  private setupControlListeners(): void {
    ControlContainer.walkReceivers(this.receivers, (control, path) => {
      control.setListener((payload) => {
        this.send(new Messages.ControlUpdate(path, payload));
      });
    });
  }

  /**
   * Announce the controller specification
   */
  announce(): void {
    const controlSpecs = ControlContainer.getSpecs(this.receivers);
    
    Logger.debug('Announcing controller', { name: this.name, specs: controlSpecs });
    this.send(new Messages.ControllerSpecification(this.name, controlSpecs));
  }

  /**
   * Set up communication with the controller
   */
  private setupCommunication(): void {
    this.communicationAdapter.setListener((data) => {
      if (Messages.isNudge(data)) {
        this.announce();
      } else if (Messages.isControlSignal(data)) {
        this.handleControlSignal(data);
      }
    });
  }
  
  /**
   * Handle an incoming control signal
   */
  private handleControlSignal(msg: Messages.ControlSignal): void {
    const control = ControlContainer.getReceiverByPath(this.receivers, msg.controlId);
    
    if (control) {
      try {
        control.handleSignal(msg.payload);
      } catch (error) {
        Logger.error('Error handling control signal', { 
          error, 
          controlId: msg.controlId,
          payload: msg.payload 
        });
      }
    } else {
      Logger.warn('Control not found', { controlId: msg.controlId.join('.') });
    }
  }

  /**
   * Send a tab closing message to the controller
   */
  sendTabClosing(): void {
    try {
      this.send(new Messages.TabClosing());
    } catch (error) {
      Logger.warn('Failed to send tab closing message', { error });
    }
  }
  
  /**
   * Clean up resources when no longer needed
   */
  dispose(): void {
    if (this.communicationAdapter.dispose) {
      this.communicationAdapter.dispose();
    }
  }
}

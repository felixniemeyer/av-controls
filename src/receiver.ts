import * as Messages from './messages';
import * as Controls from './controls';
import { CommunicationAdapter } from './adapters/base';
import { Update } from './controls/base';

/**
 * Main receiver class for handling control communication
 */
export class Receiver {
  constructor(
    private name: string,
    private rootReceiver: Controls.Base.Receiver, 
    private communicationAdapter: CommunicationAdapter
  ) {
    // Set up event handlers
    this.setupCommunication();
    this.setupControlListeners(); 
    
    // Send initial ready message
    this.send(new Messages.Ready());
    
    // Set up tab closing handler
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
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
    this.rootReceiver.onUpdate = (update: Update) => {
      this.send(new Messages.ControlUpdate(update));
    }
  }

  /**
   * Announce the controller specification
   */
  announce(): void {
    this.send(new Messages.RootSpecification(this.name, this.rootReceiver.spec));
  }

  /**
   * Set up communication with the controller
   */
  private setupCommunication(): void {
    this.communicationAdapter.addListener((data) => {
      if (data.type === Messages.Nudge.type) {
        this.announce();
      } else if (data.type === Messages.ControlSignal.type) {
        this.handleControlSignal(data);
      } else if (data.type === Messages.TabClosed.type) {
        if(this.communicationAdapter.close) {
          this.communicationAdapter.close(); 
        }
      }
    });
  }
  
  /**
   * Handle an incoming control signal
   */
  private handleControlSignal(signalMessage: Messages.ControlSignal): void {
    this.rootReceiver.handleSignal(signalMessage.signal)
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

import * as Messages from './messages';
import { Logger } from './error';
import { type ReceiversDict, type ControlId, type SpecsDict } from './common';
import * as Controls from './controls';
import { CommunicationAdapter } from './adapters/base';

/**
 * Base class for hierarchical controls that contain other controls
 */
export abstract class ControlContainer {
  /**
   * Get a control by path from any container or component
   * 
   * @param container The starting control container
   * @param controlPath Path to the desired control
   * @returns The control or undefined if not found
   */
  static getReceiverByPath(container: ReceiversDict, controlPath: ControlId): Controls.Base.Receiver | undefined {
    if (controlPath.length === 0) {
      return undefined;
    }
    
    if (controlPath.length === 1) {
      return container[controlPath[0]];
    }
    
    const currentId = controlPath[0];
    const control = container[currentId];
    
    if (!control) {
      return undefined;
    }
    
    // Call the appropriate traversal function based on control type
    return this.traverseControl(control, controlPath.slice(1));
  }
  
  /**
   * Traverse a control hierarchy based on control type
   * 
   * @param control The current control
   * @param remainingPath The remaining path to traverse
   * @returns The control or undefined if not found
   */
  private static traverseControl(control: Controls.Base.Receiver, remainingPath: string[]): Controls.Base.Receiver | undefined {
    // Check if the control is a container that has controls
    if ('controls' in control) {
      return this.getReceiverByPath((control as any).controls, remainingPath);
    }
    
    // Check if the control is a tabbed pages container
    if ('pages' in control) {
      const pageId = remainingPath[0];
      const pages = (control as any).pages;
      
      if (!pages[pageId]) {
        return undefined;
      }
      
      return this.getReceiverByPath(pages[pageId], remainingPath.slice(1));
    }
    
    return undefined;
  }
  
  /**
   * Walk all controls in a container, calling the callback for each one
   * 
   * @param controls The controls dictionary to walk
   * @param callback Function to call for each control
   * @param path Current path being walked
   */
  static walkReceivers(
    controls: ReceiversDict,
    callback: (control: Controls.Base.Receiver, path: string[]) => void,
    path: string[] = []
  ): void {
    for (const id in controls) {
      const control = controls[id];
      const controlPath = [...path, id];
      
      // Call the callback for this control
      callback(control, controlPath);
      
      // If this is a container, walk its children
      if ('controls' in control) {
        this.walkReceivers((control as any).controls, callback, controlPath);
      }
      
      // If this is a tabbed pages container, walk its pages
      if ('pages' in control) {
        const pages = (control as any).pages;
        
        for (const pageId in pages) {
          const pagePath = [...controlPath, pageId];
          this.walkReceivers(pages[pageId], callback, pagePath);
        }
      }
    }
  }
  
  /**
   * Get specs for a container of controls
   * 
   * @param controls The controls to get specs for
   * @returns A dictionary of control specs
   */
  static getSpecs(controls: ReceiversDict): SpecsDict {
    const specs: SpecsDict = {};
    
    for (const id in controls) {
      specs[id] = controls[id].spec;
    }
    
    return specs;
  }
}


/**
 * Main receiver class for handling control communication
 */
export class Receiver {
  
  constructor(
    private name: string,
    private receivers: ReceiversDict, 
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
    this.communicationAdapter.addListener((data) => {
      console.log('received message', JSON.stringify(data));
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
      this.send(new Messages.TabClosed());
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

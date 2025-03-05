/**
 * Common utilities and base classes for the AV Controls system
 */

import * as Base from './controls/base';

export type SpecsDict = {[id: string]: Base.Spec};
export type ReceiversDict = {[id: string]: Base.Receiver};
export type SendersDict = {[id: string]: Base.Sender};

export type ControlId = string[]

export function controlIdsEqual(a: ControlId, b: ControlId) {
  return a.length === b.length && a.every((value, index) => value === b[index])
}

export class Mapping {
}

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
  static getReceiverByPath(container: ReceiversDict, controlPath: ControlId): Base.Receiver | undefined {
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
  private static traverseControl(control: Base.Receiver, remainingPath: string[]): Base.Receiver | undefined {
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
    callback: (control: Base.Receiver, path: string[]) => void,
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
 * Communication adapter interface for different transport methods
 */
export interface CommunicationAdapter {
  /**
   * Send a message to the target
   */
  send(message: any): void;
  
  /**
   * Register a listener for incoming messages
   */
  setListener(listener: (message: any) => void): void;
  
  /**
   * Initialize the adapter
   */
  initialize?(): Promise<void>;
  
  /**
   * Clean up resources
   */
  dispose?(): void;
}
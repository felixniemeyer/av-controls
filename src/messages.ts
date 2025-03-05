import type { SpecsDict } from './common';
import packageJson from '../package.json'; 

import { Base } from './controls';

import type { ControlId } from './common';

// Define message types as a union of literals
export type MessageType = 
  | 'ready'
  | 'nudge'
  | 'controller-specification'
  | 'control-signal'
  | 'control-update'
  | 'tab-closing';

// Base interface for all messages
export interface Message {
  type: MessageType;
  protocol?: string;
}

export class Ready implements Message {
  static type = 'ready' as const;
  type = Ready.type;

  constructor() {}
}

export class Nudge implements Message {
  static type = 'nudge' as const;
  type = Nudge.type;
  
  constructor() {}
}

export class ControllerSpecification implements Message {
  static type = 'controller-specification' as const;
  type = ControllerSpecification.type;
  version = packageJson.version;

  constructor(
    public name: string,
    public controlSpecs: SpecsDict,
  ) {}
}

// signals go from the controller to the visuals
export class ControlSignal implements Message {
  static type = 'control-signal' as const;
  type = ControlSignal.type;

  constructor(
    public controlId: ControlId,
    public payload: Base.Signal,
  ) {}
}

// updates go from the visuals to the controller
export class ControlUpdate implements Message {
  static type = 'control-update' as const;
  type = ControlUpdate.type;

  constructor(
    public controlId: ControlId,
    public payload: Base.Update,
  ) {}
}

export class TabClosing implements Message {
  static type = 'tab-closing' as const;
  type = TabClosing.type;
}

// Type guard functions to check message types
export function isControlSignal(message: unknown): message is ControlSignal {
  return message !== null && 
    typeof message === 'object' && 
    'type' in message && 
    message.type === ControlSignal.type;
}

export function isControlUpdate(message: unknown): message is ControlUpdate {
  return message !== null && 
    typeof message === 'object' && 
    'type' in message && 
    message.type === ControlUpdate.type;
}

export function isReady(message: unknown): message is Ready {
  return message !== null && 
    typeof message === 'object' && 
    'type' in message && 
    message.type === Ready.type;
}

export function isNudge(message: unknown): message is Nudge {
  return message !== null && 
    typeof message === 'object' && 
    'type' in message && 
    message.type === Nudge.type;
}

export function isControllerSpecification(message: unknown): message is ControllerSpecification {
  return message !== null && 
    typeof message === 'object' && 
    'type' in message && 
    message.type === ControllerSpecification.type;
}

export function isTabClosing(message: unknown): message is TabClosing {
  return message !== null && 
    typeof message === 'object' && 
    'type' in message && 
    message.type === TabClosing.type;
}

/**
 * Common utilities and base classes for the AV Controls system
 */

import * as Controls from './controls';
import {
  Base,
  Group,
  Cake,
  Textbox,
  Letterbox,
  ConfirmButton,
  ConfirmSwitch,
  Fader,
  Label,
  Selector,
  Switch,
  Dots,
  Knob,
  PresetButton,
  Tabs,
  Joystick,
  Modal // Added Modal import
} from './controls';

export type SpecsDict = {[id: string]: Controls.Base.Spec};
export type ReceiversDict = {[id: string]: Controls.Base.Receiver};
export type SendersDict = {[id: string]: Controls.Base.Sender};

/**
 * Base class for input sources (MIDI, keyboard, etc.)
 */
export abstract class InputSource {
  constructor(
    public readonly id: string,
    public readonly type: string
  ) {}
}

/**
 * MIDI input source
 */
export class MidiSource extends InputSource {
  constructor(
    id: string,
    public readonly midiType: 'key' | 'cc'
  ) {
    super(id, 'midi')
  }
}

/**
 * Keyboard input source
 */
export class KeyboardSource extends InputSource {
  constructor(
    public readonly code: string, // e.g., "KeyA", "Digit1"
    public readonly key: string   // e.g., "a", "1"
  ) {
    super(`keyboard-${code}`, 'keyboard')
  }
}

/**
 * Base class for all input signals
 */
export abstract class InputSignal {
  constructor(
    public readonly sourceId: string,
    public readonly type: string,
    public readonly timestamp: number = Date.now()
  ) {}
}

export function createSenderFromSpec(spec: Controls.Base.Spec): Base.Sender {
  if (spec.type === Controls.Pad.Spec.type) {
    return new Controls.Pad.Sender(spec as Controls.Pad.Spec);
  } else if (spec.type === Controls.Fader.Spec.type) {
    return new Fader.Sender(spec as Fader.Spec);
  } else if (spec.type === Switch.Spec.type) {
    return new Switch.Sender(spec as Switch.Spec);
  } else if (spec.type === Selector.Spec.type) {
    return new Selector.Sender(spec as Selector.Spec);
  } else if (spec.type === ConfirmButton.Spec.type) {
    return new ConfirmButton.Sender(spec as ConfirmButton.Spec);
  } else if (spec.type === ConfirmSwitch.Spec.type) {
    return new ConfirmSwitch.Sender(spec as ConfirmSwitch.Spec);
  } else if (spec.type === Label.Spec.type) {
    return new Label.Sender(spec as Label.Spec);
  } else if (spec.type === Cake.Spec.type) {
    return new Cake.Sender(spec as Cake.Spec);
  } else if (spec.type === Letterbox.Spec.type) {
    return new Letterbox.Sender(spec as Letterbox.Spec);
  } else if (spec.type === Textbox.Spec.type) {
    return new Textbox.Sender(spec as Textbox.Spec);
  } else if (spec.type === Dots.Spec.type) {
    return new Dots.Sender(spec as Dots.Spec);
  } else if (spec.type === Knob.Spec.type) {
    return new Knob.Sender(spec as Knob.Spec);
  } else if(spec.type === PresetButton.Spec.type) {
    return new PresetButton.Sender(spec as PresetButton.Spec) 
  } else if(spec.type === Group.Spec.type) {
    return new Group.Sender(spec as Group.Spec)
  } else if(spec.type === Tabs.Spec.type) {
    return new Tabs.Sender(spec as Tabs.Spec)
    } else if(spec.type === Joystick.Spec.type) {
      return new Joystick.Sender(spec as Joystick.Spec)
    } else if(spec.type === Modal.Spec.type) { // Added Modal case
      return new Modal.Sender(spec as Modal.Spec)
    }
    throw new Error(`Unknown control type: ${spec.type}`)
  }
  
import {type Dict} from './dict';
import * as ControlSpecs from './control-specs'
import * as MeterSpecs from './meter-specs'
import Messages from './messages'

function randomId() {
  return ((Math.random() + 1) * Math.pow(36, 9)).toString(36).substring(0,10)
}

abstract class Control {
  abstract handleMessage(payload: any) : void;
  abstract spec: ControlSpecs.ControlSpec;
}

class Fader extends Control {
  public value: number;
  constructor(
    public spec: ControlSpecs.FaderSpec,
    public onChange?: (value: number) => void,
  ) {
    super();
    this.value = spec.initialValue;
  }

  handleMessage(payload: any) {
    // need to be a value
    if(typeof payload === 'number') {
      if(this.onChange) {
        this.onChange(payload);
      }
      this.value = payload;
    } else {
      throw('received slider value that is not a number');
    }
  }
}

class Pad extends Control {
  public pressed = false;
  constructor(
    public spec: ControlSpecs.PadSpec,
    public onPress?: (velocity: number) => void,
    public onRelease?: () => void,
  ) {
    super();
  }

  handleMessage(payload: any) {
    if(typeof payload === 'object') {
      if(payload.press == true) {
        if(this.pressed == false && this.onPress) {
          this.onPress(payload.velocity);
        }
        this.pressed = true;
      } else {
        if(this.pressed == true && this.onRelease) {
          this.onRelease();
        }
        this.pressed = false;
      }
    }
  }
}

class Switch extends Control {
  public on: boolean;
  constructor(
    public spec: ControlSpecs.SwitchSpec,
    public onToggle?: (on: boolean) => void,
  ) {
    super();
    this.on = spec.initiallyOn;
  }

  handleMessage(payload: any): void {
    if(typeof payload === 'boolean') {
      if(this.onToggle) {
        this.onToggle(payload);
      }
      this.on = payload;
    } else {
      throw('received switch value that is not a boolean');
    }
  }
}

class Selector extends Control {
  public index: number;
  constructor(
    public spec: ControlSpecs.SelectorSpec,
    public onSelect?: (index: number) => void,
  ) {
    super();
    this.index = spec.initialIndex;
  }

  handleMessage(payload: any): void {
    if(typeof payload === 'number' && payload % 1 === 0 && payload >= 0) {
      if(this.onSelect) {
        this.onSelect(payload);
      }
      this.index = payload;
    } else {
      throw('received selector value that is not a whole, positive (with 0) number');
    }
  }
}

class ConfirmButton extends Control {
  constructor(
    public spec: ControlSpecs.ConfirmButtonSpec,
    public onConfirmedPress?: () => void,
    public onPress?: () => void,
  ) {
    super();
  }

  handleMessage(payload: any) {
    if(typeof payload === 'boolean') {
      if(payload == true) {
        if(this.onConfirmedPress) {
          this.onConfirmedPress();
        }
      } else {
        if(this.onPress) {
          this.onPress();
        }
      }
    }
  }
}

class Label extends Control {
  constructor(
    public spec: ControlSpecs.PadSpec,
  ) {
    super();
  }

  handleMessage(_payload: any) {
    // wont happen
  }
}

class ConfirmSwitch extends Control {
  constructor(
    public spec: ControlSpecs.ConfirmSwitchSpec,
    public onConfirmedOn?: (isOn: boolean) => void,
  ) {
    super();
  }

  handleMessage(payload: any) {
    if(typeof payload === 'boolean') {
      const on = payload;
      if(this.onConfirmedOn) {
        this.onConfirmedOn(on);
      }
    }
  }
}


// Meters

type Listener = (payload: any) => void;
abstract class Meter {
  abstract spec: MeterSpecs.MeterSpec;
  private listeners: Listener[] = [];
  addListener(listener: Listener) {
    this.listeners.push(listener);
  }
  sendValue(payload: any) {
    this.listeners.forEach((listener) => {
      listener(payload);
    });
  }
}

class Cake extends Meter {
  constructor(
    public spec: MeterSpecs.CakeSpec,
  ) {
    super();
  }
}


class ReceiverBuilder {
  private controls: { [id: string]: Control } = {};

  private meters: { [id: string]: Meter } = {};

  constructor(
    private name: string, 
  ) { }

  addControl(control: Control, id?: string) {
    if(id === undefined) {
      id = this.makeUpId(control.spec.name, this.controls);
    }
    this.controls[id] = control;
    return this;
  }

  addMeter(meter: Meter, id?: string) {
    if(id === undefined) {
      id = this.makeUpId(meter.spec.name, this.meters);
    }
    this.meters[id] = meter;
  }

  makeUpId(name: string, dict: {[id: string]: any}) {
    let id = name
    let i = 1
    while(dict[id] !== undefined) {
      id = name + (++i)
    }
    return id
  }

  build() {
    return new Receiver(this.controls, this.meters, this.name);
  }
}

class Receiver {
  private randomId = randomId();

  constructor(
    private controls: Dict<Control>, 
    private meters: Dict<Meter>,
    private name: string,
  ) {
    this.announce();
    this.listen();
    for(let id in this.meters) {
      const meter = this.meters[id];
      meter.addListener((payload) => {
        if(window.opener !== null) {
          window.opener.postMessage(
            new Messages.MeterMessage(id, payload, this.randomId),
            '*'
          );
        }
      })
    }
    window.addEventListener('beforeunload', () => {
      this.sendTabClosing();
    })
  }

  announce() {
    if(window.opener !== null) {
      const meterSpecs: Dict<MeterSpecs.MeterSpec> = {}
      for(let id in this.meters) {
        meterSpecs[id] = this.meters[id].spec;
      }
      const controlSpecs: Dict<ControlSpecs.ControlSpec> = {}
      for(let id in this.controls) {
        controlSpecs[id] = this.controls[id].spec;
      }
      window.opener.postMessage(
        new Messages.AnnounceReceiver(this.name, controlSpecs, meterSpecs, this.randomId),
        '*'
      );
    }
  }

  listen() {
    window.addEventListener('message', (event) => {
      if(window.opener !== null) {
        const data = event.data;
        const type = data.type;
        if(type === Messages.ControlMessage.type) {
          const msg = data as Messages.ControlMessage;
          const control = this.controls[msg.controlId]
          console.log('received control message', msg);
          control.handleMessage(msg.payload);
        }
      }
    });
  }

  sendTabClosing() {
    if(window.opener !== null) {
      window.opener.postMessage(
        new Messages.TabClosing(), 
        '*'
      );
    }
  }
}

export {
  Receiver, 
  ReceiverBuilder,
  Fader,
  Pad,
  Switch,
  Selector,
  ConfirmButton,
  Label,
  ConfirmSwitch, 
  // meters
  Cake,
}


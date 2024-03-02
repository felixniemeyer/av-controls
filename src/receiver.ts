import * as Specs from './control-specs'
import Messages from './messages'

abstract class Control {
  abstract handleMessage(payload: any) : void;
  abstract spec: Specs.ControlSpec;
}

class Fader extends Control {
  public value: number;
  constructor(
    public spec: Specs.FaderSpec,
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
    public spec: Specs.PadSpec,
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
    public spec: Specs.SwitchSpec,
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
    public spec: Specs.SelectorSpec,
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

class ReceiverBuilder {
  private controls: Control[] = [];

  constructor(
    private name: string, 
  ) { }

  addControl(control: Control) {
    this.controls.push(control);
    return this;
  }

  build() {
    return new Receiver(this.controls, this.name);
  }
}

class Receiver {
  constructor(
    private controls: Control[], 
    private name: string,
  ) {
    this.announce();
    this.listen();
    window.addEventListener('beforeunload', () => {
      this.sendTabClosing();
    })
  }

  announce() {
    if(window.opener !== null) {
      console.log('announcing controls');
      console.log('opener', window.opener);
      const specs = this.controls.map((control) => control.spec);
      window.opener.postMessage(
        new Messages.AnnounceReceiver(this.name, specs), 
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
          const control = this.controls[msg.controlIndex]
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
}


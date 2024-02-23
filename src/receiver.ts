import { ControlSpec, FaderSpec, PadSpec } from './control-specs'
import Messages from './messages'

abstract class Control {
  abstract handleMessage(payload: any) : void;
  abstract spec: ControlSpec;
}

class Fader extends Control {
  public value: number;
  constructor(
    public spec: FaderSpec,
    public onChange?: (value: number) => void,
  ) {
    super();
    this.value = spec.initialValue;
  }

  handleMessage(payload: any) {
    // need to be a value
    if(typeof payload === 'number') {
      if(payload < 0 || payload > 1) {
        throw('received slider value outside of range [0,1]');
      } else {
        if(this.onChange) {
          this.onChange(payload);
        }
        this.value = payload;
      }
    } else {
      throw('received slider value that is not a number');
    }
  }
}

class Pad extends Control {
  public pressed = false;
  constructor(
    public spec: PadSpec,
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
}


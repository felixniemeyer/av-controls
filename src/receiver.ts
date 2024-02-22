import { v4 as uuidv4 } from 'uuid';

import { ControlSpecification } from './control-specification'
import Messages from './messages'

abstract class Control {
  constructor(
    public spec: ControlSpecification
  ){}

  abstract handleMessage(payload: any) : void;
}
class Fader extends Control {
  public value: number;
  constructor(
    x: number,
    y: number,
    width: number,
    height: number,
    name: string,
    initValue: number,
    public onChange?: (value: number) => void,
  ) {
    super({
      x, y, 
      width, height,
      name, type: 'fader',
    });
    this.value = initValue;
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

class Button extends Control {
  public pressed = false;
  constructor(
    x: number, y: number, size: number, name: string,
    public onPress?: () => void,
    public onRelease?: () => void,
  ) {
    super({
      x, y, 
      width: size, height: size, 
      name, type: 'button'
    });
  }

  handleMessage(payload: any) {
  }
}


class ReceiverBuilder {
  private controls: Control[] = [];

  constructor(
    private name: string, 
    private allowedHosts: string[]
  ) { }

  addControl(control: Control) {
    this.controls.push(control);
    return this;
  }

  build() {
    // check that all controls have unique names
    this.controls.forEach((control, i) => {
      this.controls.forEach((otherControl, j) => {
        if (i !== j && control.spec.name === otherControl.spec.name) {
          throw new Error(`Control name ${control.spec.name} is not unique`);
        }
      });
    });
    return new Receiver(this.controls, this.name, this.allowedHosts);
  }
}

class Receiver {
  private id: string;
  private origin: string;

  constructor(
    private controls: Control[], 
    private name: string,
    private allowedOrigins: string[]
  ) {
    // make uuid
    this.id = uuidv4();
    this.origin = window.location.origin;
    this.announce();
    this.listen();
  }

  announce() {
    const specs = this.controls.map((control) => control.spec);
    this.allowedOrigins.forEach((allowedOrigin) => {
      window.postMessage(
        new Messages.AnnounceReceiver(this.origin, this.id, specs, this.name), 
        allowedOrigin
      );
    });
  }

  listen() {
    window.addEventListener('message', (event) => {
      const origin = event.origin;
      const data = event.data;
      if(data.type && this.allowedOrigins.includes(origin)) {
        const type = data.type;
        if(type === Messages.SearchForReceivers.type){
          this.announce();
        } else if(type === Messages.ControlMessage.type) {
          const msg = data as Messages.ControlMessage;
          if(msg.receiverId === this.id) {
            const control = this.controls[msg.controlIndex]
            control.handleMessage(msg.payload);
          }
        }
      }
    });
  }
}

export {
  Receiver, 
  ReceiverBuilder,
  Fader,
  Button,
}


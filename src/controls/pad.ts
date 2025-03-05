import * as Base from './base';
import { UpdateParsingError } from '../error'

class Signal extends Base.Signal {
  constructor(
    public pressed: boolean,
    public velocity: number,
  ) {
    super();
  }
  static tryFromAny(payload: any): Signal {
    const pressed = payload.pressed;
    if (typeof pressed !== 'boolean') {
      throw new UpdateParsingError(`pressed must be a boolean, got ${pressed}`);
    }
    if (typeof payload.velocity !== 'number') {
      throw new UpdateParsingError(`velocity must be a number, got ${payload.velocity}`);
    }
    return new Signal(pressed, payload.velocity);
  }
}

export class Spec extends Base.Spec {
  static type = 'pad' as const 
  public type = Spec.type

  constructor(
    baseArgs: Base.Args,
  ) {
    super(baseArgs);
  }
}

/**
 * Pad control receiver
 */
export class Receiver extends Base.Receiver {
  public pressed = false;
  
  constructor(
    public spec: Spec,
    public onPress?: (velocity: number) => void,
    public onRelease?: () => void,
  ) {
    super();
  }

  handleSignal(payload: Signal): void {
    if (payload.pressed) {
      if (!this.pressed && this.onPress) {
        this.onPress(payload.velocity || 1.0);
      }
      this.pressed = true;
    } else {
      if (this.pressed && this.onRelease) {
        this.onRelease();
      }
      this.pressed = false;
    }
  }
}

type PadEvent = {press: true, velocity: number} | {press: false}

export class Sender extends Base.Sender {
  pressed: boolean = false

  constructor(
    public spec: Spec,
  ) {
    super()
  }

  press(v: number) {
    this.pressed = true
    this.onControl({press: true, velocity: v} as PadEvent)
  }

  release() {
    this.pressed = false
    this.onControl({press: false} as PadEvent)
  }
}
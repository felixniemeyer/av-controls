import * as Base from './base';

class Signal extends Base.Signal {
  constructor(
    public pressed: boolean,
    public velocity?: number,
  ) {
    super();
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
      if (!this.pressed ) {
        this.pressed = true;
        if(this.onPress) {
          this.onPress(payload.velocity || 1.0);
        }
      }
    } else {
      if (this.pressed) {
        this.pressed = false;
        if(this.onRelease) {
          this.onRelease();
        }
      }
    }
  }
}

export class Sender extends Base.Sender {
  pressed: boolean = false

  constructor(
    public spec: Spec,
  ) {
    super()
  }

  press(v: number) {
    this.pressed = true
    this.onSignal(new Signal(true, v))
  }

  release() {
    this.pressed = false
    this.onSignal(new Signal(false))
  }
}
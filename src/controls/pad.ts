import * as Base from './base';

class Signal extends Base.Signal {
  constructor(
    public pressed: boolean,
    public velocity?: number,
  ) {
    super();
  }
}

export class Update extends Base.Update {
  constructor(
    public pressed: boolean,
    public velocity: number = 0,
  ) {
    super();
  }
}

export class State extends Base.State {
  constructor(
    public pressed: boolean = false,
    public velocity: number = 0,
  ) {
    super();
  }
}

export class Spec extends Base.Spec {
  static type = 'pad' as const 
  public type = Spec.type

  constructor(
    baseArgs: Base.Args,
    public initialState: State = new State(false, 0),
  ) {
    super(baseArgs);
  }
}

/**
 * Pad control receiver
 */
export class Receiver extends Base.Receiver {
  public pressed = false;
  public velocity = 0;
  
  constructor(
    public spec: Spec,
    public onPress?: (velocity: number) => void,
    public onRelease?: () => void,
  ) {
    super();
    this.pressed = spec.initialState.pressed;
    this.velocity = spec.initialState.velocity;
  }

  handleSignal(payload: Signal): void {
    if (payload.pressed) {
      this.velocity = payload.velocity || 1.0;
      if (!this.pressed ) {
        this.pressed = true;
        if(this.onPress) {
          this.onPress(this.velocity);
        }
      }
    } else {
      if (this.pressed) {
        this.pressed = false;
        this.velocity = 0;
        if(this.onRelease) {
          this.onRelease();
        }
      }
    }
    this.onUpdate(new Update(this.pressed, this.velocity));
  }

  getState(): State {
    return new State(this.pressed, this.velocity);
  }

  restoreState(state: State): void {
    this.pressed = state.pressed;
    this.velocity = state.velocity;
    if (this.pressed) {
      this.onPress?.(this.velocity || 1.0);
    } else {
      this.onRelease?.();
    }
  }
}

export class Sender extends Base.Sender {
  pressed: boolean = false
  velocity: number = 0

  constructor(
    public spec: Spec,
  ) {
    super()
  }

  press(v: number) {
    this.pressed = true
    this.velocity = v
    this.onSignal(new Signal(true, v))
  }

  release() {
    this.pressed = false
    this.velocity = 0
    this.onSignal(new Signal(false))
  }

  getState() {
    return new State(this.pressed, this.velocity)
  }

  setState(state: State) {
    if (state.pressed) {
      this.press(state.velocity)
      return
    }
    this.release()
  }

  handleUpdate(update: Update) {
    this.pressed = update.pressed
    this.velocity = update.velocity
  }
}

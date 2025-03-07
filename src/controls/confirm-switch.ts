import * as Base from './base';
import { UpdateParsingError } from '../error';

export class Signal extends Base.Signal {
  constructor(
    public on: boolean,
  ) {
    super();
  }
  static tryFromAny(payload: any): Signal {
    const on = payload.on;
    if (typeof on !== 'boolean') {
      throw new UpdateParsingError(`on must be a boolean, got ${on}`);
    }
    return new Signal(on);
  }
}

export class Spec extends Base.Spec {
  static type = 'confirm-switch'
  public type = Spec.type

  constructor(
    baseArgs: Base.Args,
    public initiallyOn: boolean = false
  ) {
    super(baseArgs);
  }
}

/**
 * Confirm switch control receiver
 */
export class Receiver extends Base.Receiver {
  constructor(
    public spec: Spec,
    public onConfirmedSwitch?: (isOn: boolean) => void,
  ) {
    super();
  }

  handleSignal(signal: Signal): void {
    if (this.onConfirmedSwitch) {
      this.onConfirmedSwitch(signal.on);
    }
  }
}

export class State extends Base.State {
  constructor(
    public on: boolean,
  ) {
    super();
  }
}

export class Sender extends Base.Sender {
  awaitingConfirmation: boolean = false
  on: boolean 

  constructor(
    public spec: Spec,
  ) {
    super()
    this.on = spec.initiallyOn
  }

  private defuseTimer? : number
  press() {
    if(this.defuseTimer !== undefined) {
      clearTimeout(this.defuseTimer)
      this.defuseTimer = undefined
    }
    if(this.awaitingConfirmation) {
      this.awaitingConfirmation = false
      this.on = !this.on
      this.onSignal(new Signal(this.on))
    } else {
      this.awaitingConfirmation = true
      this.defuseTimer = setTimeout(() => {
        this.awaitingConfirmation = false
      }, 4000)
    }
  }

  cancel() {
    this.awaitingConfirmation = false
  }

  getState() {
    return new State(this.on)
  }

  setState(state: State) {
    this.on = state.on
    this.onSignal(new Signal(this.on))
  }
}

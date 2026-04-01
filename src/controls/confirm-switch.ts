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

export class Update extends Base.Update {
  constructor(
    public on: boolean,
  ) {
    super();
  }
}

export class Spec extends Base.Spec {
  static type = 'confirm-switch'
  public type = Spec.type

  constructor(
    baseArgs: Base.Args,
    public initialState: State = new State(false),
  ) {
    super(baseArgs);
  }
}

/**
 * Confirm switch control receiver
 */
export class Receiver extends Base.Receiver {
  public on: boolean = false

  constructor(
    public spec: Spec,
    public onConfirmedSwitch?: (isOn: boolean) => void,
  ) {
    super();
    this.on = spec.initialState.on;
  }

  handleSignal(signal: Signal): void {
    this.on = signal.on;
    if (this.onConfirmedSwitch) {
      this.onConfirmedSwitch(signal.on);
    }
    this.onUpdate(new Update(signal.on));
  }

  getState(): State {
    return new State(this.on);
  }

  restoreState(state: State): void {
    this.on = state.on;
    if (this.onConfirmedSwitch) {
      this.onConfirmedSwitch(this.on);
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
    this.on = spec.initialState.on
  }

  press() {
    if(this.awaitingConfirmation) {
      this.awaitingConfirmation = false
      this.on = !this.on
      this.onSignal(new Signal(this.on))
    } else {
      this.awaitingConfirmation = true
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

  handleUpdate(update: Update) {
    this.on = update.on
    // A remote/timeline-driven update resolves any local half-confirmed click.
    this.awaitingConfirmation = false
  }
}

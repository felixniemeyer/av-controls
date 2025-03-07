import * as Base from './base';
import { UpdateParsingError } from '../error';

export class Signal extends Base.Signal {
  constructor(
    public confirmed: boolean,
  ) {
    super();
  }
  static tryFromAny(payload: any): Signal {
    const confirmed = payload.confirmed;
    if (typeof confirmed !== 'boolean') {
      throw new UpdateParsingError(`confirmed must be a boolean, got ${confirmed}`);
    }
    return new Signal(confirmed);
  }
}

export class Spec extends Base.Spec {
  static type = 'confirm-button'
  public type = Spec.type

  constructor(
    baseArgs: Base.Args,
  ) {
    super(baseArgs);
  }
}

/**
 * Confirm button control receiver
 */
export class Receiver extends Base.Receiver {
  constructor(
    public spec: Spec,
    public onConfirmedPress?: () => void,
    public onPress?: () => void,
  ) {
    super();
  }

  handleSignal(payload: Signal): void {
    if (payload.confirmed) {
      if (this.onConfirmedPress) {
        this.onConfirmedPress();
      }
    } else {
      if (this.onPress) {
        this.onPress();
      }
    }
  }
}

export class Sender extends Base.Sender {
  awaitingConfirmation: boolean = false

  constructor(
    public spec: Spec,
  ) {
    super()
  }

  private defuseTimer? : number
  press() {
    if(this.defuseTimer !== undefined) {
      clearTimeout(this.defuseTimer)
      this.defuseTimer = undefined
    }
    if(this.awaitingConfirmation) {
      this.onSignal(new Signal(true))
      this.awaitingConfirmation = false
    } else {
      this.awaitingConfirmation = true
      this.onSignal(new Signal(false))
      this.defuseTimer = setTimeout(() => {
        this.awaitingConfirmation = false
      }, 4000)
    }
  }

  cancel() {
    this.awaitingConfirmation = false
  }
}

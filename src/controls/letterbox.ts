import * as Base from './base';
import { SignalParsingError } from '../error'

class Signal extends Base.Signal {
  constructor(
    public letter: string,
  ) {
    super();
  }
  static tryFromAny(payload: any): Signal {
    const letter = payload.letter;
    if (typeof letter !== 'string') {
      throw new SignalParsingError(`letter must be a string, got ${letter}`);
    }
    return new Signal(letter);
  }
}

export class Spec extends Base.Spec {
  static type = 'letterbox'
  public type = Spec.type

  constructor(
    baseArgs: Base.Args,
  ) {
		super(baseArgs);
	}
}

export class Receiver extends Base.Receiver {
  constructor(
    public spec: Spec,
    public onLetter?: (letter: string) => void,
  ) {
    super();
  }

  handleSignal(signal: Signal): void {
    if (this.onLetter) {
      this.onLetter(signal.letter);
    }
  }
}

export class State extends Base.State {
  constructor(
    public letter: string,
  ) {
    super();
  }
}

export class Sender extends Base.Sender {
  constructor(
    public spec: Spec, 
  ) {
    super()
  }

  send(message: string) {
    this.onSignal(new Signal(message))
  }
}
import * as Base from './base';
import { SignalParsingError } from '../error';

class Signal extends Base.Signal {
  constructor(
    public text: string,
  ) {
    super();
  }
  static tryFromAny(payload: any): Signal {
    const text = payload.text;
    if (typeof text !== 'string') {
      throw new SignalParsingError(`text must be a string, got ${text}`);
    }
    return new Signal(text);
  }
}

export class Spec extends Base.Spec {
  static type = 'textbox'
  public type = Spec.type

  constructor(
    baseArgs: Base.Args,
		public initialText: string,
	) {
		super(baseArgs);
	}
}

/**
 * Textbox control receiver
 */
export class Receiver extends Base.Receiver {
  public text: string = '';

  constructor(
    public spec: Spec, 
    public onTextChange?: (text: string) => void, 
  ) {
    super();
    this.text = spec.initialText;
  }

  handleSignal(signal: Signal): void {
    this.text = signal.text;
    if (this.onTextChange) {
      this.onTextChange(this.text);
    }
  }
}

export class State extends Base.State {
  constructor(
    public text: string,
  ) {
    super();
  }
}

export class Sender extends Base.Sender {
  public text: string = ''

  constructor(
    public spec: Spec,
  ) {
    super()
    this.text = spec.initialText
  }

  send() {
    this.onSignal(new Signal(this.text))
  }

  getState() {
    return new State(this.text)
  }

  setState(state: State) {
    this.text = state.text
  }
}

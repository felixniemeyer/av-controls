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

export class Update extends Base.Update {
  constructor(
    public text: string,
  ) {
    super();
  }
}

export class Spec extends Base.Spec {
  static type = 'textbox'
  public type = Spec.type

  constructor(
    baseArgs: Base.Args,
    public initialState: State,
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
    this.text = spec.initialState.text;
  }

  handleSignal(signal: Signal): void {
    this.text = signal.text;
    if (this.onTextChange) {
      this.onTextChange(this.text);
    }
    this.onUpdate(new Update(this.text));
  }

  getState(): State {
    return new State(this.text);
  }

  restoreState(state: State): void {
    this.text = state.text;
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
    this.text = spec.initialState.text
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

  handleUpdate(update: Update) {
    this.text = update.text
  }
}

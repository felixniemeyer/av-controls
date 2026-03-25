import { UpdateParsingError } from '../error';
import * as Base from './base';

export class Update extends Base.Update {
  constructor(
    public value: number,
  ) {
    super();
  }
  static tryFromAny(payload: any): Update {
    const value = payload.value;
    if (typeof value !== 'number') {
      throw new UpdateParsingError(`value must be a number, got ${value}`);
    }
    return new Update(value);
  }
}

export class State extends Base.State {
  constructor(
    public value: number,
  ) {
    super();
  }
}

export class Spec extends Base.Spec {
  static type = 'meter'
  public type = Spec.type

  constructor(
    baseArgs: Base.Args,
    public min: number,
    public max: number,
    public initialState: State,
  ) {
    super(baseArgs);
  }
}

/**
 * Meter control receiver (display-only vertical bar)
 */
export class Receiver extends Base.Receiver {
  public value: number;

  constructor(
    public spec: Spec,
  ) {
    super();
    this.value = spec.initialState.value;
  }

  sendValue(value: number): void {
    this.value = value;
    this.onUpdate(new Update(value));
  }

  getState(): State {
    return new State(this.value);
  }

  restoreState(state: State): void {
    this.value = state.value;
  }
}

export class Sender extends Base.Sender {
  value: number

  constructor(
    public spec: Spec,
  ) {
    super()
    this.value = spec.initialState.value
  }

  handleUpdate(payload: Update) {
    this.value = payload.value
  }

  getState() {
    return new State(this.value)
  }

  setState(state: State) {
    this.value = state.value
  }
}

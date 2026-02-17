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
  static type = 'cake'
  public type = Spec.type

  constructor(
    baseArgs: Base.Args,
    public min: number,
    public max: number,
    public initialState: State,
    public decimalPlaces: number,
  ) {
    super(baseArgs);
  }
}
/**
 * Cake control receiver (display-only)
 */
export class Receiver extends Base.Receiver {
  constructor(
    public spec: Spec,
  ) {
    super();
  }

  sendValue(value: number): void {
    this.onUpdate(new Update(value));
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
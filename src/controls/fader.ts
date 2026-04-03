import * as Base from './base';
import { UpdateParsingError } from '../error';
import { mapNormToValue, mapValueToNorm, type RangeMapping } from './range-mapping';

export class Signal extends Base.Signal {
  constructor(
    public value: number,
  ) {
    super();
  }
  static tryFromAny(payload: any): Signal {
    const value = payload.value;
    if (typeof value !== 'number') {
      throw new UpdateParsingError(`value must be a number, got ${value}`);
    }
    return new Signal(value);
  }
}

export class Update extends Base.Update {
  constructor(
    public value: number,
  ) {
    super();
  }
}

export class Spec extends Base.Spec {
  static type = 'fader'
  public type = Spec.type

  constructor(
    baseArgs: Base.Args,
    public initialState: State,
    public min: number,
    public max: number,
    public decimalPlaces: number,
    public isHorizontal: boolean = false,
    public mapping: RangeMapping = 'linear',
  ) {
    super(baseArgs);
  }

}

export class Receiver extends Base.Receiver {
  public value: number;

  constructor(
    public spec: Spec,
    public onChange?: (value: number) => void,
  ) {
    super();
    this.value = spec.initialState.value;
  }

  handleSignal(payload: Signal): void {
    this.value = payload.value;
    if (this.onChange) {
      this.onChange(payload.value);
    }
    this.onUpdate(new Update(payload.value));
  }

  getState(): State {
    return new State(this.value);
  }

  restoreState(state: State): void {
    this.value = state.value;
    if (this.onChange) {
      this.onChange(this.value);
    }
    // Note: does NOT call onUpdate - avoids persistence loop
  }
}

export class State extends Base.State {
  constructor(
    public value: number,
  ) {
    super();
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

  setValue(value: number) {
    this.value = value
    this.onSignal(new Signal(value))
  }

  setNormValue(normValue: number) {
    const mapped = mapNormToValue(normValue, this.spec.min, this.spec.max, this.spec.mapping)
    this.setValue(mapped)
  }

  getNormValue() {
    return mapValueToNorm(this.value, this.spec.min, this.spec.max, this.spec.mapping)
  }

  getState() {
    return new State(this.value)
  }

  setState(state: State) {
    this.setValue(state.value)
  }

  handleUpdate(update: Update) {
    this.value = update.value
  }
}

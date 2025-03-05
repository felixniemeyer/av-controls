import * as Base from './base';
import { SignalParsingError } from '../error';

export class Signal extends Base.Signal {
  constructor(
    public value: number,
  ) {
    super();
  }
  static tryFromAny(payload: any): Signal {
    if (typeof payload !== 'number') {
      throw new SignalParsingError(`Invalid signal to Knob: ${JSON.stringify(payload)}`);
    }
    return new Signal(payload);
  }
}

export class Spec extends Base.Spec {
  static type = 'knob'
  public type = Spec.type

  constructor(
    baseArgs: Base.Args,
    public initialValue: number,
    public min: number,
    public max: number,
    public decimalPlaces: number,
  ) {
    super(baseArgs);
  }
}


/**
 * Knob control receiver (similar to fader)
 */
export class Receiver extends Base.Receiver {
  public value: number;

  constructor(
    public spec: Spec,
  ) {
    super();
    this.value = spec.initialValue;
  }

  handleSignal(signal: Signal): void {
    this.value = signal.value;
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
    this.value = spec.initialValue
  }

  setValue(value: number) {
    this.value = value
    this.onControl(new Signal(value))
  }

  setNormValue(normValue: number) {
    const mapped = normValue * (this.spec.max - this.spec.min) + this.spec.min
    this.setValue(mapped)
  }

  getNormValue() {
    return (this.value - this.spec.min) / (this.spec.max - this.spec.min)
  }

  getState() {
    return new State(this.value)
  }

  setState(state: State) {
    this.setValue(state.value)
  }
}

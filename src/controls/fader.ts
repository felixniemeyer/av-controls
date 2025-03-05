import * as Base from './base';
import { UpdateParsingError } from '../error';

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

export class Spec extends Base.Spec {
  static type = 'fader'
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

export class Receiver extends Base.Receiver {
  public value: number;
  
  constructor(
    public spec: Spec,
    public onChange?: (value: number) => void,
  ) {
    super();
    this.value = spec.initialValue;
  }

  handleSignal(payload: Signal): void {
    if (this.onChange) {
      this.onChange(payload.value);
    }
    
    this.value = payload.value;
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
    this.onControl(value)
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
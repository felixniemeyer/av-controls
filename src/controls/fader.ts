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
    public initialValue: number,
    public min: number, 
    public max: number,
    public decimalPlaces: number,
    public isHorizontal: boolean = false,
    public mapping: 'linear' | 'square' = 'linear',
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
    this.value = payload.value;
    if (this.onChange) {
      this.onChange(payload.value);
    }
    this.onUpdate(new Update(payload.value));
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

function mapNormToValue(normValue: number, min: number, max: number, mapping: 'linear' | 'square') {
  const clamped = Math.max(0, Math.min(1, normValue))
  if (mapping === 'square') {
    return min + (clamped * clamped) * (max - min)
  }
  return min + clamped * (max - min)
}

function mapValueToNorm(value: number, min: number, max: number, mapping: 'linear' | 'square') {
  const range = max - min
  if (range === 0) return 0
  const clamped = Math.max(0, Math.min(1, (value - min) / range))
  if (mapping === 'square') {
    return Math.sqrt(clamped)
  }
  return clamped
}

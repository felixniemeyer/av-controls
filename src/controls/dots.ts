import * as Base from './base';
import { SignalParsingError } from '../error';

export type Dot = [number, number]

export class Update extends Base.Update {
  constructor(
    public values: Dot[],
  ) {
    super();
  }
}

interface SingleValue {
  index: number,
  dot: Dot,
}

type FullValue = Dot[];

class Signal extends Base.Signal {
  constructor(
    public type: 'single' | 'full',
    public value: SingleValue | FullValue,
  ) {
    super();
  }
  static tryFromAny(payload: any): Signal {
    const type = payload.type;
    if(type == 'single' && payload.dot !== undefined && payload.index !== undefined) {
      return new Signal(type, {index: payload.index, dot: payload.dot});
    } else if (type == 'full' && payload.dots) {
      return new Signal(type, payload.dots);
    } else {
      throw new SignalParsingError(`Invalid signal to Dots: ${JSON.stringify(payload)}`);
    }
  }
}

export class Spec extends Base.Spec {
  static type = 'dots'
  public type = Spec.type

  constructor(
    baseArgs: Base.Args,
    public initialValues: Dot[],
    public xPadding = 0.01,
    public yPadding = -1,
//    public displayStyle: 'curve' | 'polygon',
  ) {
    super(baseArgs);
  }
}

/**
 * Dots control receiver for curves and points
 */
export class Receiver extends Base.Receiver {
  values: Dot[];

  constructor(
    public spec: Spec,
    public onDotsChange?: (dots: Dot[]) => void,
  ) {
    super();
    this.values = [...spec.initialValues]; // Clone to avoid reference issues
  }

  handleSignal(signal: Signal): void {
    if (signal.type === 'single') {
      // Update a single dot
      const value = signal.value as SingleValue;
      this.values[value.index] = value.dot;
    } else if (signal.type === 'full') {
      this.values = signal.value as FullValue;
    }
    
    if (this.onDotsChange) {
      this.onDotsChange(this.values);
    }
  }
}

export class State extends Base.State {
  constructor(
    public values: Dot[],
  ) {
    super();
  }
}

export class Sender extends Base.Sender {
  values: Dot[]

  constructor(
    public spec: Spec,
	) {
    super()
    this.values = spec.initialValues
  }

  moveDot(index: number, value: Dot) {
    this.values[index] = value
    this.onSignal(new Signal('single', {index, dot: value}))
  }

  getState() {
    return new State(this.deproxy())
  }

  setState(state: State) {
    this.values = state.values 
    this.onSignal(new Signal('full', this.deproxy()))
  }

  deproxy() {
    return this.values.map(dot => dot.slice()) as Dot[]
  }
}

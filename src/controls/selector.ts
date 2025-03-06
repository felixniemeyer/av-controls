import * as Base from './base';
import { UpdateParsingError } from '../error';

export class Signal extends Base.Signal {
    constructor(
        public index: number,
    ) {
        super();
    }
    static tryFromAny(payload: any): Signal {
        const index = payload.index;
        if (typeof index !== 'number') {
            throw new UpdateParsingError(`index must be a number, got ${index}`);
        }
        return new Signal(index);
    }
}

export class Spec extends Base.Spec {
  static type = 'selector'
  public type = Spec.type

  constructor(
    baseArgs: Base.Args,
    public options: string[],
    public initialIndex: number,
  ) {
    super(baseArgs);
  }
}

/**
 * Selector control receiver
 */
export class Receiver extends Base.Receiver {
  public index: number;
  
  constructor(
    public spec: Spec,
    public onSelect?: (index: number) => void,
  ) {
    super();
    this.index = spec.initialIndex;
  }

  handleSignal(payload: Signal): void {
    if (this.onSelect) {
      this.onSelect(payload.index);
    }
    this.index = payload.index;
  }
}

export class State extends Base.State {
  constructor(
    public index: number,
  ) {
    super();
  }
}

export class Sender extends Base.Sender {
  index: number

  constructor(
    public spec: Spec,
  ) {
    super()
    this.index = spec.initialIndex
  }

  select(value: number) {
    this.index = value
    this.onControl(value)
  }

  increment() {
    this.index = (this.index + 1) % this.spec.options.length
  }

  decrement() {
    this.index = (this.index - 1 + this.spec.options.length) % this.spec.options.length
  }

  getState() {
    return new State(this.index)
  }

  setState(state: State) {
    this.select(state.index)
  }
}

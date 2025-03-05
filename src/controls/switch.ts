import * as Base from './base';
import { UpdateParsingError } from '../error';

export class Signal extends Base.Signal {
    constructor(
        public on: boolean,
    ) {
        super();
    }
    static tryFromAny(payload: any): Signal {
        const on = payload.on;
        if (typeof on !== 'boolean') {
            throw new UpdateParsingError(`on must be a boolean, got ${on}`);
        }
        return new Signal(on);
    }
}

export class Spec extends Base.Spec {
  static type = 'switch'
  public type = Spec.type

  constructor(
    baseArgs: Base.Args,
    public initiallyOn: boolean = false
  ) {
    super(baseArgs);
  }
}

export class Receiver extends Base.Receiver {
  public on: boolean;
  
  constructor(
    public spec: Spec,
    public onToggle?: (on: boolean) => void,
  ) {
    super();
    this.on = spec.initiallyOn;
  }

  handleSignal(payload: Signal): void {
    if (this.onToggle) {
      this.onToggle(payload.on);
    }
    
    this.on = payload.on;
  }
}

export class State extends Base.State {
  constructor(
    public on: boolean,
  ) {
    super();
  }
}

export class Sender extends Base.Sender {
  on: boolean

  constructor(
    public spec: Spec,
  ) {
    super()
    this.on = spec.initiallyOn
  }

  toggle() {
    this.on = !this.on
    this.onControl(this.on)
  }

  getState() {
    return new State(this.on)
  }

  setState(state: State) {
    this.on = state.on
  }
}

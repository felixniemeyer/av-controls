import * as Base from './base';
import { UpdateParsingError } from '../error';

export class Signal extends Base.Signal {
  constructor(
    public x: number,
    public y: number,
  ) {
    super();
  }
  static tryFromAny(payload: any): Signal {
    const x = payload.x;
    const y = payload.y;
    if (typeof x !== 'number' || typeof y !== 'number') {
      throw new UpdateParsingError(`x and y must be numbers, got x=${x}, y=${y}`);
    }
    return new Signal(x, y);
  }
}

export class Update extends Base.Update {
  constructor(
    public x: number,
    public y: number,
  ) {
    super();
  }
}

export class Spec extends Base.Spec {
  static type = 'joystick'
  public type = Spec.type

  constructor(
    baseArgs: Base.Args,
    public initialValue: { x: number; y: number } = { x: 0, y: 0 },
  ) {
    super(baseArgs);
  }
}

export class Receiver extends Base.Receiver {
  public x: number;
  public y: number;

  constructor(
    public spec: Spec,
    public onPositionChange?: (x: number, y: number) => void,
  ) {
    super();
    this.x = spec.initialValue.x;
    this.y = spec.initialValue.y;
  }

  handleSignal(payload: Signal): void {
    this.x = payload.x;
    this.y = payload.y;
    if (this.onPositionChange) {
      this.onPositionChange(payload.x, payload.y);
    }
    this.onUpdate(new Update(payload.x, payload.y));
  }
}

export class State extends Base.State {
  constructor(
    public x: number,
    public y: number,
  ) {
    super();
  }
}

export class Sender extends Base.Sender {
  x: number
  y: number

  constructor(
    public spec: Spec,
	) {
    super()
    this.x = spec.initialValue.x
    this.y = spec.initialValue.y
  }

  setPosition(x: number, y: number) {
    this.x = x
    this.y = y
    this.onSignal(new Signal(x, y))
  }

  reset() {
    this.setPosition(0, 0)
  }

  getState() {
    return new State(this.x, this.y)
  }

  setState(state: State) {
    this.setPosition(state.x, state.y)
  }

  handleUpdate(update: Update) {
    this.x = update.x
    this.y = update.y
  }
}

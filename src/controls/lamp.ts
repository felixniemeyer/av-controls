import { UpdateParsingError } from '../error';
import * as Base from './base';

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value))
}

export class Update extends Base.Update {
  constructor(
    public amount: number,
  ) {
    super();
  }
  static tryFromAny(payload: any): Update {
    const amount = payload.amount;
    if (typeof amount !== 'number') {
      throw new UpdateParsingError(`amount must be a number, got ${amount}`);
    }
    return new Update(amount);
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
  static type = 'lamp'
  public type = Spec.type

  constructor(
    baseArgs: Base.Args,
    public initialState: State,
    public decayToAfter1Second: number = 0.5,
  ) {
    super(baseArgs);
  }
}

/**
 * Lamp control receiver (display-only flash indicator)
 */
export class Receiver extends Base.Receiver {
  public value: number;

  constructor(
    public spec: Spec,
  ) {
    super();
    this.value = clamp01(spec.initialState.value);
  }

  trigger(amount: number = 1): void {
    this.value = clamp01(this.value + amount);
    this.onUpdate(new Update(amount));
  }

  getState(): State {
    return new State(this.value);
  }

  restoreState(state: State): void {
    this.value = clamp01(state.value);
  }
}

export class Sender extends Base.Sender {
  value: number
  lastValueAtMs: number
  flashVersion = 0

  constructor(
    public spec: Spec,
  ) {
    super()
    this.value = clamp01(spec.initialState.value)
    this.lastValueAtMs = Date.now()
  }

  private decayMultiplier(elapsedSeconds: number) {
    const target = clamp01(this.spec.decayToAfter1Second)
    if (target === 0) return elapsedSeconds <= 0 ? 1 : 0
    if (target === 1) return 1
    return Math.pow(target, elapsedSeconds)
  }

  getValueAt(nowMs = Date.now()) {
    const elapsedSeconds = Math.max(0, (nowMs - this.lastValueAtMs) / 1000)
    return clamp01(this.value * this.decayMultiplier(elapsedSeconds))
  }

  handleUpdate(payload: Update) {
    const nowMs = Date.now()
    const decayedValue = this.getValueAt(nowMs)
    this.value = clamp01(decayedValue + payload.amount)
    this.lastValueAtMs = nowMs
    this.flashVersion += 1
  }

  getState() {
    return new State(this.getValueAt())
  }

  setState(state: State) {
    this.value = clamp01(state.value)
    this.lastValueAtMs = Date.now()
    this.flashVersion += 1
  }
}

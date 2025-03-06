import { Logger, UpdateParsingError } from '../error';
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

export class Spec extends Base.Spec {
  static type = 'cake'
  public type = Spec.type

  constructor(
    baseArgs: Base.Args,
    public min: number, 
    public max: number,
    public initialValue: number,
    public decimalPlaces: number,
  ) { 
    super(baseArgs);
  }
}
/**
 * Cake control receiver (display-only)
 */
export class Receiver extends Base.Receiver {
  private lastUpdateTime: number = 0;

  constructor(
    public spec: Spec,
    private throttle = 2000,
  ) {
    super();
  }

  handleSignal(_signal: Base.Signal): void {
    // Cake doesn't handle incoming messages
    Logger.debug('Cake received message, ignoring', { cake: this.spec.name });
  }

  sendValue(value: number): void {
    const now = Date.now();
    if (now - this.lastUpdateTime > this.throttle) {
      this.lastUpdateTime = now;
      this.sendUpdate(new Update(value));
    }
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

  update(payload: Update) {
    this.value = payload.value
  }
}
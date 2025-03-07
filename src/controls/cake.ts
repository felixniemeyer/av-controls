import { UpdateParsingError } from '../error';
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
  constructor(
    public spec: Spec,
  ) {
    super();
  }

  sendValue(value: number): void {
    this.onUpdate(new Update(value));
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

  handleUpdate(payload: Update) {
    this.value = payload.value
  }
}
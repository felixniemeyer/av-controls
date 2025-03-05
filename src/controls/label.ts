import * as Base from './base';
import { Logger } from '../error';

export class Spec extends Base.Spec {
  static type = 'label'
  public type = Spec.type

  constructor(
    baseArgs: Base.Args,
    public labelPosition: 'top' | 'center' | 'bottom',
  ) {
    super(baseArgs);
  }
}

export class Receiver extends Base.Receiver {
  constructor(
    public spec: Spec,
  ) {
    super();
  }

  handleSignal(_signal: Base.Signal): void {
    // Labels don't handle signals
    Logger.debug('Label received signal, ignoring', { label: this.spec.name });
  }
}

export class Sender extends Base.Sender {
  constructor(
    public spec: Spec,
  ) {
    super()
  }
}

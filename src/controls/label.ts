import * as Base from './base';

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
}

export class Sender extends Base.Sender {
  constructor(
    public spec: Spec,
  ) {
    super()
  }
}

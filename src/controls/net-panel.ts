import * as Base from './base';
import { type SpecsDict, type ReceiversDict, type ControlId } from '../common';
import { Logger } from '../error';

export class Update extends Base.Update {
  constructor(
    public payload: Base.Update,
    public id: ControlId,
  ) {
    super();
  }
}

export class SpecWithoutControls extends Base.Spec {
  static type = 'net-panel-without-controls'
  public type = SpecWithoutControls.type

  constructor(
    baseArgs: Base.Args,
  ) {
    super(baseArgs);
  }
}

export class Spec extends Base.Spec {
  static type = 'net-panel'
  public type = Spec.type

  constructor(
    baseArgs: Base.Args,
    public controlSpecs: SpecsDict,
  ) {
    super(baseArgs);
  }
}

/**
 * NetPanel for networking controls between tabs
 */
export class Receiver extends Base.Receiver {
  public spec: Spec;

  constructor(
    spec: SpecWithoutControls,
    public controls: ReceiversDict,
  ) {
    super();
    const controlSpecs: SpecsDict = {};
    
    for (const id in controls) {
      controlSpecs[id] = controls[id].spec;
    }
    
    this.spec = new Spec(
      spec.baseArgs,
      controlSpecs,
    );
  }

  handleSignal(_signal: Base.Signal): void {
    // NetPanel doesn't handle messages directly
    Logger.debug('NetPanel received message, ignoring', { panel: this.spec.name });
  }
}

export class Sender extends Base.Sender {
  constructor(
    public spec: Spec,
    private onUpdate: (update: Update) => void,
  ) {
    super()
  }

  update(update: Update) {
    if(update.id.length > 0) {
      this.onUpdate(new Update(update.payload, update.id))
    } 
  }

  traverse(callback: Base.TraversalCallback, object: any) {
    callback(this, object)
  }
}
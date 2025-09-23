import * as Base from './base';

import { type SpecsDict, type ReceiversDict, type SendersDict, createSenderFromSpec } from "../common";

export class Update extends Base.Update {
    constructor(
        public controlId: string,
        public update: Base.Update,
    ) {
        super();
    }
}

export class Signal extends Base.Signal {
    constructor(
        public controlId: string,
        public signal: Base.Signal,
    ) {
        super();
    }
}

// this control is special as it contains other controls
export class SpecWithoutControls extends Base.Spec {
  static type = 'group-without-controls'
  public type = SpecWithoutControls.type

  constructor(
    baseArgs: Base.Args,
  ) {
    super(baseArgs);
  }
}

// this control is special as it contains other controls
export class Spec extends Base.Spec {
  static type = 'group'
  public type = Spec.type

  constructor(
    baseArgs: Base.Args,
    public controlSpecs: SpecsDict, 
  ) {
    super(baseArgs);
  }
}


/**
 * A group container for other controls
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
      const control = controls[id]
      if (control) {
        controlSpecs[id] = control.spec;
        control.onUpdate = (update: Base.Update) => {
          this.onUpdate(new Update(id, update))
        }
      }
    }
    this.spec = this.makeSpec(spec, controlSpecs);
  }

  makeSpec(spec: SpecWithoutControls, controlSpecs: SpecsDict) {
    return new Spec(
      spec.baseArgs,
      controlSpecs,
    );
  }

  addControlSpecsToSpec(_baseArgs: Base.Args, _controlSpecs: SpecsDict) {
  }

  handleSignal(signal: Signal): void {
    const control = this.controls[signal.controlId];
    if (control) {
      control.handleSignal(signal.signal);
    }
  }
}

type GroupState = {[id: string]: Base.State}

export class State extends Base.State {
  constructor(
    public states: GroupState,
  ) {
    super();
  }
}

export class Sender extends Base.Sender {
  public senders: SendersDict

  constructor(
    public spec: Spec,
  ) {
    super()
    this.senders = {}
    for(const id in spec.controlSpecs) {
      const controlSpec = spec.controlSpecs[id]
      if (controlSpec) {
        const sender = createSenderFromSpec(controlSpec)
        this.senders[id] = sender
        sender.onSignal = (signal: Base.Signal) => {
          this.onSignal(new Signal(id, signal))
        }
        sender.parent = this
      }
    }
  }

  handleUpdate(update: Update) {
    const sender = this.senders[update.controlId]
    if (sender) {
      sender.handleUpdate(update.update)
    }
  }

  getState() {
    const states: GroupState = {}
    for (const id in this.senders) {
      states[id] = this.senders[id]!.getState()
    }
    return new State(states)
  }

  setState(state: State) {
    for (const id in this.senders) {
      const stateForControl = state.states[id]
      if (stateForControl) {
        this.senders[id]!.setState(stateForControl)
      }
    }
  }

  traverse(callback: Base.TraversalCallback, object: any) {
    const nodeObject = object.self = object.self || {}
    const children = object.children = object.children || {}
    callback(this, nodeObject)
    for (const id in this.senders) {
      const subObject = children[id] = children[id] || {}
      this.senders[id]!.traverse(callback, subObject)
    }
  }

  deepForeach(callback: Base.DeepForeachCallback) {
    callback(this)
    for (const id in this.senders) {
      this.senders[id]!.deepForeach(callback)
    }
  }
}

import * as Base from './base';
import * as Group from './group'; // We still need Group for Update/Signal if we want to share message types, or we redefine them. 
// To keep it clean and compatible, let's redefine.

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

// Modal Spec - distinct type
export class Spec extends Base.Spec {
  static type = 'modal'
  public type = Spec.type

  constructor(
    baseArgs: Base.Args,
    public controlSpecs: SpecsDict, 
    public modalWidth: number = 80,
    public modalHeight: number = 80,
  ) {
    super(baseArgs);
  }
}

/**
 * Modal control receiver
 */
export class Receiver extends Base.Receiver {
  public spec: Spec;

  constructor(
    spec: Group.SpecWithoutControls, // We use Group's SpecWithoutControls as the "input" spec
    public controls: ReceiversDict,
    public modalWidth: number = 80,
    public modalHeight: number = 80,
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
    this.spec = new Spec(
        spec.baseArgs,
        controlSpecs,
        modalWidth,
        modalHeight
    )
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

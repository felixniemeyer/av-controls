import { Logger } from "../error";
import * as Base from './base';
import { UpdateParsingError } from '../error';

import { type SpecsDict, type ReceiversDict, type SendersDict } from "../common";

export type GroupStyle = 'framed' | 'logical' | 'page';

export class Update extends Base.Update {
    constructor(
        public childControlId: string,
        public update: Base.Update,
    ) {
        super();
    }
    static tryFromAny(payload: any): Update {
        const childControlId = payload.childControlId
        if(typeof childControlId !== 'string') {
            throw new UpdateParsingError(`childControlId must be a string, got ${childControlId}`)
        }
        const childUpdate = Base.Update.tryFromAny(payload.update);
        if(!childUpdate) {
            throw new UpdateParsingError(`childUpdate must be an Update, got ${payload.update}`)
        }
        return new Update(
            childControlId,
            childUpdate,
        );
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
    public style: GroupStyle = 'framed',
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
    public style?: GroupStyle,
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
      controlSpecs[id] = controls[id].spec;
    }
    this.spec = new Spec(
      spec.baseArgs,
      controlSpecs,
      spec.style
    );
  }

  handleSignal(_payload: Base.Signal): void {
    Logger.debug('Group received message, ignoring', { group: this.spec.name });
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
  constructor(
    public spec: Spec,
    public senders: SendersDict,
  ) {
    super()
  }

  update(update: Update) {
    if(update.childControlId) {
      this.senders[update.childControlId].update(update.update)
    } 
  }

  getState() {
    const states: GroupState = {}
    for (const id in this.senders) {
      states[id] = this.senders[id].getState()
    }
    return new State(states)
  }

  setState(state: State) {
    for (const id in this.senders) {
      this.senders[id].setState(state.states[id])
    }
  }

  traverse(callback: Base.TraversalCallback, object: any) {
    const nodeObject = object.self = object.self || {}
    callback(this, nodeObject)
    for (const id in this.senders) {
      const subObject = object.children[id] = object.children[id] || {}
      this.senders[id].traverse(callback, subObject)
    }
  }

}
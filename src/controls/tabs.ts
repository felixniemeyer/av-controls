import { type SpecsDict } from '../common'
import { Group, Base } from '../controls'

export class State extends Group.State {
  constructor(
    public activeId: string,
    states: {[id: string]: Base.State},
  ) {
    super(states);
  }
}

export class SpecWithoutControls extends Group.SpecWithoutControls {
  static type = 'tabs-without-controls'
  public type = SpecWithoutControls.type

  constructor(
    baseArgs: Base.Args,
    public initialActiveId: string,
  ) {
    super(baseArgs)
  }
}

export class Spec extends Group.Spec {
  static type = 'tabs'
  public type = Spec.type

  constructor(
    baseArgs: Base.Args,
    public tabs: {[id: string]: Base.Spec},
    public initialActiveId: string,
  ) {
    super(baseArgs, tabs)
  }
}

export class Receiver extends Group.Receiver {
  public type = 'tabs'
  public activeId: string

  constructor(
    spec: SpecWithoutControls,
    tabs: {[id: string]: Base.Receiver},
  ) {
    super(spec, tabs)
    this.activeId = spec.initialActiveId
  }

  makeSpec(spec: SpecWithoutControls, controlSpecs: SpecsDict) {
    return new Spec(
      spec.baseArgs,
      controlSpecs,
      spec.initialActiveId,
    );
  }

  getState(): State {
    const childStates: {[id: string]: Base.State} = {};
    for (const id in this.controls) {
      childStates[id] = this.controls[id]!.getState();
    }
    return new State(this.activeId, childStates);
  }

  restoreState(state: State): void {
    if (state instanceof State) {
      this.activeId = state.activeId;
    }
    for (const id in this.controls) {
      const childState = state.states[id];
      if (childState) {
        this.controls[id]!.restoreState(childState);
      }
    }
  }
}

export class Sender extends Group.Sender {
  public type = 'tabs'
  public activeId: string

  constructor(
    public spec: Spec,
  ) {
    super(spec)
    this.activeId = spec.initialActiveId
  }

  getState(): State {
    const childStates: {[id: string]: Base.State} = {};
    for (const id in this.senders) {
      childStates[id] = this.senders[id]!.getState();
    }
    return new State(this.activeId, childStates);
  }

  setState(state: State): void {
    if (state instanceof State) {
      this.activeId = state.activeId;
    }
    for (const id in this.senders) {
      const childState = state.states[id];
      if (childState) {
        this.senders[id]!.setState(childState);
      }
    }
  }
}


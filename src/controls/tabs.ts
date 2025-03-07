import { type SpecsDict } from '../common'
import { Group, Base } from '../controls'

export class SpecWithoutControls extends Group.SpecWithoutControls {
  static type = 'tabs-without-controls'
  public type = SpecWithoutControls.type

  constructor(
    baseArgs: Base.Args,
    public initiallyActiveId: string
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
    public initiallyActiveId: string
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
    this.activeId = spec.initiallyActiveId
  }

  makeSpec(spec: SpecWithoutControls, controlSpecs: SpecsDict) {
    return new Spec(
      spec.baseArgs,
      controlSpecs,
      spec.initiallyActiveId
    );
  }
}

export class Sender extends Group.Sender {
  public type = 'tabs'
  public activeId: string

  constructor(
    public spec: Spec,
  ) {
    super(spec)
    this.activeId = spec.initiallyActiveId
  }
}


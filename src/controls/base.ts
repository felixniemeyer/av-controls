import { Mapping } from '../common'

// updates go from visuals to controller
export class Update {
}

// signals go from controller to visuals
export class Signal {
}

export class Args {
  constructor(
    public name: string,
    public x: number,
    public y: number,
    public width: number,
    public height: number,
    public color: string,
  ) {}
}

export class Spec {
  static type = ''
  public type = Spec.type

  public name: string
  public x: number
  public y: number
  public width: number
  public height: number
  public color: string
  constructor(
    public baseArgs: Args,
  ) {
    this.name = baseArgs.name
    this.x = baseArgs.x
    this.y = baseArgs.y
    this.width = baseArgs.width
    this.height = baseArgs.height
    this.color = baseArgs.color
  }
}

type OnUpdateCallback = (payload: Update) => void
type OnSignalCallback = (payload: Signal) => void
type OnTouchCallback = () => void

export abstract class Receiver {
  abstract spec: Spec;

  public onUpdate: OnUpdateCallback = () => {}

  handleSignal(_payload: Signal): void {
  }
}


export type TraversalCallback = (sender: Sender, object: any) => void
export type DeepForeachCallback = (sender: Sender) => void

export class State {
}

export abstract class Sender {
  public abstract spec: Spec

  public mappings: Mapping[] = []

  public onSignal: OnSignalCallback = () => {}
  public onTouch: OnTouchCallback = () => {}

  public parent?: Sender

  constructor(
  ) { }

  tabIndex() {
    return 0
  }

  addMapping(mapping: Mapping) {
    this.mappings.push(mapping)
  }

  removeMappings() {
    this.mappings = []
  }

  handleUpdate(_update: Update) {
  }

  getState() {
    return new State()
  }

  setState(_state: State): void {
  }

  traverse(callback: TraversalCallback, object: any) {
    callback(this, object)
  }

  deepForeach(callback: DeepForeachCallback) {
    callback(this)
  }
}
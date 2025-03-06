import { Mapping } from '../common'

// updates go from visuals to controller
export class Update {
  static tryFromAny(object: any): Update {
    return object as Update;
  }
}

// signals go from controller to visuals
export class Signal {
  static tryFromAny(object: any): Signal {
    return object as Signal;
  }
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

export type Listener = (payload: Signal) => void;

export abstract class Receiver {
  abstract handleSignal(payload: Signal): void;
  abstract spec: Spec;

  private listeners: Listener[] = [];

  public setListener(listener: Listener): void {
    this.listeners.push(listener);
  }

  protected sendUpdate(payload: Update): void {
    for (const listener of this.listeners) {
      listener(payload);
    }
  }
}

type OnControlCallback = (payload: Signal) => void
type OnTouchCallback = () => void

export type TraversalCallback = (sender: Sender, object: any) => void

export class State {
}


export abstract class Sender {
  public abstract spec: Spec

  public mappings: Mapping[] = []

  public onControl: OnControlCallback = () => {}
  public onTouch: OnTouchCallback = () => {}

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

  update(_update: Update) {
  }

  getState() : State {
    return new State()
  }

  setState(_state: State) {
  }

  traverse(callback: TraversalCallback, object: any) {
    callback(this, object)
  }
}
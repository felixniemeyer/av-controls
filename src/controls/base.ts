import type { UpdateOrigin } from '../messages';

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
  ) {
    // Sanitize name: '/' is used as path separator in persistence
    if (name.includes('/')) {
      console.warn(`Control name "${name}" contains '/'. Replacing with '-'.`)
      this.name = name.replace(/\//g, '-')
    }
  }
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

type OnUpdateCallback = (update: Update) => void
type OnSignalCallback = (signal: Signal) => void
type OnTouchCallback = () => void

export abstract class Receiver {
  private static updateOriginStack: UpdateOrigin[] = []
  abstract spec: Spec;

  public onUpdate: OnUpdateCallback = () => {}

  handleSignal(_signal: Signal): void {
  }

  getState(): State {
    return new State()
  }

  // Restore state WITHOUT triggering onUpdate (avoids persistence loop)
  restoreState(_state: State): void {
  }

  static withUpdateOrigin<T>(origin: UpdateOrigin, fn: () => T): T {
    Receiver.updateOriginStack.push(origin)
    try {
      return fn()
    } finally {
      Receiver.updateOriginStack.pop()
    }
  }

  static currentUpdateOrigin(): UpdateOrigin | undefined {
    return Receiver.updateOriginStack[Receiver.updateOriginStack.length - 1]
  }
}


export type TraversalCallback = (sender: Sender, object: any) => void
export type DeepForeachCallback = (sender: Sender) => void

export class State {
}

export abstract class Sender {
  public abstract spec: Spec

  public onSignal: OnSignalCallback = () => {}
  public onTouch: OnTouchCallback = () => {}

  public parent?: Sender

  constructor(
  ) { }

  tabIndex() {
    return 0
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

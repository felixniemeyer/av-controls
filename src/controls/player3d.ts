import * as Base from './base';
import { UpdateParsingError } from '../error';

export type Vec3 = [number, number, number]
export type Quaternion = [number, number, number, number]

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isVec3(value: unknown): value is Vec3 {
  return Array.isArray(value)
    && value.length === 3
    && value.every(isFiniteNumber)
}

function isQuaternion(value: unknown): value is Quaternion {
  return Array.isArray(value)
    && value.length === 4
    && value.every(isFiniteNumber)
}

function cloneVec3(value: Vec3): Vec3 {
  return [value[0], value[1], value[2]]
}

function cloneQuaternion(value: Quaternion): Quaternion {
  return [value[0], value[1], value[2], value[3]]
}

export class Signal extends Base.Signal {
  constructor(
    public position: Vec3,
    public rotation: Quaternion,
  ) {
    super();
  }

  static tryFromAny(payload: any): Signal {
    if (!isVec3(payload?.position)) {
      throw new UpdateParsingError(`position must be a 3-number tuple, got ${payload?.position}`)
    }
    if (!isQuaternion(payload?.rotation)) {
      throw new UpdateParsingError(`rotation must be a 4-number tuple, got ${payload?.rotation}`)
    }
    return new Signal(cloneVec3(payload.position), cloneQuaternion(payload.rotation))
  }
}

export class Update extends Base.Update {
  constructor(
    public position: Vec3,
    public rotation: Quaternion,
  ) {
    super();
  }
}

export class State extends Base.State {
  constructor(
    public position: Vec3,
    public rotation: Quaternion,
  ) {
    super();
  }
}

export class Spec extends Base.Spec {
  static type = 'player3d'
  public type = Spec.type

  constructor(
    baseArgs: Base.Args,
    public initialState: State = new State([0, 0, 0], [0, 0, 0, 1]),
    public moveSpeed: number = 1,
    public lookSensitivity: number = 0.0025,
    public enableRoll: boolean = false,
  ) {
    super(baseArgs);
  }
}

export class Receiver extends Base.Receiver {
  public position: Vec3
  public rotation: Quaternion

  constructor(
    public spec: Spec,
    public onChange?: (position: Vec3, rotation: Quaternion) => void,
  ) {
    super();
    this.position = cloneVec3(spec.initialState.position)
    this.rotation = cloneQuaternion(spec.initialState.rotation)
  }

  handleSignal(payload: Signal): void {
    this.position = cloneVec3(payload.position)
    this.rotation = cloneQuaternion(payload.rotation)
    this.onChange?.(cloneVec3(this.position), [...this.rotation] as Quaternion)
    this.onUpdate(new Update(cloneVec3(this.position), [...this.rotation] as Quaternion))
  }

  getState(): State {
    return new State(cloneVec3(this.position), [...this.rotation] as Quaternion)
  }

  restoreState(state: State): void {
    this.position = cloneVec3(state.position)
    this.rotation = cloneQuaternion(state.rotation)
    this.onChange?.(cloneVec3(this.position), [...this.rotation] as Quaternion)
  }
}

export class Sender extends Base.Sender {
  public position: Vec3
  public rotation: Quaternion

  constructor(
    public spec: Spec,
  ) {
    super()
    this.position = cloneVec3(spec.initialState.position)
    this.rotation = cloneQuaternion(spec.initialState.rotation)
  }

  setPose(position: Vec3, rotation: Quaternion) {
    this.position = cloneVec3(position)
    this.rotation = cloneQuaternion(rotation)
    this.onSignal(new Signal(cloneVec3(this.position), [...this.rotation] as Quaternion))
  }

  getState() {
    return new State(cloneVec3(this.position), [...this.rotation] as Quaternion)
  }

  setState(state: State) {
    this.setPose(state.position, state.rotation)
  }

  handleUpdate(update: Update) {
    this.position = cloneVec3(update.position)
    this.rotation = cloneQuaternion(update.rotation)
  }
}

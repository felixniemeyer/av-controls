import * as Base from './base';
import { Logger } from '../error';

export class Update extends Base.Update {
  constructor(
    public action: 'random' | 'next'
  ) {
    super();
  }
}

export class Spec extends Base.Spec {
  static type = 'preset-button'
  public type = Spec.type

  constructor(
    baseArgs: Base.Args,
    public stencil: any,
  ) {
		super(baseArgs);
	}
}

export class Receiver extends Base.Receiver {
  constructor(
    public spec: Spec,
  ) {
    super();
  }

  handleSignal(_signal: Base.Signal): void {
    Logger.debug('PresetButton received message, ignoring', { button: this.spec.name });
  }

  makeRandomSwitch(): void {
    this.onUpdate(new Update('random'));
  }
}

export class Sender extends Base.Sender {
  private savedParentStates: {[id: string]: Base.State} = {}

  private lastPresetLoaded: string | undefined

  getLoadedPreset() {
    return this.lastPresetLoaded
  }

  constructor(
    public spec: Spec,
  ) {
    super()
  }
  
  handleUpdate(update: Update) {
    console.log('update arrived at ', update)
    if(update.action == 'next') {
      this.nextPresetInRow()
    } else if(update.action == 'random') {
      this.randomPreset()
    }
  }

  save(presetId: string) {
    if(this.parent) {
      const state = this.parent.getState()
      console.log(`saving preset ${presetId}`, state)
      this.savedParentStates[presetId] = state
    }
  }

  load(presetId: string) {
    const savedState = this.savedParentStates[presetId]
    if(this.parent && savedState) {
      this.parent.setState(savedState)
    }
    this.lastPresetLoaded = presetId
  }

  getAllPresets() {
    return this.savedParentStates
  }

  setPresets(presets: {[id: string]: Base.State}) {
    this.savedParentStates = presets
  }

  deletePreset(presetId: string) {
    delete this.savedParentStates[presetId]
  }

  nextPresetInRow() {
    const presetIds = Object.keys(this.savedParentStates)
    if(presetIds.length > 0) {
      let i = 0
      if(this.lastPresetLoaded !== undefined) {
        i = (presetIds.indexOf(this.lastPresetLoaded) + 1) % presetIds.length
      }
      const nextPresetId = presetIds[i]!
      this.load(nextPresetId)
    }
  }

  randomPreset() {
    const presetIds = Object.keys(this.savedParentStates)
    if(presetIds.length > 0) {
      let i 
      if(this.lastPresetLoaded !== undefined) { 
        i = Math.floor(Math.random() * (presetIds.length - 1))
        const prevIndex = presetIds.indexOf(this.lastPresetLoaded)
        if(i >= prevIndex) {
          i += 1 
        }
      } else {
        i = Math.floor(Math.random() * presetIds.length)
      }
      const nextPresetId = presetIds[i]!
      this.load(nextPresetId)
    }
  }

  getNames() {
    return Object.keys(this.savedParentStates)
  }
}

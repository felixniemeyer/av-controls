import * as Base from './base';
import { Logger } from '../error';
import { type SendersDict } from '../common';

export class Update extends Base.Update {
  constructor(
    public action: 'random' | 'next'
  ) {
    super();
  }
  static tryFromPayload(payload: any) : Update | undefined {
    if(payload.action == 'random') {
      return new Update('random')
    } else if(payload.action == 'next') {
      return new Update('next')
    }
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

  handleSignal(signal: Update): void {
    // PresetButton doesn't handle incoming messages directly
    Logger.debug('PresetButton received message, ignoring', { button: this.spec.name });
  }

  makeRandomSwitch(): void {
    this.sendUpdate(new Update('random'));
  }
}

type Preset = {[id: string]: Base.State}

export class Sender extends Base.Sender {
  private presets: {[id: string]: Preset} = {}

  private lastPresetLoaded: string | undefined

  getLoadedPreset() {
    return this.lastPresetLoaded
  }

  constructor(
    public spec: Spec,
    private controls: SendersDict
  ) {
    super()
  }
  
  update(payload: any) {
    if(payload.action == 'next') {
      this.nextPresetInRow()
    } else if(payload.action == 'random') {
      this.randomPreset()
    }
  }

  save(presetId: string) {
    const preset: Preset = {}
    for(let key in this.controls) {
      preset[key] = this.controls[key].getState()
    }
    this.presets[presetId] = preset
  }

  load(presetId: string) {
    const preset = this.presets[presetId]
    if(preset !== undefined) {
      for(let key in preset) {
        this.controls[key].setState(preset[key])
      }
    }
  }

  getAllPresets() {
    return this.presets
  }

  setPresets(presets: {[id: string]: Preset}) {
    this.presets = presets
  }

  deletePreset(presetId: string) {
    delete this.presets[presetId]
  }

  nextPresetInRow() {
    const presetIds = Object.keys(this.presets)
    if(presetIds.length > 0) {
      let i = 0
      if(this.lastPresetLoaded !== undefined) {
        i = (presetIds.indexOf(this.lastPresetLoaded) + 1) % presetIds.length
      } 
      const nextPresetId = presetIds[i]
      this.load(nextPresetId)
    }
  }

  randomPreset() {
    const presetIds = Object.keys(this.presets)
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
      const nextPresetId = presetIds[i]
      this.load(nextPresetId)
    }
  }

  getNames() {
    return Object.keys(this.presets)
  }
}

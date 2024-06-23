import {type Dict} from './dict';
import {
  ControlSpec, 
  GroupSpec,
  GroupSpecWithoutControls,
  TabbedPagesSpec,
  TabbedPagesSpecWithoutControls,
  PadSpec,
  FaderSpec,
  SwitchSpec,
  SelectorSpec,
  ConfirmButtonSpec,
  ConfirmSwitchSpec,
  CakeSpec,
  PresetButtonSpec, 
  LetterboxSpec, 
  type ControlSpecsDict,
} from './control-specs'
import Messages from './messages'

function randomId() {
  return ((Math.random() + 1) * Math.pow(36, 9)).toString(36).substring(0,10)
}

type Listener = (payload: any) => void;

abstract class Control {
  abstract handleMessage(payload: any) : void;
  abstract spec: ControlSpec;

  private listeners: Listener[] = [];
  addListener(listener: Listener) {
    this.listeners.push(listener);
  }
  sendValue(payload: any) {
    this.listeners.forEach((listener) => {
      listener(payload);
    });
  }
}

class Group extends Control {
  public spec: GroupSpec;

  constructor(
    spec: GroupSpecWithoutControls,
    public controls: ControlsDict,
  ) {
    super();
    const controlSpecs: ControlSpecsDict = {}
    for(let id in controls) {
      controlSpecs[id] = controls[id].spec;
    }
    this.spec = {
      ...spec,
      controlSpecs,
    }
  }

  handleMessage(_payload: any) {
    // not going to happen
  }
}

class TabbedPages extends Control {
	public spec: TabbedPagesSpec;

	constructor(
		spec: TabbedPagesSpecWithoutControls,
		public pages: Dict<ControlsDict>,
	) {
		super();
		const pageSpecs: Dict<ControlSpecsDict> = {}
		for(let pageName in pages) {
			const page = pages[pageName];
			pageSpecs[pageName] = {} as ControlSpecsDict
			for(let controlId in page) {
				pageSpecs[pageName][controlId] = page[controlId].spec; 
			}
		}
		this.spec = {
			...spec,
			pageSpecs,
		}
	}

	handleMessage(_payload: any) {
		// not going to happen
	}
}

class Fader extends Control {
  public value: number;
  constructor(
    public spec: FaderSpec,
    public onChange?: (value: number) => void,
  ) {
    super();
    this.value = spec.initialValue;
  }

  handleMessage(payload: any) {
    // need to be a value
    if(typeof payload === 'number') {
      if(this.onChange) {
        this.onChange(payload);
      }
      this.value = payload;
    } else {
      throw('received slider value that is not a number');
    }
  }
}

class Pad extends Control {
  public pressed = false;
  constructor(
    public spec: PadSpec,
    public onPress?: (velocity: number) => void,
    public onRelease?: () => void,
  ) {
    super();
  }

  handleMessage(payload: any) {
    if(typeof payload === 'object') {
      if(payload.press == true) {
        if(this.pressed == false && this.onPress) {
          this.onPress(payload.velocity);
        }
        this.pressed = true;
      } else {
        if(this.pressed == true && this.onRelease) {
          this.onRelease();
        }
        this.pressed = false;
      }
    }
  }
}

class Switch extends Control {
  public on: boolean;
  constructor(
    public spec: SwitchSpec,
    public onToggle?: (on: boolean) => void,
  ) {
    super();
    this.on = spec.initiallyOn;
  }

  handleMessage(payload: any): void {
    if(typeof payload === 'boolean') {
      if(this.onToggle) {
        this.onToggle(payload);
      }
      this.on = payload;
    } else {
      throw('received switch value that is not a boolean');
    }
  }
}

class Selector extends Control {
  public index: number;
  constructor(
    public spec: SelectorSpec,
    public onSelect?: (index: number) => void,
  ) {
    super();
    this.index = spec.initialIndex;
  }

  handleMessage(payload: any): void {
    if(typeof payload === 'number' && payload % 1 === 0 && payload >= 0) {
      if(this.onSelect) {
        this.onSelect(payload);
      }
      this.index = payload;
    } else {
      throw('received selector value that is not a whole, positive (with 0) number');
    }
  }
}

class ConfirmButton extends Control {
  constructor(
    public spec: ConfirmButtonSpec,
    public onConfirmedPress?: () => void,
    public onPress?: () => void,
  ) {
    super();
  }

  handleMessage(payload: any) {
    if(typeof payload === 'boolean') {
      if(payload == true) {
        if(this.onConfirmedPress) {
          this.onConfirmedPress();
        }
      } else {
        if(this.onPress) {
          this.onPress();
        }
      }
    }
  }
}

class Label extends Control {
  constructor(
    public spec: PadSpec,
  ) {
    super();
  }

  handleMessage(_payload: any) {
    // wont happen
  }
}

class ConfirmSwitch extends Control {
  constructor(
    public spec: ConfirmSwitchSpec,
    public onConfirmedOn?: (isOn: boolean) => void,
  ) {
    super();
  }

  handleMessage(payload: any) {
    if(typeof payload === 'boolean') {
      const on = payload;
      if(this.onConfirmedOn) {
        this.onConfirmedOn(on);
      }
    }
  }
}

class Cake extends Control {
  constructor(
    public spec: CakeSpec,
  ) {
    super();
  }

  handleMessage(_payload: any) {
    // wont happen
  }
}

class PresetButton extends Control {
	constructor(
		public spec: PresetButtonSpec,
	) {
		super();
	}

	handleMessage(_payload: any) {
		// wont happen
	}
}

class Letterbox extends Control {
	constructor(
		public spec: LetterboxSpec,
		public onLetter: (letter: string) => void,
	) {
		super();
	}

	handleMessage(payload: any) {
		if(typeof payload === 'string') {
			this.onLetter(payload);
		} else {
			throw('received letter that is not a string');
		}
	}
}

export type ControlsDict = Dict<Control>;

class Receiver {
  private id = randomId();

  constructor(
    private name: string,
    private controls: ControlsDict, 
    private info: string,
  ) {
    this.announce();
    this.listen();
    this.setupListeners(this.controls, []);
    window.addEventListener('beforeunload', () => {
      this.sendTabClosing();
    })
  }

  setupListeners(controls: ControlsDict, path: string[]) {
    for(let id in controls) {
      const control = controls[id];
      const controlId = path.concat(id);
      if(control.spec.type === 'group') {
        const group = control as Group;
        this.setupListeners(group.controls, controlId);
      } else {
        control.addListener((payload) => {
          if(window.opener !== null) {
            window.opener.postMessage(
              new Messages.MeterMessage(controlId, payload, this.id),
              '*'
            );
          }
        })
      }
    }
  }

  announce() {
    if(window.opener !== null) {
      const controlSpecs: Dict<ControlSpec> = {}
      for(let id in this.controls) {
        controlSpecs[id] = this.controls[id].spec;
      }
      window.opener.postMessage(
        new Messages.AnnounceReceiver(this.name, this.info, controlSpecs, this.id),
        '*'
      );
    }
  }

  listen() {
    window.addEventListener('message', (event) => {
      if(window.opener !== null) {
        const data = event.data;
        const type = data.type;
        if(type === Messages.ControlMessage.type) {
          const msg = data as Messages.ControlMessage;
          const control = this.getControl(this.controls, msg.controlId);
          if(control) {
						control.handleMessage(msg.payload);
					}
        }
      }
    });
  }

  getControl(controls: ControlsDict, id: string[]): Control | undefined {
    if(id.length > 1) {
      const node = controls[id[0]];
      if(node instanceof Group) {
				return this.getControl(node.controls, id.slice(1))
			} else if (node instanceof TabbedPages) {
				return this.getControl(node.pages[id[1]], id.slice(2))
			}
    } else {
      return controls[id[0]];
    }
  }

  sendTabClosing() {
    if(window.opener !== null) {
      window.opener.postMessage(
        new Messages.TabClosing(), 
        '*'
      );
    }
  }
}

export {
  Receiver, 
  Fader,
  Pad,
  Switch,
  Selector,
  ConfirmButton,
  Label,
  ConfirmSwitch, 
  // meters
  Cake,
  PresetButton,
  Group, 
  TabbedPages,
	Letterbox, 
}


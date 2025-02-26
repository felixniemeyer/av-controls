import * as Specs from './control-specs'

export type ControlsDict = {[id: string]: ControlReceiver};
type Listener = (payload: any) => void;

export abstract class ControlReceiver {
  abstract handleMessage(payload: any) : void;
  abstract spec: Specs.ControlSpec;

  private listeners: Listener[] = [];
  public setListener(listener: Listener) {
    this.listeners.push(listener);
  }
  protected sendUpdate(payload: any) {
    this.listeners.forEach((listener) => {
      listener(payload);
    })
  }
}

export class Group extends ControlReceiver {
  public spec: Specs.GroupSpec;

  constructor(
    spec: Specs.GroupSpecWithoutControls,
    public controls: ControlsDict,
  ) {
    super();
    const controlSpecs: Specs.ControlSpecsDict = {}
    for(let id in controls) {
      controlSpecs[id] = controls[id].spec;
    }
    this.spec = new Specs.GroupSpec(
      spec.baseArgs,
      controlSpecs,
    )
  }

  handleMessage(_payload: any) {
    // not going to happen
  }
}

export class TabbedPages extends ControlReceiver {
	public spec: Specs.TabbedPagesSpec;

	constructor(
		spec: Specs.TabbedPagesSpecWithoutControls,
		public pages: {[id: string]: ControlsDict},
	) {
		super();
		const pageSpecs: {[id: string]: Specs.ControlSpecsDict} = {}
		for(let pageName in pages) {
			const page = pages[pageName];
			pageSpecs[pageName] = {} as Specs.ControlSpecsDict
			for(let controlId in page) {
				pageSpecs[pageName][controlId] = (page[controlId] as ControlReceiver).spec; 
			}
		}
		this.spec = new Specs.TabbedPagesSpec(
			spec.baseArgs,
			spec.columns,
			spec.rows,
			pageSpecs,
			spec.initialPageIndex,
		)
	}

	handleMessage(_payload: any) {
		// not going to happen
	}
}

export class Fader extends ControlReceiver {
  public value: number;
  constructor(
    public spec: Specs.FaderSpec,
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

export class Pad extends ControlReceiver {
  public pressed = false;
  constructor(
    public spec: Specs.PadSpec,
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

export class Switch extends ControlReceiver {
  public on: boolean;
  constructor(
    public spec: Specs.SwitchSpec,
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

export class Selector extends ControlReceiver {
  public index: number;
  constructor(
    public spec: Specs.SelectorSpec,
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

export class ConfirmButton extends ControlReceiver {
  constructor(
    public spec: Specs.ConfirmButtonSpec,
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

export class Label extends ControlReceiver {
  constructor(
    public spec: Specs.PadSpec,
  ) {
    super();
  }

  handleMessage(_payload: any) {
    // wont happen
  }
}

export class ConfirmSwitch extends ControlReceiver {
  constructor(
    public spec: Specs.ConfirmSwitchSpec,
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

export class Cake extends ControlReceiver {
  constructor(
    public spec: Specs.CakeSpec,
  ) {
    super();
  }

  handleMessage(_payload: any) {
    // wont happen
  }

  sendValue(value: number) {
    this.sendUpdate(value);
  }
}

export class PresetButton extends ControlReceiver {
	constructor(
		public spec: Specs.PresetButtonSpec,
	) {
		super();
	}

	handleMessage(_payload: any) {
		// wont happen
	}

  makeRandomSwitch() {
    this.sendUpdate({
      action: 'random'
    });
  }
}

export class Letterbox extends ControlReceiver {
	constructor(
		public spec: Specs.LetterboxSpec,
		public onLetter?: (letter: string) => void,
	) {
		super();
	}

	handleMessage(payload: any) {
		if(typeof payload === 'string') {
			if(this.onLetter) {
				this.onLetter(payload);
			}
		} else {
			throw('received letter that is not a string');
		}
	}
}

export class Textbox extends ControlReceiver {
	public text: string = '';

	constructor(
		public spec: Specs.TextboxSpec, 
		public onTextChange?: (text: string) => void, 
	) {
		super(); 
	}

	handleMessage(payload: any): void {
		if(typeof payload === 'string') {
			if(this.onTextChange) {
				this.onTextChange(payload);
			}
		} else {
			throw('received text that is not a string');
		}
	}
}

export class Dots extends ControlReceiver {
  values: Specs.Dot[]

  constructor(
    public spec: Specs.DotsSpec,
    public onDotsChange?: (dots: Specs.Dot[]) => void,
  ) {
    super();
    this.values = spec.initialValues;
  }

  handleMessage(payload: any) {
    if(payload.type === 'ud') {
      const index = payload.index;
      const value = payload.value;
      this.values[index] = value;
      if(this.onDotsChange) {
        this.onDotsChange(this.values);
      }
    } else if(payload.type === 'full') {
      this.values = payload.values;
      if(this.onDotsChange) {
        this.onDotsChange(this.values);
      }
    } else {
      throw(`unknown dots message type: ${payload.type}`);
    }
  }
}

// like fader but with a knob
export class Knob extends ControlReceiver {
  public value: number;

  constructor(
    public spec: Specs.KnobSpec,
  ) {
    super();
    this.value = spec.initialValue;
  }

  handleMessage(payload: any) {
    if(typeof payload === 'number') {
      this.value = payload;
    } else {
      throw('received knob value that is not a number');
    }
  }
}

export class NetPanel extends ControlReceiver {
  public spec: Specs.NetPanelSpec;

  constructor(
    spec: Specs.NetPanelSpecWithoutControls,
    public controls: ControlsDict,
  ) {
    super();
    const controlSpecs: Specs.ControlSpecsDict = {}
    for(let id in controls) {
      controlSpecs[id] = controls[id].spec;
    }
    this.spec = new Specs.NetPanelSpec(
      spec.baseArgs,
      controlSpecs,
    )
  }

  handleMessage(_payload: any) {
    // not going to happen
  }
}
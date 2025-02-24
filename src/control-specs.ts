export type ControlSpecsDict = {[id: string]: ControlSpec};

export class BaseArgs {
  constructor(
    public name: string,
    public x: number,
    public y: number,
    public width: number,
    public height: number,
    public color: string,
  ) {}
}

export class ControlSpec {
  public type: string = ''
  public name: string
  public x: number
  public y: number
  public width: number
  public height: number
  public color: string
  constructor(
    baseArgs: BaseArgs,
  ) {
    this.name = baseArgs.name
    this.x = baseArgs.x
    this.y = baseArgs.y
    this.width = baseArgs.width
    this.height = baseArgs.height
    this.color = baseArgs.color
  }
}

export type GroupStyle = 'framed' | 'logical' | 'page';
export class GroupSpecWithoutControls extends ControlSpec {
  // this control is special as it contains other controls
  constructor(
    baseArgs: BaseArgs,
    public style: GroupStyle = 'framed',
  ) {
    super(baseArgs);
    this.type = 'group';
  }
}

export class GroupSpec extends ControlSpec {
  // this control is special as it contains other controls
  constructor(
    baseArgs: BaseArgs,
    public controlSpecs: ControlSpecsDict, 
    public style?: GroupStyle,
  ) {
    super(baseArgs);
    this.type = 'group';
  }
}

export class FaderSpec extends ControlSpec {
  constructor(
    baseArgs: BaseArgs,
    public initialValue: number,
    public min: number, 
    public max: number,
    public decimalPlaces: number,
  ) { 
    super(baseArgs);
    this.type = 'fader';
  }

}

export class PadSpec extends ControlSpec {
  constructor(
    baseArgs: BaseArgs,
  ) {
    super(baseArgs);
    this.type = 'pad';
  }
}

export class SwitchSpec extends ControlSpec {
  constructor(
    baseArgs: BaseArgs,
    public initiallyOn: boolean = false
  ) {
    super(baseArgs);
    this.type = 'switch';
  }
}

export class SelectorSpec extends ControlSpec {
  constructor(
    baseArgs: BaseArgs,
    public options: string[],
    public initialIndex: number,
  ) {
    super(baseArgs);
    this.type = 'selector';
  }
}

export class ConfirmButtonSpec extends ControlSpec {
  constructor(
    baseArgs: BaseArgs,
  ) {
    super(baseArgs);
    this.type = 'confirm-button';
  }
}

export class LabelSpec extends ControlSpec {
  constructor(
    baseArgs: BaseArgs,
    public labelPosition: 'top' | 'center' | 'bottom',
  ) {
    super(baseArgs);
    this.type = 'label';
  }
}

export class ConfirmSwitchSpec extends ControlSpec {
  constructor(
    baseArgs: BaseArgs,
    public initiallyOn: boolean = false
  ) {
    super(baseArgs);
    this.type = 'confirm-switch';
  }
}

export class CakeSpec extends ControlSpec {
  constructor(
    baseArgs: BaseArgs,
    public min: number, 
    public max: number,
    public initialValue: number,
    public decimalPlaces: number,
  ) { 
    super(baseArgs);
    this.type = 'cake';
  }
}

export class PresetButtonSpec extends ControlSpec {
	constructor(
    baseArgs: BaseArgs,
		public stencil: any,
	) {
		super(baseArgs);
    this.type = 'preset-button';
	}
}

export class TabbedPagesSpecWithoutControls extends ControlSpec {
  // this control is special as it contains other controls
  constructor(
    baseArgs: BaseArgs,
    public columns: number = 100, 
    public rows: number = 100,
    public initialPageIndex: number = 0,
  ) {
    super(baseArgs);
    this.type = 'tabbed-pages';
  }
}

export class TabbedPagesSpec extends ControlSpec {
  // this control is special as it contains other controls
  constructor(
    baseArgs: BaseArgs,
    public columns: number, 
    public rows: number,
    public pageSpecs: {[id: string]: ControlSpecsDict}, 
    public initialPageIndex: number,
  ) {
    super(baseArgs);
    this.type = 'tabbed-pages';
  }
}

export class LetterboxSpec extends ControlSpec {
	constructor(
    baseArgs: BaseArgs,
	) {
		super(baseArgs);
    this.type = 'letterbox';
	}
}

export class TextboxSpec extends ControlSpec {
	constructor(
    baseArgs: BaseArgs,
		public initialText: string,
	) {
		super(baseArgs);
    this.type = 'textbox';
	}
}

export type Dot = [number, number]

export class DotsSpec extends ControlSpec {
  constructor(
    baseArgs: BaseArgs,
    public initialValues: Dot[],
    public ensureXOrder: boolean = true,
    public ensureYOrder: boolean = false,
//    public displayStyle: 'curve' | 'polygon',
  ) {
    super(baseArgs);
    this.type = 'dots';
  }
}

export class KnobSpec extends ControlSpec {
  constructor(
    baseArgs: BaseArgs,
    public initialValue: number,
    public min: number,
    public max: number,
    public decimalPlaces: number,
  ) {
    super(baseArgs);
    this.type = 'knob';
  }
}

export class NetPanelSpecWithoutControls extends ControlSpec {
  constructor(
    baseArgs: BaseArgs,
  ) {
    super(baseArgs);
    this.type = 'net-panel';
  }
}

export class NetPanelSpec extends ControlSpec {
  constructor(
    baseArgs: BaseArgs,
    public controlSpecs: ControlSpecsDict,
  ) {
    super(baseArgs);
    this.type = 'net-panel';
  }
}

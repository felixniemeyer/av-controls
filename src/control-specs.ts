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
  static type = ''
  public type = ControlSpec.type

  public name: string
  public x: number
  public y: number
  public width: number
  public height: number
  public color: string
  constructor(
    public baseArgs: BaseArgs,
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

// this control is special as it contains other controls
export class GroupSpecWithoutControls extends ControlSpec {
  static type = 'group-without-controls'
  public type = GroupSpecWithoutControls.type

  constructor(
    baseArgs: BaseArgs,
    public style: GroupStyle = 'framed',
  ) {
    super(baseArgs);
  }
}

// this control is special as it contains other controls
export class GroupSpec extends ControlSpec {
  static type = 'group'
  public type = GroupSpec.type

  constructor(
    baseArgs: BaseArgs,
    public controlSpecs: ControlSpecsDict, 
    public style?: GroupStyle,
  ) {
    super(baseArgs);
  }
}

export class FaderSpec extends ControlSpec {
  static type = 'fader'
  public type = FaderSpec.type

  constructor(
    baseArgs: BaseArgs,
    public initialValue: number,
    public min: number, 
    public max: number,
    public decimalPlaces: number,
  ) { 
    super(baseArgs);
  }

}

export class PadSpec extends ControlSpec {
  static type = 'pad'
  public type = PadSpec.type

  constructor(
    baseArgs: BaseArgs,
  ) {
    super(baseArgs);
  }
}

export class SwitchSpec extends ControlSpec {
  static type = 'switch'
  public type = SwitchSpec.type

  constructor(
    baseArgs: BaseArgs,
    public initiallyOn: boolean = false
  ) {
    super(baseArgs);
  }
}

export class SelectorSpec extends ControlSpec {
  static type = 'selector'
  public type = SelectorSpec.type

  constructor(
    baseArgs: BaseArgs,
    public options: string[],
    public initialIndex: number,
  ) {
    super(baseArgs);
  }
}

export class ConfirmButtonSpec extends ControlSpec {
  static type = 'confirm-button'
  public type = ConfirmButtonSpec.type

  constructor(
    baseArgs: BaseArgs,
  ) {
    super(baseArgs);
  }
}

export class LabelSpec extends ControlSpec {
  static type = 'label'
  public type = LabelSpec.type

  constructor(
    baseArgs: BaseArgs,
    public labelPosition: 'top' | 'center' | 'bottom',
  ) {
    super(baseArgs);
  }
}

export class ConfirmSwitchSpec extends ControlSpec {
  static type = 'confirm-switch'
  public type = ConfirmSwitchSpec.type

  constructor(
    baseArgs: BaseArgs,
    public initiallyOn: boolean = false
  ) {
    super(baseArgs);
  }
}

export class CakeSpec extends ControlSpec {
  static type = 'cake'
  public type = CakeSpec.type

  constructor(
    baseArgs: BaseArgs,
    public min: number, 
    public max: number,
    public initialValue: number,
    public decimalPlaces: number,
  ) { 
    super(baseArgs);
  }
}

export class PresetButtonSpec extends ControlSpec {
  static type = 'preset-button'
  public type = PresetButtonSpec.type

  constructor(
    baseArgs: BaseArgs,
    public stencil: any,
  ) {
		super(baseArgs);
	}
}

export class TabbedPagesSpecWithoutControls extends ControlSpec {
  static type = 'tabbed-pages-without-controls'
  public type = TabbedPagesSpecWithoutControls.type

  constructor(
    baseArgs: BaseArgs,
    public columns: number = 100, 
    public rows: number = 100,
    public initialPageIndex: number = 0,
  ) {
    super(baseArgs);
  }
}

export class TabbedPagesSpec extends ControlSpec {
  static type = 'tabbed-pages'
  public type = TabbedPagesSpec.type

  constructor(
    baseArgs: BaseArgs,
    public columns: number, 
    public rows: number,
    public pageSpecs: {[id: string]: ControlSpecsDict}, 
    public initialPageIndex: number,
  ) {
    super(baseArgs);
  }
}

export class LetterboxSpec extends ControlSpec {
  static type = 'letterbox'
  public type = LetterboxSpec.type

  constructor(
    baseArgs: BaseArgs,
  ) {
		super(baseArgs);
	}
}

export class TextboxSpec extends ControlSpec {
  static type = 'textbox'
  public type = TextboxSpec.type

  constructor(
    baseArgs: BaseArgs,
		public initialText: string,
	) {
		super(baseArgs);
	}
}

export type Dot = [number, number]

export class DotsSpec extends ControlSpec {
  static type = 'dots'
  public type = DotsSpec.type

  constructor(
    baseArgs: BaseArgs,
    public initialValues: Dot[],
    public ensureXOrder: boolean = true,
    public ensureYOrder: boolean = false,
//    public displayStyle: 'curve' | 'polygon',
  ) {
    super(baseArgs);
  }
}

export class KnobSpec extends ControlSpec {
  static type = 'knob'
  public type = KnobSpec.type

  constructor(
    baseArgs: BaseArgs,
    public initialValue: number,
    public min: number,
    public max: number,
    public decimalPlaces: number,
  ) {
    super(baseArgs);
  }
}

export class NetPanelSpecWithoutControls extends ControlSpec {
  static type = 'net-panel-without-controls'
  public type = NetPanelSpecWithoutControls.type

  constructor(
    baseArgs: BaseArgs,
  ) {
    super(baseArgs);
  }
}

export class NetPanelSpec extends ControlSpec {
  static type = 'net-panel'
  public type = NetPanelSpec.type

  constructor(
    baseArgs: BaseArgs,
    public controlSpecs: ControlSpecsDict,
  ) {
    super(baseArgs);
  }
}

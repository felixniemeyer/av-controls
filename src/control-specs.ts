import type { Dict } from "./dict";

export type ControlType = 
  'group' |
  'tabbed-pages' |
	'fader' |
	'pad' |
	'switch' |
	'selector' |
	'confirm-button' |
	'label' |
	'confirm-switch' |
	'letterbox' |
	'cake' |
	'preset-button' |
	'textbox' |
	'dots' |
	'knob'
;

export type ControlSpecsDict = Dict<ControlSpec>;

export class ControlSpec {
  constructor(
    public type: ControlType,
    public name: string,
    public x: number,
    public y: number,
    public width: number,
    public height: number,
    public color: string, 
  ) {
  }
}

export type GroupStyle = 'framed' | 'logical' | 'page';
export class GroupSpecWithoutControls extends ControlSpec {
  // this control is special as it contains other controls
  constructor(
    public name: string,
    public x: number,
    public y: number,
    public width: number,
    public height: number,
    public color: string,
    public style: GroupStyle = 'framed',
  ) {
    super('group', name, x, y, width, height, color);
  }
}

export class GroupSpec extends ControlSpec {
  // this control is special as it contains other controls
  constructor(
    public name: string,
    public x: number,
    public y: number,
    public width: number,
    public height: number,
    public color: string,
    public controlSpecs: ControlSpecsDict, 
    public style?: GroupStyle,
  ) {
    super('group', name, x, y, width, height, color);
  }
}

export class FaderSpec extends ControlSpec {
  constructor(
    name: string,
    x: number,
    y: number,
    width: number,
    height: number,
    color: string, 
    public initialValue: number,
    public min: number, 
    public max: number,
    public decimalPlaces: number,
  ) { 
    super('fader', name, x, y, width, height, color);
  }

}

export class PadSpec extends ControlSpec {
  constructor(
    public name: string,
    public x: number,
    public y: number,
    public width: number,
    public height: number,
    public color: string,
  ) {
    super('pad', name, x, y, width, height, color);
  }
}

export class SwitchSpec extends ControlSpec {
  constructor(
    public name: string,
    public x: number,
    public y: number,
    public width: number,
    public height: number,
    public color: string,
    public initiallyOn: boolean = false
  ) {
    super('switch', name, x, y, width, height, color);
  }
}

export class SelectorSpec extends ControlSpec {
  constructor(
    public name: string,
    public x: number,
    public y: number,
    public width: number,
    public height: number,
    public color: string,
    public options: string[],
    public initialIndex: number,
  ) {
    super('selector', name, x, y, width, height, color);
  }
}

export class ConfirmButtonSpec extends ControlSpec {
  constructor(
    public name: string,
    public x: number,
    public y: number,
    public width: number,
    public height: number,
    public color: string,
  ) {
    super('confirm-button', name, x, y, width, height, color);
  }
}

export class LabelSpec extends ControlSpec {
  constructor(
    public name: string,
    public x: number,
    public y: number,
    public width: number,
    public height: number,
    public color: string,
    public labelPosition: 'top' | 'center' | 'bottom',
  ) {
    super('label', name, x, y, width, height, color);
  }
}

export class ConfirmSwitchSpec extends ControlSpec {
  constructor(
    public name: string,
    public x: number,
    public y: number,
    public width: number,
    public height: number,
    public color: string,
    public initiallyOn: boolean = false
  ) {
    super('confirm-switch', name, x, y, width, height, color);
  }
}

export class CakeSpec extends ControlSpec {
  constructor(
    name: string,
    x: number,
    y: number,
    width: number,
    height: number,
    color: string, 
    public min: number, 
    public max: number,
    public initialValue: number,
    public decimalPlaces: number,
  ) { 
    super('cake', name, x, y, width, height, color);
  }
}

export class PresetButtonSpec extends ControlSpec {
	constructor(
		public name: string,
		public x: number,
		public y: number,
		public width: number,
		public height: number,
		public color: string,
		public stencil: any,
	) {
		super('preset-button', name, x, y, width, height, color);
	}
}

export class TabbedPagesSpecWithoutControls extends ControlSpec {
  // this control is special as it contains other controls
  constructor(
    public name: string,
    public x: number,
    public y: number,
    public width: number,
    public height: number,
    public color: string,
    public columns: number = 100, 
    public rows: number = 100,
  ) {
    super('tabbed-pages', name, x, y, width, height, color);
  }
}

export class TabbedPagesSpec extends ControlSpec {
  // this control is special as it contains other controls
  constructor(
    public name: string,
    public x: number,
    public y: number,
    public width: number,
    public height: number,
    public color: string,
    public columns: number, 
    public rows: number,
    public pageSpecs: Dict<ControlSpecsDict>, 
  ) {
    super('tabbed-pages', name, x, y, width, height, color);
  }
}

export class LetterboxSpec extends ControlSpec {
	constructor(
		public name: string,
		public x: number,
		public y: number,
		public width: number,
		public height: number,
		public color: string,
	) {
		super('letterbox', name, x, y, width, height, color);
	}
}

export class TextboxSpec extends ControlSpec {
	constructor(
		public name: string,
		public x: number,
		public y: number,
		public width: number,
		public height: number,
		public color: string,
		public initialText: string,
	) {
		super('textbox', name, x, y, width, height, color);
	}
}

export type Dot = [number, number]

export class DotsSpec extends ControlSpec {
  constructor(
    public name: string,
    public x: number,
    public y: number,
    public width: number,
    public height: number,
    public color: string,
    public initialValues: Dot[],
    public ensureXOrder: boolean = true,
    public ensureYOrder: boolean = false,
//    public displayStyle: 'curve' | 'polygon',
  ) {
    super('dots', name, x, y, width, height, color);
  }
}

export class KnobSpec extends ControlSpec {
  constructor(
    public name: string,
    public x: number,
    public y: number,
    public width: number,
    public height: number,
    public color: string,
    public initialValue: number,
    public min: number,
    public max: number,
    public decimalPlaces: number,
  ) {
    super('knob', name, x, y, width, height, color);
  }
}

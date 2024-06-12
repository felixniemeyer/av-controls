import { type Dict } from "./dict";

export type ControlType = 
  'group' |
	'fader' |
	'pad' |
	'switch' |
	'selector' |
	'confirm-button' |
	'label' |
	'confirm-switch' |
	'cake';

export type ControlSpecsDict = Dict<ControlSpec>;

export interface BaseSpec {
  name: string
  x: number
  y: number
  width: number
  height: number
  color: string
}

export class ControlSpec {
  constructor(
    public type: ControlType,
  	public base: BaseSpec,
  ) {
  }
}

export type GroupStyle = 'framed' | 'logical' | 'page';
export class GroupSpecWithoutControls extends ControlSpec {
  // this control is special as it contains other controls
  constructor(
    public base: BaseSpec,
    public style: GroupStyle = 'framed',
    public columns: number = 100, 
    public rows: number = 100,
  ) {
    super('group', base);
  }
}

export class GroupSpec extends ControlSpec {
  // this control is special as it contains other controls
  constructor(
    public base: BaseSpec,
    public controlSpecs: ControlSpecsDict, 
    public style?: GroupStyle,
    public columns?: number, 
    public rows?: number,
  ) {
    super('group', base);
  }
}

export class FaderSpec extends ControlSpec {
  constructor(
    public base: BaseSpec,
    public initialValue: number,
    public min: number, 
    public max: number,
    public decimalPlaces: number,
  ) { 
    super('fader', base);
  }

}

export class PadSpec extends ControlSpec {
  constructor(
  	public base: BaseSpec,
  ) {
    super('pad', base);  
  }
}

export class SwitchSpec extends ControlSpec {
  constructor(
  	public base: BaseSpec,
    public initiallyOn: boolean = false
  ) {
    super('switch', base);
  }
}

export class SelectorSpec extends ControlSpec {
  constructor(
    public base: BaseSpec,
    public options: string[],
    public initialIndex: number,
  ) {
    super('selector', base);
  }
}

export class ConfirmButtonSpec extends ControlSpec {
  constructor(
  	base: BaseSpec,
  ) {
    super('confirm-button', base);
  }
}

export class LabelSpec extends ControlSpec {
  constructor(
    public base: BaseSpec,
    public labelPosition: 'top' | 'center' | 'bottom',
  ) {
    super('label', base);
  }
}

export class ConfirmSwitchSpec extends ControlSpec {
  constructor(
    public base: BaseSpec,
    public initiallyOn: boolean = false
  ) {
    super('confirm-switch', base);
  }
}

export class CakeSpec extends ControlSpec {
  constructor(
    public base: BaseSpec,
    public min: number, 
    public max: number,
    public initialValue: number,
    public decimalPlaces: number,
  ) { 
    super('cake', base);
  }

}

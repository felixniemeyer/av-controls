type ControlType = 'fader' | 'pad' | 'switch' | 'selector';

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

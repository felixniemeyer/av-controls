export type MeterType = 'cake';

export class MeterSpec {
  constructor(
    public type: MeterType,
    public name: string,
    public x: number,
    public y: number,
    public width: number,
    public height: number,
    public color: string, 
  ) {
  }
}

export class CakeSpec extends MeterSpec {
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

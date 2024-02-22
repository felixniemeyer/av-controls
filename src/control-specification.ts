class ControlSpecification {
  constructor(
    public x: number,
    public y: number,
    public width: number,
    public height: number,
    public name: string,
    public type: 'fader' | 'button',
  ) {
  }
}

export {
  ControlSpecification
}

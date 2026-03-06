import * as Base from './base'

/**
 * Signal sent from controller to artwork when user selects an option.
 */
export class Signal extends Base.Signal {
  constructor(
    public selectedIndex: number
  ) {
    super()
  }
}

/**
 * Update sent from artwork to controller with current options and selection.
 */
export class Update extends Base.Update {
  constructor(
    public options: string[],
    public selectedIndex: number,
    public description?: string
  ) {
    super()
  }
}

/**
 * Specification for a Menu control.
 * Unlike Selector, Menu options are defined by the receiver and can change dynamically.
 */
export class Spec extends Base.Spec {
  static type = 'menu'
  public type = Spec.type

  constructor(
    baseArgs: Base.Args,
    public initialOptions: string[] = [],
    public initialDescription: string = ''
  ) {
    super(baseArgs)
  }
}

/**
 * Serializable state for persistence.
 */
export class State extends Base.State {
  constructor(
    public selectedIndex: number,
    public options: string[]
  ) {
    super()
  }
}

/**
 * Artwork-side receiver for Menu control.
 * Call setOptions() to update the available choices.
 */
export class Receiver extends Base.Receiver {
  public options: string[]
  public selectedIndex: number
  public description: string

  constructor(
    public spec: Spec,
    public onSelect?: (index: number, value: string) => void
  ) {
    super()
    this.options = [...spec.initialOptions]
    this.selectedIndex = 0
    this.description = spec.initialDescription
  }

  /**
   * Update the available options. Sends an Update to the controller.
   * @param options New list of option labels
   * @param selectedIndex Optionally set the selected index
   */
  setOptions(options: string[], selectedIndex?: number) {
    this.options = options
    if (selectedIndex !== undefined) {
      this.selectedIndex = selectedIndex
    } else if (this.selectedIndex >= options.length) {
      this.selectedIndex = Math.max(0, options.length - 1)
    }
    this.onUpdate(new Update(this.options, this.selectedIndex, this.description))
  }

  /**
   * Update the description text. Sends an Update to the controller.
   */
  setDescription(description: string) {
    this.description = description
    this.onUpdate(new Update(this.options, this.selectedIndex, this.description))
  }

  /**
   * Handle a selection signal from the controller.
   */
  handleSignal(signal: Signal): void {
    this.selectedIndex = signal.selectedIndex
    if (this.onSelect && this.options[signal.selectedIndex] !== undefined) {
      this.onSelect(signal.selectedIndex, this.options[signal.selectedIndex]!)
    }
    // Echo back the update to confirm selection
    this.onUpdate(new Update(this.options, this.selectedIndex, this.description))
  }

  getState(): State {
    return new State(this.selectedIndex, [...this.options])
  }

  restoreState(state: State): void {
    this.options = [...state.options]
    this.selectedIndex = state.selectedIndex
    if (this.onSelect && this.options[this.selectedIndex] !== undefined) {
      this.onSelect(this.selectedIndex, this.options[this.selectedIndex]!)
    }
  }

  /**
   * Get the currently selected value.
   */
  getSelectedValue(): string | undefined {
    return this.options[this.selectedIndex]
  }
}

/**
 * Controller-side sender for Menu control.
 * Receives option updates from the artwork and sends selection signals.
 */
export class Sender extends Base.Sender {
  public options: string[]
  public selectedIndex: number
  public description: string

  constructor(public spec: Spec) {
    super()
    this.options = [...spec.initialOptions]
    this.selectedIndex = 0
    this.description = spec.initialDescription
  }

  /**
   * Select an option by index. Sends a Signal to the artwork.
   */
  select(index: number) {
    if (index >= 0 && index < this.options.length) {
      this.selectedIndex = index
      this.onSignal(new Signal(index))
    }
  }

  /**
   * Handle an update from the artwork (options changed).
   */
  handleUpdate(update: Update) {
    this.options = [...update.options]
    this.selectedIndex = update.selectedIndex
    if (update.description !== undefined) {
      this.description = update.description
    }
  }

  getState(): State {
    return new State(this.selectedIndex, [...this.options])
  }

  setState(state: State) {
    this.options = [...state.options]
    this.select(state.selectedIndex)
  }

  /**
   * Get the currently selected value.
   */
  getSelectedValue(): string | undefined {
    return this.options[this.selectedIndex]
  }
}

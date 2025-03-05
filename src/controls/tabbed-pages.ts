import { Logger, UpdateParsingError } from "../error";
import * as Base from './base';

import { type SpecsDict, type ReceiversDict, type SendersDict } from "../common";

export class Update extends Base.Update {
  constructor(
    public pageIndex: number,
    public controlId: string,
    public update: Base.Update,
  ) {
    super();
  }
  static tryFromAny(payload: any): Update {
    if(!payload.pageIndex) {
      throw new UpdateParsingError('Invalid update');
    }
    if(!payload.controlId) {
      throw new UpdateParsingError('Invalid update');
    }
    if(!payload.update) {
      throw new UpdateParsingError('Invalid update');
    }
    return new Update(payload.pageIndex, payload.controlId, payload.update);
  }
}

export class Signal extends Base.Signal {
  constructor(
    public pageIndex: number,
    public signal: Base.Signal,
  ) {
    super();
  }
}

export class SpecWithoutControls extends Base.Spec {
  constructor(
    baseArgs: Base.Args,
    public columns: number = 100, 
    public rows: number = 100,
    public initialPageIndex: number = 0,
  ) {
    super(baseArgs);
  }
}

export class Spec extends Base.Spec{
  static type = 'tabbed-pages'
  public type = Spec.type

  constructor(
    baseArgs: Base.Args,
    public columns: number, 
    public rows: number,
    public pageSpecs: {[id: string]: SpecsDict}, 
    public initialPageIndex: number,
  ) {
    super(baseArgs);
  }
}
/**
 * Tabbed pages container for controls
 */
export class Receiver extends Base.Receiver {
  public spec: Spec;

  constructor(
    spec: SpecWithoutControls,
    public pages: {[id: string]: ReceiversDict},
  ) {
    super();
    const pageSpecs: {[id: string]: SpecsDict} = {};
    
    for (const pageName in pages) {
      const page = pages[pageName];
      pageSpecs[pageName] = {} as SpecsDict;
      
      for (const controlId in page) {
        pageSpecs[pageName][controlId] = (page[controlId] as Base.Receiver).spec; 
      }
    }
    
    this.spec = new Spec(
      spec.baseArgs,
      spec.columns,
      spec.rows,
      pageSpecs,
      spec.initialPageIndex,
    );
  }

  handleSignal(_payload: Base.Signal): void {
    Logger.debug('TabbedPages received signal, ignoring', { pages: this.spec.name });
  }
}

type PageState = {[id: string]: Base.State}
type TabbedPagesState = {[pageId: string]: PageState}

export class State extends Base.State {
  constructor(
    public state: TabbedPagesState,
  ) {
    super();
  }
}
export class Sender extends Base.Sender {
  public activePage: string

  constructor(
    public spec: Spec,
    public pages: {[pageId: string]: SendersDict}, 
  ) {
    super()
    this.activePage = Object.keys(pages)[spec.initialPageIndex]
  }

  update(update: Update) {
    if(update.pageIndex) {
      const page = this.pages[update.pageIndex]
      page[update.controlId].update(update.update)
    } 
  }

  getState() {
    const state: TabbedPagesState = {}
    for (const pageId in this.pages) {
      const pageState: PageState = {}
      for (const controlId in this.pages[pageId]) {
        pageState[controlId] = this.pages[pageId][controlId].getState()
      }
      state[pageId] = pageState
    }
    return new State(state)
  }

  setState(state: State) {
    for (const pageId in this.pages) {
      const pageState = state.state[pageId]
      for (const controlId in this.pages[pageId]) {
        this.pages[pageId][controlId].setState(pageState[controlId])
      }
    }
  }

  traverse(callback: Base.TraversalCallback, object: any) {
    callback(this, object)
    for (const pageId in this.pages) {
      for (const senderId in this.pages[pageId]) {
        const pageObject = object._children[pageId] = object._children[pageId] || {}
        const subObject = pageObject[senderId] = pageObject[senderId] || {}
        this.pages[pageId][senderId].traverse(callback, subObject)
      }
    }
  }
}
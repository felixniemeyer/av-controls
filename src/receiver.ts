import * as Specs from './control-specs'; 
import * as Messages from './messages'

import { type ControlsDict, ControlReceiver, Group, TabbedPages, NetPanel } from './receivers'

export class Receiver {
  constructor(
    private name: string,
    private controls: ControlsDict, 
    private controllerTab: Window = window.opener || window.parent,
  ) {
    this.listen();
    this.setupListeners(controls, []); 
    this.send(new Messages.Ready());
    window.addEventListener('beforeunload', () => {
      this.sendTabClosing();
    })
  }

  send(message: any) {
  	this.controllerTab.postMessage({
				protocol: 'av-controls',
				...message
			}, '*'
		);
  }

  setupListeners(controls: ControlsDict, path: string[]) {
    for(let id in controls) {
      const control = controls[id];
      const controlId = path.concat(id);
      if(control.spec.type === Specs.GroupSpec.type) {
        const group = control as Group;
        this.setupListeners(group.controls, controlId);
      } else if(control.spec.type === Specs.NetPanelSpec.type) {
        const netPanel = control as NetPanel;
        this.setupListeners(netPanel.controls, controlId);
      } else if(control.spec.type === Specs.TabbedPagesSpec.type) {
        const tabbedPages = control as TabbedPages;
        for(let pageId in tabbedPages.pages) {
          this.setupListeners(tabbedPages.pages[pageId], controlId.concat(pageId));
        }
      } 
      control.setListener((payload) => {
        this.send(
          new Messages.ControlUpdate(controlId, payload),
        );
      })
    }
  }

  announce() {
		const controlSpecs: {[id: string]: Specs.ControlSpec} = {}
		for(let id in this.controls) {
			controlSpecs[id] = this.controls[id].spec;
		}
    console.log('announcing', this.name, controlSpecs)
		this.send(
      new Messages.ControllerSpecification(this.name, controlSpecs)
		);
  }

  listen() {
    window.addEventListener('message', (event) => {
			const data = event.data;
			const type = data.type;
			if(type === Messages.Nudge.type) {
				this.announce()
			} else if(type === Messages.ControlSignal.type) {
				const msg = data as Messages.ControlSignal;
				const control = this.getControl(this.controls, msg.controlId);
				if(control) {
					control.handleMessage(msg.payload);
				}
			} 
    });
  }

  getControl(controls: ControlsDict, id: string[]): ControlReceiver | undefined {
    if(id.length > 1) {
      const node = controls[id[0]];
      if(node instanceof Group) {
				return this.getControl(node.controls, id.slice(1))
			} else if (node instanceof TabbedPages) {
				return this.getControl(node.pages[id[1]], id.slice(2))
			} else if (node instanceof NetPanel) {
				return this.getControl(node.controls, id.slice(1))
			}
    } else {
      return controls[id[0]];
    }
    return undefined
  }

  sendTabClosing() {
		this.send(
			new Messages.TabClosing()
		);
  }
}

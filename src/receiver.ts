import { ControlSpec } from './control-specs'; 
import * as Messages from './messages'

import { ControlsDict, Control, Group, TabbedPages, NetPanel } from './controls'

export class Receiver {
  private id = -1;

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
      if(control.spec.type === 'group') {
        const group = control as Group;
        this.setupListeners(group.controls, controlId);
      } else {
        control.addListener((payload) => {
					this.send(
						new Messages.MeterMessage(controlId, payload),
					);
        })
      }
    }
  }

  announce() {
		const controlSpecs: {[id: string]: ControlSpec} = {}
		for(let id in this.controls) {
			controlSpecs[id] = this.controls[id].spec;
		}
    console.log('announcing', this.name, controlSpecs)
		this.send(
      new Messages.AnnounceReceiver(this.name, controlSpecs)
		);
  }

  listen() {
    window.addEventListener('message', (event) => {
			const data = event.data;
			const type = data.type;
			if(type === 'nudge') {
				this.announce()
			} else if(type === 'control-message') {
				const msg = data as Messages.ControlMessage;
				const control = this.getControl(this.controls, msg.controlId);
				if(control) {
					control.handleMessage(msg.payload);
				}
			}
    });
  }

  getControl(controls: ControlsDict, id: string[]): Control | undefined {
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

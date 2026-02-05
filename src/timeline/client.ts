import { type Message, ControlUpdate, RootSpecification, TimelineEditMessage, TimelineRequestState, TimelineStateMessage } from '../messages';
import type { TimelineEdit, TimelineState } from './index';
import type { Sender as TransportSender } from '../transports/base';

export type TimelineClientOptions = {
  autoRequestState?: boolean;
};

export class TimelineClient {
  private state: TimelineState | null = null;
  private rootSpec: RootSpecification | null = null;

  public onState: ((state: TimelineState) => void) | null = null;
  public onRootSpec: ((spec: RootSpecification) => void) | null = null;
  public onControlUpdate: ((update: ControlUpdate) => void) | null = null;

  constructor(
    private sender: TransportSender,
    options?: TimelineClientOptions,
  ) {
    this.sender.addListener((message: Message) => {
      this.handleMessage(message);
    });
    if (options?.autoRequestState ?? true) {
      this.requestState();
    }
  }

  getState() {
    return this.state;
  }

  getRootSpec() {
    return this.rootSpec;
  }

  requestState() {
    this.sender.send(new TimelineRequestState());
  }

  sendEdit(edit: TimelineEdit) {
    this.sender.send(new TimelineEditMessage(edit));
  }

  setPlaying(playing: boolean) {
    this.sendEdit({ type: 'set-playing', playing });
  }

  seek(time: number) {
    this.sendEdit({ type: 'seek', time });
  }

  setControlEnabled(path: string[], enabled: boolean) {
    this.sendEdit({ type: 'set-control-enabled', path, enabled });
  }

  setLaneEnabled(path: string[], laneId: string, enabled: boolean) {
    this.sendEdit({ type: 'set-lane-enabled', path, laneId, enabled });
  }

  setLanePoints(path: string[], laneId: string, points: { t: number; v: number }[]) {
    this.sendEdit({ type: 'set-lane-points', path, laneId, points });
  }

  addLane(path: string[], lane: { id: string; key: string; enabled: boolean; points: { t: number; v: number }[]; min?: number; max?: number }) {
    this.sendEdit({ type: 'add-lane', path, lane });
  }

  removeLane(path: string[], laneId: string) {
    this.sendEdit({ type: 'remove-lane', path, laneId });
  }

  private handleMessage(message: Message) {
    if (message.type === RootSpecification.type) {
      this.rootSpec = message as RootSpecification;
      this.onRootSpec?.(this.rootSpec);
      return;
    }
    if (message.type === TimelineStateMessage.type) {
      const payload = message as TimelineStateMessage;
      this.state = payload.state;
      this.onState?.(payload.state);
      return;
    }
    if (message.type === ControlUpdate.type) {
      this.onControlUpdate?.(message as ControlUpdate);
    }
  }
}

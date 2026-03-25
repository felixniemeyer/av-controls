import { type Message, ControlUpdate, RootSpecification, TimelineEditMessage, TimelineRequestState, TimelineStateMessage } from '../messages';
import type { TimelineEdit, TimelineState } from './index';
import type { Sender as TransportSender } from '../transports/base';

export type TimelineClientOptions = {
  autoRequestState?: boolean;
};

export class TimelineClient {
  private state: TimelineState | null = null;
  private rootSpec: RootSpecification | null = null;
  private seqCounter = 0;
  private pendingSeqs = new Map<string, number>(); // controlPath:laneKey[:render] -> seq
  private latestTimelineEditSeq = 0;

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

  sendEdit(edit: TimelineEdit, seq?: number) {
    const effectiveSeq = seq ?? ++this.seqCounter;
    this.latestTimelineEditSeq = Math.max(this.latestTimelineEditSeq, effectiveSeq);
    this.sender.send(new TimelineEditMessage(edit, effectiveSeq));
  }

  setPlaying(playing: boolean) {
    this.sendEdit({ type: 'set-playing', playing });
  }

  setState(state: 'playing' | 'paused' | 'scrubbing' | 'rendering') {
    this.sendEdit({ type: 'set-state', state });
  }

  seek(time: number) {
    this.sendEdit({ type: 'seek', time });
  }

  setAlwaysRender(alwaysRender: boolean) {
    this.sendEdit({ type: 'set-always-render', alwaysRender });
  }

  setLoopEnabled(loopEnabled: boolean) {
    this.sendEdit({ type: 'set-loop-enabled', loopEnabled });
  }

  setLoopDuration(loopDurationSec: number) {
    this.sendEdit({ type: 'set-loop-duration', loopDurationSec });
  }

  setControlEnabled(path: string[], enabled: boolean) {
    this.sendEdit({ type: 'set-control-enabled', path, enabled });
  }

  setLaneEnabled(path: string[], laneKey: string, enabled: boolean) {
    this.sendEdit({ type: 'set-lane-enabled', path, laneKey, enabled });
  }

  setLanePoints(path: string[], laneKey: string, points: { t: number; v: number; kind?: 'pos' | 'ctrl' }[]) {
    const seq = ++this.seqCounter;
    const key = `${path.join('.')}:${laneKey}`;
    this.pendingSeqs.set(key, seq);
    this.sendEdit({ type: 'set-lane-points', path, laneKey, points }, seq);
  }

  setRenderLanePoints(path: string[], laneKey: string, points: { t: number; v: number; kind?: 'pos' | 'ctrl' }[]) {
    const seq = ++this.seqCounter;
    const key = `${path.join('.')}:${laneKey}:render`;
    this.pendingSeqs.set(key, seq);
    this.sendEdit({ type: 'set-render-lane-points', path, laneKey, points }, seq);
  }

  addLane(path: string[], lane: { key: string; enabled: boolean; points: { t: number; v: number; kind?: 'pos' | 'ctrl' }[] }) {
    this.sendEdit({ type: 'add-lane', path, lane });
  }

  addRenderLane(path: string[], laneKey: string) {
    this.sendEdit({ type: 'add-render-lane', path, laneKey });
  }

  removeLane(path: string[], laneKey: string) {
    this.sendEdit({ type: 'remove-lane', path, laneKey });
  }

  removeRenderLane(path: string[], laneKey: string) {
    this.sendEdit({ type: 'remove-render-lane', path, laneKey });
  }

  renderFrame() {
    this.sendEdit({ type: 'render-frame' });
  }

  private handleMessage(message: Message) {
    if (message.type === RootSpecification.type) {
      this.rootSpec = message as RootSpecification;
      this.onRootSpec?.(this.rootSpec);
      return;
    }
    if (message.type === TimelineStateMessage.type) {
      const payload = message as TimelineStateMessage;
      if (typeof payload.seq === 'number' && payload.seq < this.latestTimelineEditSeq) {
        // Stale state echo from an older timeline edit.
        return;
      }
      const filteredState = this.filterOwnEdits(payload.state);
      this.state = filteredState;
      this.onState?.(filteredState);
      return;
    }
    if (message.type === ControlUpdate.type) {
      this.onControlUpdate?.(message as ControlUpdate);
    }
  }

  private filterOwnEdits(state: TimelineState): TimelineState {
    // Filter out lanes where we have a pending seq that matches
    return {
      ...state,
      controls: state.controls.map(control => {
        const pathKey = control.path.join('.');
        return {
          ...control,
          lanes: control.lanes.map(lane => {
            const key = `${pathKey}:${lane.key}`;
            const pendingSeq = this.pendingSeqs.get(key);
            const renderKey = `${key}:render`;
            const pendingRenderSeq = this.pendingSeqs.get(renderKey);
            let nextLane = lane;
            if (pendingSeq !== undefined && lane.seq === pendingSeq) {
              // This is our own edit coming back, clear the pending seq
              this.pendingSeqs.delete(key);
              // Return the lane from our current state instead (keep local version)
              const currentControl = this.state?.controls.find(c => c.path.join('.') === pathKey);
              const currentLane = currentControl?.lanes.find(l => l.key === lane.key);
              nextLane = currentLane ?? lane;
            }
            if (pendingRenderSeq !== undefined && nextLane.renderSeq === pendingRenderSeq) {
              this.pendingSeqs.delete(renderKey);
              const currentControl = this.state?.controls.find(c => c.path.join('.') === pathKey);
              const currentLane = currentControl?.lanes.find(l => l.key === lane.key);
              if (currentLane) {
                nextLane = currentLane;
              }
            }
            return nextLane;
          }),
        };
      }),
    };
  }
}

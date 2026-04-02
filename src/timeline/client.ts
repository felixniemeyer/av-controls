import { type Message, ControlUpdate, RootSpecification, TimelineEditMessage, TimelineRequestState, TimelineStateMessage, type TimelineLane, type RenderConfig, RenderProgressMessage, RenderCompleteMessage } from '../messages';
import type { TimelineEdit, TimelineState } from './index';
import type { Sender as TransportSender } from '../transports/base';

export type TimelineClientOptions = {
  autoRequestState?: boolean;
};

export type TimelineStateEvent = {
  state: TimelineState;
  source: 'snapshot' | 'edit-echo';
  seq?: number;
  stateSeq?: number;
};

export class TimelineClient {
  private state: TimelineState | null = null;
  private rootSpec: RootSpecification | null = null;
  private seqCounter = 0;
  private pendingSeqs = new Map<string, number>(); // controlPath:laneKey[:render] -> seq
  private latestTimelineEditSeq = 0;
  private latestStateSeq = 0;
  private triggerLog = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('timeline-trigger-log') === '1';
  private playLog = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('timeline-play-log') === '1';

  public onState: ((event: TimelineStateEvent) => void) | null = null;
  public onRootSpec: ((spec: RootSpecification) => void) | null = null;
  public onControlUpdate: ((update: ControlUpdate) => void) | null = null;
  public onRenderProgress: ((msg: RenderProgressMessage) => void) | null = null;
  public onRenderComplete: ((msg: RenderCompleteMessage) => void) | null = null;

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
    return effectiveSeq;
  }

  setPlaying(playing: boolean) {
    const seq = this.seqCounter + 1;
    if (this.playLog) {
      console.info('[timeline:play:edit]', {
        playing,
        nextSeq: seq,
      });
    }
    return this.sendEdit({ type: 'set-playing', playing }, seq);
  }

  setState(state: 'playing' | 'paused' | 'scrubbing' | 'rendering') {
    const seq = this.seqCounter + 1;
    if (this.playLog) {
      console.info('[timeline:play:set-state-edit]', {
        state,
        nextSeq: seq,
      });
    }
    return this.sendEdit({ type: 'set-state', state }, seq);
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

  setLaneTriggers(path: string[], laneKey: string, triggers: { on: { t: number; value: number }; off: { t: number } }[]) {
    const seq = ++this.seqCounter;
    const key = `${path.join('.')}:${laneKey}`;
    this.pendingSeqs.set(key, seq);
    if (this.triggerLog) {
      console.info('[timeline:trigger:edit]', {
        path: path.join('.'),
        laneKey,
        seq,
        triggers: triggers.map(trigger => ({
          onT: trigger.on.t,
          onValue: trigger.on.value,
          offT: trigger.off.t,
        })),
      });
    }
    this.sendEdit({ type: 'set-lane-triggers', path, laneKey, triggers }, seq);
  }

  setLaneKeyframes(path: string[], laneKey: string, keyframes: { t: number; value: unknown; leftSmooth?: number; rightSmooth?: number }[]) {
    const seq = ++this.seqCounter;
    const key = `${path.join('.')}:${laneKey}`;
    this.pendingSeqs.set(key, seq);
    this.sendEdit({ type: 'set-lane-keyframes', path, laneKey, keyframes }, seq);
  }

  setRenderLanePoints(path: string[], laneKey: string, points: { t: number; v: number; kind?: 'pos' | 'ctrl' }[]) {
    const seq = ++this.seqCounter;
    const key = `${path.join('.')}:${laneKey}:render`;
    this.pendingSeqs.set(key, seq);
    this.sendEdit({ type: 'set-render-lane-points', path, laneKey, points }, seq);
  }

  addLane(path: string[], lane: TimelineLane) {
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

  startRenderSequence(config: RenderConfig) {
    return this.sendEdit({ type: 'start-render-sequence', config });
  }

  pauseRenderSequence() {
    return this.sendEdit({ type: 'pause-render-sequence' });
  }

  cancelRenderSequence() {
    return this.sendEdit({ type: 'cancel-render-sequence' });
  }

  private handleMessage(message: Message) {
    if (message.type === RootSpecification.type) {
      this.rootSpec = message as RootSpecification;
      this.latestStateSeq = 0;
      this.onRootSpec?.(this.rootSpec);
      return;
    }
    if (message.type === TimelineStateMessage.type) {
      const payload = message as TimelineStateMessage;
      if (typeof payload.stateSeq === 'number') {
        if (payload.stateSeq < this.latestStateSeq) {
          return;
        }
        this.latestStateSeq = payload.stateSeq;
      }
      if (typeof payload.seq === 'number' && payload.seq < this.latestTimelineEditSeq) {
        // Stale state echo from an older timeline edit.
        return;
      }
      const filteredState = this.filterOwnEdits(payload.state);
      if (this.triggerLog) {
        const triggerControls = filteredState.controls
          .flatMap(control => control.lanes
            .filter(lane => lane.type === 'trigger')
            .map(lane => ({
              path: control.path.join('.'),
              laneKey: lane.key,
              triggerCount: lane.triggers.length,
              triggers: lane.triggers.map(trigger => ({
                onT: trigger.on.t,
                onValue: trigger.on.value,
                offT: trigger.off.t,
              })),
            })));
        if (triggerControls.length) {
          console.info('[timeline:trigger:state]', {
            time: filteredState.time,
            state: filteredState.state,
            stateSeq: payload.stateSeq,
            triggerControls,
          });
        }
      }
      this.state = filteredState;
      this.onState?.({
        state: filteredState,
        source: typeof payload.seq === 'number' ? 'edit-echo' : 'snapshot',
        seq: payload.seq,
        stateSeq: payload.stateSeq,
      });
      return;
    }
    if (message.type === ControlUpdate.type) {
      this.onControlUpdate?.(message as ControlUpdate);
      return;
    }
    if (message.type === RenderProgressMessage.type) {
      this.onRenderProgress?.(message as RenderProgressMessage);
      return;
    }
    if (message.type === RenderCompleteMessage.type) {
      this.onRenderComplete?.(message as RenderCompleteMessage);
      return;
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
            if (pendingRenderSeq !== undefined && nextLane.type !== 'keyframes' && nextLane.type !== 'step' && nextLane.type !== 'trigger' && nextLane.renderSeq === pendingRenderSeq) {
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

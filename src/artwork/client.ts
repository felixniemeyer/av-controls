import {
  ArtworkCaptureAckMessage,
  ArtworkRenderAckMessage,
  ArtworkRuntimeCommandMessage,
  ArtworkRuntimeStatusMessage,
  type Message,
} from '../messages';
import type { Sender as TransportSender } from '../transports/base';

export type ArtworkClientStatus = {
  mode: 'live' | 'playing' | 'paused';
  time: number;
};

export type ArtworkRenderAck = {
  time: number;
  captured: boolean;
  ok: boolean;
  error?: string;
  probeId?: string;
};

export type ArtworkCaptureAck = {
  action: 'start-video' | 'finalize-video' | 'cancel-video';
  ok: boolean;
  error?: string;
};

export class ArtworkClient {
  public onStatus: ((status: ArtworkClientStatus) => void) | null = null;
  public onRenderAck: ((ack: ArtworkRenderAck) => void) | null = null;
  public onCaptureAck: ((ack: ArtworkCaptureAck) => void) | null = null;
  private removeListener: (() => void) | null = null;

  constructor(
    private sender: TransportSender,
  ) {
    this.removeListener = this.sender.addListener((message: Message) => {
      this.handleMessage(message);
    });
  }

  setMode(mode: 'live' | 'playing' | 'paused') {
    this.sender.send(new ArtworkRuntimeCommandMessage({
      type: 'set-artwork-mode',
      mode,
    }));
  }

  resetRenderState() {
    this.sender.send(new ArtworkRuntimeCommandMessage({
      type: 'reset-render-state',
    }));
  }

  startVideoCapture(options: { downloadName: string; fps: number; codec: 'avc' | 'hevc'; quality: number }) {
    this.sender.send(new ArtworkRuntimeCommandMessage({
      type: 'start-video-capture',
      ...options,
    }));
  }

  finalizeVideoCapture() {
    this.sender.send(new ArtworkRuntimeCommandMessage({
      type: 'finalize-video-capture',
    }));
  }

  cancelVideoCapture() {
    this.sender.send(new ArtworkRuntimeCommandMessage({
      type: 'cancel-video-capture',
    }));
  }

  render(time: number, options?: { captureDownloadName?: string }) {
    this.sender.send(new ArtworkRuntimeCommandMessage({
      type: 'render-artwork',
      time,
      capture: options?.captureDownloadName ? { downloadName: options.captureDownloadName } : undefined,
    }));
  }

  probeRenderLatency(probeId: string) {
    this.sender.send(new ArtworkRuntimeCommandMessage({
      type: 'probe-render-latency',
      probeId,
    }));
  }

  private handleMessage(message: Message) {
    if (message.type === ArtworkRuntimeStatusMessage.type) {
      const status = message as ArtworkRuntimeStatusMessage;
      this.onStatus?.({
        mode: status.mode,
        time: status.time,
      });
      return;
    }
    if (message.type === ArtworkRenderAckMessage.type) {
      const ack = message as ArtworkRenderAckMessage;
      this.onRenderAck?.({
        time: ack.time,
        captured: ack.captured,
        ok: ack.ok,
        error: ack.error,
        probeId: ack.probeId,
      });
      return;
    }
    if (message.type === ArtworkCaptureAckMessage.type) {
      const ack = message as ArtworkCaptureAckMessage;
      this.onCaptureAck?.({
        action: ack.action,
        ok: ack.ok,
        error: ack.error,
      });
    }
  }

  dispose() {
    this.removeListener?.();
    this.removeListener = null;
    this.onStatus = null;
    this.onRenderAck = null;
    this.onCaptureAck = null;
  }
}

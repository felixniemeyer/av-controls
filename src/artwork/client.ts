import {
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
};

export class ArtworkClient {
  public onStatus: ((status: ArtworkClientStatus) => void) | null = null;
  public onRenderAck: ((ack: ArtworkRenderAck) => void) | null = null;
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

  render(time: number, options?: { captureDownloadName?: string }) {
    this.sender.send(new ArtworkRuntimeCommandMessage({
      type: 'render-artwork',
      time,
      capture: options?.captureDownloadName ? { downloadName: options.captureDownloadName } : undefined,
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
      });
    }
  }

  dispose() {
    this.removeListener?.();
    this.removeListener = null;
    this.onStatus = null;
    this.onRenderAck = null;
  }
}

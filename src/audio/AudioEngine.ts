import { PitchDetector } from "pitchy";
import { PitchSmoother } from "../features/pitch/pitchSmoother";
import captureWorkletUrl from "./capture-worklet.js?url&no-inline";

export class AudioEngine {
  readonly context = new AudioContext();
  private readonly pitchSmoother = new PitchSmoother();
  private mic?: MediaStream;
  private micNode?: MediaStreamAudioSourceNode;
  private worklet?: AudioWorkletNode;
  private mutedSink?: GainNode;
  private source?: MediaElementAudioSourceNode;
  private disposed = false;

  async startMicrophone(onPitch: (hz: number | null, clarity: number, timestamp: number) => void) {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("Microphone capture is unsupported");
    this.mic = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false, channelCount: 1 },
      video: false,
    });
    await this.context.resume();
    try {
      await this.context.audioWorklet.addModule(captureWorkletUrl);
    } catch (cause) {
      const detail = cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause);
      throw new Error(`Could not load microphone audio worklet from ${captureWorkletUrl}: ${detail}`, { cause });
    }
    this.micNode = this.context.createMediaStreamSource(this.mic);
    this.worklet = new AudioWorkletNode(this.context, "capture-frame");
    this.worklet.port.onmessage = (event: MessageEvent<{ samples: ArrayBuffer; timestamp: number }>) => {
      const samples = new Float32Array(event.data.samples);
      const detector = PitchDetector.forFloat32Array(samples.length);
      const [detectedHz, clarity] = detector.findPitch(samples, this.context.sampleRate);
      const hz = Number.isFinite(detectedHz) && clarity >= 0.9 ? detectedHz : null;
      onPitch(this.pitchSmoother.push(hz), clarity, event.data.timestamp);
    };
    this.micNode.connect(this.worklet);
    this.mutedSink = this.context.createGain();
    this.mutedSink.gain.value = 0;
    this.worklet.connect(this.mutedSink);
    this.mutedSink.connect(this.context.destination);
  }

  async connectPlayback(audio: HTMLAudioElement) {
    await this.context.resume();
    this.source ??= this.context.createMediaElementSource(audio);
    this.source.connect(this.context.destination);
  }

  stopMicrophone() {
    this.pitchSmoother.reset();
    this.worklet?.disconnect();
    this.mutedSink?.disconnect();
    this.micNode?.disconnect();
    this.worklet = undefined;
    this.mutedSink = undefined;
    this.micNode = undefined;
    this.mic?.getTracks().forEach((track) => track.stop());
    this.mic = undefined;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.stopMicrophone();
    this.source?.disconnect();
    void this.context.close();
  }
}

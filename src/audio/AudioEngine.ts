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
  private microphoneGeneration = 0;

  async startMicrophone(onPitch: (hz: number | null, clarity: number, timestamp: number) => void) {
    if (!globalThis.isSecureContext) {
      throw new Error("Microphone access requires HTTPS. Open this app on localhost or use an HTTPS address.");
    }
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("Microphone capture is unsupported in this browser");
    const generation = ++this.microphoneGeneration;
    const isCurrentStart = () => !this.disposed && generation === this.microphoneGeneration;
    const mic = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false, channelCount: 1 },
      video: false,
    });
    if (!isCurrentStart()) {
      mic.getTracks().forEach((track) => track.stop());
      throw new Error("Microphone startup was cancelled.");
    }
    this.mic = mic;
    await this.context.resume();
    if (!isCurrentStart()) throw new Error("Microphone startup was cancelled.");
    try {
      await this.context.audioWorklet.addModule(captureWorkletUrl);
    } catch (cause) {
      const detail = cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause);
      throw new Error(`Could not load microphone audio worklet from ${captureWorkletUrl}: ${detail}`, { cause });
    }
    if (!isCurrentStart()) throw new Error("Microphone startup was cancelled.");
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

  connectPlayback(audio: HTMLAudioElement) {
    if (!this.source) {
      this.source = this.context.createMediaElementSource(audio);
      this.source.connect(this.context.destination);
    }
    return this.context.resume();
  }

  stopMicrophone() {
    this.microphoneGeneration += 1;
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

class CaptureFrameProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.frame = new Float32Array(2048);
    this.index = 0;
  }
  process(inputs) {
    const input = inputs[0]?.[0];
    if (input) {
      for (let i = 0; i < input.length && this.index < this.frame.length; i++) this.frame[this.index++] = input[i];
      if (this.index === this.frame.length) {
        const copy = this.frame.slice();
        this.port.postMessage({ samples: copy.buffer, timestamp: currentTime }, [copy.buffer]);
        this.index = 0;
      }
    }
    return true;
  }
}
registerProcessor("capture-frame", CaptureFrameProcessor);

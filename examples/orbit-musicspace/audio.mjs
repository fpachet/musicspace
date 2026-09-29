export class FaustAudio {
  constructor(metadata, onState, wasmUrl = new URL("./audio/orbit-study.wasm", import.meta.url)) {
    this.metadata = metadata;
    this.onState = onState;
    this.values = {};
    this.context = null;
    this.node = null;
    this.ready = null;
    this.wasmUrl = wasmUrl;
  }

  setValues(values) {
    Object.assign(this.values, values);
    this.node?.port.postMessage(values);
  }

  async toggle() {
    if (!this.context) {
      this.context = new AudioContext();
      this.context.onstatechange = () => this.onState(this.context?.state ?? "closed");
      this.ready = this.initialize().catch(async (error) => {
        await this.context.close();
        this.context = null;
        this.node = null;
        throw error;
      });
      await this.ready;
      await this.context.resume();
    } else {
      await this.ready;
      if (this.context.state === "running") await this.context.suspend();
      else await this.context.resume();
    }
    this.onState(this.context.state);
  }

  async initialize() {
    const response = await fetch(this.wasmUrl);
    if (!response.ok) throw new Error("Could not load the Faust instrument.");
    const module = await WebAssembly.compile(await response.arrayBuffer());
    await this.context.audioWorklet.addModule(new URL("./audio/faust-worklet.mjs", import.meta.url));
    this.node = new AudioWorkletNode(this.context, "orbit-study", {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [2],
      processorOptions: { module, metadata: this.metadata, values: this.values }
    });
    this.node.onprocessorerror = () => this.onState("error");
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 256;
    this.node.connect(this.analyser).connect(this.context.destination);
  }

  async destroy() {
    this.node?.disconnect();
    this.analyser?.disconnect();
    await this.context?.close();
  }
}

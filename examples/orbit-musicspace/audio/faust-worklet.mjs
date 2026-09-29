// Minimal mono-instance runtime for the included Faust 2.81.2 wasm module.
// The DSP generates stereo output and has no audio inputs.
class OrbitStudyProcessor extends AudioWorkletProcessor {
  constructor({ processorOptions: { module, metadata, values } }) {
    super();
    const instance = new WebAssembly.Instance(module, {
      env: { _powf: Math.pow, _sinf: Math.sin, _tanf: Math.tan, _tanhf: Math.tanh }
    });
    this.dsp = instance.exports;
    this.dsp.init(0, sampleRate);
    const pointer = Math.ceil(metadata.size / 16) * 16;
    this.outputsPointer = pointer;
    const needed = pointer + 8 + 2 * 128 * 4;
    if (this.dsp.memory.buffer.byteLength < needed) {
      this.dsp.memory.grow(Math.ceil((needed - this.dsp.memory.buffer.byteLength) / 65536));
    }
    const addresses = new Int32Array(this.dsp.memory.buffer);
    this.buffers = [0, 1].map((channel) => {
      const address = pointer + 8 + channel * 128 * 4;
      addresses[pointer / 4 + channel] = address;
      return new Float32Array(this.dsp.memory.buffer, address, 128);
    });
    this.controls = new Map();
    const walk = (items) => {
      for (const item of items) {
        if (item.items) walk(item.items);
        else if (item.address && item.index !== undefined) this.controls.set(item.address, item);
      }
    };
    walk(metadata.ui);
    this.apply(values);
    this.port.onmessage = ({ data }) => this.apply(data);
  }

  apply(values) {
    for (const [path, value] of Object.entries(values)) {
      const control = this.controls.get(path);
      if (control && Number.isFinite(value)) {
        this.dsp.setParamValue(0, Number(control.index), Math.max(control.min, Math.min(control.max, value)));
      }
    }
  }

  process(_inputs, outputs) {
    this.dsp.compute(0, 128, 0, this.outputsPointer);
    for (let channel = 0; channel < outputs[0].length; channel++) {
      outputs[0][channel].set(this.buffers[channel]);
    }
    return true;
  }
}

registerProcessor('orbit-study', OrbitStudyProcessor);

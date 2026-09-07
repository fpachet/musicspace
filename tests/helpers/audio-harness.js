// Deterministic Web Audio / timer doubles for testing the real output clients.
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function createAudioHarness(options = {}) {
  const contexts = [];
  const timers = new Map();
  let nextTimer = 1;
  let time = 0;
  const param = () => ({
    value: 0,
    setTargetAtTime(value) {
      this.value = value;
    },
    setValueAtTime(value) {
      this.value = value;
    },
    linearRampToValueAtTime(value) {
      this.value = value;
    },
    exponentialRampToValueAtTime(value) {
      this.value = value;
    },
    cancelScheduledValues() {}
  });
  class AudioContext {
    constructor() {
      this.currentTime = time;
      this.sampleRate = 100;
      this.destination = {};
      this.state = "suspended";
      this.nodes = [];
      contexts.push(this);
    }
    resume() {
      return Promise.resolve(options.resume?.()).then(() => {
        if (this.state !== "closed") this.state = "running";
      });
    }
    suspend() {
      this.state = "suspended";
      return Promise.resolve();
    }
    close() {
      this.state = "closed";
      return Promise.resolve();
    }
    node(type) {
      const node = {
        type,
        gain: param(),
        pan: param(),
        frequency: param(),
        Q: param(),
        delayTime: param(),
        playbackRate: param(),
        detune: param(),
        connections: [],
        started: false,
        stopped: false,
        connect(destination) {
          this.connections.push(destination);
          return destination;
        },
        disconnect() {
          this.connections = [];
        },
        start(at = 0) {
          this.started = true;
          this.startAt = at;
        },
        stop() {
          this.stopped = true;
        },
        addEventListener() {},
        setPeriodicWave() {}
      };
      this.nodes.push(node);
      return node;
    }
    createGain() {
      return this.node("gain");
    }
    createOscillator() {
      return this.node("oscillator");
    }
    createBufferSource() {
      return this.node("buffer");
    }
    createStereoPanner() {
      return this.node("pan");
    }
    createBiquadFilter() {
      return this.node("filter");
    }
    createDelay() {
      return this.node("delay");
    }
    createWaveShaper() {
      return this.node("shaper");
    }
    createPeriodicWave() {
      return {};
    }
    createBuffer(channels, length) {
      return { duration: length / this.sampleRate, getChannelData: () => new Float32Array(length) };
    }
    decodeAudioData(data) {
      return Promise.resolve(options.decode?.(data) || { duration: 1 });
    }
  }
  const schedule = (callback) => {
    const id = nextTimer++;
    timers.set(id, callback);
    return id;
  };
  return {
    contexts,
    timers,
    globals: {
      AudioContext,
      setInterval: schedule,
      clearInterval: (id) => timers.delete(id),
      setTimeout: schedule,
      clearTimeout: (id) => timers.delete(id),
      performance: { now: () => time * 1000 }
    },
    advance(seconds) {
      time += seconds;
      contexts.forEach((context) => {
        context.currentTime = time;
      });
      for (const callback of [...timers.values()]) callback();
    },
    playingNodes: () =>
      contexts
        .flatMap((context) => context.nodes)
        .filter((node) => node.started && !node.stopped && node.connections.length)
  };
}
module.exports = { deferred, createAudioHarness };

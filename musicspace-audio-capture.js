// Optional Web Audio capture bus for reproducible demo recordings.
//
// Normal playback still connects to AudioContext.destination. Audio clients can
// additionally connect their final output nodes here so capture scripts can
// record one mixed MediaStream without relying on browser tab audio capture.

(function exposeMusicSpaceAudioCapture(global) {
  const contextEntries = new Map();
  let mixerContext = null;
  let mixerDestination = null;

  function registerContext(context) {
    if (!context || typeof context.createMediaStreamDestination !== "function") {
      return null;
    }
    if (contextEntries.has(context)) {
      return contextEntries.get(context);
    }

    const destination = context.createMediaStreamDestination();
    const entry = {
      context,
      destination,
      mixerSource: null
    };
    contextEntries.set(context, entry);
    return entry;
  }

  function connect(context, node) {
    const entry = registerContext(context);
    if (!entry || typeof node?.connect !== "function") {
      return false;
    }
    try {
      node.connect(entry.destination);
      return true;
    } catch (error) {
      return false;
    }
  }

  function disconnect(context, node) {
    const entry = contextEntries.get(context);
    if (!entry || typeof node?.disconnect !== "function") {
      return false;
    }
    try {
      node.disconnect(entry.destination);
      return true;
    } catch (error) {
      return false;
    }
  }

  function ensureMixer() {
    if (mixerContext && mixerDestination) {
      return mixerDestination;
    }

    const AudioContextClass = global.AudioContext || global.webkitAudioContext;
    if (!AudioContextClass) {
      return null;
    }

    mixerContext = new AudioContextClass();
    mixerDestination = mixerContext.createMediaStreamDestination();
    return mixerDestination;
  }

  async function stream() {
    const destination = ensureMixer();
    if (!destination) {
      return null;
    }

    for (const entry of contextEntries.values()) {
      if (!entry.mixerSource) {
        entry.mixerSource = mixerContext.createMediaStreamSource(entry.destination.stream);
        entry.mixerSource.connect(destination);
      }
    }

    if (mixerContext.state === "suspended") {
      await mixerContext.resume();
    }
    return destination.stream;
  }

  function trackCount() {
    return Array.from(contextEntries.values())
      .filter((entry) => entry.destination.stream.getAudioTracks().length > 0)
      .length;
  }

  global.MusicSpaceAudioCapture = {
    connect,
    disconnect,
    registerContext,
    stream,
    trackCount
  };
})(window);

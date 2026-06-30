// Per-source audio file playback for MusicSpace.
//
// The scene owns source geometry and serialized bindings. This client owns
// decoding audio files, creating Web Audio nodes, and updating pan/gain from
// listener-relative source positions.

(function exposeMusicSpaceSourceAudioClient(global) {
  const AUDIO_FILE_TYPE = "audio-file";
  const DEFAULT_SPATIALIZATION = "pan-distance";
  const MAX_DISTANCE = Math.hypot(800, 600);
  const MAX_REVERB_SEND = 0.48;

  function createSourceAudioClient(options = {}) {
    const onStatus = options.onStatus || (() => {});
    const getSource = options.getSource || (() => null);
    const getListener = options.getListener || (() => null);

    let context = null;
    let reverbBus = null;
    let bindings = [];
    let players = new Map();
    let enabled = false;

    return {
      loadPatch(patch = {}) {
        stopPlayers();
        enabled = false;
        bindings = normalizeBindings(patch.sourceBindings || []);
      },
      serialize() {
        return {
          sourceBindings: bindings.map(serializeBinding)
        };
      },
      bindingsForSource(sourceName) {
        return bindings.filter((binding) => binding.source === sourceName).map(serializeBinding);
      },
      isSourceMuted(sourceName) {
        return Boolean(bindings.find((binding) => binding.source === sourceName)?.muted);
      },
      toggleSourceMuted(sourceName) {
        const binding = bindings.find((candidate) => candidate.source === sourceName);
        if (!binding) {
          return null;
        }

        binding.muted = !binding.muted;
        const player = players.get(sourceName);
        if (player) {
          player.binding.muted = binding.muted;
        }
        updateSpatial();
        return serializeBinding(binding);
      },
      upsertBinding(binding) {
        const normalized = normalizeBinding(binding);
        if (!normalized) {
          return null;
        }

        bindings = bindings.filter((candidate) => candidate.source !== normalized.source);
        bindings.push(normalized);
        if (enabled) {
          restartEnabledPlayback().catch(() => {
            onStatus(`Could not restart ${normalized.name}.`);
          });
        }
        return serializeBinding(normalized);
      },
      removeBinding(sourceName) {
        bindings = bindings.filter((binding) => binding.source !== sourceName);
        const player = players.get(sourceName);
        stopPlayer(player);
        players.delete(sourceName);
      },
      renameSource(oldName, newName) {
        bindings = bindings.map((binding) => (
          binding.source === oldName ? { ...binding, source: newName } : binding
        ));
        const player = players.get(oldName);
        if (player) {
          players.delete(oldName);
          player.binding.source = newName;
          players.set(newName, player);
        }
      },
      removeBindingsForMissingSources(sourceNames) {
        const validNames = new Set(sourceNames);
        for (const binding of [...bindings]) {
          if (!validNames.has(binding.source)) {
            this.removeBinding(binding.source);
          }
        }
      },
      hasBindings() {
        return bindings.length > 0;
      },
      isEnabled() {
        return enabled;
      },
      async setEnabled(nextEnabled) {
        enabled = Boolean(nextEnabled) && bindings.length > 0;
        if (!enabled) {
          stopPlayers();
          return false;
        }

        await ensureContext();
        if (!context) {
          enabled = false;
          return false;
        }

        await context.resume();
        await startPlayers();
        updateSpatial();
        return enabled;
      },
      updateSpatial
    };

    function normalizeBindings(nextBindings) {
      if (!Array.isArray(nextBindings)) {
        return [];
      }

      return nextBindings.map(normalizeBinding).filter(Boolean);
    }

    function normalizeBinding(binding) {
      if (!binding || typeof binding !== "object") {
        return null;
      }
      if (binding.type !== AUDIO_FILE_TYPE) {
        return null;
      }
      if (typeof binding.source !== "string" || binding.source.trim() === "") {
        return null;
      }

      return {
        source: binding.source,
        type: AUDIO_FILE_TYPE,
        name: binding.name || binding.fileName || "Audio file",
        mimeType: binding.mimeType || "",
        dataUrl: binding.dataUrl || "",
        url: binding.url || "",
        loop: binding.loop !== false,
        gain: finiteOrDefault(binding.gain, 1),
        muted: Boolean(binding.muted),
        spatialization: binding.spatialization || DEFAULT_SPATIALIZATION
      };
    }

    function serializeBinding(binding) {
      return {
        source: binding.source,
        type: binding.type,
        name: binding.name,
        mimeType: binding.mimeType,
        dataUrl: binding.dataUrl,
        url: binding.url,
        loop: binding.loop,
        gain: binding.gain,
        muted: binding.muted,
        spatialization: binding.spatialization
      };
    }

    async function ensureContext() {
      if (context) {
        return context;
      }

      const AudioContextClass = global.AudioContext || global.webkitAudioContext;
      if (!AudioContextClass) {
        onStatus("Web Audio is not available in this browser.");
        return null;
      }

      context = new AudioContextClass();
      reverbBus = createReverbBus(context);
      return context;
    }

    async function startPlayers() {
      const nextPlayers = new Map();
      for (const binding of bindings) {
        const sourceEntity = getSource(binding.source);
        if (!sourceEntity) {
          continue;
        }

        try {
          const player = await createPlayer(binding);
          if (player) {
            nextPlayers.set(binding.source, player);
          }
        } catch (error) {
          onStatus(`Could not play ${binding.name}.`);
        }
      }

      stopPlayers();
      players = nextPlayers;
    }

    async function createPlayer(binding) {
      if (!context || (!binding.dataUrl && !binding.url)) {
        return null;
      }

      const buffer = await decodeBindingAudio(binding);
      const sourceNode = context.createBufferSource();
      const sourceGainNode = context.createGain();
      const directGainNode = context.createGain();
      const reverbSendNode = context.createGain();
      const panNode = context.createStereoPanner ? context.createStereoPanner() : null;

      sourceNode.buffer = buffer;
      sourceNode.loop = binding.loop;
      reverbSendNode.gain.value = 0;
      sourceNode.connect(sourceGainNode);
      sourceGainNode.connect(directGainNode);
      sourceGainNode.connect(reverbSendNode);
      if (panNode) {
        directGainNode.connect(panNode);
        panNode.connect(context.destination);
      } else {
        directGainNode.connect(context.destination);
      }
      if (reverbBus) {
        reverbSendNode.connect(reverbBus.input);
      }
      sourceNode.start();

      return { binding, sourceNode, sourceGainNode, directGainNode, reverbSendNode, panNode };
    }

    async function decodeBindingAudio(binding) {
      const arrayBuffer = binding.dataUrl
        ? dataUrlToArrayBuffer(binding.dataUrl)
        : await fetchArrayBuffer(binding.url);
      return context.decodeAudioData(arrayBuffer.slice(0));
    }

    async function fetchArrayBuffer(url) {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Could not load ${url}`);
      }
      return response.arrayBuffer();
    }

    function updateSpatial() {
      if (!enabled || !context) {
        return;
      }

      const listener = getListener();
      if (!listener) {
        return;
      }

      const time = context.currentTime;
      for (const player of players.values()) {
        const sourceEntity = getSource(player.binding.source);
        if (!sourceEntity) {
          continue;
        }

        const dx = sourceEntity.x - listener.x;
        const dy = sourceEntity.y - listener.y;
        const distance = Math.hypot(dx, dy);
        const normalizedDistance = clamp(distance / MAX_DISTANCE, 0, 1);
        const pan = clamp(dx / 300, -1, 1);
        const attenuation = player.binding.spatialization === "stereo-pan"
          ? 1
          : clamp(1 - normalizedDistance, 0.05, 1);
        const sourceGain = player.binding.muted ? 0 : clamp(player.binding.gain, 0, 2);
        const reverbSend = player.binding.muted || player.binding.spatialization === "stereo-pan"
          ? 0
          : Math.pow(normalizedDistance, 0.7) * MAX_REVERB_SEND;

        setParam(player.sourceGainNode.gain, sourceGain, time);
        setParam(player.directGainNode.gain, attenuation, time);
        setParam(player.reverbSendNode.gain, reverbSend, time);
        if (player.panNode) {
          setParam(player.panNode.pan, pan, time);
        }
      }
    }

    function stopPlayers() {
      for (const player of players.values()) {
        stopPlayer(player);
      }
      players = new Map();
    }

    function stopPlayer(player) {
      if (!player) {
        return;
      }

      try {
        player.sourceNode.stop();
      } catch (error) {
        // The source may already have ended.
      }
      player.sourceNode.disconnect();
      player.sourceGainNode.disconnect();
      player.directGainNode.disconnect();
      player.reverbSendNode.disconnect();
      player.panNode?.disconnect();
    }

    async function restartEnabledPlayback() {
      if (!enabled) {
        return;
      }
      stopPlayers();
      await startPlayers();
      updateSpatial();
    }
  }

  function createReverbBus(context) {
    if (
      typeof context.createGain !== "function" ||
      typeof context.createDelay !== "function"
    ) {
      return null;
    }

    const input = context.createGain();
    const delay = context.createDelay(1.2);
    const feedback = context.createGain();
    const output = context.createGain();
    const tone = typeof context.createBiquadFilter === "function"
      ? context.createBiquadFilter()
      : null;

    input.gain.value = 1;
    delay.delayTime.value = 0.135;
    feedback.gain.value = 0.26;
    output.gain.value = 0.42;

    input.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    if (tone) {
      tone.type = "lowpass";
      tone.frequency.value = 4200;
      delay.connect(tone);
      tone.connect(output);
    } else {
      delay.connect(output);
    }
    output.connect(context.destination);

    return { input, delay, feedback, output, tone };
  }

  function dataUrlToArrayBuffer(dataUrl) {
    const [, payload = ""] = dataUrl.split(",");
    const binary = global.atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes.buffer;
  }

  function setParam(param, value, time) {
    if (typeof param.setTargetAtTime === "function") {
      param.setTargetAtTime(value, time, 0.025);
    } else {
      param.value = value;
    }
  }

  function finiteOrDefault(value, fallback) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  global.MusicSpaceSourceAudioClient = {
    createSourceAudioClient
  };
})(window);

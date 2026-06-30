// MIDI/MusicXML transport and spatial playback client for MusicSpace.
//
// This module is intentionally separate from the MusicSpace constraint engine:
// it parses and plays sequence files, then asks the scene for listener/source
// positions to derive pan, gain, reverb, and filter controls.

(function exposeMusicSpaceMidiFileClient(global) {
  const DEFAULT_TEMPO = 500000;
  const SCHEDULE_AHEAD_SECONDS = 0.18;
  const SCHEDULER_INTERVAL_MS = 35;
  const SPATIAL_INTERVAL_MS = 60;
  const MAX_SPATIAL_DISTANCE = 360;
  const PPQ = 480;

  function createMidiFileClient(options = {}) {
    const playButton = options.playButton || null;
    const modeSelect = options.modeSelect || null;
    const outputSelect = options.outputSelect || null;
    const panel = options.panel || null;
    const trackList = options.trackList || null;
    const status = options.status || null;
    const onStatus = options.onStatus || (() => {});
    const getSource = options.getSource || (() => null);
    const getListener = options.getListener || (() => null);

    let patchMidiSpec = null;
    let midiFile = null;
    let trackBindings = [];
    let renderer = null;
    let isPlaying = false;
    let startedAt = 0;
    let schedulerTimer = null;
    let spatialTimer = null;
    let nextEventIndex = 0;
    let boundTrackIndices = new Set();
    let midiAccess = null;
    let availableOutputs = [];
    let selectedOutputId = "";
    let loadToken = 0;

    if (playButton) {
      playButton.addEventListener("click", () => {
        if (isPlaying) {
          stop();
        } else {
          play();
        }
      });
    }

    if (modeSelect) {
      modeSelect.addEventListener("change", () => {
        stop();
        updateModeAvailability();
        setStatus(modeSelect.value === "external" ? "External MIDI mode selected." : "Internal GM-style synth selected.");
      });
    }

    if (outputSelect) {
      outputSelect.addEventListener("change", () => {
        selectedOutputId = outputSelect.value;
      });
    }

    return {
      loadPatch,
      serialize,
      updateSpatial,
      stop,
      renameSource(oldName, newName) {
        if (patchMidiSpec?.trackBindings) {
          patchMidiSpec = {
            ...patchMidiSpec,
            trackBindings: patchMidiSpec.trackBindings.map((binding) => (
              binding.source === oldName ? { ...binding, source: newName } : binding
            ))
          };
        }
        trackBindings = trackBindings.map((binding) => (
          binding.source === oldName ? { ...binding, source: newName } : binding
        ));
        updatePanel();
        updateSpatial(true);
      },
      hasMidiFile() {
        return Boolean(patchMidiSpec);
      }
    };

    async function loadPatch(patch = {}) {
      stop();
      patchMidiSpec = patch.midiFile || null;
      midiFile = null;
      trackBindings = [];
      renderer = null;
      loadToken += 1;
      const currentLoadToken = loadToken;

      updatePanel();
      updatePlayButton();

      if (!patchMidiSpec) {
        setStatus("");
        return;
      }

      if (modeSelect && patchMidiSpec.preferredMode) {
        modeSelect.value = patchMidiSpec.preferredMode === "external" ? "external" : "internal";
      }

      setStatus(`Loading ${patchMidiSpec.name || patchMidiSpec.url || "sequence"}...`);

      try {
        const loadUrl = patchMidiSpec.url;
        let parsed = patchMidiSpec.sequenceData || null;

        if (!parsed) {
          const response = await fetch(loadUrl);
          if (!response.ok) {
            throw new Error(`Could not load ${loadUrl}.`);
          }
          const buffer = await response.arrayBuffer();
          parsed = await parseSequenceFile(loadUrl, buffer);
        }
        if (currentLoadToken !== loadToken) {
          return;
        }

        midiFile = parsed;
        trackBindings = bindTracks(parsed, patchMidiSpec.trackBindings || []);
        updatePanel();
        updatePlayButton();
        updateModeAvailability();
        setStatus(`${parsed.musicalTracks.length} sequence tracks loaded.`);
      } catch (error) {
        if (currentLoadToken === loadToken) {
          const failedUrl = patchMidiSpec?.url;
          patchMidiSpec = null;
          updatePanel();
          setStatus(midiLoadErrorMessage(error, failedUrl));
        }
      }
    }

    function serialize() {
      if (!patchMidiSpec) {
        return {};
      }

      return {
        midiFile: {
          ...serializeMidiSpec(patchMidiSpec),
          preferredMode: modeSelect?.value || patchMidiSpec.preferredMode || "internal"
        }
      };
    }

    async function play() {
      if (!midiFile || trackBindings.length === 0) {
        setStatus(patchMidiSpec ? "Sequence file is still loading." : "This patch has no sequence file.");
        return;
      }

      stop();

      try {
        renderer = modeSelect?.value === "external"
          ? await createExternalRenderer()
          : createInternalRenderer();
      } catch (error) {
        renderer = null;
        setStatus(error.message || "Could not start MIDI playback.");
        return;
      }

      if (!renderer) {
        return;
      }

      isPlaying = true;
      startedAt = nowSeconds();
      nextEventIndex = 0;
      boundTrackIndices = new Set(trackBindings.map((binding) => binding.trackIndex));
      renderer.start(trackBindings);
      updateSpatial(true);
      scheduleDueEvents();
      schedulerTimer = global.setInterval(scheduleDueEvents, SCHEDULER_INTERVAL_MS);
      spatialTimer = global.setInterval(() => updateSpatial(false), SPATIAL_INTERVAL_MS);
      updatePlayButton();
      setStatus("MIDI playing.");
    }

    function stop() {
      const wasPlaying = isPlaying;

      if (schedulerTimer) {
        global.clearInterval(schedulerTimer);
        schedulerTimer = null;
      }

      if (spatialTimer) {
        global.clearInterval(spatialTimer);
        spatialTimer = null;
      }

      renderer?.stop();
      renderer = null;
      isPlaying = false;
      nextEventIndex = 0;
      boundTrackIndices = new Set();
      updatePlayButton();

      if (wasPlaying) {
        setStatus("MIDI stopped.");
      }
    }

    function scheduleDueEvents() {
      if (!isPlaying || !renderer || !midiFile) {
        return;
      }

      const transportTime = nowSeconds() - startedAt;
      const horizon = transportTime + SCHEDULE_AHEAD_SECONDS;

      while (nextEventIndex < midiFile.events.length && midiFile.events[nextEventIndex].seconds <= horizon) {
        const event = midiFile.events[nextEventIndex];
        const delay = Math.max(0, event.seconds - transportTime);
        if (boundTrackIndices.has(event.trackIndex)) {
          renderer.schedule(event, delay);
        }
        nextEventIndex += 1;
      }

      if (transportTime > midiFile.durationSeconds + 0.5) {
        stop();
        setStatus("MIDI finished.");
      }
    }

    function updateSpatial(immediate = false) {
      if (!patchMidiSpec || trackBindings.length === 0) {
        return;
      }

      const spatialValues = trackBindings.map((binding) => ({
        ...binding,
        spatial: spatialValuesForSource(getSource(binding.source))
      }));

      renderer?.applySpatial(spatialValues, immediate);
    }

    async function createExternalRenderer() {
      if (!global.navigator?.requestMIDIAccess) {
        throw new Error("Web MIDI is not available in this browser.");
      }

      midiAccess = midiAccess || await global.navigator.requestMIDIAccess({ sysex: false });
      refreshMidiOutputs();
      const output = availableOutputs.find((candidate) => candidate.id === selectedOutputId) || availableOutputs[0];
      if (!output) {
        throw new Error("No MIDI output is available.");
      }

      selectedOutputId = output.id;
      if (outputSelect) {
        outputSelect.value = selectedOutputId;
      }

      return createWebMidiRenderer(output);
    }

    function createInternalRenderer() {
      const AudioContextClass = global.AudioContext || global.webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error("Web Audio is not available in this browser.");
      }

      return createBrowserSynthRenderer(new AudioContextClass());
    }

    function updateModeAvailability() {
      if (!modeSelect || !outputSelect) {
        return;
      }

      const external = modeSelect.value === "external";
      outputSelect.hidden = !external;
      outputSelect.disabled = !external;

      if (external) {
        refreshMidiOutputs();
      }
    }

    function refreshMidiOutputs() {
      availableOutputs = midiAccess ? Array.from(midiAccess.outputs.values()) : [];
      if (!outputSelect) {
        return;
      }

      outputSelect.replaceChildren();
      if (availableOutputs.length === 0) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "No MIDI outputs";
        outputSelect.append(option);
        return;
      }

      for (const output of availableOutputs) {
        const option = document.createElement("option");
        option.value = output.id;
        option.textContent = output.name || output.manufacturer || output.id;
        outputSelect.append(option);
      }

      if (!selectedOutputId || !availableOutputs.some((output) => output.id === selectedOutputId)) {
        selectedOutputId = availableOutputs[0].id;
      }
      outputSelect.value = selectedOutputId;
    }

    function updatePanel() {
      if (!panel || !trackList) {
        return;
      }

      panel.hidden = !patchMidiSpec;
      trackList.replaceChildren();

      if (!patchMidiSpec) {
        return;
      }

      const rows = trackBindings.length > 0
        ? trackBindings
        : (patchMidiSpec.trackBindings || []).map((binding) => ({ ...binding, noteCount: 0, channel: binding.channel }));

      for (const binding of rows) {
        const row = document.createElement("div");
        const label = document.createElement("span");
        const output = document.createElement("output");

        row.className = "midi-track";
        label.textContent = binding.source || binding.track || "Track";
        output.value = [
          binding.track && binding.track !== binding.source ? binding.track : "",
          binding.channel ? `ch ${binding.channel}` : "",
          binding.noteCount ? `${binding.noteCount} notes` : ""
        ].filter(Boolean).join(" · ");
        row.append(label, output);
        trackList.append(row);
      }
    }

    function updatePlayButton() {
      if (!playButton) {
        return;
      }

      playButton.textContent = isPlaying ? "Stop MIDI" : "Play MIDI";
      playButton.setAttribute("aria-pressed", String(isPlaying));
      playButton.disabled = Boolean(patchMidiSpec && !midiFile);
    }

    function setStatus(message) {
      if (status) {
        status.textContent = message;
      }
      if (message) {
        onStatus(message);
      }
    }

    function midiLoadErrorMessage(error, url) {
      if (global.location?.protocol === "file:") {
        return "MIDI/MusicXML files cannot be fetched from file://. Run npm run serve and open http://localhost:8000/musicspace.html.";
      }

      if (error instanceof TypeError) {
        return `Could not fetch ${url}. Check that the app is served from the project root and that the sequence file exists.`;
      }

      return error.message || "Could not load sequence file.";
    }

    function spatialValuesForSource(source) {
      const listener = getListener();
      if (!source || !listener) {
        return { pan: 0, gain: 0.85, reverb: 0.2, filter: 0.85 };
      }

      const dx = source.x - listener.x;
      const dy = source.y - listener.y;
      const distance = Math.hypot(dx, dy);
      const normalizedDistance = clamp(distance / MAX_SPATIAL_DISTANCE, 0, 1);
      const pan = clamp(dx / (MAX_SPATIAL_DISTANCE * 0.85), -1, 1);
      const gain = clamp(1 - normalizedDistance * 0.75, 0.18, 1);
      const reverb = clamp(normalizedDistance, 0, 1);
      const filter = clamp(1 - normalizedDistance * 0.55 - Math.max(0, dy) / HEIGHT * 0.25, 0.25, 1);

      return { pan, gain, reverb, filter };
    }
  }

  async function createPatchFromSequenceFile(file) {
    const buffer = await file.arrayBuffer();
    const sequence = await parseSequenceFile(file.name, buffer);
    return patchFromSequence(sequence, file.name);
  }

  function serializeMidiSpec(spec) {
    if (!spec.url) {
      return spec;
    }

    const { sequenceData, ...serializableSpec } = spec;
    return serializableSpec;
  }

  function patchFromSequence(sequence, fileName) {
    const tracks = sequence.musicalTracks;
    if (tracks.length === 0) {
      throw new Error("No playable tracks or parts were found.");
    }

    const listener = { x: 400, y: 300 };
    const radius = tracks.length <= 3 ? 185 : 230;
    const usedNames = new Set();
    const sources = tracks.map((track, index) => {
      const angle = -Math.PI / 2 + (Math.PI * 2 * index) / tracks.length;
      const name = uniqueSourceName(track.name || `Part ${index + 1}`, usedNames, index);
      return {
        name,
        x: Math.round(listener.x + radius * Math.cos(angle)),
        y: Math.round(listener.y + radius * Math.sin(angle)),
        drawTrace: false
      };
    });
    const trackBindings = tracks.map((track, index) => ({
      track: track.name,
      trackIndex: track.index,
      source: sources[index].name,
      channel: track.primaryChannel || index + 1,
      program: track.primaryProgram || 1,
      isDrums: track.channels.includes(10)
    }));

    return {
      key: `sequence-${Date.now()}`,
      name: sequence.title || cleanFileName(fileName),
      listener,
      sources,
      constraints: sources.length >= 2 ? [{ type: "sum", sources: sources.map((source) => source.name) }] : [],
      target: { type: "midi-file" },
      midiFile: {
        name: fileName,
        preferredMode: "internal",
        sequenceData: sequence,
        trackBindings
      }
    };
  }

  function uniqueSourceName(name, usedNames, index) {
    const base = (name || "").trim() || `Part ${index + 1}`;
    let candidate = base;
    let suffix = 2;

    while (usedNames.has(candidate)) {
      candidate = `${base} ${suffix}`;
      suffix += 1;
    }

    usedNames.add(candidate);
    return candidate;
  }

  function cleanFileName(fileName) {
    return fileName.replace(/\.(mid|midi|musicxml|xml|mxl)$/i, "");
  }

  function bindTracks(midiFile, bindings) {
    return bindings
      .map((binding) => {
        const track = findTrack(midiFile, binding);
        if (!track) {
          return null;
        }

        return {
          track: track.name || binding.track || `Track ${track.index}`,
          trackIndex: track.index,
          source: binding.source || track.name || `Track ${track.index}`,
          channel: binding.channel || track.primaryChannel || 1,
          program: binding.program || track.primaryProgram || 1,
          noteCount: track.noteCount,
          isDrums: binding.isDrums ?? track.channels.includes(10)
        };
      })
      .filter(Boolean);
  }

  async function parseSequenceFile(name, arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    const lowerName = String(name || "").toLowerCase();

    if (startsWith(bytes, [0x4d, 0x54, 0x68, 0x64]) || lowerName.endsWith(".mid") || lowerName.endsWith(".midi")) {
      return parseMidiFile(arrayBuffer);
    }

    if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) || lowerName.endsWith(".mxl")) {
      return parseMusicXmlText(await extractMusicXmlFromMxl(arrayBuffer));
    }

    return parseMusicXmlText(new TextDecoder("utf-8").decode(bytes));
  }

  function startsWith(bytes, signature) {
    return signature.every((byte, index) => bytes[index] === byte);
  }

  async function extractMusicXmlFromMxl(arrayBuffer) {
    const entries = await readZipEntries(arrayBuffer);
    const container = entries.find((entry) => entry.name === "META-INF/container.xml");
    let rootFile = null;

    if (container) {
      const containerText = decodeUtf8(container.data);
      const match = containerText.match(/full-path=["']([^"']+)["']/);
      rootFile = match ? match[1] : null;
    }

    const mainEntry = entries.find((entry) => entry.name === rootFile) ||
      entries.find((entry) => /\.(musicxml|xml)$/i.test(entry.name) && !entry.name.startsWith("META-INF/"));

    if (!mainEntry) {
      throw new Error("No MusicXML score found in MXL archive.");
    }

    return decodeUtf8(mainEntry.data);
  }

  async function readZipEntries(arrayBuffer) {
    const view = new DataView(arrayBuffer);
    const entries = [];
    let offset = 0;

    while (offset + 30 <= view.byteLength) {
      const signature = view.getUint32(offset, true);
      if (signature !== 0x04034b50) {
        break;
      }

      const flags = view.getUint16(offset + 6, true);
      const method = view.getUint16(offset + 8, true);
      const compressedSize = view.getUint32(offset + 18, true);
      const fileNameLength = view.getUint16(offset + 26, true);
      const extraLength = view.getUint16(offset + 28, true);
      const nameStart = offset + 30;
      const dataStart = nameStart + fileNameLength + extraLength;
      const name = decodeUtf8(new Uint8Array(arrayBuffer, nameStart, fileNameLength));

      if (flags & 0x08) {
        throw new Error("MXL entries with data descriptors are not supported yet.");
      }

      const compressed = new Uint8Array(arrayBuffer, dataStart, compressedSize);
      const data = method === 0 ? compressed :
        method === 8 ? new Uint8Array(await inflateRaw(compressed)) :
          null;

      if (data && !name.endsWith("/")) {
        entries.push({ name, data });
      }

      offset = dataStart + compressedSize;
    }

    return entries;
  }

  async function inflateRaw(bytes) {
    if (!global.DecompressionStream) {
      throw new Error("This browser cannot decompress MXL files.");
    }

    try {
      return await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer();
    } catch (error) {
      return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate"))).arrayBuffer();
    }
  }

  function parseMusicXmlText(xmlText) {
    if (!global.DOMParser) {
      throw new Error("MusicXML parsing requires a browser DOMParser.");
    }

    const document = new DOMParser().parseFromString(xmlText, "application/xml");
    const parserError = document.querySelector("parsererror");
    if (parserError) {
      throw new Error("Could not parse MusicXML.");
    }

    const partInfo = parseMusicXmlPartInfo(document);
    const rawTracks = Array.from(document.querySelectorAll("score-partwise > part"))
      .map((part, index) => parseMusicXmlPart(part, partInfo.get(part.getAttribute("id")), index + 1))
      .filter((track) => track.noteCount > 0);
    const tempoEvents = rawTracks
      .flatMap((track) => track.tempos)
      .sort((a, b) => a.tick - b.tick);
    const tempoMap = buildTempoMap(tempoEvents, PPQ);
    const musicalTracks = rawTracks.map((track) => ({
      ...track,
      primaryChannel: mostFrequent(track.channels),
      primaryProgram: track.programs[0]?.program || 1
    }));
    const events = buildPlaybackEvents(rawTracks, tempoMap);
    const durationSeconds = events.reduce((max, event) => Math.max(max, event.seconds + (event.durationSeconds || 0)), 0);

    return {
      format: "musicxml",
      title: textContent(document.querySelector("work-title")) || textContent(document.querySelector("movement-title")),
      trackCount: rawTracks.length,
      ppq: PPQ,
      rawTracks,
      musicalTracks,
      events,
      durationSeconds
    };
  }

  function parseMusicXmlPartInfo(document) {
    const info = new Map();
    const parts = Array.from(document.querySelectorAll("part-list > score-part"));

    for (const scorePart of parts) {
      const id = scorePart.getAttribute("id");
      const instruments = new Map();
      const midiInstruments = Array.from(scorePart.querySelectorAll("midi-instrument"));

      for (const midiInstrument of midiInstruments) {
        instruments.set(midiInstrument.getAttribute("id"), {
          channel: intText(midiInstrument.querySelector("midi-channel"), 1),
          program: intText(midiInstrument.querySelector("midi-program"), 1),
          unpitched: intText(midiInstrument.querySelector("midi-unpitched"), null)
        });
      }

      const firstInstrument = midiInstruments[0];
      info.set(id, {
        id,
        name: textContent(scorePart.querySelector("part-name")) || id,
        channel: intText(firstInstrument?.querySelector("midi-channel"), 1),
        program: intText(firstInstrument?.querySelector("midi-program"), 1),
        instruments
      });
    }

    return info;
  }

  function parseMusicXmlPart(part, info, index) {
    const channel = info?.channel || index;
    const program = info?.program || 1;
    const events = [{ tick: 0, type: "programChange", channel, program, bytes: [0xc0 + channelIndex(channel), clampInt(program - 1, 0, 127)] }];
    const tempos = [];
    const channels = [channel];
    const programs = [{ tick: 0, channel, program }];
    let divisions = 1;
    let quarterPosition = 0;
    let noteCount = 0;

    for (const measure of Array.from(part.querySelectorAll(":scope > measure"))) {
      const divisionsText = textContent(measure.querySelector(":scope > attributes > divisions"));
      if (divisionsText) {
        divisions = Number(divisionsText) || divisions;
      }

      for (const child of Array.from(measure.children)) {
        if (child.localName === "direction") {
          const tempo = Number(child.querySelector("sound")?.getAttribute("tempo"));
          if (Number.isFinite(tempo) && tempo > 0) {
            tempos.push({ tick: Math.round(quarterPosition * PPQ), microsecondsPerQuarter: Math.round(60000000 / tempo) });
          }
        } else if (child.localName === "backup") {
          quarterPosition -= durationQuarters(child, divisions);
        } else if (child.localName === "forward") {
          quarterPosition += durationQuarters(child, divisions);
        } else if (child.localName === "note") {
          const isChord = Boolean(child.querySelector(":scope > chord"));
          const isRest = Boolean(child.querySelector(":scope > rest"));
          const duration = durationQuarters(child, divisions);

          if (!isRest) {
            const note = musicXmlNoteNumber(child, info, channel);
            const velocity = clampInt(Number(child.querySelector(":scope > velocity")?.textContent) || 84, 1, 127);
            const tick = Math.round(quarterPosition * PPQ);
            const durationTicks = Math.max(1, Math.round(duration * PPQ));
            events.push({
              tick,
              type: "noteOn",
              channel: note.channel,
              note: note.number,
              velocity,
              bytes: [0x90 + channelIndex(note.channel), note.number, velocity]
            });
            events.push({
              tick: tick + durationTicks,
              type: "noteOff",
              channel: note.channel,
              note: note.number,
              velocity: 0,
              bytes: [0x80 + channelIndex(note.channel), note.number, 0]
            });
            channels.push(note.channel);
            noteCount += 1;
          }

          if (!isChord) {
            quarterPosition += duration;
          }
        }
      }
    }

    return {
      index,
      name: info?.name || `Part ${index}`,
      events,
      tempos,
      channels: Array.from(new Set(channels)),
      programs,
      noteCount
    };
  }

  function musicXmlNoteNumber(note, info, fallbackChannel) {
    const instrumentId = note.querySelector(":scope > instrument")?.getAttribute("id");
    const instrument = instrumentId ? info?.instruments.get(instrumentId) : null;

    if (instrument?.unpitched) {
      return { number: clampInt(instrument.unpitched, 0, 127), channel: instrument.channel || fallbackChannel };
    }

    const pitch = note.querySelector(":scope > pitch");
    if (pitch) {
      const step = textContent(pitch.querySelector("step"));
      const alter = Number(textContent(pitch.querySelector("alter")) || 0);
      const octave = Number(textContent(pitch.querySelector("octave")) || 4);
      return { number: clampInt((octave + 1) * 12 + stepToSemitone(step) + alter, 0, 127), channel: instrument?.channel || fallbackChannel };
    }

    const unpitched = note.querySelector(":scope > unpitched");
    if (unpitched) {
      const step = textContent(unpitched.querySelector("display-step"));
      const octave = Number(textContent(unpitched.querySelector("display-octave")) || 4);
      return { number: clampInt((octave + 1) * 12 + stepToSemitone(step), 0, 127), channel: instrument?.channel || fallbackChannel };
    }

    return { number: 60, channel: fallbackChannel };
  }

  function durationQuarters(element, divisions) {
    return (Number(textContent(element.querySelector(":scope > duration"))) || 0) / Math.max(1, divisions);
  }

  function stepToSemitone(step) {
    return { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[step] ?? 0;
  }

  function textContent(element) {
    return element?.textContent?.trim() || "";
  }

  function intText(element, fallback) {
    const value = Number(textContent(element));
    return Number.isFinite(value) ? value : fallback;
  }

  function findTrack(midiFile, binding) {
    if (Number.isInteger(binding.trackIndex)) {
      return midiFile.musicalTracks.find((track) => track.index === binding.trackIndex);
    }

    if (binding.track) {
      return midiFile.musicalTracks.find((track) => track.name === binding.track);
    }

    if (binding.channel) {
      return midiFile.musicalTracks.find((track) => track.channels.includes(binding.channel));
    }

    return null;
  }

  function createWebMidiRenderer(output) {
    const lastSpatial = new Map();
    const panicTimers = [];
    let activeChannels = [];

    return {
      start(bindings) {
        clearPanicTimers();
        activeChannels = Array.from(new Set(bindings.map((binding) => channelIndex(binding.channel))));
        for (const binding of bindings) {
          if (binding.program && !binding.isDrums) {
            output.send([0xc0 + channelIndex(binding.channel), clampInt(binding.program - 1, 0, 127)]);
          }
        }
      },
      schedule(event, delaySeconds) {
        if (!event.bytes) {
          return;
        }

        output.send(event.bytes, global.performance.now() + delaySeconds * 1000);
      },
      applySpatial(bindings, immediate) {
        for (const binding of bindings) {
          const channel = channelIndex(binding.channel);
          const values = {
            pan: Math.round((binding.spatial.pan + 1) * 63.5),
            gain: Math.round(binding.spatial.gain * 127),
            reverb: Math.round(binding.spatial.reverb * 127),
            filter: Math.round(binding.spatial.filter * 127)
          };

          sendCcIfChanged(output, lastSpatial, channel, 10, values.pan, immediate);
          sendCcIfChanged(output, lastSpatial, channel, 7, values.gain, immediate);
          sendCcIfChanged(output, lastSpatial, channel, 91, values.reverb, immediate);
          sendCcIfChanged(output, lastSpatial, channel, 74, values.filter, immediate);
        }
      },
      stop() {
        sendMidiPanic(output, activeChannels);
        clearPanicTimers();

        // Web MIDI cannot cancel note-ons already scheduled with future timestamps.
        // Repeat panic after the scheduler lookahead window so those notes are also released.
        for (const delayMs of [80, (SCHEDULE_AHEAD_SECONDS * 1000) + 60, 500]) {
          panicTimers.push(global.setTimeout(() => {
            sendMidiPanic(output, activeChannels);
          }, delayMs));
        }
      }
    };

    function clearPanicTimers() {
      while (panicTimers.length > 0) {
        global.clearTimeout(panicTimers.pop());
      }
    }
  }

  function sendMidiPanic(output, channels) {
    const targetChannels = channels.length > 0 ? channels : Array.from({ length: 16 }, (_, channel) => channel);

    for (const channel of targetChannels) {
      output.send([0xb0 + channel, 64, 0]); // sustain off
      output.send([0xb0 + channel, 120, 0]); // all sound off
      output.send([0xb0 + channel, 123, 0]); // all notes off

      for (let note = 0; note < 128; note += 1) {
        output.send([0x80 + channel, note, 0]);
      }
    }
  }

  function sendCcIfChanged(output, cache, channel, cc, value, immediate) {
    const clamped = clampInt(value, 0, 127);
    const key = `${channel}:${cc}`;
    if (!immediate && cache.get(key) === clamped) {
      return;
    }

    cache.set(key, clamped);
    output.send([0xb0 + channel, cc, clamped]);
  }

  function createBrowserSynthRenderer(context) {
    const master = context.createGain();
    const reverbInput = context.createGain();
    const reverbDelay = context.createDelay(1.2);
    const reverbFeedback = context.createGain();
    const reverbOutput = context.createGain();
    const trackNodes = new Map();
    const activeVoices = new Set();
    const noiseBuffer = createNoiseBuffer(context);

    master.gain.value = 0.82;
    reverbInput.gain.value = 0.75;
    reverbDelay.delayTime.value = 0.115;
    reverbFeedback.gain.value = 0.28;
    reverbOutput.gain.value = 0.45;
    reverbInput.connect(reverbDelay);
    reverbDelay.connect(reverbFeedback);
    reverbFeedback.connect(reverbDelay);
    reverbDelay.connect(reverbOutput);
    reverbOutput.connect(master);
    master.connect(context.destination);

    return {
      start(bindings) {
        context.resume();
        for (const binding of bindings) {
          ensureTrackNode(binding);
        }
      },
      schedule(event, delaySeconds) {
        if (event.type !== "noteOn") {
          return;
        }

        const trackNode = trackNodes.get(event.trackIndex);
        if (!trackNode) {
          return;
        }

        if (trackNode.isDrums) {
          scheduleDrum(event, trackNode, context.currentTime + delaySeconds);
        } else {
          schedulePitchedNote(event, trackNode, context.currentTime + delaySeconds);
        }
      },
      applySpatial(bindings, immediate) {
        const time = context.currentTime;
        const rampTime = immediate ? 0.01 : 0.045;

        for (const binding of bindings) {
          const node = ensureTrackNode(binding);
          node.pan.pan.setTargetAtTime(binding.spatial.pan, time, rampTime);
          node.gain.gain.setTargetAtTime(binding.spatial.gain, time, rampTime);
          node.reverbSend.gain.setTargetAtTime(binding.spatial.reverb * binding.spatial.gain * 0.28, time, rampTime);
          node.filter.frequency.setTargetAtTime(500 + binding.spatial.filter * 6500, time, rampTime);
        }
      },
      stop() {
        for (const voice of activeVoices) {
          try {
            voice.stop();
          } catch (error) {
            // It may already have ended naturally.
          }
        }
        activeVoices.clear();
        context.close();
      }
    };

    function ensureTrackNode(binding) {
      if (trackNodes.has(binding.trackIndex)) {
        return trackNodes.get(binding.trackIndex);
      }

      const filter = context.createBiquadFilter();
      const gain = context.createGain();
      const reverbSend = context.createGain();
      const pan = context.createStereoPanner();

      filter.type = "lowpass";
      filter.frequency.value = 6500;
      gain.gain.value = 0.75;
      reverbSend.gain.value = 0.12;
      filter.connect(gain);
      filter.connect(reverbSend);
      reverbSend.connect(reverbInput);
      gain.connect(pan);
      pan.connect(master);

      const node = {
        filter,
        gain,
        reverbSend,
        pan,
        isDrums: binding.isDrums,
        instrumentType: instrumentTypeForProgram(binding.program),
        waveform: waveformForProgram(binding.program)
      };
      trackNodes.set(binding.trackIndex, node);
      return node;
    }

    function schedulePitchedNote(event, trackNode, startTime) {
      if (trackNode.instrumentType === "bass") {
        scheduleBassNote(event, trackNode, startTime);
        return;
      }

      if (trackNode.instrumentType === "piano") {
        schedulePianoNote(event, trackNode, startTime);
        return;
      }

      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      const duration = clamp(event.durationSeconds || 0.18, 0.035, 4);
      const velocityGain = clamp(event.velocity / 127, 0.1, 1);
      const endTime = startTime + duration;

      oscillator.type = trackNode.waveform;
      oscillator.frequency.value = midiNoteFrequency(event.note);
      envelope.gain.setValueAtTime(0.0001, startTime);
      envelope.gain.linearRampToValueAtTime(0.14 * velocityGain, startTime + 0.012);
      envelope.gain.setTargetAtTime(0.0001, Math.max(startTime + 0.02, endTime - 0.05), 0.045);
      oscillator.connect(envelope);
      envelope.connect(trackNode.filter);
      oscillator.start(startTime);
      oscillator.stop(endTime + 0.08);
      trackVoice(oscillator);
    }

    function scheduleBassNote(event, trackNode, startTime) {
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      const duration = clamp(event.durationSeconds || 0.2, 0.04, 2.8);
      const velocityGain = clamp(event.velocity / 127, 0.12, 1);
      const endTime = startTime + duration;

      oscillator.type = "triangle";
      oscillator.frequency.value = midiNoteFrequency(event.note);
      envelope.gain.setValueAtTime(0.0001, startTime);
      envelope.gain.linearRampToValueAtTime(0.22 * velocityGain, startTime + 0.01);
      envelope.gain.setTargetAtTime(0.0001, startTime + Math.min(0.18, duration * 0.45), 0.16);
      oscillator.connect(envelope);
      envelope.connect(trackNode.filter);
      oscillator.start(startTime);
      oscillator.stop(endTime + 0.05);
      trackVoice(oscillator);
    }

    function schedulePianoNote(event, trackNode, startTime) {
      const root = midiNoteFrequency(event.note);
      const duration = clamp(event.durationSeconds || 0.16, 0.045, 3.2);
      const velocityGain = clamp(event.velocity / 127, 0.12, 1);
      const endTime = startTime + duration;
      const envelope = context.createGain();
      const fundamental = context.createOscillator();
      const overtone = context.createOscillator();
      const overtoneGain = context.createGain();

      fundamental.type = "triangle";
      fundamental.frequency.value = root;
      overtone.type = "sine";
      overtone.frequency.value = root * 2.01;
      overtoneGain.gain.value = 0.24;

      envelope.gain.setValueAtTime(0.0001, startTime);
      envelope.gain.linearRampToValueAtTime(0.16 * velocityGain, startTime + 0.006);
      envelope.gain.exponentialRampToValueAtTime(0.0001, endTime + 0.09);

      fundamental.connect(envelope);
      overtone.connect(overtoneGain);
      overtoneGain.connect(envelope);
      envelope.connect(trackNode.filter);
      fundamental.start(startTime);
      overtone.start(startTime);
      fundamental.stop(endTime + 0.12);
      overtone.stop(endTime + 0.12);
      trackVoice(fundamental);
      trackVoice(overtone);
    }

    function scheduleDrum(event, trackNode, startTime) {
      if (event.note <= 36) {
        scheduleKick(event, trackNode, startTime);
      } else if (event.note === 38 || event.note === 40) {
        scheduleSnare(event, trackNode, startTime);
      } else {
        scheduleHat(event, trackNode, startTime);
      }
    }

    function scheduleKick(event, trackNode, startTime) {
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      const velocityGain = clamp(event.velocity / 127, 0.12, 1);
      const endTime = startTime + 0.16;

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(95, startTime);
      oscillator.frequency.exponentialRampToValueAtTime(42, endTime);
      envelope.gain.setValueAtTime(0.0001, startTime);
      envelope.gain.linearRampToValueAtTime(0.55 * velocityGain, startTime + 0.005);
      envelope.gain.exponentialRampToValueAtTime(0.0001, endTime);
      oscillator.connect(envelope);
      envelope.connect(trackNode.filter);
      oscillator.start(startTime);
      oscillator.stop(endTime + 0.02);
      trackVoice(oscillator);
    }

    function scheduleSnare(event, trackNode, startTime) {
      const source = context.createBufferSource();
      const filter = context.createBiquadFilter();
      const envelope = context.createGain();
      const velocityGain = clamp(event.velocity / 127, 0.12, 1);
      const endTime = startTime + 0.13;

      source.buffer = noiseBuffer;
      filter.type = "bandpass";
      filter.frequency.value = 1800;
      filter.Q.value = 0.8;
      envelope.gain.setValueAtTime(0.0001, startTime);
      envelope.gain.linearRampToValueAtTime(0.22 * velocityGain, startTime + 0.003);
      envelope.gain.exponentialRampToValueAtTime(0.0001, endTime);
      source.connect(filter);
      filter.connect(envelope);
      envelope.connect(trackNode.filter);
      source.start(startTime);
      source.stop(endTime + 0.02);
      trackVoice(source);
    }

    function scheduleHat(event, trackNode, startTime) {
      const source = context.createBufferSource();
      const filter = context.createBiquadFilter();
      const envelope = context.createGain();
      const velocityGain = clamp(event.velocity / 127, 0.12, 1);
      const endTime = startTime + drumDuration(event.note);

      source.buffer = noiseBuffer;
      filter.type = "highpass";
      filter.frequency.value = event.note >= 49 ? 4200 : 6200;
      envelope.gain.setValueAtTime(0.0001, startTime);
      envelope.gain.linearRampToValueAtTime(0.12 * velocityGain, startTime + 0.002);
      envelope.gain.exponentialRampToValueAtTime(0.0001, endTime);
      source.connect(filter);
      filter.connect(envelope);
      envelope.connect(trackNode.filter);
      source.start(startTime);
      source.stop(endTime + 0.02);
      trackVoice(source);
    }

    function trackVoice(voice) {
      activeVoices.add(voice);
      voice.addEventListener("ended", () => activeVoices.delete(voice));
    }
  }

  function parseMidiFile(arrayBuffer) {
    const reader = createReader(arrayBuffer);
    if (reader.readString(4) !== "MThd") {
      throw new Error("Not a MIDI file.");
    }

    const headerLength = reader.readUint32();
    const format = reader.readUint16();
    const trackCount = reader.readUint16();
    const division = reader.readUint16();
    if (headerLength > 6) {
      reader.skip(headerLength - 6);
    }
    if (division & 0x8000) {
      throw new Error("SMPTE MIDI timing is not supported.");
    }

    const rawTracks = [];
    for (let index = 0; index < trackCount; index += 1) {
      if (reader.readString(4) !== "MTrk") {
        throw new Error("Malformed MIDI track.");
      }

      rawTracks.push(parseTrack(reader.readBytes(reader.readUint32()), index));
    }

    const tempoEvents = rawTracks
      .flatMap((track) => track.tempos)
      .sort((a, b) => a.tick - b.tick);
    const tempoMap = buildTempoMap(tempoEvents, division);
    const musicalTracks = rawTracks
      .filter((track) => track.noteCount > 0)
      .map((track) => ({
        ...track,
        primaryChannel: mostFrequent(track.channels),
        primaryProgram: track.programs[0]?.program || 1
      }));
    const events = buildPlaybackEvents(rawTracks, tempoMap);
    const durationSeconds = events.reduce((max, event) => Math.max(max, event.seconds + (event.durationSeconds || 0)), 0);

    return { format, trackCount, ppq: division, rawTracks, musicalTracks, events, durationSeconds };
  }

  function parseTrack(bytes, index) {
    const reader = createReader(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    const events = [];
    const tempos = [];
    const channels = [];
    const programs = [];
    let tick = 0;
    let runningStatus = null;
    let name = "";
    let noteCount = 0;

    while (!reader.eof()) {
      tick += reader.readVarInt();
      let status = reader.peekUint8();

      if (status < 0x80) {
        if (runningStatus === null) {
          throw new Error("MIDI running status without status byte.");
        }
        status = runningStatus;
      } else {
        status = reader.readUint8();
        if (status < 0xf0) {
          runningStatus = status;
        }
      }

      if (status === 0xff) {
        const type = reader.readUint8();
        const length = reader.readVarInt();
        const payload = reader.readBytes(length);
        if (type === 0x03) {
          name = decodeText(payload);
        } else if (type === 0x51 && payload.length === 3) {
          tempos.push({ tick, microsecondsPerQuarter: read24(payload) });
        } else if (type === 0x2f) {
          break;
        }
        continue;
      }

      if (status === 0xf0 || status === 0xf7) {
        reader.skip(reader.readVarInt());
        continue;
      }

      const eventType = status >> 4;
      const channel = (status & 0x0f) + 1;
      channels.push(channel);

      if (eventType === 0x8 || eventType === 0x9 || eventType === 0xa || eventType === 0xb || eventType === 0xe) {
        const data1 = reader.readUint8();
        const data2 = reader.readUint8();
        const bytes = [status, data1, data2];
        const type = eventType === 0x9 && data2 > 0 ? "noteOn" :
          (eventType === 0x8 || eventType === 0x9 ? "noteOff" :
            eventType === 0xb ? "controlChange" : "channel");
        if (type === "noteOn") {
          noteCount += 1;
        }
        events.push({ tick, type, channel, note: data1, velocity: data2, bytes });
      } else if (eventType === 0xc || eventType === 0xd) {
        const data1 = reader.readUint8();
        const bytes = [status, data1];
        if (eventType === 0xc) {
          programs.push({ tick, channel, program: data1 + 1 });
          events.push({ tick, type: "programChange", channel, program: data1 + 1, bytes });
        } else {
          events.push({ tick, type: "channel", channel, bytes });
        }
      }
    }

    return {
      index,
      name: name || `Track ${index}`,
      events,
      tempos,
      channels: Array.from(new Set(channels)),
      programs,
      noteCount
    };
  }

  function buildTempoMap(tempoEvents, ppq) {
    const sorted = tempoEvents.length > 0 ? tempoEvents : [{ tick: 0, microsecondsPerQuarter: DEFAULT_TEMPO }];
    const map = [];
    let lastTick = 0;
    let seconds = 0;
    let tempo = DEFAULT_TEMPO;

    for (const event of sorted) {
      if (event.tick > lastTick) {
        seconds += ticksToSeconds(event.tick - lastTick, tempo, ppq);
      }
      tempo = event.microsecondsPerQuarter;
      lastTick = event.tick;
      map.push({ tick: event.tick, seconds, tempo });
    }

    if (map[0]?.tick !== 0) {
      map.unshift({ tick: 0, seconds: 0, tempo: DEFAULT_TEMPO });
    }

    return { map, ppq };
  }

  function buildPlaybackEvents(rawTracks, tempoMap) {
    const noteStarts = new Map();
    const playbackEvents = [];

    for (const track of rawTracks) {
      for (const event of track.events) {
        const seconds = secondsAtTick(event.tick, tempoMap);
        const base = { ...event, seconds, trackIndex: track.index, trackName: track.name };

        if (event.type === "noteOn") {
          noteStarts.set(noteKey(track.index, event.channel, event.note), base);
          playbackEvents.push(base);
        } else if (event.type === "noteOff") {
          const key = noteKey(track.index, event.channel, event.note);
          const start = noteStarts.get(key);
          if (start) {
            start.durationSeconds = Math.max(0.02, seconds - start.seconds);
            noteStarts.delete(key);
          }
          playbackEvents.push(base);
        } else if (event.type === "programChange" || event.type === "controlChange") {
          playbackEvents.push(base);
        }
      }
    }

    return playbackEvents.sort((a, b) => a.seconds - b.seconds);
  }

  function noteKey(trackIndex, channel, note) {
    return `${trackIndex}:${channel}:${note}`;
  }

  function ticksToSeconds(ticks, tempo, ppq) {
    return ticks * tempo / 1000000 / ppq;
  }

  function secondsAtTick(tick, tempoMap) {
    let segment = tempoMap.map[0];
    for (const candidate of tempoMap.map) {
      if (candidate.tick > tick) {
        break;
      }
      segment = candidate;
    }

    return segment.seconds + ticksToSeconds(tick - segment.tick, segment.tempo, tempoMap.ppq);
  }

  function createReader(arrayBuffer) {
    const view = new DataView(arrayBuffer);
    let offset = 0;

    return {
      eof() {
        return offset >= view.byteLength;
      },
      readUint8() {
        const value = view.getUint8(offset);
        offset += 1;
        return value;
      },
      peekUint8() {
        return view.getUint8(offset);
      },
      readUint16() {
        const value = view.getUint16(offset, false);
        offset += 2;
        return value;
      },
      readUint32() {
        const value = view.getUint32(offset, false);
        offset += 4;
        return value;
      },
      readString(length) {
        return decodeText(this.readBytes(length));
      },
      readBytes(length) {
        const bytes = new Uint8Array(arrayBuffer, offset, length);
        offset += length;
        return bytes;
      },
      readVarInt() {
        let value = 0;
        while (true) {
          const byte = this.readUint8();
          value = (value << 7) | (byte & 0x7f);
          if ((byte & 0x80) === 0) {
            return value;
          }
        }
      },
      skip(length) {
        offset += length;
      }
    };
  }

  function decodeText(bytes) {
    return Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  }

  function decodeUtf8(bytes) {
    return new TextDecoder("utf-8").decode(bytes);
  }

  function read24(bytes) {
    return (bytes[0] << 16) | (bytes[1] << 8) | bytes[2];
  }

  function mostFrequent(values) {
    const counts = new Map();
    for (const value of values) {
      counts.set(value, (counts.get(value) || 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 1;
  }

  function waveformForProgram(program) {
    if (program >= 33 && program <= 40) {
      return "triangle";
    }
    if (program >= 1 && program <= 8) {
      return "sine";
    }
    return "sawtooth";
  }

  function instrumentTypeForProgram(program) {
    if (program >= 33 && program <= 40) {
      return "bass";
    }
    if (program >= 1 && program <= 8) {
      return "piano";
    }
    return "generic";
  }

  function createNoiseBuffer(context) {
    const length = Math.floor(context.sampleRate * 0.5);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);

    for (let index = 0; index < length; index += 1) {
      data[index] = Math.random() * 2 - 1;
    }

    return buffer;
  }

  function midiNoteFrequency(note) {
    return 440 * (2 ** ((note - 69) / 12));
  }

  function drumFrequency(note) {
    if (note <= 36) {
      return 55;
    }
    if (note <= 45) {
      return 110;
    }
    if (note <= 51) {
      return 220;
    }
    return 440;
  }

  function drumDuration(note) {
    return note <= 40 ? 0.16 : 0.055;
  }

  function channelIndex(channel) {
    return clampInt((channel || 1) - 1, 0, 15);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function clampInt(value, min, max) {
    return Math.round(clamp(value, min, max));
  }

  function nowSeconds() {
    return global.performance.now() / 1000;
  }

  global.MusicSpaceMidiFileClient = {
    createPatchFromSequenceFile,
    createMidiFileClient,
    parseMidiFile,
    parseSequenceFile
  };
})(window);

import { OrbitUI, computeConfigHashSync } from "./vendor/orbit/dist/index.js";
import { OrbitMusicSpace } from "./adapter.mjs";
import { FaustAudio } from "./audio.mjs";

const $ = (id) => document.getElementById(id);
const message = (text) => {
  $("message").textContent = text;
};
const colors = { Dry: "#86bacd", Wet: "#a6e4cb", Cutoff: "#eeb398", Resonance: "#c2afe2" };
const response = await fetch("./audio/orbit-study.json");
if (!response.ok) throw new Error("Faust metadata could not be loaded.");
const metadata = await response.json();
const widgets = [];
const walk = (items) => items.forEach((item) => (item.items ? walk(item.items) : widgets.push(item)));
walk(metadata.ui);
const paths = Object.fromEntries(widgets.map((item) => [item.label, item.address]));
const ordered = ["Dry", "Wet", "Cutoff", "Resonance"].map((name) =>
  widgets.find((item) => item.label === name)
);
let controller;
let library = [];
let gestureBefore = null;
let physicsPaused = false;
let applying = false;
let frameId;
const undo = [];
const redo = [];

const audio = new FaustAudio(metadata, (state) => {
  const playing = state === "running";
  $("audio").innerHTML = playing
    ? '<span aria-hidden="true">Ⅱ</span> Pause sound'
    : '<span aria-hidden="true">▶</span> Start sound';
  $("audio-status").textContent = playing
    ? "Faust · WebAssembly · live"
    : state === "error"
      ? "Audio processor stopped"
      : "Sound paused · keep exploring";
  if (state === "error") message("The audio processor stopped. Reload the page to restart the instrument.");
});

const orbit = new OrbitUI($("orbit"), {
  uiDescriptor: metadata.ui,
  onParamChange: (path, value) => {
    audio.setValues({ [path]: value });
    updateReadouts();
  },
  resolveState: (state, path) => (controller ? controller.resolve(state, path, !!gestureBefore) : state),
  onParamsApplied: (state) => {
    if (controller && !applying) {
      controller.reseed(state);
      updateButtons();
    }
  },
  drawRelations: (ctx, state) => drawRelations(ctx, state),
  onInteractionStart: () => beginGesture(),
  onInteractionEnd: () => endGesture(),
  onLibraryChange: (records) => {
    library = records;
  },
  tooltips: {
    centerButton: "Reset the visual layout",
    randomButton: "Explore random parameters",
    hintSlider: "Drag to change; linked controls follow",
    hintCenter: "Move the shared center",
    hintOuter: "Change the outer radius"
  }
});

// Use built-in glyphs so the shareable folder never needs a font CDN.
const glyphs = {
  label: "◇",
  casino: "⚄",
  zoom_in: "+",
  bubble_chart: "◉",
  delete: "×",
  my_location: "⊙",
  moving: "↝",
  cycle: "↻",
  arrow_drop_down: "⌄",
  play_arrow: "▶",
  stop: "■"
};
const decorate = () => {
  for (const el of $("orbit").shadowRoot.querySelectorAll(".material-symbols-outlined")) {
    const icon = glyphs[el.textContent.trim()];
    if (icon) el.textContent = icon;
  }
};
const iconObserver = new MutationObserver(decorate);
iconObserver.observe($("orbit").shadowRoot, { childList: true, subtree: true });
const fontStyle = document.createElement("style");
fontStyle.textContent =
  ".material-symbols-outlined{font-family:system-ui,sans-serif!important}.orbit-canvas{touch-action:none}";
$("orbit").shadowRoot.append(fontStyle);
decorate();

let initialState = orbit.getOrbitState();
// Give the four controls recognizable quadrants, with enough space for labels.
const angles = { Dry: -2.55, Wet: -0.59, Cutoff: 2.55, Resonance: 0.59 };
for (const item of ordered) {
  const control = initialState.controls[item.address];
  control.color = colors[item.label];
  const u = (item.init - item.min) / (item.max - item.min);
  const r = initialState.outerRadius - u * (initialState.outerRadius - initialState.innerRadius);
  control.x = initialState.center.x + Math.cos(angles[item.label]) * r;
  control.y = initialState.center.y + Math.sin(angles[item.label]) * r;
}
orbit.setOrbitState(initialState);
orbit.setParams(Object.fromEntries(ordered.map((item) => [item.address, item.init])));
controller = new OrbitMusicSpace(orbit.getOrbitState(), paths);

for (const item of ordered) {
  const card = document.createElement("div");
  card.className = "readout";
  card.innerHTML = `<label for="param-${item.label}"><i style="background:${colors[item.label]}"></i>${item.label}</label><output id="value-${item.label}"></output><small>${item.label === "Cutoff" ? "Hz" : item.label === "Dry" || item.label === "Wet" ? "%" : "Q"}</small><input id="param-${item.label}" type="range" min="${item.min}" max="${item.max}" step="${item.step}" value="${item.init}" aria-label="${item.label}">`;
  $("readouts").append(card);
  const input = $(`param-${item.label}`);
  input.addEventListener("pointerdown", beginGesture);
  input.addEventListener("input", () => {
    if (!gestureBefore) beginGesture();
    const state = orbit.getOrbitState();
    const point = state.controls[item.address];
    const angle = Math.atan2(point.y - state.center.y, point.x - state.center.x);
    const u = (Number(input.value) - item.min) / (item.max - item.min);
    const radius = state.outerRadius - u * (state.outerRadius - state.innerRadius);
    point.x = state.center.x + Math.cos(angle) * radius;
    point.y = state.center.y + Math.sin(angle) * radius;
    orbit.applyResolvedState(controller.resolve(state, item.address));
  });
  input.addEventListener("change", endGesture);
  input.addEventListener("pointerup", endGesture);
  input.addEventListener("pointercancel", endGesture);
}

const configurations = {
  Warm: { Dry: 0.55, Wet: 0.45, Cutoff: 1800, Resonance: 1.5 },
  Open: { Dry: 0.15, Wet: 0.85, Cutoff: 4600, Resonance: 0.8 },
  Hollow: { Dry: 0.12, Wet: 0.88, Cutoff: 650, Resonance: 4.2 }
};
const paramsFor = (config) =>
  Object.fromEntries(Object.entries(config).map(([name, value]) => [paths[name], value]));
library = Object.entries(configurations).map(([name, config], index) => {
  const configuration = paramsFor(config);
  return {
    uiHash: orbit.uiHash,
    configHash: computeConfigHashSync(configuration),
    name,
    lastSeenAt: Date.now() + index,
    configuration
  };
});
orbit.setLibrary(library);
audio.setValues(orbit.getParamValues());
updateReadouts();
const initial = snapshot();

function snapshot() {
  return {
    format: "orbit-musicspace-poc",
    version: 1,
    uiHash: orbit.uiHash,
    orbit: orbit.getOrbitState(),
    params: orbit.getParamValues(),
    engine: controller.snapshot(),
    library: structuredClone(library)
  };
}

function remember(before) {
  undo.push(before);
  if (undo.length > 50) undo.shift();
  redo.length = 0;
  updateButtons();
}

function beginGesture() {
  if (!controller || gestureBefore) return;
  gestureBefore = snapshot();
  if (controller.sweeping) controller.sweep(false);
  physicsPaused = false;
  updateButtons();
}

function endGesture() {
  if (!controller) return;
  controller.release();
  if (!gestureBefore) return;
  if (
    JSON.stringify(gestureBefore.params) !== JSON.stringify(orbit.getParamValues()) ||
    JSON.stringify(gestureBefore.orbit) !== JSON.stringify(orbit.getOrbitState())
  )
    remember(gestureBefore);
  gestureBefore = null;
}

function restore(record) {
  if (record?.format !== "orbit-musicspace-poc" || record.version !== 1 || record.uiHash !== orbit.uiHash) {
    throw new Error("Choose a session saved by this Orbit × MusicSpace demo.");
  }
  if (
    !record.engine ||
    typeof record.engine.settings?.balance !== "boolean" ||
    typeof record.engine.settings?.spring !== "boolean"
  )
    throw new Error("Invalid relationship settings.");
  const state = orbit.getOrbitState();
  for (const key of ["innerRadius", "outerRadius"]) {
    if (!Number.isFinite(record.orbit?.[key]) || record.orbit[key] <= 0)
      throw new Error("Invalid orbit geometry.");
    state[key] = record.orbit[key];
  }
  if (state.innerRadius >= state.outerRadius) throw new Error("Invalid orbit radii.");
  for (const axis of ["x", "y"]) {
    if (!Number.isFinite(record.orbit.center?.[axis])) throw new Error("Invalid center.");
    state.center[axis] = record.orbit.center[axis];
  }
  const values = {};
  for (const item of ordered) {
    const saved = record.orbit.controls?.[item.address];
    if (!saved || !Number.isFinite(saved.x) || !Number.isFinite(saved.y))
      throw new Error("Invalid control positions.");
    state.controls[item.address].x = saved.x;
    state.controls[item.address].y = saved.y;
    const value = record.params?.[item.address];
    if (!Number.isFinite(value) || value < item.min || value > item.max)
      throw new Error("Invalid parameter values.");
    values[item.address] = value;
  }
  if (!Array.isArray(record.library)) throw new Error("Invalid preset library.");
  // Validate an independent engine before changing anything visible or audible.
  const candidate = new OrbitMusicSpace(state, paths);
  candidate.restore(record.engine, state);
  applying = true;
  try {
    orbit.setOrbitState(state);
    orbit.setParams(values);
    controller = candidate;
    library = structuredClone(record.library);
    orbit.setLibrary(library);
    audio.setValues(values);
  } finally {
    applying = false;
  }
  gestureBefore = null;
  physicsPaused = true; // Restored sounds stay still until the next gesture or sweep.
  controller.space.resetClock();
  updateReadouts();
  updateButtons();
}

function action(callback) {
  endGesture();
  const before = snapshot();
  callback();
  remember(before);
  updateReadouts();
  updateButtons();
}

function updateReadouts() {
  if (!controller) return;
  const values = orbit.getParamValues();
  for (const item of ordered) {
    const output = $(`value-${item.label}`);
    if (!output) continue;
    const value = values[item.address] ?? item.init;
    output.textContent =
      item.label === "Dry" || item.label === "Wet"
        ? (value * 100).toFixed(1)
        : item.label === "Cutoff"
          ? Math.round(value).toLocaleString("en-US")
          : value.toFixed(2);
    $(`param-${item.label}`).value = String(value);
  }
  const sum = (values[paths.Dry] ?? 0) + (values[paths.Wet] ?? 0);
  $("constraint-status").textContent = controller.settings.balance
    ? `Dry + Wet = ${sum.toFixed(3)}`
    : "Independent controls";
  for (const button of $("presets").children) {
    const expected = paramsFor(configurations[button.dataset.preset]);
    button.classList.toggle(
      "selected",
      Object.keys(expected).every((key) => Math.abs(expected[key] - values[key]) < 0.0001)
    );
  }
}

function updateButtons() {
  if (!controller) return;
  $("balance").setAttribute("aria-checked", String(controller.settings.balance));
  $("spring").setAttribute("aria-checked", String(controller.settings.spring));
  $("sweep").setAttribute("aria-pressed", String(controller.sweeping && !physicsPaused));
  $("sweep").textContent = controller.sweeping && !physicsPaused ? "Ⅱ   Pause sweep" : "↔   Start sweep";
  $("motion-status").textContent = physicsPaused
    ? "Motion paused"
    : controller.sweeping
      ? "Cutoff in motion"
      : controller.settings.spring
        ? "Spring active"
        : "Ready to play";
  $("undo").disabled = undo.length === 0;
  $("redo").disabled = redo.length === 0;
}

function drawRelations(ctx, state) {
  if (!controller) return;
  const link = (a, b, color, spring = false) => {
    const p = state.controls[paths[a]],
      q = state.controls[paths[b]];
    if (!p || !q) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    if (spring) {
      const dx = q.x - p.x,
        dy = q.y - p.y,
        length = Math.hypot(dx, dy) || 1;
      for (let i = 0; i <= 64; i++) {
        const t = i / 64,
          wave = Math.sin(t * Math.PI * 16) * 5 * Math.sin(t * Math.PI);
        const x = p.x + dx * t - (dy / length) * wave;
        const y = p.y + dy * t + (dx / length) * wave;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    } else {
      ctx.setLineDash([4, 5]);
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(q.x, q.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  };
  if (controller.settings.balance) link("Dry", "Wet", colors.Wet);
  if (controller.settings.spring) link("Cutoff", "Resonance", colors.Cutoff, true);
}

$("balance").onclick = () =>
  action(() => {
    physicsPaused = false;
    orbit.applyResolvedState(
      controller.configure({ balance: !controller.settings.balance }, orbit.getOrbitState())
    );
    message(
      controller.settings.balance
        ? "Balance linked. Drag Dry or Wet; the other makes room."
        : "Balance released. Dry and Wet now move independently."
    );
  });
$("spring").onclick = () =>
  action(() => {
    physicsPaused = false;
    orbit.applyResolvedState(
      controller.configure({ spring: !controller.settings.spring }, orbit.getOrbitState())
    );
    message(
      controller.settings.spring
        ? "Spring connected. Pull the peach Cutoff dot, then let go."
        : "Spring released. Cutoff and Resonance now move independently."
    );
  });
$("sweep").onclick = () =>
  action(() => {
    const enabled = !controller.sweeping || physicsPaused;
    controller.sweep(enabled);
    physicsPaused = !enabled;
    message(
      enabled
        ? "Cutoff is sweeping. Enable the spring to hear Resonance respond."
        : "Motion paused. Drag a dot to take over."
    );
  });
$("undo").onclick = () => {
  endGesture();
  if (!undo.length) return;
  const current = snapshot(),
    previous = undo.pop();
  restore(previous);
  redo.push(current);
  updateButtons();
  message("Undid the whole gesture. Motion is paused so you can hear the restored sound.");
};
$("redo").onclick = () => {
  if (!redo.length) return;
  const current = snapshot(),
    next = redo.pop();
  restore(next);
  undo.push(current);
  updateButtons();
  message("Redid the gesture. Drag a control or start the sweep to resume motion.");
};
$("reset").onclick = () =>
  action(() => {
    restore(initial);
    physicsPaused = false;
    message("Back to Warm. Try dragging the green Wet dot.");
  });
for (const button of $("presets").children)
  button.onclick = () =>
    action(() => {
      const values = paramsFor(configurations[button.dataset.preset]);
      orbit.setParams(values);
      audio.setValues(values);
      physicsPaused = false;
      message(`${button.dataset.preset} recalled. Spring rest length now matches this arrangement.`);
    });
$("audio").disabled = false;
$("audio-status").textContent = "A quiet pulsed chord · click to listen";
$("audio").onclick = async () => {
  $("audio").disabled = true;
  try {
    await audio.toggle();
  } catch (error) {
    $("audio-status").textContent = "Audio could not start";
    message(error.message);
  } finally {
    $("audio").disabled = false;
  }
};
$("save").onclick = () => {
  endGesture();
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(snapshot(), null, 2)], { type: "application/json" })
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "orbit-musicspace-session.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  message("Saved controls, relationships, motion and the preset library.");
};
$("load").onclick = () => $("file").click();
$("file").onchange = async () => {
  const file = $("file").files[0];
  if (!file) return;
  try {
    if (file.size > 2_000_000) throw new Error("Choose a session smaller than 2 MB.");
    const record = JSON.parse(await file.text());
    const before = snapshot();
    restore(record);
    remember(before);
    message("Session restored. Motion is paused; drag a dot or start the sweep to continue.");
  } catch (error) {
    message(`Could not load session: ${error.message}`);
  }
  $("file").value = "";
};
document.addEventListener("keydown", (event) => {
  if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z") return;
  if (event.composedPath().some((el) => el instanceof HTMLInputElement && el.type === "text")) return;
  event.preventDefault();
  if ($("orbit").classList.contains("orbit-ui-overlay-active")) {
    if (event.shiftKey) orbit.redoLibrary();
    else orbit.undoLibrary();
  } else $(event.shiftKey ? "redo" : "undo").click();
});
document.addEventListener("visibilitychange", () => controller.space.resetClock());
const waveform = $("waveform").getContext("2d");
const samples = new Float32Array(256);
function frame(timestamp) {
  const overlay = $("orbit").classList.contains("orbit-ui-overlay-active");
  orbit.setPromotionSuspended(
    audio.context?.state !== "running" || controller.sweeping || controller.settings.spring
  );
  if (!physicsPaused && !overlay && !document.hidden) {
    const state = controller.advance(timestamp);
    if (state) orbit.applyResolvedState(state);
  } else controller.space.resetClock();
  waveform.clearRect(0, 0, 180, 26);
  if (audio.context?.state === "running" && audio.analyser) audio.analyser.getFloatTimeDomainData(samples);
  else samples.fill(0);
  waveform.strokeStyle = "#a6e4cb";
  waveform.lineWidth = 1;
  waveform.beginPath();
  for (let i = 0; i < samples.length; i++) {
    const x = (i / (samples.length - 1)) * 180,
      y = 13 + samples[i] * 80;
    if (!i) waveform.moveTo(x, y);
    else waveform.lineTo(x, y);
  }
  waveform.stroke();
  frameId = requestAnimationFrame(frame);
}
frameId = requestAnimationFrame(frame);
window.addEventListener(
  "pagehide",
  () => {
    cancelAnimationFrame(frameId);
    iconObserver.disconnect();
    orbit.destroy();
    void audio.destroy();
  },
  { once: true }
);
// Read-only diagnostics used by the integration tests and useful during review.
window.orbitStudy = {
  snapshot,
  get diagnostics() {
    return controller.space.diagnostics();
  },
  get audioState() {
    return audio.context?.state ?? "idle";
  },
  get audioRms() {
    if (!audio.analyser) return 0;
    const buffer = new Float32Array(audio.analyser.fftSize);
    audio.analyser.getFloatTimeDomainData(buffer);
    return Math.sqrt(buffer.reduce((sum, value) => sum + value * value, 0) / buffer.length);
  }
};
updateButtons();

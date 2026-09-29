import { OrbitUI } from "./vendor/orbit/dist/index.js";
import { FaustAudio } from "./audio.mjs";
import { Constellation, names, palette, relations } from "./constellation-model.mjs";
import { drawConstraints } from "./constraint-drawing.mjs";

const $ = (id) => document.getElementById(id);
const response = await fetch("./audio/constellation.json");
if (!response.ok) throw new Error("Could not load the Constellation instrument.");
const metadata = await response.json();
const widgets = [];
const walk = (items) => items.forEach((item) => (item.items ? walk(item.items) : widgets.push(item)));
walk(metadata.ui);
const paths = Object.fromEntries(widgets.map((item) => [item.label, item.address]));
const ordered = names.map((name) => widgets.find((item) => item.label === name));
const percentages = new Set(["Bass", "Body", "Air", "Dry", "Wet", "Depth"]);
let model,
  gesture,
  activePath = null,
  selected = null,
  running = false,
  applying = false;
let drawn = [],
  frameId;
const undo = [],
  redo = [];
const message = (text) => {
  $("message").textContent = text;
};
const audio = new FaustAudio(
  metadata,
  (state) => {
    $("audio").textContent = state === "running" ? "Ⅱ Pause sound" : "▶ Start sound";
    $("audio-status").textContent =
      state === "running"
        ? "Faust · WebAssembly · live"
        : state === "error"
          ? "Audio processor stopped"
          : "Sound paused";
  },
  new URL("./audio/constellation.wasm", import.meta.url)
);

const orbit = new OrbitUI($("orbit"), {
  uiDescriptor: metadata.ui,
  onParamChange: (path, value) => {
    audio.setValues({ [path]: value });
    updateValues();
  },
  resolveState: (state, path) => {
    if (!model) return state;
    if (path) activePath = path;
    return model.resolve(state, path, !!gesture);
  },
  onParamsApplied: (state) => {
    if (model && !applying) {
      model.reseed(state);
      updateInspector();
    }
  },
  drawRelations: (ctx, state) => {
    if (!model) return;
    drawn = drawConstraints(ctx, state, model.snapshot(), {
      visibility: $("visibility").value,
      selected,
      activePath,
      guides: $("guides").checked,
      residuals: geometricIssues()
    });
  },
  onInteractionStart: beginGesture,
  onInteractionEnd: endGesture,
  tooltips: {
    hintSlider: "Drag: visible constraints propagate the movement",
    hintCenter: "Move center and recapture geometric targets",
    hintOuter: "Resize the parameter range"
  }
});
orbit.setPromotionSuspended(true);
const icons = {
  label: "◇",
  casino: "⚄",
  zoom_in: "+",
  bubble_chart: "◉",
  delete: "×",
  my_location: "⊙",
  moving: "↝",
  cycle: "↻",
  play_arrow: "▶",
  stop: "■"
};
const decorate = () => {
  for (const el of $("orbit").shadowRoot.querySelectorAll(".material-symbols-outlined"))
    if (icons[el.textContent.trim()]) el.textContent = icons[el.textContent.trim()];
};
const observer = new MutationObserver(decorate);
observer.observe($("orbit").shadowRoot, { childList: true, subtree: true });
const style = document.createElement("style");
style.textContent =
  ".material-symbols-outlined{font-family:system-ui,sans-serif!important}.orbit-canvas{touch-action:none}";
$("orbit").shadowRoot.append(style);
decorate();

const state = orbit.getOrbitState();
state.outerRadius = Math.min(orbit.body.clientWidth, orbit.body.clientHeight) * 0.42;
state.innerRadius = state.outerRadius * 0.16;
const angles = [-2.3, -1.57, -0.85, -3.0, -0.14, 2.55, 1.97, 0.95, 0.42, 1.35];
for (const [index, item] of ordered.entries()) {
  const control = state.controls[item.address];
  control.color = palette[index];
  const radius =
    state.outerRadius -
    ((item.init - item.min) / (item.max - item.min)) * (state.outerRadius - state.innerRadius);
  control.x = state.center.x + Math.cos(angles[index]) * radius;
  control.y = state.center.y + Math.sin(angles[index]) * radius;
}
orbit.setOrbitState(state);
orbit.setParams(Object.fromEntries(ordered.map((item) => [item.address, item.init])));
model = new Constellation(orbit.getOrbitState(), paths);

for (const relation of relations) {
  const row = document.createElement("div");
  row.className = "relation-row";
  row.id = `row-${relation.id}`;
  row.style.setProperty("--relation-color", relation.color);
  row.innerHTML = `<button class="relation-select" id="select-${relation.id}" aria-pressed="false" aria-label="Highlight ${relation.title}"><span class="rule-number">${relation.number}</span><span><span class="rule-title">${relation.title}</span><span class="rule-detail">${relation.detail}</span></span></button><button class="switch" id="toggle-${relation.id}" role="switch" aria-checked="true" aria-label="Enable ${relation.title}"></button>`;
  $("relations").append(row);
  $(`select-${relation.id}`).onclick = () => {
    selected = selected === relation.id ? null : relation.id;
    message(
      selected
        ? `${relation.number} · ${relation.title}. ${relation.detail}.`
        : "Showing the whole constellation."
    );
    redraw();
  };
  $(`toggle-${relation.id}`).onclick = () => {
    endGesture();
    remember(snapshot());
    orbit.applyResolvedState(model.toggle(relation.id));
    message(
      `${relation.title} ${model.disabled.has(relation.id) ? "released" : "enabled"}. Its original target is retained.`
    );
    updateInspector();
  };
}

for (const [index, item] of ordered.entries()) {
  const card = document.createElement("div");
  card.className = "readout";
  card.innerHTML = `<label for="param-${item.label}"><i style="background:${palette[index]}"></i>${item.label}</label><output id="value-${item.label}"></output><small>${percentages.has(item.label) ? "%" : item.label === "Cutoff" || item.label === "Rate" ? "Hz" : ""}</small><input id="param-${item.label}" type="range" min="${item.min}" max="${item.max}" step="${item.step}" aria-label="${item.label}">`;
  $("readouts").append(card);
  const input = $(`param-${item.label}`);
  input.addEventListener("pointerdown", beginGesture);
  input.addEventListener("input", () => {
    if (!gesture) beginGesture();
    activePath = item.address;
    const next = orbit.getOrbitState(),
      p = next.controls[item.address];
    const angle = Math.atan2(p.y - next.center.y, p.x - next.center.x);
    const radius =
      next.outerRadius -
      ((Number(input.value) - item.min) / (item.max - item.min)) * (next.outerRadius - next.innerRadius);
    p.x = next.center.x + Math.cos(angle) * radius;
    p.y = next.center.y + Math.sin(angle) * radius;
    orbit.applyResolvedState(model.resolve(next, item.address));
    updateInspector();
  });
  for (const event of ["change", "pointerup", "pointercancel"]) input.addEventListener(event, endGesture);
}

function snapshot() {
  return {
    format: "orbit-constellation",
    version: 1,
    uiHash: orbit.uiHash,
    orbit: orbit.getOrbitState(),
    params: orbit.getParamValues(),
    scene: model.snapshot()
  };
}
function remember(before) {
  undo.push(before);
  if (undo.length > 50) undo.shift();
  redo.length = 0;
  updateInspector();
}
function beginGesture() {
  if (model && !gesture) gesture = snapshot();
}
function endGesture() {
  if (!model) return;
  model.release();
  if (gesture && JSON.stringify(gesture.orbit) !== JSON.stringify(orbit.getOrbitState())) remember(gesture);
  gesture = null;
  updateInspector();
}
function restore(record) {
  model.restore(record.scene, record.orbit);
  applying = true;
  try {
    orbit.setOrbitState(record.orbit);
    orbit.setParams(record.params);
    audio.setValues(record.params);
  } finally {
    applying = false;
  }
  running = false;
  gesture = null;
  updateValues();
  updateInspector();
  redraw();
}
function geometricIssues() {
  return model.space.diagnostics().residuals.filter((r) => !["air-spring", "pan-spring"].includes(r.id));
}
function updateValues() {
  if (!model) return;
  const values = orbit.getParamValues();
  for (const item of ordered) {
    const output = $(`value-${item.label}`);
    if (!output) continue;
    const value = values[item.address] ?? item.init;
    output.textContent = percentages.has(item.label)
      ? (value * 100).toFixed(0)
      : item.label === "Cutoff"
        ? Math.round(value).toLocaleString("en-US")
        : value.toFixed(2);
    $(`param-${item.label}`).value = String(value);
  }
}
function updateInspector() {
  if (!model) return;
  const issues = geometricIssues(),
    ids = new Set(issues.map((r) => r.id));
  for (const relation of relations) {
    const row = $(`row-${relation.id}`);
    if (!row) continue;
    row.classList.toggle("selected", selected === relation.id);
    row.classList.toggle("disabled", model.disabled.has(relation.id));
    row.classList.toggle("warning", ids.has(relation.id));
    $(`select-${relation.id}`).setAttribute("aria-pressed", String(selected === relation.id));
    $(`toggle-${relation.id}`).setAttribute("aria-checked", String(!model.disabled.has(relation.id)));
  }
  const active = model.snapshot().constraints.filter((c) => c.enabled !== false);
  $("counts").textContent =
    `${active.length} active constraints · ${new Set(active.map((c) => c.type)).size} types`;
  $("solver-status").textContent = issues.length
    ? `${issues.length} geometric ${issues.length === 1 ? "relation" : "relations"} outside tolerance`
    : "All geometric constraints satisfied";
  $("solver-status").classList.toggle("solver-warning", issues.length > 0);
  $("motion-status").textContent = running ? "Spring dynamics running" : "Dynamics paused";
  $("dynamics").textContent = running ? "Ⅱ Pause dynamics" : "▶ Animate springs";
  $("dynamics").setAttribute("aria-pressed", String(running));
  $("undo").disabled = undo.length === 0;
  $("redo").disabled = redo.length === 0;
}
function redraw() {
  orbit.applyResolvedState(model.toOrbit(orbit.getOrbitState()));
  updateInspector();
}

const initial = snapshot();
audio.setValues(orbit.getParamValues());
updateValues();
updateInspector();
$("visibility").onchange = redraw;
$("guides").onchange = redraw;
$("clear-selection").onclick = () => {
  selected = null;
  activePath = null;
  redraw();
};
$("dynamics").onclick = () => {
  endGesture();
  remember(snapshot());
  running = !running;
  model.space.resetClock();
  updateInspector();
  message(
    running
      ? "Springs are moving. Pull Air or Depth and watch the network respond."
      : "Dynamics paused. You can still drag and explore geometric relationships."
  );
};
$("undo").onclick = () => {
  endGesture();
  if (!undo.length) return;
  const current = snapshot();
  restore(undo.pop());
  redo.push(current);
  updateInspector();
  message("Restored the complete gesture and constraint settings. Dynamics paused.");
};
$("redo").onclick = () => {
  if (!redo.length) return;
  const current = snapshot();
  restore(redo.pop());
  undo.push(current);
  updateInspector();
};
$("reset").onclick = () => {
  endGesture();
  remember(snapshot());
  restore(initial);
  selected = null;
  activePath = null;
  redraw();
  message("Constellation reset. All nineteen constraints are active.");
};
$("save").onclick = () => {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(snapshot(), null, 2)], { type: "application/json" })
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "orbit-constellation.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  message("Saved the geometry, Faust parameters, invariant targets and enabled states.");
};
$("audio").disabled = false;
$("audio-status").textContent = "Three voices · click to listen";
$("audio").onclick = async () => {
  $("audio").disabled = true;
  try {
    await audio.toggle();
  } catch (error) {
    message(error.message);
  } finally {
    $("audio").disabled = false;
  }
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
document.addEventListener("visibilitychange", () => model.space.resetClock());
let lastStatus = 0;
function frame(timestamp) {
  if (running && !document.hidden && !$("orbit").classList.contains("orbit-ui-overlay-active")) {
    model.space.advance(timestamp);
    orbit.applyResolvedState(model.toOrbit());
  } else model.space.resetClock();
  if (timestamp - lastStatus > 100) {
    updateInspector();
    lastStatus = timestamp;
  }
  frameId = requestAnimationFrame(frame);
}
frameId = requestAnimationFrame(frame);
window.addEventListener(
  "pagehide",
  () => {
    cancelAnimationFrame(frameId);
    observer.disconnect();
    orbit.destroy();
    void audio.destroy();
  },
  { once: true }
);
window.orbitStudy = {
  snapshot,
  get drawnConstraints() {
    return [...drawn];
  },
  get diagnostics() {
    return model.space.diagnostics();
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
redraw();

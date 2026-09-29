import { OrbitUI } from "./vendor/orbit/dist/index.js";
import { FaustAudio } from "./audio.mjs";
import { names, palette } from "./constellation-model.mjs";
import { LivingSprings, motors } from "./living-springs-model.mjs";

const $ = (id) => document.getElementById(id);
const response = await fetch("./audio/constellation.json");
if (!response.ok) throw new Error("Could not load the Faust instrument.");
const metadata = await response.json(),
  widgets = [];
const walk = (items) => items.forEach((item) => (item.items ? walk(item.items) : widgets.push(item)));
walk(metadata.ui);
const paths = Object.fromEntries(widgets.map((item) => [item.label, item.address]));
const ordered = names.map((name) => widgets.find((item) => item.label === name));
const percent = new Set(["Bass", "Body", "Air", "Dry", "Wet", "Depth"]);
const feels = {
  Float: { speed: 0.55, stiffness: 14, damping: 2.5 },
  Wiggle: { speed: 1, stiffness: 28, damping: 1.2 },
  Flutter: { speed: 1.65, stiffness: 48, damping: 0.6 }
};
let model,
  gesture,
  frameId,
  applying = false,
  running = true,
  activePath = null;
const trails = new Map(),
  undo = [],
  redo = [];
let drawnSprings = 0,
  lastTrail = 0;
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
    updateControls();
  },
  new URL("./audio/constellation.wasm", import.meta.url)
);

const orbit = new OrbitUI($("orbit"), {
  uiDescriptor: metadata.ui,
  onParamChange: (path, value) => {
    audio.setValues({ [path]: value });
    updateReadouts();
  },
  resolveState: (state, path) => {
    if (!model) return state;
    activePath = path;
    return model.resolve(state, path, !!gesture);
  },
  onParamsApplied: (state) => {
    if (model && !applying) {
      model.reseed(state);
      trails.clear();
    }
  },
  drawRelations: (ctx, state) => drawNetwork(ctx, state),
  onInteractionStart: beginGesture,
  onInteractionEnd: endGesture,
  tooltips: {
    hintSlider: "Pull and release to excite the spring network",
    hintCenter: "Move the shared center",
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
const font = document.createElement("style");
font.textContent =
  ".material-symbols-outlined{font-family:system-ui,sans-serif!important}.orbit-canvas{touch-action:none}";
$("orbit").shadowRoot.append(font);
decorate();

const state = orbit.getOrbitState();
state.outerRadius = Math.min(orbit.body.clientWidth, orbit.body.clientHeight) * 0.43;
state.innerRadius = state.outerRadius * 0.15;
const angles = [-2.3, -1.57, -0.85, -3.0, -0.14, 2.55, 1.97, 0.95, 0.42, 1.35];
for (const [i, item] of ordered.entries()) {
  const p = state.controls[item.address];
  p.color = palette[i];
  const r =
    state.outerRadius -
    ((item.init - item.min) / (item.max - item.min)) * (state.outerRadius - state.innerRadius);
  p.x = state.center.x + Math.cos(angles[i]) * r;
  p.y = state.center.y + Math.sin(angles[i]) * r;
}
orbit.setOrbitState(state);
orbit.setParams(Object.fromEntries(ordered.map((item) => [item.address, item.init])));
model = new LivingSprings(orbit.getOrbitState(), paths);

for (const [i, item] of ordered.entries()) {
  const card = document.createElement("div");
  card.className = "readout";
  card.innerHTML = `<label for="param-${item.label}"><i style="background:${palette[i]}"></i>${item.label}</label><output id="value-${item.label}"></output><small>${percent.has(item.label) ? "%" : item.label === "Cutoff" || item.label === "Rate" ? "Hz" : ""}</small><input id="param-${item.label}" type="range" min="${item.min}" max="${item.max}" step="${item.step}" aria-label="${item.label}">`;
  $("readouts").append(card);
  const input = $(`param-${item.label}`);
  input.addEventListener("pointerdown", beginGesture);
  input.addEventListener("input", () => {
    if (!gesture) beginGesture();
    activePath = item.address;
    const next = orbit.getOrbitState(),
      p = next.controls[item.address];
    const a = Math.atan2(p.y - next.center.y, p.x - next.center.x);
    const r =
      next.outerRadius -
      ((Number(input.value) - item.min) / (item.max - item.min)) * (next.outerRadius - next.innerRadius);
    p.x = next.center.x + Math.cos(a) * r;
    p.y = next.center.y + Math.sin(a) * r;
    orbit.applyResolvedState(model.resolve(next, item.address));
  });
  for (const event of ["change", "pointerup", "pointercancel"]) input.addEventListener(event, endGesture);
}

function snapshot() {
  return {
    format: "orbit-living-springs",
    version: 1,
    orbit: orbit.getOrbitState(),
    params: orbit.getParamValues(),
    engine: model.snapshot()
  };
}
function beginGesture() {
  if (model && !gesture) gesture = snapshot();
}
function remember(before) {
  undo.push(before);
  if (undo.length > 50) undo.shift();
  redo.length = 0;
  updateControls();
}
function endGesture() {
  if (!model) return;
  model.release();
  if (gesture) remember(gesture);
  gesture = null;
  activePath = null;
  updateControls();
}
function restore(saved) {
  model.restore(saved.engine, saved.orbit);
  applying = true;
  try {
    orbit.setOrbitState(saved.orbit);
    orbit.setParams(saved.params);
    audio.setValues(saved.params);
  } finally {
    applying = false;
  }
  running = false;
  gesture = null;
  trails.clear();
  updateReadouts();
  updateControls();
  redraw();
}
function action(callback) {
  endGesture();
  remember(snapshot());
  callback();
  updateControls();
  redraw();
}
function redraw() {
  orbit.applyResolvedState(model.toOrbit(orbit.getOrbitState()));
}

function updateReadouts() {
  if (!model) return;
  const values = orbit.getParamValues();
  for (const item of ordered) {
    const output = $(`value-${item.label}`);
    if (!output) continue;
    const value = values[item.address] ?? item.init;
    output.textContent = percent.has(item.label)
      ? (value * 100).toFixed(0)
      : item.label === "Cutoff"
        ? Math.round(value).toLocaleString("en-US")
        : value.toFixed(2);
    $(`param-${item.label}`).value = String(value);
  }
}
function updateControls() {
  if (!model) return;
  $("freeze").textContent = running ? "Ⅱ Freeze motion" : "▶ Resume motion";
  $("freeze").setAttribute("aria-pressed", String(!running));
  $("motors").setAttribute("aria-checked", String(model.settings.powered));
  $("orbit-period").textContent = `◇ Orbit · ${(7.3 / model.settings.speed).toFixed(1)} s`;
  $("shuttle-period").textContent = `◇ Shuttle · ${(2 / (0.0031 * 60 * model.settings.speed)).toFixed(1)} s`;
  $("motion-status").textContent =
    `${running ? "Moving" : "Frozen"} · ${audio.context?.state === "running" ? "sound on" : "sound off"}`;
  $("network-status").textContent = !running
    ? "Simulation frozen"
    : model.settings.powered
      ? "Motors feeding the network"
      : "Motors off · springs settling";
  for (const key of ["speed", "stiffness", "damping"]) {
    $(key).value = String(model.settings[key]);
    $(`${key}-value`).textContent =
      key === "speed"
        ? `${model.settings[key].toFixed(2)}×`
        : key === "damping"
          ? model.settings[key].toFixed(1)
          : String(model.settings[key]);
  }
  for (const button of document.querySelectorAll("[data-feel]"))
    button.classList.toggle(
      "selected",
      Object.entries(feels[button.dataset.feel]).every(
        ([key, value]) => Math.abs(model.settings[key] - value) < 0.0001
      )
    );
  $("undo").disabled = !undo.length;
  $("redo").disabled = !redo.length;
}

function drawNetwork(ctx, orbitState) {
  if (!model) return;
  if ($("trails").checked) {
    for (const [path, points] of trails) {
      ctx.strokeStyle = orbitState.controls[path].color;
      ctx.lineWidth = 1.5;
      for (let i = 1; i < points.length; i++) {
        ctx.globalAlpha = (0.28 * i) / points.length;
        ctx.beginPath();
        ctx.moveTo(points[i - 1].x, points[i - 1].y);
        ctx.lineTo(points[i].x, points[i].y);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }
  const scene = model.space.snapshot(),
    points = new Map(scene.points.map((p) => [p.id, p]));
  drawnSprings = 0;
  if ($("connections").checked)
    for (const spring of scene.constraints.filter((c) => c.type === "spring")) {
      const a = points.get(spring.anchor),
        b = points.get(spring.target),
        dx = b.x - a.x,
        dy = b.y - a.y,
        length = Math.hypot(dx, dy) || 1;
      const strain = (length - spring.restLength) / Math.max(1, spring.restLength);
      const motorLink = motors.includes(spring.anchor);
      ctx.strokeStyle = motorLink ? "#edcf91" : strain > 0.03 ? "#e8b5aa" : "#a1ceca";
      ctx.globalAlpha =
        activePath && spring.anchor !== activePath && spring.target !== activePath
          ? 0.22
          : motorLink
            ? 0.85
            : 0.65;
      ctx.lineWidth = motorLink ? 1.7 : 1.25;
      const coils = Math.max(4, Math.min(14, Math.round(length / 14)));
      ctx.beginPath();
      for (let i = 0; i <= 80; i++) {
        const t = i / 80,
          wave = Math.sin(t * Math.PI * 2 * coils) * Math.min(4.5, length / 15) * Math.sin(t * Math.PI);
        const x = a.x + dx * t - (dy / length) * wave,
          y = a.y + dy * t + (dx / length) * wave;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      drawnSprings++;
    }
  ctx.globalAlpha = 0.28;
  ctx.strokeStyle = "#edcf91";
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 6]);
  ctx.beginPath();
  ctx.arc(model.orbitPath.centerX, model.orbitPath.centerY, model.orbitPath.radius, 0, Math.PI * 2);
  ctx.stroke();
  const { start, end } = model.shuttlePath;
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  for (const [i, id] of motors.entries()) {
    const p = points.get(id);
    ctx.fillStyle = "#e7cb8d";
    ctx.strokeStyle = "#fff0c6";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - 7);
    ctx.lineTo(p.x + 7, p.y);
    ctx.lineTo(p.x, p.y + 7);
    ctx.lineTo(p.x - 7, p.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ecd9af";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(i === 0 ? "Orbit motor" : "Shuttle motor", p.x + 12, p.y - 10);
  }
}

const initial = snapshot();
for (const key of ["speed", "stiffness", "damping"]) {
  $(key).addEventListener("pointerdown", beginGesture);
  $(key).addEventListener("input", () => {
    if (!gesture) beginGesture();
    model.configure({ [key]: Number($(key).value) });
    updateControls();
  });
  for (const event of ["change", "pointerup", "pointercancel"]) $(key).addEventListener(event, endGesture);
}
for (const button of document.querySelectorAll("[data-feel]"))
  button.onclick = () =>
    action(() => {
      model.configure({ ...feels[button.dataset.feel], powered: true });
      running = true;
      message(`${button.dataset.feel}: a new balance of speed, spring tension and damping.`);
    });
$("motors").onclick = () =>
  action(() => {
    model.configure({ powered: !model.settings.powered });
    message(
      model.settings.powered
        ? "Motors on. Energy keeps flowing into the springs."
        : "Motors off. The anchors stay put and the web can settle."
    );
  });
$("freeze").onclick = () => {
  endGesture();
  running = !running;
  model.space.resetClock();
  updateControls();
  message(
    running
      ? "Motion resumed. Grab a dot and give it a pluck."
      : "Everything frozen. Sound holds its current configuration."
  );
};
$("connections").onchange = redraw;
$("trails").onchange = () => {
  trails.clear();
  redraw();
};
$("undo").onclick = () => {
  endGesture();
  if (!undo.length) return;
  const current = snapshot();
  restore(undo.pop());
  redo.push(current);
  updateControls();
  message("Gesture restored. Resume motion when you are ready.");
};
$("redo").onclick = () => {
  if (!redo.length) return;
  const current = snapshot();
  restore(redo.pop());
  undo.push(current);
  updateControls();
};
$("reset").onclick = () =>
  action(() => {
    restore(initial);
    running = true;
    message("Fresh springs, both motors running. Start sound to listen.");
  });
$("audio").disabled = false;
$("audio-status").textContent = "Real Faust synth · click to listen";
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
function frame(timestamp) {
  if (running && !document.hidden && !$("orbit").classList.contains("orbit-ui-overlay-active")) {
    orbit.applyResolvedState(model.advance(timestamp));
    if ($("trails").checked && timestamp - lastTrail > 40) {
      for (const p of model.space.positions())
        if (Object.values(paths).includes(p.id)) {
          const trace = trails.get(p.id) ?? [];
          trace.push({ x: p.x, y: p.y });
          if (trace.length > 80) trace.shift();
          trails.set(p.id, trace);
        }
      lastTrail = timestamp;
    }
  } else model.space.resetClock();
  frameId = requestAnimationFrame(frame);
}
audio.setValues(orbit.getParamValues());
updateReadouts();
updateControls();
redraw();
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
  get drawnSprings() {
    return drawnSprings;
  },
  get running() {
    return running;
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

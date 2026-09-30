const WIDTH = 800;

const HEIGHT = 600;

const traceCanvas = document.getElementById("trace");

const traceCtx = traceCanvas.getContext("2d");

const canvas = document.getElementById("canvas");

const ctx = canvas.getContext("2d");

const stage = document.getElementById("stage");

const uiModePlayButton = document.getElementById("ui-mode-play");

const uiModeEditButton = document.getElementById("ui-mode-edit");

const animationToggle = document.getElementById("animation-toggle");

const undoStatus = document.getElementById("undo-status");

const traceSelectedButton = document.getElementById("trace-selected");

const traceNoneButton = document.getElementById("trace-none");

const patchSelect = document.getElementById("patch-select");

const savePatchButton = document.getElementById("save-patch");

const loadPatchButton = document.getElementById("load-patch");

const patchFileInput = document.getElementById("patch-file");

const clearTraceButton = document.getElementById("clear-trace");

const resetButton = document.getElementById("reset");

const fullscreenToggleButton = document.getElementById("fullscreen-toggle");
const canvasFullscreenButton = document.getElementById("canvas-fullscreen");
const mobileToolsButton = document.getElementById("mobile-tools-toggle");

const saveTraceButton = document.getElementById("save-trace");

const patchInfo = document.getElementById("patch-info");

const transportToolbarGroup = document.getElementById("transport-toolbar-group");

const targetToggleButton = document.getElementById("target-toggle");

const targetPanel = document.getElementById("target-panel");

const targetGrid = document.getElementById("target-grid");

const midiLoadSequenceButton = document.getElementById("midi-load-sequence");

const midiSequenceFileInput = document.getElementById("midi-sequence-file");

const midiToolbarGroup = document.getElementById("midi-toolbar-group");

const midiModeSelect = document.getElementById("midi-mode");

const midiOutputSelect = document.getElementById("midi-output");

const midiPanel = document.getElementById("midi-panel");

const midiTrackList = document.getElementById("midi-track-list");

const midiStatus = document.getElementById("midi-status");

const selectionSummary = document.getElementById("selection-summary");

const patchSummary = document.getElementById("patch-summary");

const patchValidation = document.getElementById("patch-validation");

const patchInspector = document.getElementById("patch-inspector");

const patchInspectorToggle = document.getElementById("patch-inspector-toggle");

const patchInspectorInlineToggle = document.getElementById("patch-inspector-inline-toggle");

const patchInspectorClose = document.getElementById("patch-inspector-close");

const patchMappingEditor = document.getElementById("patch-mapping-editor");

const patchMappingList = document.getElementById("patch-mapping-list");

const patchMappingAddButton = document.getElementById("patch-mapping-add");

const patchMappingApplyButton = document.getElementById("patch-mapping-apply");

const patchJsonToggle = document.getElementById("patch-json-toggle");

const patchJsonInlineToggle = document.getElementById("patch-json-inline-toggle");

const patchJsonEditor = document.getElementById("patch-json-editor");

const patchJsonTextarea = document.getElementById("patch-json");

const patchJsonApplyButton = document.getElementById("patch-json-apply");

const patchValidateButton = document.getElementById("patch-validate");

const constraintStatus = document.getElementById("constraint-status");

const solverModePropagationButton = document.getElementById("solver-mode-propagation");

const solverModeXpbdButton = document.getElementById("solver-mode-xpbd");

const listenerModeRetargetButton = document.getElementById("listener-mode-retarget");

const listenerModePreserveButton = document.getElementById("listener-mode-preserve");

const toolButtons = Array.from(document.querySelectorAll("[data-tool]"));

const rotationEditor = document.getElementById("rotation-editor");

const rotationRunningInput = document.getElementById("rotation-running");

const rotationDisplacementInput = document.getElementById("rotation-displacement");

const rotationPeriodInput = document.getElementById("rotation-period");

const rotationDirectionInput = document.getElementById("rotation-direction");

const rotationPrevButton = document.getElementById("rotation-prev");

const rotationNextButton = document.getElementById("rotation-next");

const rotationApplyButton = document.getElementById("rotation-apply");

const rotationCloseButton = document.getElementById("rotation-close");

const shuttleEditor = document.getElementById("shuttle-editor");

const shuttleStartRefInput = document.getElementById("shuttle-start-ref");

const shuttleEndRefInput = document.getElementById("shuttle-end-ref");

const shuttleStartXInput = document.getElementById("shuttle-start-x");

const shuttleStartYInput = document.getElementById("shuttle-start-y");

const shuttleEndXInput = document.getElementById("shuttle-end-x");

const shuttleEndYInput = document.getElementById("shuttle-end-y");

const shuttleSpeedInput = document.getElementById("shuttle-speed");

const shuttleShowPathInput = document.getElementById("shuttle-show-path");

const shuttlePrevButton = document.getElementById("shuttle-prev");

const shuttleNextButton = document.getElementById("shuttle-next");

const shuttleApplyButton = document.getElementById("shuttle-apply");

const shuttleCloseButton = document.getElementById("shuttle-close");

const constraintEditor = document.getElementById("constraint-editor");

const constraintEditorSummary = document.getElementById("constraint-editor-summary");

const constraintNodeManualInput = document.getElementById("constraint-node-manual");

const constraintNodeXRow = document.getElementById("constraint-node-x-row");

const constraintNodeXInput = document.getElementById("constraint-node-x");

const constraintNodeYRow = document.getElementById("constraint-node-y-row");

const constraintNodeYInput = document.getElementById("constraint-node-y");

const constraintValueARow = document.getElementById("constraint-value-a-row");

const constraintValueALabel = document.getElementById("constraint-value-a-label");

const constraintValueAInput = document.getElementById("constraint-value-a");

const constraintValueBRow = document.getElementById("constraint-value-b-row");

const constraintValueBLabel = document.getElementById("constraint-value-b-label");

const constraintValueBInput = document.getElementById("constraint-value-b");

const constraintPrevButton = document.getElementById("constraint-prev");

const constraintNextButton = document.getElementById("constraint-next");

const constraintRecaptureButton = document.getElementById("constraint-recapture");

const constraintValueCRow = document.getElementById("constraint-value-c-row");
const constraintValueCLabel = document.getElementById("constraint-value-c-label");
const constraintValueCInput = document.getElementById("constraint-value-c");
const sourceMassRow = document.getElementById("source-mass-row");
const sourceMassInput = document.getElementById("source-mass");
const constraintApplyButton = document.getElementById("constraint-apply");

const constraintCloseButton = document.getElementById("constraint-close");

const sourceEditor = document.getElementById("source-editor");

const sourceNameInput = document.getElementById("source-name");

const sourceOutputTypeInput = document.getElementById("source-output-type");

const sourceAudioFileInput = document.getElementById("source-audio-file");

const sourceAudioFileRow = document.getElementById("source-audio-file-row");

const sourceSpatializationRow = document.getElementById("source-spatialization-row");

const sourceSpatializationInput = document.getElementById("source-spatialization");

const sourceGainRow = document.getElementById("source-gain-row");

const sourceGainInput = document.getElementById("source-gain");

const sourceLoopRow = document.getElementById("source-loop-row");

const sourceLoopInput = document.getElementById("source-loop");

const sourceGeneratorPitchRow = document.getElementById("source-generator-pitch-row");

const sourceGeneratorPitchInput = document.getElementById("source-generator-pitch");

const sourceGeneratorPeriodRow = document.getElementById("source-generator-period-row");

const sourceGeneratorPeriodInput = document.getElementById("source-generator-period");

const sourceGeneratorDurationRow = document.getElementById("source-generator-duration-row");

const sourceGeneratorDurationInput = document.getElementById("source-generator-duration");

const sourceGeneratorVelocityRow = document.getElementById("source-generator-velocity-row");

const sourceGeneratorVelocityInput = document.getElementById("source-generator-velocity");

const sourceGeneratorWaveformRow = document.getElementById("source-generator-waveform-row");

const sourceGeneratorWaveformInput = document.getElementById("source-generator-waveform");

const sourceGeneratorOutputModeRow = document.getElementById("source-generator-output-mode-row");

const sourceGeneratorOutputModeInput = document.getElementById("source-generator-output-mode");

const sourceGeneratorOutputRow = document.getElementById("source-generator-output-row");

const sourceGeneratorOutputInput = document.getElementById("source-generator-output");

const sourceGeneratorChannelRow = document.getElementById("source-generator-channel-row");

const sourceGeneratorChannelInput = document.getElementById("source-generator-channel");

const sourceMidiTrackRow = document.getElementById("source-midi-track-row");

const sourceMidiTrackInput = document.getElementById("source-midi-track");

const sourceMidiChannelRow = document.getElementById("source-midi-channel-row");

const sourceMidiChannelInput = document.getElementById("source-midi-channel");

const sourceMidiProgramRow = document.getElementById("source-midi-program-row");

const sourceMidiProgramInput = document.getElementById("source-midi-program");

const sourceMidiDrumsRow = document.getElementById("source-midi-drums-row");

const sourceMidiDrumsInput = document.getElementById("source-midi-drums");

const sourceMutedRow = document.getElementById("source-muted-row");

const sourceGeneratorMappingsPanel = document.getElementById("source-generator-mappings");

const sourceGeneratorMappingList = document.getElementById("source-generator-mapping-list");

const sourceGeneratorMappingAddButton = document.getElementById("source-generator-mapping-add");

const sourceMutedInput = document.getElementById("source-muted");

const sourceAudioFileName = document.getElementById("source-audio-file-name");

const sourcePrevButton = document.getElementById("source-prev");

const sourceNextButton = document.getElementById("source-next");

const sourceApplyButton = document.getElementById("source-apply");

const sourceToggleMuteButton = document.getElementById("source-toggle-mute");

const sourceRemoveBindingButton = document.getElementById("source-remove-binding");

const sourceCloseButton = document.getElementById("source-close");

const listenerEditor = document.getElementById("listener-editor");

const listenerXInput = document.getElementById("listener-x");

const listenerYInput = document.getElementById("listener-y");

const listenerDrawTraceInput = document.getElementById("listener-draw-trace");

const listenerPrevButton = document.getElementById("listener-prev");

const listenerNextButton = document.getElementById("listener-next");

const listenerApplyButton = document.getElementById("listener-apply");

const listenerCloseButton = document.getElementById("listener-close");

const LISTENER_MODE_RETARGET = "retarget";

const LISTENER_MODE_PRESERVE = "preserve";

const MIN_DISTANCE = 2;

const SOLVER_MODE_PROPAGATION = "propagation";

const SOLVER_MODE_XPBD = "xpbd";

const DEFAULT_SOLVER_MODE = SOLVER_MODE_PROPAGATION;

const UI_MODE_PLAY = "play";

const UI_MODE_EDIT = "edit";

const TOOL_SELECT = "select";

const SOURCE_BINDING_AUDIO_FILE = "audio-file";

const SOURCE_OUTPUT_MIDI_FILE = "midi-file";

const SOURCE_OUTPUT_MIDI_OSTINATO = "midi-ostinato";

const SOURCE_OUTPUT_ADDITIVE_SYNTH = "additive-synth";

const SOURCE_GENERATOR_MAPPING_FEATURES = ["x", "y", "distance", "angle"];

const SOURCE_GENERATOR_MAPPING_PARAMETERS = [
  "pitch",
  "periodMs",
  "durationMs",
  "velocity",
  "channel",
  "frequencyHz",
  "gain"
];

const SOURCE_GENERATOR_MAPPING_CURVES = ["linear", "exp"];

const SOURCE_GENERATOR_FEATURE_SPECS = {
  x: { min: 0, max: WIDTH, step: 1, defaultMin: 0, defaultMax: WIDTH },
  y: { min: 0, max: HEIGHT, step: 1, defaultMin: 0, defaultMax: HEIGHT },
  distance: { min: 0, max: WIDTH, step: 1, defaultMin: 0, defaultMax: 400 },
  angle: { min: -Math.PI, max: Math.PI, step: 0.01, defaultMin: -Math.PI, defaultMax: Math.PI }
};

const SOURCE_GENERATOR_PARAMETER_SPECS = {
  pitch: { min: 0, max: 127, step: 1, defaultMin: 48, defaultMax: 72 },
  periodMs: { min: 40, max: 60000, step: 10, defaultMin: 360, defaultMax: 1300 },
  durationMs: { min: 10, max: 10000, step: 10, defaultMin: 70, defaultMax: 260 },
  velocity: { min: 1, max: 127, step: 1, defaultMin: 40, defaultMax: 112 },
  channel: { min: 1, max: 16, step: 1, defaultMin: 1, defaultMax: 16 },
  frequencyHz: { min: 20, max: 16000, step: 1, defaultMin: 110, defaultMax: 880 },
  gain: { min: 0, max: 1, step: 0.01, defaultMin: 0.06, defaultMax: 0.35 }
};

const DOUBLE_CLICK_MS = 450;

const DOUBLE_CLICK_DISTANCE = 12;

const PATCH_INDEX_URL = "patches/index.json";

let builtInPatches = [];

let isCanvasFullscreen = false;

// Keep patch coordinates unchanged while extending the visible world in fullscreen.
// Rendering and pointer input share this transform so the extra area is interactive.
function canvasViewport() {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, rect.width || WIDTH);
  const height = Math.max(1, rect.height || HEIGHT);
  const scale = Math.min(width / WIDTH, height / HEIGHT);
  const scaleX = isCanvasFullscreen ? scale : width / WIDTH;
  const scaleY = isCanvasFullscreen ? scale : height / HEIGHT;
  const offsetX = (width - WIDTH * scaleX) / 2;
  const offsetY = (height - HEIGHT * scaleY) / 2;
  return {
    rect,
    width,
    height,
    scaleX,
    scaleY,
    offsetX,
    offsetY,
    left: -offsetX / scaleX,
    top: -offsetY / scaleY,
    right: (width - offsetX) / scaleX,
    bottom: (height - offsetY) / scaleY
  };
}

function clearCanvasSurface(context, surface) {
  context.save();
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, surface.width, surface.height);
  context.restore();
}

function configureCanvasResolution() {
  const rect = canvas.getBoundingClientRect();
  const cssWidth = Math.max(1, rect.width || WIDTH);
  const cssHeight = Math.max(1, rect.height || HEIGHT);
  const pixelRatio = Math.max(1, Math.min(4, globalThis.devicePixelRatio || 1));
  const backingWidth = Math.max(1, Math.round(cssWidth * pixelRatio));
  const backingHeight = Math.max(1, Math.round(cssHeight * pixelRatio));
  const didResize = canvas.width !== backingWidth || canvas.height !== backingHeight;

  if (didResize) {
    canvas.width = backingWidth;
    canvas.height = backingHeight;
    traceCanvas.width = backingWidth;
    traceCanvas.height = backingHeight;
  }

  const view = canvasViewport();
  const pixelX = backingWidth / cssWidth;
  const pixelY = backingHeight / cssHeight;
  for (const context of [ctx, traceCtx]) {
    context.setTransform(
      view.scaleX * pixelX,
      0,
      0,
      view.scaleY * pixelY,
      view.offsetX * pixelX,
      view.offsetY * pixelY
    );
  }
  return didResize;
}

function setCanvasFullscreen(enabled) {
  isCanvasFullscreen = Boolean(enabled);
  stage.classList.toggle("is-fullscreen", isCanvasFullscreen);
  document.body?.classList?.toggle("is-canvas-fullscreen", isCanvasFullscreen);
  fullscreenToggleButton.setAttribute("aria-pressed", String(isCanvasFullscreen));
  fullscreenToggleButton.textContent = isCanvasFullscreen ? "Exit Fullscreen" : "Fullscreen";
  canvasFullscreenButton.textContent = isCanvasFullscreen ? "Close" : "Expand";
  canvasFullscreenButton.setAttribute(
    "aria-label",
    isCanvasFullscreen ? "Exit fullscreen canvas" : "Expand canvas"
  );
  canvasFullscreenButton.setAttribute("aria-pressed", String(isCanvasFullscreen));
  fullscreenToggleButton.title = isCanvasFullscreen
    ? "Exit fullscreen canvas mode"
    : "Use the full screen for the canvas";

  requestAnimationFrame(() => {
    configureCanvasResolution();
    drawAll();
    if (isCanvasFullscreen) {
      focusCanvasWithoutScrolling();
    }
  });
}

async function enterCanvasFullscreen() {
  setCanvasFullscreen(true);
  try {
    await stage.requestFullscreen?.();
  } catch (error) {
    // CSS fullscreen mode remains available when the browser API is denied.
  }
}

async function exitCanvasFullscreen() {
  const fullscreenElement = document.fullscreenElement;
  if (fullscreenElement === stage && document.exitFullscreen) {
    try {
      await document.exitFullscreen();
    } catch (error) {
      // Fall back to the local state update below.
    }
  }
  setCanvasFullscreen(false);
}

function toggleCanvasFullscreen() {
  if (isCanvasFullscreen) {
    exitCanvasFullscreen();
  } else {
    enterCanvasFullscreen();
  }
}

function handleDocumentFullscreenChange() {
  if (document.fullscreenElement === stage) {
    setCanvasFullscreen(true);
  } else if (isCanvasFullscreen) {
    setCanvasFullscreen(false);
  }
}

function colorWithAlpha(color, alpha) {
  const match = /^#([0-9a-f]{6})$/i.exec(color || "");
  if (!match) {
    return color;
  }
  const value = Number.parseInt(match[1], 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

function radialGradient(ctx, x, y, radius, innerColor, outerColor) {
  if (typeof ctx.createRadialGradient !== "function") {
    return outerColor;
  }
  const gradient = ctx.createRadialGradient(
    x - radius * 0.34,
    y - radius * 0.4,
    Math.max(1, radius * 0.08),
    x,
    y,
    radius
  );
  gradient.addColorStop(0, innerColor);
  gradient.addColorStop(1, outerColor);
  return gradient;
}

function roundedRectPath(ctx, x, y, width, height, radius) {
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, width, height, radius);
    return;
  }
  ctx.rect(x, y, width, height);
}

function polygonPath(ctx, x, y, radius, sides, rotation = 0) {
  for (let i = 0; i < sides; i += 1) {
    const angle = rotation + (Math.PI * 2 * i) / sides;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }
  ctx.closePath();
}

function sourceSignalColor(emitterCapability = {}) {
  if (emitterCapability.audio && emitterCapability.midi) {
    return "#a855f7";
  }
  if (emitterCapability.midi) {
    return "#7c3aed";
  }
  if (emitterCapability.audio) {
    return "#f97316";
  }
  return "#e11d48";
}

function drawSourceBody(ctx, source, emitterCapability) {
  const emits = Boolean(emitterCapability?.emits);
  const radius = sourceVisualRadius(source, emitterCapability);
  const signalColor = sourceSignalColor(emitterCapability);

  if (emitterCapability?.partial) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(source.x, source.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = radialGradient(ctx, source.x, source.y, radius, "#fff7ed", "#ef4444");
    ctx.fill();
    ctx.strokeStyle = colorWithAlpha("#f97316", 0.9);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
    return;
  }

  ctx.save();
  ctx.shadowColor = colorWithAlpha(signalColor, emits ? 0.36 : 0.18);
  ctx.shadowBlur = emits ? 14 : 8;

  ctx.beginPath();
  ctx.arc(source.x, source.y, radius + 5, 0, Math.PI * 2);
  ctx.fillStyle = colorWithAlpha(signalColor, emits ? 0.11 : 0.065);
  ctx.fill();
  ctx.strokeStyle = colorWithAlpha(signalColor, emits ? 0.58 : 0.32);
  ctx.lineWidth = emits ? 2 : 1.25;
  if (!emits) {
    ctx.setLineDash([2, 3]);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.shadowBlur = 0;

  ctx.beginPath();
  ctx.arc(source.x, source.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = emits
    ? radialGradient(ctx, source.x, source.y, radius, "#ffffff", signalColor)
    : radialGradient(ctx, source.x, source.y, radius, "#ffffff", "#ffe4e6");
  ctx.fill();
  ctx.strokeStyle = emits ? colorWithAlpha(signalColor, 0.92) : "#e11d48";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(source.x - radius * 0.27, source.y - radius * 0.3, Math.max(1.6, radius * 0.15), 0, Math.PI * 2);
  ctx.fillStyle = emits ? "rgba(255, 255, 255, 0.78)" : "rgba(225, 29, 72, 0.42)";
  ctx.fill();

  const orbitAngle = -Math.PI / 4;
  ctx.beginPath();
  ctx.arc(
    source.x + Math.cos(orbitAngle) * (radius + 5),
    source.y + Math.sin(orbitAngle) * (radius + 5),
    emits ? 2.4 : 1.9,
    0,
    Math.PI * 2
  );
  ctx.fillStyle = signalColor;
  ctx.fill();
  ctx.restore();
}

function drawSourceExternalLabel(ctx, source, emitterCapability = { emits: false }) {
  const paddingX = 5;
  const labelHeight = 16;
  const labelWidth = clamp(source.name.length * 7 + paddingX * 2, 30, 116);
  const view = canvasViewport();
  const labelX = clamp(source.x - labelWidth / 2, view.left + 4, view.right - labelWidth - 4);
  const belowY = source.y + source.radius + 6;
  const labelY =
    belowY + labelHeight <= view.bottom - 4 ? belowY : source.y - source.radius - labelHeight - 6;

  ctx.save();
  ctx.beginPath();
  roundedRectPath(ctx, labelX, labelY, labelWidth, labelHeight, 6);
  ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
  ctx.fill();
  ctx.strokeStyle = emitterCapability.emits ? "rgba(31, 41, 51, 0.16)" : "rgba(225, 29, 72, 0.22)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = emitterCapability.emits ? "#1f2933" : "#52616f";
  ctx.font = "700 11px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(source.name, labelX + labelWidth / 2, labelY + labelHeight / 2, labelWidth - paddingX * 2);
  ctx.restore();
}

function drawSourceEmitterBadge(ctx, source, emitterCapability) {
  if (!emitterCapability?.emits) {
    return;
  }
  if (emitterCapability.partial) {
    return;
  }

  const badgeCount = Number(Boolean(emitterCapability.audio)) + Number(Boolean(emitterCapability.midi));
  const badgeRadius = 7.5;
  const badgeWidth = badgeCount * 13 + 3;
  const badgeHeight = badgeRadius * 2;
  const view = canvasViewport();
  const badgeX = clamp(source.x + source.radius - 3, view.left + 4, view.right - badgeWidth - 4);
  const badgeY = clamp(source.y - source.radius - 8, view.top + 4, view.bottom - badgeHeight - 4);

  ctx.save();
  ctx.shadowColor = "rgba(23, 33, 31, 0.18)";
  ctx.shadowBlur = 5;
  let centerX = badgeX + badgeRadius;
  if (emitterCapability.audio) {
    drawEmitterChip(ctx, centerX, badgeY + badgeRadius, "#f97316");
    drawAudioEmitterIcon(ctx, centerX - 5, badgeY + badgeRadius);
    centerX += 13;
  }
  if (emitterCapability.midi) {
    drawEmitterChip(ctx, centerX, badgeY + badgeRadius, "#7c3aed");
    drawMidiEmitterIcon(ctx, centerX - 5, badgeY + 1.5);
  }
  ctx.restore();
}

function drawEmitterChip(ctx, x, y, color) {
  ctx.beginPath();
  ctx.arc(x, y, 7.5, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255, 255, 255, 0.96)";
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.35;
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function sourceVisualRadius(source, emitterCapability = sourceEmitterCapability(source)) {
  if (!emitterCapability?.partial) {
    return source.radius;
  }

  const [generator] = generatorClient.effectiveGeneratorsForSource?.(source.name) || [];
  const gain = Number(generator?.gain);
  return clamp(3.8 + Math.sqrt(Math.max(0, gain || 0.02)) * 8, 4.5, 8);
}

function drawAudioEmitterIcon(ctx, x, centerY) {
  ctx.strokeStyle = "#9a3412";
  ctx.lineWidth = 1.6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x, centerY);
  ctx.lineTo(x + 2, centerY - 4);
  ctx.lineTo(x + 5, centerY + 4);
  ctx.lineTo(x + 8, centerY - 4);
  ctx.lineTo(x + 10, centerY);
  ctx.stroke();
}

function drawMidiEmitterIcon(ctx, x, y) {
  ctx.fillStyle = "#5b21b6";
  ctx.beginPath();
  ctx.arc(x + 2, y + 9, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(x + 4, y, 2, 10);
  ctx.beginPath();
  ctx.moveTo(x + 5, y);
  ctx.lineTo(x + 10, y + 2);
  ctx.lineTo(x + 10, y + 5);
  ctx.lineTo(x + 5, y + 3);
  ctx.closePath();
  ctx.fill();
}

const usePackageEngine = (() => {
  try {
    return new URL(window.location.href).searchParams.get("engine") === "package";
  } catch {
    return false;
  }
})();
const sceneOptions = {
  targetApi: globalThis.MusicSpaceTargets,
  onStatus: setConstraintStatus
};
const scene = usePackageEngine
  ? globalThis.MusicSpacePackageScene.createPackageScene({
      createView: () => globalThis.MusicSpacePresentation.createPresentation(sceneOptions),
      onStatus: setConstraintStatus
    })
  : MusicSpaceModel.createSceneModel(sceneOptions);
const state = scene.state;
const presentation = usePackageEngine ? scene : globalThis.MusicSpacePresentation.legacyPresentation(scene);
const {
  createObject: createViewObject,
  isKind: isViewKind,
  kindOf: viewKind,
  updateNode: updateConstraintNode,
  refresh: recaptureConstraint,
  affectedEntities: constraintEntities
} = presentation;
const containsPoint = globalThis.MusicSpacePresentation.containsPoint;
const renderers = {};
function drawObject(object, ctx, ...args) {
  renderers[viewKind(object)](object, ctx, ...args);
}
const {
  constraintReferencesEntity,
  distanceBetween,
  resolveTrajectoryEndpoint,
  getObjectByName,
  entityLabel,
  normalizeTrajectory,
  parameterFeatureValue,
  clamp,
  enforceConstraints,
  refineXpbdAfterDrag,
  measureConstraintResiduals,
  validatePatch
} = scene;
renderers.Entity = function (object, ctx) {
  ctx.beginPath();
  ctx.arc(object.x, object.y, object.radius, 0, Math.PI * 2);
  ctx.fillStyle = object.color;
  ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.stroke();
};

renderers.Listener = function (object, ctx) {
  renderers.Entity(object, ctx);
  drawListenerGlyph(ctx, object.x, object.y);
};

renderers.SoundSource = function (object, ctx, emitterCapability = sourceEmitterCapability(object)) {
  drawSourceBody(ctx, object, emitterCapability);
  if (emitterCapability.partial) {
    return;
  }
  if (object.name.length <= 2) {
    ctx.fillStyle = emitterCapability.emits ? "#ffffff" : "#991b1b";
    ctx.font = "700 12px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(object.name, object.x, object.y);
  } else {
    drawSourceExternalLabel(ctx, object, emitterCapability);
  }

  drawSourceEmitterBadge(ctx, object, emitterCapability);
};

renderers.MovingObject = function (object, ctx) {
  if (object.trajectory?.type === "rotator") {
    ctx.beginPath();
    ctx.arc(object.x, object.y, object.radius + 3, 0, Math.PI * 2);
    ctx.fillStyle = "#f97316";
    ctx.fill();
    ctx.strokeStyle = "#fed7aa";
    ctx.lineWidth = 4;
    ctx.stroke();
  } else {
    ctx.save();
    ctx.translate(object.x, object.y);
    ctx.rotate(Math.PI / 4);
    ctx.beginPath();
    ctx.rect(-object.radius, -object.radius, object.radius * 2, object.radius * 2);
    ctx.fillStyle = object.color;
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 10px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(object.trajectory?.type === "rotator" ? "R" : "M", object.x, object.y);

  ctx.fillStyle = "#0f172a";
  ctx.font = "12px sans-serif";
  ctx.textBaseline = "bottom";
  ctx.fillText(object.name, object.x, object.y - 18);
};

renderers.ConstraintNode = function (object, ctx) {
  const radius = object.radius + 1;
  ctx.save();

  ctx.beginPath();
  ctx.arc(object.x, object.y, radius + 7, 0, Math.PI * 2);
  ctx.fillStyle = colorWithAlpha(object.color, 0.09);
  ctx.fill();

  ctx.shadowColor = colorWithAlpha(object.color, 0.3);
  ctx.shadowBlur = 11;
  ctx.beginPath();
  polygonPath(ctx, object.x, object.y, radius + 2, 6, Math.PI / 6);
  ctx.fillStyle = radialGradient(ctx, object.x, object.y, radius + 2, "#ffffff", object.color);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = colorWithAlpha(object.color, 0.95);
  ctx.lineWidth = 1.75;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(object.x, object.y, radius - 4, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255, 255, 255, 0.14)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.58)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(object.x - 4, object.y - 5, 1.7, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255, 255, 255, 0.72)";
  ctx.fill();

  ctx.fillStyle = "#263330";
  ctx.font = "800 10px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText(object.label.toUpperCase(), object.x, object.y - radius - 8);

  drawConstraintGlyph(ctx, object);
  ctx.restore();
};

function drawConstraintGlyph(ctx, object) {
  if (object.label === "Spring") {
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.55;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(object.x - 7, object.y);
    ctx.lineTo(object.x - 5, object.y);
    ctx.lineTo(object.x - 3.5, object.y - 3.5);
    ctx.lineTo(object.x - 0.5, object.y + 3.5);
    ctx.lineTo(object.x + 2.5, object.y - 3.5);
    ctx.lineTo(object.x + 5, object.y);
    ctx.lineTo(object.x + 7, object.y);
    ctx.stroke();
    return;
  }

  ctx.fillStyle = "#ffffff";
  ctx.font = "800 10px sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText(object.glyph, object.x, object.y);
}

renderers.AngleConstraint = function (object, ctx) {
  drawConnector(ctx, object.node, object.a, "#2563eb");
  drawConnector(ctx, object.node, object.b, "#2563eb");
  drawConnector(ctx, object.node, object.listener, "#2563eb");
  drawObject(object.node, ctx);
};

renderers.SumConstraint = function (object, ctx) {
  for (const source of object.sources) {
    drawConnector(ctx, object.node, source, "#059669");
  }
  drawConnector(ctx, object.node, object.listener, "#059669");
  drawObject(object.node, ctx);
};

renderers.ProductConstraint = function (object, ctx) {
  for (const source of object.sources) {
    drawConnector(ctx, object.node, source, "#7c3aed");
  }
  drawConnector(ctx, object.node, object.listener, "#7c3aed");
  drawObject(object.node, ctx);
};

renderers.RadialLimitConstraint = function (object, ctx) {
  drawRadialLimit(ctx, object.listener, object.minDistance, object.maxDistance, "#ea580c");
  drawConnector(ctx, object.node, object.source, "#ea580c");
  drawConnector(ctx, object.node, object.listener, "#ea580c");
  drawObject(object.node, ctx);
};

renderers.SpringConstraint = function (object, ctx) {
  drawSpring(ctx, object);
  if (object.node.isManual) {
    drawConnector(ctx, object.node, object.anchor, object.node.color);
    drawConnector(ctx, object.node, object.target, object.node.color);
  }
  drawObject(object.node, ctx);
};

function springGeometry(spring) {
  const dx = spring.target.x - spring.anchor.x;
  const dy = spring.target.y - spring.anchor.y;
  const length = Math.hypot(dx, dy);
  const ux = length ? dx / length : 1;
  const uy = length ? dy / length : 0;
  const nx = -uy;
  const ny = ux;
  const startInset = Math.min((spring.anchor.radius || 0) + 3, length * 0.18);
  const endInset = Math.min((spring.target.radius || 0) + 3, length * 0.18);
  const usableLength = Math.max(0, length - startInset - endInset);
  const terminalLength = Math.min(24, usableLength * 0.16);
  const coilLength = Math.max(0, usableLength - terminalLength * 2);
  const restLength = Math.max(1, Number(spring.restLength) || length || 1);
  const strain = (length - restLength) / restLength;
  const amplitude = Math.min(8, Math.max(3.5, coilLength / 17));

  return {
    startX: spring.anchor.x + ux * startInset,
    startY: spring.anchor.y + uy * startInset,
    endX: spring.target.x - ux * endInset,
    endY: spring.target.y - uy * endInset,
    coilStartX: spring.anchor.x + ux * (startInset + terminalLength),
    coilStartY: spring.anchor.y + uy * (startInset + terminalLength),
    coilLength,
    length,
    ux,
    uy,
    nx,
    ny,
    amplitude,
    strain
  };
}

function traceSpringPath(ctx, geometry, normalShift = 0) {
  const { startX, startY, endX, endY, coilStartX, coilStartY, coilLength, ux, uy, nx, ny, amplitude } =
    geometry;
  const coilEndX = coilStartX + ux * coilLength;
  const coilEndY = coilStartY + uy * coilLength;
  const turns = 8;
  const samples = turns * 6;

  ctx.beginPath();
  ctx.moveTo(startX + nx * normalShift, startY + ny * normalShift);
  if (coilLength < 8) {
    ctx.lineTo(endX + nx * normalShift, endY + ny * normalShift);
    return;
  }
  ctx.lineTo(coilStartX + nx * normalShift, coilStartY + ny * normalShift);
  for (let index = 0; index <= samples; index += 1) {
    const t = index / samples;
    const offset = Math.sin(t * turns * Math.PI * 2) * amplitude + normalShift;
    ctx.lineTo(
      coilStartX + ux * coilLength * t + nx * offset,
      coilStartY + uy * coilLength * t + ny * offset
    );
  }
  ctx.lineTo(coilEndX + nx * normalShift, coilEndY + ny * normalShift);
  ctx.lineTo(endX + nx * normalShift, endY + ny * normalShift);
}

function drawSpring(ctx, spring) {
  const geometry = springGeometry(spring);
  const color = spring.node.color;
  const strainGlow = Math.min(0.28, Math.abs(geometry.strain) * 0.32);

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = colorWithAlpha(color, 0.22 + strainGlow);
  ctx.shadowBlur = 7 + Math.min(7, Math.abs(geometry.strain) * 10);
  traceSpringPath(ctx, geometry);
  ctx.strokeStyle = colorWithAlpha(color, 0.18);
  ctx.lineWidth = 6;
  ctx.stroke();

  ctx.shadowBlur = 0;
  traceSpringPath(ctx, geometry);
  ctx.strokeStyle = "#831843";
  ctx.lineWidth = 3.4;
  ctx.stroke();

  traceSpringPath(ctx, geometry, -0.8);
  ctx.strokeStyle = colorWithAlpha("#fbcfe8", 0.9);
  ctx.lineWidth = 1.15;
  ctx.stroke();

  for (const [x, y] of [
    [geometry.startX, geometry.startY],
    [geometry.endX, geometry.endY]
  ]) {
    ctx.beginPath();
    ctx.arc(x, y, 2.8, 0, Math.PI * 2);
    ctx.fillStyle = "#fdf2f8";
    ctx.fill();
    ctx.strokeStyle = "#9d174d";
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }
  ctx.restore();
}

renderers.FixedDistanceConstraint = function (object, ctx) {
  drawConnector(ctx, object.node, object.anchor, "#0f766e");
  drawConnector(ctx, object.node, object.target, "#0f766e");
  drawObject(object.node, ctx);
};

renderers.DistanceRatioConstraint = function (object, ctx) {
  drawConnector(ctx, object.node, object.a, "#9333ea");
  drawConnector(ctx, object.node, object.b, "#9333ea");
  drawConnector(ctx, object.node, object.listener, "#9333ea");
  drawObject(object.node, ctx);
};

renderers.PinConstraint = function (object, ctx) {
  drawConnector(ctx, object.node, object.target, "#475569");
  drawObject(object.node, ctx);
};

renderers.SolidAttachmentConstraint = function (object, ctx) {
  if (isPartialSource(object.attached) || isPartialSource(object.carrier)) {
    ctx.save();
    ctx.strokeStyle = "rgba(3, 105, 161, 0.28)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(object.carrier.x, object.carrier.y);
    ctx.lineTo(object.attached.x, object.attached.y);
    ctx.stroke();
    ctx.restore();
    return;
  }

  drawConnector(ctx, object.node, object.carrier, "#0369a1");
  drawConnector(ctx, object.node, object.attached, "#0369a1");
  drawObject(object.node, ctx);
};

renderers.MinimumSeparationConstraint = function (object, ctx) {
  drawConnector(ctx, object.node, object.a, "#be123c");
  drawConnector(ctx, object.node, object.b, "#be123c");
  drawObject(object.node, ctx);
};

renderers.AngleSectorConstraint = function (object, ctx) {
  drawAngleSector(ctx, object.listener, object.centerAngle, object.width, "#c2410c");
  drawConnector(ctx, object.node, object.source, "#c2410c");
  drawConnector(ctx, object.node, object.listener, "#c2410c");
  drawObject(object.node, ctx);
};
let dragged = null;

let selectedEntity = null;
let selectionSummaryKey = null;

let hoveredEntity = null;

let activeTool = TOOL_SELECT;

let pendingToolEntities = [];

let lastCanvasClick = null;

let activeRotationMover = null;

let activeShuttleMover = null;

let activeConstraintEditorConstraint = null;

let activeSourceEditorSource = null;

let activeSourceEditorInitialOutputType = "none";

let pendingSourceAudioFile = null;

let cachedSourceGeneratorMidiOutputs = [];

let undoStack = [];

let isAnimating = false;

let soundOutputEnabled = false;
let soundGeneration = 0;

let animationFrame = null;

const simulationClock = MusicSpaceClock.createClock();

let activePatch = null;

let uiMode = UI_MODE_PLAY;

const loadedSequencePatches = new Map();

const parameterClient = MusicSpaceParameterClient.createParameterClient({
  panel: targetPanel,
  grid: targetGrid,
  onStatus: setConstraintStatus,
  getEntity: getObjectByName,
  getFeature: parameterFeatureValue
});

const sourceAudioClient = MusicSpaceSourceAudioClient.createSourceAudioClient({
  onStatus: setConstraintStatus,
  getSource: getObjectByName,
  getListener: () => state.listener
});

const midiFileClient = MusicSpaceMidiFileClient.createMidiFileClient({
  modeSelect: midiModeSelect,
  outputSelect: midiOutputSelect,
  panel: midiPanel,
  trackList: midiTrackList,
  status: midiStatus,
  onStateChange: synchronizeSoundOutput,
  onStatus: setConstraintStatus,
  getSource: getObjectByName,
  getListener: () => state.listener
});

const generatorClient = MusicSpaceGeneratorClient.createGeneratorClient({
  onStatus: setConstraintStatus,
  getSource: getObjectByName,
  getListener: () => state.listener
});

function resetScene() {
  if (!activePatch) {
    setConstraintStatus("No patch is loaded.");
    return;
  }

  pushUndoSnapshot("reset");
  loadPatch(activePatch, { preserveAsActive: false });
}

function clonePatch(patch) {
  return JSON.parse(JSON.stringify(patch));
}

function populatePatchSelect() {
  patchSelect.replaceChildren();

  for (const patch of builtInPatches) {
    const option = document.createElement("option");
    option.value = patch.key;
    option.textContent = patch.name;
    option.title = patch.description || patchTags(patch).join(", ");
    patchSelect.append(option);
  }
}

async function loadBuiltInPatchLibrary() {
  const index = await fetchJson(PATCH_INDEX_URL);
  const entries = Array.isArray(index.patches) ? index.patches : [];
  const baseUrl = new URL(PATCH_INDEX_URL, window.location.href);

  builtInPatches = await Promise.all(
    entries.map(async (entry) => {
      const file = entry.file || `${entry.key}.json`;
      const patchUrl = new URL(file, baseUrl);
      const patch = await fetchJson(patchUrl.href);
      return {
        ...patch,
        version: patch.version || index.version || 1,
        key: patch.key || entry.key,
        name: patch.name || entry.name || entry.key,
        description: entry.description || patch.description || "",
        tags: Array.isArray(entry.tags) ? entry.tags.slice() : patchTags(patch)
      };
    })
  );

  if (builtInPatches.length === 0) {
    throw new Error("Patch index did not list any patches.");
  }
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-cache" });
  if (!response.ok) {
    throw new Error(`Could not load ${url} (${response.status} ${response.statusText})`);
  }
  return response.json();
}

function getInitialSolverMode() {
  try {
    const mode = new URL(window.location.href).searchParams.get("solver");
    return mode === SOLVER_MODE_XPBD ? SOLVER_MODE_XPBD : DEFAULT_SOLVER_MODE;
  } catch (error) {
    return DEFAULT_SOLVER_MODE;
  }
}

function selectPatchOptionForPatch(patch) {
  const key = patch.key || `loaded-sequence-${Date.now()}`;
  let option = Array.from(patchSelect.options).find((candidate) => candidate.value === key);
  patch.key = key;

  if (!option) {
    option = document.createElement("option");
    option.value = key;
    patchSelect.append(option);
  }

  option.textContent = patch.name || "Loaded Sequence";
  option.title = patch.description || patchTags(patch).join(", ");
  patchSelect.value = key;
  loadedSequencePatches.set(key, clonePatch(patch));
  updatePatchInfo(patch);
}

function loadMenuPatch(key, options = {}) {
  const patch =
    loadedSequencePatches.get(key) ||
    builtInPatches.find((candidate) => candidate.key === key) ||
    builtInPatches[0];

  if (!patch) {
    setConstraintStatus("No patch is available to load.");
    return;
  }

  loadPatch(clonePatch(patch), { preserveAsActive: true, clearUndo: options.clearUndo ?? true });
}

function loadPatch(patch, { preserveAsActive = true, clearUndo = false } = {}) {
  if (!scene.loadPatch(patch)) {
    const findings = scene.validation();
    renderPatchValidation(findings);
    setConstraintStatus(
      findings
        .filter((finding) => finding.level === "error")
        .map((finding) => finding.message)
        .join(" ")
    );
    return false;
  }
  if (preserveAsActive) activePatch = clonePatch(patch);
  if (clearUndo) {
    undoStack = [];
    updateUndoStatus();
  }
  parameterClient.loadPatch(patch);
  sourceAudioClient.loadPatch(patch);
  midiFileClient.loadPatch(patch);
  generatorClient.loadPatch(patch);
  soundGeneration += 1;
  soundOutputEnabled = false;
  updateSoundToggleButton();
  updateMidiToolbarVisibility();
  updateToolbarAvailability();
  dragged = null;
  selectedEntity = state.listener;
  hoveredEntity = null;
  state.lastPropagationReport = null;
  state.propagationPaused = false;
  pendingToolEntities = [];
  activeRotationMover = null;
  activeShuttleMover = null;
  activeConstraintEditorConstraint = null;
  activeSourceEditorSource = null;
  activeSourceEditorInitialOutputType = "none";
  pendingSourceAudioFile = null;
  rotationEditor.hidden = true;
  shuttleEditor.hidden = true;
  constraintEditor.hidden = true;
  sourceEditor.hidden = true;
  listenerEditor.hidden = true;

  setConstraintStatus("");
  clearTrace();
  updatePatchInfo(patch);
  drawAll();
  updatePatchInspector();
  if (scene.hasDynamics()) startAnimation();
  return true;
}

function patchTags(patch = {}) {
  if (Array.isArray(patch.tags) && patch.tags.length > 0) {
    return patch.tags.map((tag) => String(tag)).filter(Boolean);
  }

  const tags = new Set();
  if ((patch.sourceBindings || []).length > 0) {
    tags.add("audio");
  }
  if (patch.midiFile) {
    tags.add("midi-file");
  }
  if ((patch.sourceGenerators || []).length > 0) {
    tags.add("generators");
  }
  if ((patch.sourceGeneratorMappings || []).length > 0 || (patch.parameterMappings || []).length > 0) {
    tags.add("mappings");
  }
  if ((patch.movingObjects || []).length > 0) {
    tags.add("motion");
  }
  if ((patch.constraints || []).length > 0) {
    tags.add("constraints");
  }
  if (!tags.size) {
    tags.add("geometry");
  }
  return Array.from(tags);
}

function updatePatchInfo(patch = activePatch) {
  if (usePackageEngine) {
    const url = new URL(window.location.href);
    url.searchParams.delete("engine");
    if (patch?.key) url.searchParams.set("patch", patch.key);
    document.getElementById("standard-engine-link").href = url.href;
  }
  if (!patchInfo) {
    return;
  }

  patchInfo.replaceChildren();
  if (!patch) {
    patchInfo.textContent = "";
    return;
  }

  const title = document.createElement("strong");
  title.textContent = patch.name || "Untitled patch";
  patchInfo.append(title);

  const description = patch.description || summarizePatchForInfo(patch);
  if (description) {
    const summary = document.createElement("span");
    summary.textContent = description;
    patchInfo.append(summary);
  }

  for (const tag of patchTags(patch).slice(0, 5)) {
    const pill = document.createElement("span");
    pill.className = "patch-tag";
    pill.textContent = tag;
    patchInfo.append(pill);
  }
}

function summarizePatchForInfo(patch = {}) {
  const parts = [];
  if ((patch.sources || []).length > 0) {
    parts.push(`${(patch.sources || []).length} sources`);
  }
  if ((patch.constraints || []).length > 0) {
    parts.push(`${(patch.constraints || []).length} constraints`);
  }
  if ((patch.movingObjects || []).length > 0) {
    parts.push(`${(patch.movingObjects || []).length} movers`);
  }
  if ((patch.sourceBindings || []).length > 0) {
    parts.push("audio files");
  }
  if ((patch.sourceGenerators || []).length > 0) {
    const hasAdditive = (patch.sourceGenerators || []).some(
      (generator) => generator.type === SOURCE_OUTPUT_ADDITIVE_SYNTH
    );
    parts.push(hasAdditive ? "synth generators" : "MIDI generators");
  }
  if (patch.midiFile) {
    parts.push("MIDI sequence");
  }
  return parts.join(", ");
}

function pushUndoSnapshot(reason = "edit") {
  if (!state.listener || !state.sources || !state.movingObjects || !state.constraints) {
    return;
  }

  undoStack.push({
    reason,
    patch: clonePatch(serializePatch())
  });

  if (undoStack.length > 60) {
    undoStack.shift();
  }
  updateUndoStatus();
}

function editGeometry(reason, mutate) {
  const patch = clonePatch(serializePatch());
  if (scene.editGeometry) {
    if (!scene.editGeometry(mutate)) return false;
  } else {
    mutate();
  }
  undoStack.push({ reason, patch });
  if (undoStack.length > 60) undoStack.shift();
  updateUndoStatus();
  return true;
}

function undoLastEdit() {
  const snapshot = undoStack.pop();
  if (!snapshot) {
    setConstraintStatus("Nothing to undo.");
    updateUndoStatus();
    return;
  }

  stopAnimation();
  if (!loadPatch(snapshot.patch, { preserveAsActive: true, clearUndo: false })) {
    undoStack.push(snapshot);
    updateUndoStatus();
    return;
  }
  if (activePatch.key) patchSelect.value = activePatch.key;
  setConstraintStatus(`Undid ${snapshot.reason}.`);
  updateUndoStatus();
}

function updateUndoStatus() {
  if (!undoStatus) {
    return;
  }

  const nextUndo = undoStack[undoStack.length - 1];
  undoStatus.hidden = !nextUndo;
  undoStatus.textContent = nextUndo ? `Undo: ${nextUndo.reason}` : "";
  undoStatus.title = nextUndo ? "Press Cmd/Ctrl+Z to undo." : "";
}

function serializePatch() {
  const patch = scene.serializePatch();
  // Optional output blocks are owned by clients; removed bindings must not survive in the authored snapshot.
  for (const key of [
    "target",
    "audioSynth",
    "parameterMappings",
    "audioMappings",
    "sourceBindings",
    "sourceGenerators",
    "sourceGeneratorMappings",
    "midiFile"
  ])
    delete patch[key];
  return {
    ...patch,
    name: activePatch.name || "MusicSpace Patch",
    ...parameterClient.serialize(),
    ...sourceAudioClient.serialize(),
    ...midiFileClient.serialize(),
    ...generatorClient.serialize()
  };
}

function currentPatchSnapshot() {
  if (!state.listener || !state.sources || !state.movingObjects || !state.constraints) {
    return activePatch ? clonePatch(activePatch) : null;
  }

  const patch = serializePatch();
  if (activePatch?.$schema) {
    patch.$schema = activePatch.$schema;
  }
  if (activePatch?.key) {
    patch.key = activePatch.key;
  }
  return patch;
}

function updatePatchInspector({ refreshJson = true } = {}) {
  if (!patchSummary || !patchValidation) {
    return;
  }

  const patch = currentPatchSnapshot();
  renderPatchSummary(patch);
  fillPatchMappingsEditor(parameterClient.mappings?.() || []);
  renderPatchValidation(validatePatch(patch));

  if (
    patchJsonTextarea &&
    patch &&
    refreshJson &&
    !patchJsonEditor.hidden &&
    document.activeElement !== patchJsonTextarea
  ) {
    patchJsonTextarea.value = JSON.stringify(patch, null, 2);
  }
}

function renderPatchSummary(patch) {
  patchSummary.replaceChildren();

  if (!patch) {
    patchSummary.append(createInspectorSection("Patch", ["No patch loaded."]));
    return;
  }

  const constraintLines = (patch.constraints || []).map(describeConstraintSpec);
  const mappingLines = (patch.parameterMappings || []).map(describeParameterMapping);
  const sourceAudioLines = (patch.sourceBindings || []).map(describeSourceBinding);
  const midiLines = (patch.midiFile?.trackBindings || []).map(describeMidiBinding);
  const generatorLines = (patch.sourceGenerators || []).map(describeSourceGenerator);
  const generatorMappingLines = (patch.sourceGeneratorMappings || []).map(describeSourceGeneratorMapping);
  const backendLines = describePatchBackend(patch);

  patchSummary.append(
    createInspectorSection("Patch", [
      `Name: ${patch.name || "Untitled"}`,
      `Key: ${patch.key || "unsaved"}`,
      `Version: ${patch.version || 1}`
    ]),
    createInspectorSection("Scene", [
      `Sources: ${(patch.sources || []).length}`,
      `Moving objects: ${(patch.movingObjects || []).length}`,
      `Constraints: ${(patch.constraints || []).length}`
    ]),
    createInspectorSection("Backend", backendLines),
    createInspectorSection("Constraints", constraintLines.length ? constraintLines : ["None"]),
    createInspectorSection("Source Audio", sourceAudioLines.length ? sourceAudioLines : ["None"]),
    createInspectorSection("Generators", generatorLines.length ? generatorLines : ["None"]),
    createInspectorSection(
      "Generator Mappings",
      generatorMappingLines.length ? generatorMappingLines : ["None"]
    ),
    createInspectorSection("Mappings", mappingLines.length ? mappingLines : ["None"]),
    createInspectorSection("MIDI", midiLines.length ? midiLines : ["None"])
  );
}

function createInspectorSection(title, lines) {
  const section = document.createElement("section");
  const heading = document.createElement("h3");
  const list = document.createElement("ul");

  section.className = "inspector-section";
  heading.textContent = title;
  list.className = "inspector-list";

  for (const line of lines) {
    const item = document.createElement("li");
    item.textContent = line;
    list.append(item);
  }

  section.append(heading, list);
  return section;
}

function describePatchBackend(patch) {
  const target = patch.target || patch.audioSynth || null;
  const type = target?.type || (patch.midiFile ? "midi-file?" : "subtractive");
  const lines = [`Type: ${type}`];

  if (target?.name) {
    lines.push(`Name: ${target.name}`);
  }
  if (target?.module) {
    lines.push(`Module: ${target.module}`);
  }
  if (target?.dsp) {
    lines.push(`DSP: ${target.dsp}`);
  }
  if (target?.wasm) {
    lines.push(`WASM: ${target.wasm}`);
  }
  if (target?.json || target?.metadata) {
    lines.push(`Metadata: ${target.json || target.metadata}`);
  }
  if (patch.midiFile?.url) {
    lines.push(`Sequence: ${patch.midiFile.url}`);
  }
  return lines;
}

function describeConstraintSpec(spec) {
  if (!spec || !spec.type) {
    return "Invalid constraint";
  }
  if (spec.type === "angle") {
    return `Angle: ${(spec.sources || []).join(" / ")}`;
  }
  if (spec.type === "sum" || spec.type === "product") {
    return `${capitalize(spec.type)}: ${(spec.sources || []).join(", ")}`;
  }
  if (spec.type === "radialLimit") {
    return `Radial limit: ${spec.source} in [${spec.minDistance}, ${spec.maxDistance}]`;
  }
  if (spec.type === "spring") {
    return `Spring: ${spec.anchor} to ${spec.target}, rest ${spec.restLength}, stiffness ${spec.stiffness}, damping ${spec.damping}`;
  }
  if (spec.type === "fixedDistance") {
    return `Fixed distance: ${spec.anchor} to ${spec.target} = ${spec.distance}`;
  }
  if (spec.type === "distanceRatio") {
    return `Distance ratio: ${(spec.sources || []).join(" / ")} = ${spec.ratio}`;
  }
  if (spec.type === "pin") {
    return `Pin: ${spec.target} at (${spec.x}, ${spec.y})`;
  }
  if (spec.type === "solid") {
    return `Solid: ${spec.attached} follows ${spec.carrier}`;
  }
  if (spec.type === "separation") {
    return `Separation: ${(spec.sources || []).join(" / ")} >= ${spec.minDistance}`;
  }
  if (spec.type === "angleSector") {
    return `Angle sector: ${spec.source} center ${spec.centerAngle}, width ${spec.width}`;
  }
  return `Unknown: ${spec.type}`;
}

function describeParameterMapping(mapping) {
  return `${mapping.source}.${mapping.feature} -> ${mapping.target} (${mapping.outputMin}..${mapping.outputMax})`;
}

function describeSourceBinding(binding) {
  if (binding?.type === SOURCE_BINDING_AUDIO_FILE) {
    const mode = binding.spatialization === "stereo-pan" ? "pan" : "pan+distance";
    return `${binding.source} -> ${binding.name || binding.url || "audio file"} (${mode})`;
  }
  return `${binding?.source || "?"} -> ${binding?.type || "unknown"}`;
}

function describeMidiBinding(binding) {
  const channel = binding.channel ? ` ch ${binding.channel}` : "";
  const program = Number.isFinite(Number(binding.program)) ? ` program ${binding.program}` : "";
  return `${binding.track || `track ${binding.trackIndex ?? "?"}`} -> ${binding.source}${channel}${program}`;
}

function describeSourceGenerator(generator) {
  if (generator?.type === "midi-ostinato") {
    const channel = generator.channel ? ` ch ${generator.channel}` : "";
    return `${generator.source} -> ostinato pitch ${generator.pitch}, every ${generator.periodMs} ms${channel}`;
  }
  if (generator?.type === SOURCE_OUTPUT_ADDITIVE_SYNTH) {
    const partialCount = Array.isArray(generator.partials) ? generator.partials.length : 0;
    return `${generator.source} -> additive ${Math.round(generator.frequencyHz || 0)} Hz, ${partialCount} partials`;
  }
  return `${generator?.source || "?"} -> ${generator?.type || "unknown"}`;
}

function describeSourceGeneratorMapping(mapping) {
  return `${mapping.source}.${mapping.feature} -> ${mapping.parameter || mapping.target} (${mapping.outputMin}..${mapping.outputMax})`;
}

function renderPatchValidation(findings) {
  patchValidation.replaceChildren();

  for (const finding of findings) {
    const item = document.createElement("div");
    item.className = `validation-item ${finding.level}`;
    item.textContent = `${finding.level.toUpperCase()}: ${finding.message}`;
    patchValidation.append(item);
  }
}

function capitalize(value) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function drawParameterMappingCues(ctx) {
  if (!parameterClient.hasMappings()) {
    return;
  }

  ctx.save();
  ctx.setLineDash([4, 5]);
  ctx.strokeStyle = "rgba(217, 119, 6, 0.5)";
  ctx.fillStyle = "#92400e";
  ctx.font = "700 11px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  const drawnSources = new Set();
  for (const name of parameterClient.mappedEntityNames()) {
    const entity = getObjectByName(name);
    if (!entity || drawnSources.has(entity)) {
      continue;
    }

    ctx.beginPath();
    ctx.moveTo(state.listener.x, state.listener.y);
    ctx.lineTo(entity.x, entity.y);
    ctx.stroke();
    ctx.fillText("Param", entity.x, entity.y + entity.radius + 6);
    drawnSources.add(entity);
  }

  ctx.restore();
}

function sourceEmitterCapability(sourceOrName) {
  const sourceName = typeof sourceOrName === "string" ? sourceOrName : sourceOrName?.name;
  if (!sourceName) {
    return { audio: false, midi: false, emits: false };
  }

  const audio = sourceAudioClient
    .bindingsForSource(sourceName)
    .some((binding) => binding.type === SOURCE_BINDING_AUDIO_FILE && Boolean(binding.dataUrl || binding.url));
  const midi = Boolean(midiFileClient.hasTrackBindingForSource?.(sourceName));
  const generated = Boolean(generatorClient.hasGeneratorForSource?.(sourceName));
  const [generator] = generatorClient.generatorsForSource?.(sourceName) || [];
  const generatedMidi = generated && generator?.type !== SOURCE_OUTPUT_ADDITIVE_SYNTH;
  const generatedAudio = generated && generator?.type === SOURCE_OUTPUT_ADDITIVE_SYNTH;
  const partial = isPartialGenerator(generator);
  return {
    audio: audio || generatedAudio,
    midi: midi || generatedMidi,
    generator: generated,
    partial,
    emits: audio || midi || generated
  };
}

function isPartialSource(sourceOrName) {
  const sourceName = typeof sourceOrName === "string" ? sourceOrName : sourceOrName?.name;
  if (!sourceName) {
    return false;
  }
  const [generator] = generatorClient.generatorsForSource?.(sourceName) || [];
  return isPartialGenerator(generator);
}

function isPartialGenerator(generator) {
  return (
    generator?.type === SOURCE_OUTPUT_ADDITIVE_SYNTH &&
    Array.isArray(generator.partials) &&
    generator.partials.length === 1
  );
}

function updateSelectionSummary() {
  if (!selectionSummary) {
    return;
  }

  const summary = selectedEntitySummary(selectedEntity);
  const key = JSON.stringify(summary);
  if (key === selectionSummaryKey) return;
  selectionSummaryKey = key;
  selectionSummary.replaceChildren();
  selectionSummary.hidden = !summary;
  if (!summary) {
    return;
  }

  const heading = document.createElement("strong");
  heading.textContent = summary.title;
  selectionSummary.append(heading);

  for (const line of summary.lines.slice(0, 5)) {
    const item = document.createElement("span");
    item.textContent = line;
    selectionSummary.append(item);
  }
}

function selectedEntitySummary(entity) {
  if (!entity) {
    return null;
  }

  if (entity === state.listener) {
    return {
      title: "Listener",
      lines: [
        `${state.sources.length} sources, ${state.constraints.length} constraints`,
        `Mode: ${state.listenerMode === LISTENER_MODE_RETARGET ? "re-anchor" : "preserve"}`
      ]
    };
  }

  if (isViewKind(entity, "SoundSource")) {
    return selectedSourceSummary(entity);
  }

  if (isViewKind(entity, "MovingObject")) {
    return {
      title: `Mover: ${entity.name}`,
      lines: [
        `Trajectory: ${describeTrajectory(entity.trajectory)}`,
        `${state.constraints.filter((constraint) => constraintReferencesEntity(constraint, entity)).length} constraints`
      ]
    };
  }

  if (isViewKind(entity, "ConstraintNode")) {
    const constraint = findConstraintForNode(entity);
    const spec = constraint ? constraintEditorSpec(constraint) : null;
    return {
      title: entityLabel(entity),
      lines: [spec?.summary || "Constraint node", "Double-click to edit parameters"]
    };
  }

  return {
    title: entityLabel(entity),
    lines: []
  };
}

function selectedSourceSummary(source) {
  const name = source.name;
  const audioBindings = sourceAudioClient.bindingsForSource(name);
  const generators = generatorClient.generatorsForSource(name);
  const generatorMappings = generatorClient.mappingsForSource(name);
  const midiBindings = (currentPatchSnapshot()?.midiFile?.trackBindings || []).filter(
    (binding) => binding.source === name
  );
  const relatedConstraints = state.constraints.filter((constraint) =>
    constraintReferencesEntity(constraint, source)
  );
  const lines = [];

  if (audioBindings.length || midiBindings.length || generators.length) {
    if (audioBindings.length) {
      lines.push(`Audio: ${audioBindings[0].name || audioBindings[0].url || "file"}`);
    }
    if (midiBindings.length) {
      lines.push(
        `MIDI sequence: ${midiBindings.map((binding) => binding.track || `track ${binding.trackIndex ?? "?"}`).join(", ")}`
      );
    }
    if (generators.length) {
      const generator = generatorClient.effectiveGeneratorsForSource?.(name)?.[0] || generators[0];
      if (generator.type === SOURCE_OUTPUT_ADDITIVE_SYNTH) {
        const partialCount = Array.isArray(generator.partials) ? generator.partials.length : 0;
        lines.push(`Generator: additive ${Math.round(generator.frequencyHz)} Hz, ${partialCount} partials`);
      } else {
        lines.push(`Generator: pitch ${generator.pitch}, period ${Math.round(generator.periodMs)} ms`);
      }
    }
  } else {
    lines.push("Output: none");
  }

  if (generatorMappings.length) {
    lines.push(
      `Mapped controls: ${generatorMappings.map((mapping) => formatMappingOption(mapping.parameter || mapping.target)).join(", ")}`
    );
  }

  lines.push(`${relatedConstraints.length} constraints`);
  return {
    title: `Source: ${name}`,
    lines
  };
}

function describeTrajectory(trajectory = {}) {
  if (trajectory.type === "rotator") {
    return `rotator, ${roundEditorValue(trajectory.periodSeconds || 20)} s`;
  }
  if (trajectory.type === "shuttle") {
    return "shuttle";
  }
  if (trajectory.type === "bounce") {
    return "bounce";
  }
  return "free";
}

function drawAll() {
  configureCanvasResolution();
  updateTraceSelectedButton();
  updateToolbarAvailability();
  updateSelectionSummary();
  updateOpenSourceMappingReadouts();
  updateOpenPatchMappingReadouts();
  clearCanvasSurface(ctx, canvas);
  if (uiMode === UI_MODE_EDIT) {
    drawGrid(ctx);
  }
  parameterClient.update();
  midiFileClient.updateSpatial();
  generatorClient.updateSpatial();

  for (const constraint of state.constraints) {
    drawObject(constraint, ctx);
  }
  drawConstraintDiagnostics(ctx);

  drawParameterMappingCues(ctx);
  sourceAudioClient.updateSpatial();

  for (const mover of state.movingObjects) {
    drawMoverTrajectory(ctx, mover);
  }

  for (const mover of state.movingObjects) {
    drawObject(mover, ctx);
  }

  drawObject(state.listener, ctx);
  for (const source of state.sources) {
    drawObject(source, ctx, sourceEmitterCapability(source));
    drawSourceMuteCue(ctx, source);
  }

  if (selectedEntity) {
    drawSelection(ctx, selectedEntity);
  }

  if (state.propagationPaused) {
    drawPropagationPausedBadge(ctx);
  }
}

function drawGrid(ctx) {
  ctx.strokeStyle = "rgba(148, 163, 184, 0.18)";
  ctx.lineWidth = 1;

  const view = canvasViewport();
  for (let x = Math.floor(view.left / 40) * 40 + 40; x < view.right; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, view.top);
    ctx.lineTo(x, view.bottom);
    ctx.stroke();
  }

  for (let y = Math.floor(view.top / 40) * 40 + 40; y < view.bottom; y += 40) {
    ctx.beginPath();
    ctx.moveTo(view.left, y);
    ctx.lineTo(view.right, y);
    ctx.stroke();
  }
}

function drawConnector(ctx, from, to, color) {
  ctx.save();
  ctx.lineCap = "round";

  ctx.strokeStyle = colorWithAlpha(color, 0.12);
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();

  ctx.strokeStyle = colorWithAlpha(color, 0.76);
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();

  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const endpointX = from.x + Math.cos(angle) * (from.radius || 0);
  const endpointY = from.y + Math.sin(angle) * (from.radius || 0);
  ctx.beginPath();
  ctx.arc(endpointX, endpointY, 2.1, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function drawConstraintDiagnostics(ctx) {
  const residuals = state.lastPropagationReport?.residuals || measureConstraintResiduals();
  for (const residual of residuals) {
    const node = residual.constraint.node;
    ctx.save();
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.radius + 6, 0, Math.PI * 2);
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.restore();
  }
}

function drawPropagationPausedBadge(ctx) {
  const width = 248;
  const height = 34;
  const x = WIDTH - width - 18;
  const y = 18;

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, width, height);
  ctx.fillStyle = "rgba(17, 24, 39, 0.9)";
  ctx.fill();
  ctx.strokeStyle = "#f59e0b";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 13px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("Shift: propagation paused", x + 12, y + height / 2);
  ctx.restore();
}

function drawMoverTrajectory(ctx, mover) {
  if (mover.trajectory?.type !== "shuttle" || !mover.trajectory.showPath) {
    return;
  }

  const start = resolveTrajectoryEndpoint(mover.trajectory.start, mover.trajectory.ax, mover.trajectory.ay);
  const end = resolveTrajectoryEndpoint(mover.trajectory.end, mover.trajectory.bx, mover.trajectory.by);

  ctx.save();
  ctx.strokeStyle = "#0f766e";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
  ctx.restore();
}

function drawListenerGlyph(ctx, x, y) {
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 6, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x - 2, y, 3, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
}

function drawSelection(ctx, entity) {
  ctx.beginPath();
  const radius = isViewKind(entity, "SoundSource") ? sourceVisualRadius(entity) : entity.radius;
  ctx.arc(entity.x, entity.y, radius + 6, 0, Math.PI * 2);
  ctx.strokeStyle = "#f59e0b";
  ctx.lineWidth = 3;
  ctx.stroke();
}

function drawSourceMuteCue(ctx, source) {
  if (!sourceAudioClient.isSourceMuted(source.name)) {
    return;
  }

  ctx.save();
  ctx.strokeStyle = "#111827";
  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  const radius = sourceVisualRadius(source);
  ctx.arc(source.x, source.y, radius + 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(source.x - source.radius - 4, source.y + source.radius + 4);
  ctx.lineTo(source.x + source.radius + 4, source.y - source.radius - 4);
  ctx.stroke();
  ctx.restore();
}

function drawRadialLimit(ctx, anchor, minDistance, maxDistance, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);

  for (const distance of [minDistance, maxDistance]) {
    ctx.beginPath();
    ctx.arc(anchor.x, anchor.y, distance, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawAngleSector(ctx, anchor, centerAngle, width, color) {
  const radius = 130;
  const start = centerAngle - width / 2;
  const end = centerAngle + width / 2;

  ctx.save();
  ctx.fillStyle = "rgba(194, 65, 12, 0.08)";
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(anchor.x, anchor.y);
  ctx.arc(anchor.x, anchor.y, radius, start, end);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function setSolverMode(nextMode, { updateUrl = false } = {}) {
  state.solverMode = nextMode === SOLVER_MODE_XPBD ? SOLVER_MODE_XPBD : SOLVER_MODE_PROPAGATION;
  updateSolverIndicator();
  if (updateUrl) {
    updateSolverModeUrl();
  }
}

function setUiMode(nextMode) {
  uiMode = nextMode === UI_MODE_EDIT ? UI_MODE_EDIT : UI_MODE_PLAY;
  document.body?.classList?.toggle("is-play-mode", uiMode === UI_MODE_PLAY);
  document.body?.classList?.toggle("is-edit-mode", uiMode === UI_MODE_EDIT);
  uiModePlayButton?.setAttribute("aria-pressed", String(uiMode === UI_MODE_PLAY));
  uiModeEditButton?.setAttribute("aria-pressed", String(uiMode === UI_MODE_EDIT));
  updateToolbarAvailability();
  if (state.listener && Array.isArray(state.sources)) {
    configureCanvasResolution();
    drawAll();
  }
}

function updateSolverIndicator() {
  const isXpbd = state.solverMode === SOLVER_MODE_XPBD;
  solverModePropagationButton?.setAttribute("aria-pressed", String(!isXpbd));
  solverModeXpbdButton?.setAttribute("aria-pressed", String(isXpbd));
}

function updateSolverModeUrl() {
  if (!window.history?.replaceState) {
    return;
  }

  const url = new URL(window.location.href);
  if (state.solverMode === SOLVER_MODE_XPBD) {
    url.searchParams.set("solver", SOLVER_MODE_XPBD);
  } else {
    url.searchParams.delete("solver");
  }
  window.history.replaceState(null, "", url.href);
}

async function toggleSoundOutput() {
  const ticket = ++soundGeneration;
  const nextEnabled = !soundOutputEnabled;
  if (nextEnabled && !patchHasSoundOutput()) {
    setConstraintStatus("This patch has no sound, MIDI, generator, or parameter output.");
    updateToolbarAvailability();
    return;
  }

  soundOutputEnabled = nextEnabled;
  updateSoundToggleButton();

  const results = await Promise.allSettled([
    parameterClient.setEnabled(nextEnabled),
    sourceAudioClient.setEnabled(nextEnabled),
    midiFileClient.setEnabled(nextEnabled),
    generatorClient.setEnabled(nextEnabled)
  ]);

  if (ticket !== soundGeneration) return;
  soundOutputEnabled = results.some((result) => result.status === "fulfilled" && result.value);
  updateSoundToggleButton();
  drawAll();
}

function synchronizeSoundOutput() {
  soundOutputEnabled = Boolean(
    parameterClient.isEnabled() ||
    sourceAudioClient.isEnabled() ||
    midiFileClient.isEnabled?.() ||
    generatorClient.isEnabled()
  );
  updateSoundToggleButton();
}

function updateSoundToggleButton() {
  if (!targetToggleButton) {
    return;
  }

  targetToggleButton.textContent = soundOutputEnabled ? "Stop Sound" : "Play Sound";
  targetToggleButton.setAttribute("aria-pressed", String(soundOutputEnabled));
  targetToggleButton.classList.toggle("is-playing", soundOutputEnabled);
  updateToolbarAvailability();
}

function updateMidiToolbarVisibility() {
  if (!midiToolbarGroup) {
    return;
  }

  midiToolbarGroup.hidden = !midiFileClient.hasMidiFile();
}

function patchHasSoundOutput() {
  return Boolean(
    parameterClient.hasMappings?.() ||
    sourceAudioClient.hasBindings?.() ||
    midiFileClient.hasMidiFile?.() ||
    generatorClient.hasGenerators?.()
  );
}

function patchHasMovers() {
  return state.movingObjects.length > 0 || scene.hasDynamics();
}

function updateToolbarAvailability() {
  const canAnimate = patchHasMovers();
  const canPlaySound = patchHasSoundOutput();

  if (animationToggle) {
    animationToggle.hidden = !canAnimate && !isAnimating;
    animationToggle.disabled = !canAnimate && !isAnimating;
  }

  if (targetToggleButton) {
    targetToggleButton.hidden = !canPlaySound && !soundOutputEnabled;
    targetToggleButton.disabled = !canPlaySound && !soundOutputEnabled;
  }

  if (transportToolbarGroup) {
    transportToolbarGroup.hidden = Boolean(animationToggle?.hidden && targetToggleButton?.hidden);
  }

  updateMidiToolbarVisibility();
}

function setActiveTool(tool) {
  if (tool !== TOOL_SELECT) {
    stopAnimation();
  }

  activeTool = tool;
  pendingToolEntities = [];

  for (const button of toolButtons) {
    button.setAttribute("aria-pressed", String(button.dataset.tool === activeTool));
  }

  if (activeTool === TOOL_SELECT) {
    setConstraintStatus("");
  } else {
    setConstraintStatus(toolPrompt(activeTool));
  }
}

function toolPrompt(tool) {
  const prompts = {
    source: "Click empty space to create a source.",
    mover: "Click empty space to create a moving object.",
    angle: "Angle: click two sources or movers.",
    sum: "Sum: click two or more sources or movers; click Sum again to finish.",
    product: "Product: click two or more sources or movers; click Product again to finish.",
    radialLimit: "Limit: click one source or mover.",
    spring: "Spring: click two endpoints. Then drag an unpinned endpoint and release to oscillate.",
    fixedDistance: "Distance: click anchor, then target.",
    distanceRatio: "Ratio: click two sources or movers.",
    pin: "Pin: click one object.",
    solid: "Link: click carrier, then attached object.",
    separation: "Separation: click two sources or movers.",
    angleSector: "Sector: click one source or mover.",
    translateTrajectory: "Move: click a mover, or empty space to create one.",
    rotateTrajectory:
      "Orbit: click a mover, or empty space to create one. The mover itself travels around the listener.",
    rotatorTrajectory: "Spin: click a mover, or empty space to create a rotative object.",
    shuttleTrajectory: "Shuttle: click a mover, or empty space to create one, then set endpoints.",
    bounceTrajectory: "Bounce: click a mover, or empty space to create one."
  };
  return prompts[tool] || "";
}

function requiredEntityCount(tool) {
  const counts = {
    angle: 2,
    sum: 2,
    product: 2,
    radialLimit: 1,
    fixedDistance: 2,
    spring: 2,
    distanceRatio: 2,
    pin: 1,
    solid: 2,
    separation: 2,
    angleSector: 1
  };
  return counts[tool] || 0;
}

function isVariableArityConstraintTool(tool) {
  return tool === "sum" || tool === "product";
}

function canUseEntityForTool(tool, entity) {
  if (!entity || state.constraints.some((constraint) => constraint.node === entity)) {
    return false;
  }

  if (tool === "radialLimit" || tool === "angleSector") {
    return entity !== state.listener;
  }

  if (
    tool === "sum" ||
    tool === "product" ||
    tool === "angle" ||
    tool === "distanceRatio" ||
    tool === "separation"
  ) {
    return entity !== state.listener;
  }

  return true;
}

function handleToolClick(x, y, entity) {
  if (activeTool === "source") {
    const source = createViewObject("SoundSource", x, y, nextSourceName());
    if (!editGeometry("create source", () => state.sources.push(source))) return true;
    selectedEntity = source;
    setActiveTool(TOOL_SELECT);
    drawAll();
    return true;
  }

  if (activeTool === "mover") {
    const mover = createViewObject("MovingObject", x, y, nextMoverName(), { type: "free" });
    if (!editGeometry("create mover", () => state.movingObjects.push(mover))) return true;
    selectedEntity = mover;
    setActiveTool(TOOL_SELECT);
    drawAll();
    return true;
  }

  if (isTrajectoryTool(activeTool)) {
    const mover = isViewKind(entity, "MovingObject")
      ? entity
      : createViewObject("MovingObject", x, y, nextMoverName(), { type: "free" });
    const tool = activeTool;
    if (
      !editGeometry("assign trajectory", () => {
        if (!state.movingObjects.includes(mover)) state.movingObjects.push(mover);
        assignTrajectoryFromTool(mover, tool);
      })
    )
      return true;
    if (tool === "shuttleTrajectory") openShuttleEditor(mover);
    if (tool === "rotatorTrajectory") openRotationEditor(mover);
    selectedEntity = mover;
    setActiveTool(TOOL_SELECT);
    drawAll();
    return true;
  }

  if (!canUseEntityForTool(activeTool, entity)) {
    setConstraintStatus(toolPrompt(activeTool));
    return true;
  }

  if (pendingToolEntities.includes(entity)) {
    setConstraintStatus("That object is already selected for this constraint.");
    return true;
  }

  pendingToolEntities.push(entity);
  const requiredCount = requiredEntityCount(activeTool);

  if (pendingToolEntities.length < requiredCount) {
    setConstraintStatus(`${toolPrompt(activeTool)} (${pendingToolEntities.length}/${requiredCount})`);
    drawAll();
    return true;
  }

  if (isVariableArityConstraintTool(activeTool)) {
    setConstraintStatus(
      `${capitalize(activeTool)}: ${pendingToolEntities.length} selected. Click more, or click ${capitalize(activeTool)} again to finish.`
    );
    drawAll();
    return true;
  }

  finishPendingConstraintTool();
  return true;
}

function finishPendingConstraintTool() {
  const constraint = createConstraintFromTool(activeTool, pendingToolEntities);
  let addedMessage = "";
  if (constraint) {
    if (
      !editGeometry("create constraint", () => {
        state.constraints.push(constraint);
        if (!usePackageEngine) scene.initializeDynamics();
      })
    )
      return;
    if (scene.hasDynamics()) startAnimation();
    selectedEntity = constraint.node;
    addedMessage = `${constraint.node.label} constraint added.`;
  }
  pendingToolEntities = [];
  setActiveTool(TOOL_SELECT);
  setConstraintStatus(addedMessage);
  drawAll();
}

function handleToolButtonClick(tool) {
  if (
    tool === activeTool &&
    isVariableArityConstraintTool(tool) &&
    pendingToolEntities.length >= requiredEntityCount(tool)
  ) {
    finishPendingConstraintTool();
    return;
  }

  setActiveTool(tool);
}

function createConstraintFromTool(tool, entities) {
  if (tool === "angle") {
    return createViewObject("AngleConstraint", state.listener, entities[0], entities[1]);
  }

  if (tool === "sum") {
    return createViewObject("SumConstraint", state.listener, entities);
  }

  if (tool === "product") {
    return createViewObject("ProductConstraint", state.listener, entities);
  }

  if (tool === "radialLimit") {
    const distance = distanceBetween(entities[0], state.listener);
    return createViewObject(
      "RadialLimitConstraint",
      state.listener,
      entities[0],
      Math.max(MIN_DISTANCE, distance * 0.55),
      distance * 1.35
    );
  }

  if (tool === "spring") {
    return createViewObject("SpringConstraint", entities[0], entities[1]);
  }

  if (tool === "fixedDistance") {
    return createViewObject("FixedDistanceConstraint", entities[0], entities[1]);
  }

  if (tool === "distanceRatio") {
    return createViewObject("DistanceRatioConstraint", state.listener, entities[0], entities[1]);
  }

  if (tool === "pin") {
    return createViewObject("PinConstraint", entities[0]);
  }

  if (tool === "solid") {
    return createViewObject("SolidAttachmentConstraint", entities[0], entities[1]);
  }

  if (tool === "separation") {
    return createViewObject(
      "MinimumSeparationConstraint",
      entities[0],
      entities[1],
      Math.max(50, distanceBetween(entities[0], entities[1]))
    );
  }

  if (tool === "angleSector") {
    return createViewObject("AngleSectorConstraint", state.listener, entities[0]);
  }

  return null;
}

function isTrajectoryTool(tool) {
  return (
    tool === "translateTrajectory" ||
    tool === "rotateTrajectory" ||
    tool === "rotatorTrajectory" ||
    tool === "shuttleTrajectory" ||
    tool === "bounceTrajectory"
  );
}

function assignTrajectoryFromTool(mover, tool) {
  if (tool === "translateTrajectory") {
    mover.trajectory = normalizeTrajectory(
      { type: "translation", vx: 1.4, vy: 0.7, bounce: true },
      mover.x,
      mover.y
    );
  } else if (tool === "rotateTrajectory") {
    const radius = Math.max(40, distanceBetween(mover, state.listener));
    mover.trajectory = normalizeTrajectory(
      {
        type: "rotation",
        centerX: state.listener.x,
        centerY: state.listener.y,
        radius,
        phase: Math.atan2(mover.y - state.listener.y, mover.x - state.listener.x),
        angularSpeed: 0.018
      },
      mover.x,
      mover.y
    );
  } else if (tool === "shuttleTrajectory") {
    mover.trajectory = normalizeTrajectory(
      {
        type: "shuttle",
        ax: clamp(mover.x - 120, 0, WIDTH),
        ay: mover.y,
        bx: clamp(mover.x + 120, 0, WIDTH),
        by: mover.y,
        phase: 0.5,
        speed: 0.008,
        direction: 1
      },
      mover.x,
      mover.y
    );
  } else if (tool === "rotatorTrajectory") {
    mover.trajectory = normalizeTrajectory(
      {
        type: "rotator",
        running: true,
        periodSeconds: 20,
        direction: 1,
        displacementInducesRotation: true
      },
      mover.x,
      mover.y
    );
  } else if (tool === "bounceTrajectory") {
    mover.trajectory = normalizeTrajectory({ type: "bounce", vx: 1.8, vy: 1.1 }, mover.x, mover.y);
  }
}

function editableInspectorTargets() {
  return [
    { entity: state.listener, label: "Listener", open: () => openListenerEditor() },
    ...state.sources.map((source) => ({
      entity: source,
      label: entityLabel(source),
      open: () => openSourceEditor(source)
    })),
    ...state.movingObjects
      .filter((mover) => mover.trajectory?.type === "rotator" || mover.trajectory?.type === "shuttle")
      .map((mover) => ({
        entity: mover,
        label: entityLabel(mover),
        open: () => {
          if (mover.trajectory?.type === "shuttle") {
            openShuttleEditor(mover);
          } else {
            openRotationEditor(mover);
          }
        }
      })),
    ...state.constraints.map((constraint) => ({
      entity: constraint.node,
      label: constraint.node.label,
      open: () => openConstraintEditor(constraint)
    }))
  ];
}

function currentInspectorEntity() {
  if (!listenerEditor.hidden) {
    return state.listener;
  }
  if (!sourceEditor.hidden && activeSourceEditorSource) {
    return activeSourceEditorSource;
  }
  if (!rotationEditor.hidden && activeRotationMover) {
    return activeRotationMover;
  }
  if (!shuttleEditor.hidden && activeShuttleMover) {
    return activeShuttleMover;
  }
  if (!constraintEditor.hidden && activeConstraintEditorConstraint) {
    return activeConstraintEditorConstraint.node;
  }
  return selectedEntity;
}

function navigateInspector(delta) {
  const targets = editableInspectorTargets();
  if (targets.length === 0) {
    setConstraintStatus("No editable items in this patch.");
    return false;
  }

  const current = currentInspectorEntity();
  const currentIndex = Math.max(
    0,
    targets.findIndex((target) => target.entity === current)
  );
  const nextIndex = (currentIndex + delta + targets.length) % targets.length;
  const target = targets[nextIndex];
  target.open();
  selectedEntity = target.entity;
  updateInspectorNavButtons();
  drawAll();
  return true;
}

function updateInspectorNavButtons() {
  const canNavigate = editableInspectorTargets().length > 1;
  for (const button of [
    rotationPrevButton,
    rotationNextButton,
    shuttlePrevButton,
    shuttleNextButton,
    constraintPrevButton,
    constraintNextButton,
    sourcePrevButton,
    sourceNextButton,
    listenerPrevButton,
    listenerNextButton
  ]) {
    button.disabled = !canNavigate;
  }
}

function openListenerEditor() {
  if (!state.listener) {
    return;
  }

  rotationEditor.hidden = true;
  activeRotationMover = null;
  shuttleEditor.hidden = true;
  activeShuttleMover = null;
  closeConstraintEditor();
  closeSourceEditor();
  listenerXInput.value = String(roundEditorValue(state.listener.x));
  listenerYInput.value = String(roundEditorValue(state.listener.y));
  listenerDrawTraceInput.checked = Boolean(state.listener.drawTrace);
  setListenerMode(state.listenerMode);
  listenerEditor.hidden = false;
  updateInspectorNavButtons();
  setConstraintStatus("Editing listener.");
  revealEditor(listenerEditor);
}

function applyListenerEditor() {
  if (!state.listener || listenerEditor.hidden) {
    return;
  }

  const nextX = clampNumberInput(listenerXInput.value, 0, WIDTH, state.listener.x);
  const nextY = clampNumberInput(listenerYInput.value, 0, HEIGHT, state.listener.y);
  const nextDrawTrace = Boolean(listenerDrawTraceInput.checked);
  const moved = nextX !== state.listener.x || nextY !== state.listener.y;
  const changedTrace = nextDrawTrace !== Boolean(state.listener.drawTrace);

  if (!moved && !changedTrace) {
    setConstraintStatus("Listener unchanged.");
    return;
  }

  pushUndoSnapshot("edit listener");
  selectedEntity = state.listener;
  state.listener.drawTrace = nextDrawTrace;
  if (changedTrace) {
    state.listener.prevX = state.listener.x;
    state.listener.prevY = state.listener.y;
  }
  if (moved) {
    moveEntity(state.listener, nextX, nextY);
  } else {
    drawAll();
  }
  updateTraceSelectedButton();
  updatePatchInspector();
  setConstraintStatus(
    `Listener updated in ${state.listenerMode === LISTENER_MODE_RETARGET ? "re-anchor" : "preserve"} mode.`
  );
}

function closeListenerEditor() {
  listenerEditor.hidden = true;
  updateInspectorNavButtons();
}

function openRotationEditor(mover) {
  if (!isViewKind(mover, "MovingObject")) {
    return;
  }

  if (mover.trajectory?.type !== "rotator") {
    if (
      !editGeometry("assign rotator", () => {
        mover.trajectory = normalizeTrajectory({ type: "rotator" }, mover.x, mover.y);
      })
    )
      return;
  }

  shuttleEditor.hidden = true;
  activeShuttleMover = null;
  closeConstraintEditor();
  closeSourceEditor();
  closeListenerEditor();
  activeRotationMover = mover;
  rotationRunningInput.checked = Boolean(mover.trajectory.running);
  rotationDisplacementInput.checked = Boolean(mover.trajectory.displacementInducesRotation);
  rotationPeriodInput.value = String(mover.trajectory.periodSeconds || 20);
  rotationDirectionInput.value = String(mover.trajectory.direction || 1);
  rotationEditor.hidden = false;
  updateInspectorNavButtons();
  setConstraintStatus(`Editing rotative object ${mover.name}.`);
  revealEditor(rotationEditor);
}

function applyRotationEditor() {
  if (!activeRotationMover) {
    return;
  }

  const periodSeconds = Number(rotationPeriodInput.value);
  if (
    !editGeometry("edit rotative object", () => {
      activeRotationMover.trajectory = normalizeTrajectory(
        {
          ...activeRotationMover.trajectory,
          type: "rotator",
          running: rotationRunningInput.checked,
          periodSeconds: Number.isFinite(periodSeconds) ? Math.max(0.5, periodSeconds) : 20,
          direction: Number(rotationDirectionInput.value) < 0 ? -1 : 1,
          displacementInducesRotation: rotationDisplacementInput.checked
        },
        activeRotationMover.x,
        activeRotationMover.y
      );
    })
  )
    return;
  setConstraintStatus(`Rotative object ${activeRotationMover.name} updated.`);
  drawAll();
}

function closeRotationEditor() {
  rotationEditor.hidden = true;
  activeRotationMover = null;
  updateInspectorNavButtons();
}

function openShuttleEditor(mover) {
  if (!isViewKind(mover, "MovingObject")) {
    return;
  }

  if (mover.trajectory?.type !== "shuttle") {
    if (
      !editGeometry("assign shuttle", () => {
        mover.trajectory = normalizeTrajectory({ type: "shuttle" }, mover.x, mover.y);
      })
    )
      return;
  }

  rotationEditor.hidden = true;
  activeRotationMover = null;
  closeConstraintEditor();
  closeSourceEditor();
  closeListenerEditor();
  activeShuttleMover = mover;
  populateEndpointSelect(shuttleStartRefInput, mover);
  populateEndpointSelect(shuttleEndRefInput, mover);
  const trajectory = mover.trajectory;
  const start = trajectory.start || { type: "fixed", x: trajectory.ax, y: trajectory.ay };
  const end = trajectory.end || { type: "fixed", x: trajectory.bx, y: trajectory.by };

  shuttleStartRefInput.value = start.type === "object" ? start.name : "";
  shuttleEndRefInput.value = end.type === "object" ? end.name : "";
  shuttleStartXInput.value = String(start.x ?? trajectory.ax);
  shuttleStartYInput.value = String(start.y ?? trajectory.ay);
  shuttleEndXInput.value = String(end.x ?? trajectory.bx);
  shuttleEndYInput.value = String(end.y ?? trajectory.by);
  shuttleSpeedInput.value = String(trajectory.speed ?? 0.01);
  shuttleShowPathInput.checked = trajectory.showPath !== false;
  shuttleEditor.hidden = false;
  updateInspectorNavButtons();
  setConstraintStatus(`Editing shuttle trajectory ${mover.name}.`);
  revealEditor(shuttleEditor);
}

function revealEditor(editor) {
  if (editor.classList?.contains?.("popup-panel")) {
    return;
  }

  requestAnimationFrame(() => {
    editor.scrollIntoView({ block: "nearest", behavior: "smooth" });
  });
}

function populateEndpointSelect(select, mover) {
  select.replaceChildren();
  const fixedOption = document.createElement("option");
  fixedOption.value = "";
  fixedOption.textContent = "Fixed point";
  select.append(fixedOption);

  for (const entity of selectableEndpointObjects(mover)) {
    const option = document.createElement("option");
    option.value = entityLabel(entity);
    option.textContent = entityLabel(entity);
    select.append(option);
  }
}

function selectableEndpointObjects(excludedMover) {
  return [
    state.listener,
    ...state.sources,
    ...state.movingObjects.filter((mover) => mover !== excludedMover)
  ];
}

function applyShuttleEditor() {
  if (!activeShuttleMover) {
    return;
  }

  const current = activeShuttleMover.trajectory;
  const speed = Number(shuttleSpeedInput.value);
  if (
    !editGeometry("edit shuttle trajectory", () => {
      activeShuttleMover.trajectory = normalizeTrajectory(
        {
          ...current,
          type: "shuttle",
          start: endpointFromEditor(shuttleStartRefInput, shuttleStartXInput, shuttleStartYInput),
          end: endpointFromEditor(shuttleEndRefInput, shuttleEndXInput, shuttleEndYInput),
          speed: Number.isFinite(speed) ? Math.max(0.001, speed) : current.speed,
          showPath: shuttleShowPathInput.checked
        },
        activeShuttleMover.x,
        activeShuttleMover.y
      );
    })
  )
    return;
  setConstraintStatus(`Shuttle trajectory ${activeShuttleMover.name} updated.`);
  drawAll();
}

function endpointFromEditor(refInput, xInput, yInput) {
  const refName = refInput.value;
  const x = Number(xInput.value);
  const y = Number(yInput.value);
  const fallbackX = Number.isFinite(x) ? x : 0;
  const fallbackY = Number.isFinite(y) ? y : 0;
  const object = getObjectByName(refName);

  if (refName && object) {
    return {
      type: "object",
      name: refName,
      x: object.x,
      y: object.y
    };
  }

  return {
    type: "fixed",
    x: fallbackX,
    y: fallbackY
  };
}

function closeShuttleEditor() {
  shuttleEditor.hidden = true;
  activeShuttleMover = null;
  updateInspectorNavButtons();
}

function findConstraintForNode(node) {
  return state.constraints.find((constraint) => constraint.node === node) || null;
}

function constraintEditorSpec(constraint) {
  if (isViewKind(constraint, "AngleConstraint")) {
    return {
      summary: `Angle between ${entityLabel(constraint.a)} and ${entityLabel(constraint.b)} around Listener.`,
      valueA: { label: "Angle (deg)", value: radiansToDegrees(constraint.angle), min: -360, step: 0.1 }
    };
  }
  if (isViewKind(constraint, "SumConstraint")) {
    return {
      summary: `Sum of distances for ${constraint.sources.map(entityLabel).join(", ")}.`,
      valueA: { label: "Total distance", value: constraint.totalDistance, min: 0, step: 1 }
    };
  }
  if (isViewKind(constraint, "ProductConstraint")) {
    return {
      summary: `Product of distances for ${constraint.sources.map(entityLabel).join(", ")}.`,
      valueA: { label: "Distance product", value: constraint.product, min: MIN_DISTANCE, step: 1 }
    };
  }
  if (isViewKind(constraint, "RadialLimitConstraint")) {
    return {
      summary: `${entityLabel(constraint.source)} distance from Listener.`,
      valueA: { label: "Minimum distance", value: constraint.minDistance, min: 0, step: 1 },
      valueB: { label: "Maximum distance", value: constraint.maxDistance, min: 0, step: 1 }
    };
  }
  if (isViewKind(constraint, "SpringConstraint")) {
    const movableEndpoints = constraintEntities(constraint).filter(
      (entity) =>
        entity !== state.listener &&
        !(isViewKind(entity, "MovingObject") && entity.trajectory.type !== "free") &&
        !state.constraints.some((other) => isViewKind(other, "PinConstraint") && other.target === entity)
    );
    const gesture = movableEndpoints.length
      ? `Drag ${movableEndpoints.map(entityLabel).join(" or ")} and release to oscillate.`
      : "Both endpoints are fixed.";
    return {
      summary: `${gesture} Dragging S only moves this label.`,
      valueA: { label: "Rest length", value: constraint.restLength, min: 0, step: 1 },
      valueB: { label: "Stiffness", value: constraint.stiffness, min: 0, step: 1 },
      valueC: { label: "Damping", value: constraint.damping, min: 0, step: 0.1 }
    };
  }
  if (isViewKind(constraint, "FixedDistanceConstraint")) {
    return {
      summary: `${entityLabel(constraint.target)} fixed from ${entityLabel(constraint.anchor)}.`,
      valueA: { label: "Distance", value: constraint.distance, min: MIN_DISTANCE, step: 1 }
    };
  }
  if (isViewKind(constraint, "DistanceRatioConstraint")) {
    return {
      summary: `${entityLabel(constraint.a)} / ${entityLabel(constraint.b)} distance ratio from Listener.`,
      valueA: { label: "Ratio", value: constraint.ratio, min: 0.001, step: 0.001 }
    };
  }
  if (isViewKind(constraint, "PinConstraint")) {
    return {
      summary: `${entityLabel(constraint.target)} pinned position.`,
      valueA: { label: "Pinned X", value: constraint.fixedX, step: 1 },
      valueB: { label: "Pinned Y", value: constraint.fixedY, step: 1 }
    };
  }
  if (isViewKind(constraint, "SolidAttachmentConstraint")) {
    return {
      summary: `${entityLabel(constraint.attached)} follows ${entityLabel(constraint.carrier)}.`,
      valueA: { label: "Offset X", value: constraint.offsetX, step: 1 },
      valueB: { label: "Offset Y", value: constraint.offsetY, step: 1 }
    };
  }
  if (isViewKind(constraint, "MinimumSeparationConstraint")) {
    return {
      summary: `${entityLabel(constraint.a)} and ${entityLabel(constraint.b)} minimum distance.`,
      valueA: { label: "Minimum distance", value: constraint.minDistance, min: 0, step: 1 }
    };
  }
  if (isViewKind(constraint, "AngleSectorConstraint")) {
    return {
      summary: `${entityLabel(constraint.source)} angle sector around Listener.`,
      valueA: { label: "Center angle (deg)", value: radiansToDegrees(constraint.centerAngle), step: 0.1 },
      valueB: { label: "Width (deg)", value: radiansToDegrees(constraint.width), min: 0.1, step: 0.1 }
    };
  }
  return {
    summary: "Constraint parameters.",
    valueA: null,
    valueB: null
  };
}

function fillConstraintEditorField(row, label, input, spec) {
  row.hidden = !spec;
  if (!spec) {
    return;
  }
  label.textContent = spec.label;
  input.value = String(roundEditorValue(spec.value));
  input.step = String(spec.step ?? 0.001);
  input.min = spec.min === undefined ? "" : String(spec.min);
}

function openConstraintEditor(constraint) {
  if (!constraint) {
    return;
  }

  rotationEditor.hidden = true;
  activeRotationMover = null;
  shuttleEditor.hidden = true;
  activeShuttleMover = null;
  closeSourceEditor();
  closeListenerEditor();
  activeConstraintEditorConstraint = constraint;

  const spec = constraintEditorSpec(constraint);
  constraintEditorSummary.textContent = spec.summary;
  constraintNodeManualInput.checked = Boolean(constraint.node.isManual);
  constraintNodeXInput.value = String(roundEditorValue(constraint.node.x));
  constraintNodeYInput.value = String(roundEditorValue(constraint.node.y));
  constraintNodeXRow.hidden = false;
  constraintNodeYRow.hidden = false;
  fillConstraintEditorField(constraintValueARow, constraintValueALabel, constraintValueAInput, spec.valueA);
  fillConstraintEditorField(constraintValueBRow, constraintValueBLabel, constraintValueBInput, spec.valueB);
  fillConstraintEditorField(constraintValueCRow, constraintValueCLabel, constraintValueCInput, spec.valueC);
  constraintEditor.hidden = false;
  updateInspectorNavButtons();
  setConstraintStatus(`Editing ${constraint.node.label} constraint.`);
  revealEditor(constraintEditor);
}

function applyConstraintEditor() {
  const constraint = activeConstraintEditorConstraint;
  if (!constraint) {
    return;
  }

  const values = readConstraintEditorValues(constraint);
  if (!values.ok) {
    setConstraintStatus(values.message);
    return;
  }

  if (
    !editGeometry(`edit ${constraint.node.label} constraint`, () => {
      applyConstraintEditorValues(constraint, values);
      constraint.node.isManual = constraintNodeManualInput.checked;
      constraint.node.x = clampNumberInput(constraintNodeXInput.value, 0, WIDTH, constraint.node.x);
      constraint.node.y = clampNumberInput(constraintNodeYInput.value, 0, HEIGHT, constraint.node.y);
      if (!constraint.node.isManual) {
        updateConstraintNode(constraint);
      }
    })
  )
    return;
  const primary = primaryEntityForConstraint(constraint);
  if (primary) {
    enforceConstraints(primary);
  }
  updatePatchInspector();
  drawAll();
  setConstraintStatus(`${constraint.node.label} constraint updated.`);
}

function readConstraintEditorValues(constraint) {
  const valueA = Number(constraintValueAInput.value);
  const valueB = Number(constraintValueBInput.value);
  const valueC = Number(constraintValueCInput.value);
  if (
    isViewKind(constraint, "SpringConstraint") &&
    [valueA, valueB, valueC].some((value) => !Number.isFinite(value) || value < 0)
  )
    return { ok: false, message: "Spring parameters must be finite and nonnegative." };

  if (!constraintValueARow.hidden && !Number.isFinite(valueA)) {
    return { ok: false, message: `${constraintValueALabel.textContent} must be a number.` };
  }
  if (!constraintValueBRow.hidden && !Number.isFinite(valueB)) {
    return { ok: false, message: `${constraintValueBLabel.textContent} must be a number.` };
  }
  if (isViewKind(constraint, "RadialLimitConstraint") && valueA > valueB) {
    return { ok: false, message: "Minimum distance must be less than or equal to maximum distance." };
  }
  if (
    (isViewKind(constraint, "ProductConstraint") ||
      isViewKind(constraint, "FixedDistanceConstraint") ||
      isViewKind(constraint, "DistanceRatioConstraint")) &&
    valueA <= 0
  ) {
    return { ok: false, message: `${constraintValueALabel.textContent} must be positive.` };
  }
  if (isViewKind(constraint, "AngleSectorConstraint") && valueB <= 0) {
    return { ok: false, message: "Width must be positive." };
  }

  return { ok: true, valueA, valueB, valueC };
}

function applyConstraintEditorValues(constraint, values) {
  if (isViewKind(constraint, "AngleConstraint")) {
    constraint.angle = degreesToRadians(values.valueA);
  } else if (isViewKind(constraint, "SumConstraint")) {
    constraint.totalDistance = Math.max(0, values.valueA);
  } else if (isViewKind(constraint, "ProductConstraint")) {
    constraint.product = Math.max(MIN_DISTANCE, values.valueA);
  } else if (isViewKind(constraint, "RadialLimitConstraint")) {
    constraint.minDistance = Math.max(0, values.valueA);
    constraint.maxDistance = Math.max(constraint.minDistance, values.valueB);
  } else if (isViewKind(constraint, "SpringConstraint")) {
    constraint.restLength = values.valueA;
    constraint.stiffness = values.valueB;
    constraint.damping = values.valueC;
  } else if (isViewKind(constraint, "FixedDistanceConstraint")) {
    constraint.distance = Math.max(MIN_DISTANCE, values.valueA);
  } else if (isViewKind(constraint, "DistanceRatioConstraint")) {
    constraint.ratio = Math.max(0.001, values.valueA);
  } else if (isViewKind(constraint, "PinConstraint")) {
    constraint.fixedX = clamp(values.valueA, 0, WIDTH);
    constraint.fixedY = clamp(values.valueB, 0, HEIGHT);
  } else if (isViewKind(constraint, "SolidAttachmentConstraint")) {
    constraint.offsetX = values.valueA;
    constraint.offsetY = values.valueB;
  } else if (isViewKind(constraint, "MinimumSeparationConstraint")) {
    constraint.minDistance = Math.max(0, values.valueA);
  } else if (isViewKind(constraint, "AngleSectorConstraint")) {
    constraint.centerAngle = degreesToRadians(values.valueA);
    constraint.width = degreesToRadians(Math.max(0.1, values.valueB));
  }
}

function recaptureConstraintFromGeometry() {
  const constraint = activeConstraintEditorConstraint;
  if (!constraint) {
    return;
  }

  if (!editGeometry(`recapture ${constraint.node.label} constraint`, () => recaptureConstraint(constraint)))
    return;
  openConstraintEditor(constraint);
  updatePatchInspector();
  drawAll();
  setConstraintStatus(`${constraint.node.label} constraint recaptured from current geometry.`);
}

function closeConstraintEditor() {
  constraintEditor.hidden = true;
  activeConstraintEditorConstraint = null;
  updateInspectorNavButtons();
}

function primaryEntityForConstraint(constraint) {
  if (isViewKind(constraint, "RadialLimitConstraint") || isViewKind(constraint, "AngleSectorConstraint")) {
    return constraint.source;
  }
  if (
    isViewKind(constraint, "FixedDistanceConstraint") ||
    isViewKind(constraint, "SpringConstraint") ||
    isViewKind(constraint, "PinConstraint")
  ) {
    return constraint.target;
  }
  if (isViewKind(constraint, "SolidAttachmentConstraint")) {
    return constraint.carrier;
  }
  if (isViewKind(constraint, "DistanceRatioConstraint") || isViewKind(constraint, "AngleConstraint")) {
    return constraint.a;
  }
  if (isViewKind(constraint, "MinimumSeparationConstraint")) {
    return constraint.a;
  }
  if (isViewKind(constraint, "SumConstraint") || isViewKind(constraint, "ProductConstraint")) {
    return constraint.sources[0];
  }
  return null;
}

function roundEditorValue(value) {
  return Math.round(value * 1000) / 1000;
}

function radiansToDegrees(value) {
  return (value * 180) / Math.PI;
}

function degreesToRadians(value) {
  return (value * Math.PI) / 180;
}

function midiToFrequency(pitch) {
  return 440 * Math.pow(2, (pitch - 69) / 12);
}

function frequencyToMidi(frequencyHz) {
  return 69 + 12 * Math.log2(Number(frequencyHz) / 440);
}

function updateSourceEditorVisibility() {
  const outputType = sourceOutputTypeInput.value;
  const isAudio = outputType === SOURCE_BINDING_AUDIO_FILE;
  const isMidiGenerator = outputType === SOURCE_OUTPUT_MIDI_OSTINATO;
  const isAdditiveGenerator = outputType === SOURCE_OUTPUT_ADDITIVE_SYNTH;
  const isGenerator = isMidiGenerator || isAdditiveGenerator;
  const isMidiFile = outputType === SOURCE_OUTPUT_MIDI_FILE;
  const showGeneratorOutput = isMidiGenerator && sourceGeneratorOutputModeInput.value === "external";

  setEditorRowAvailability(sourceAudioFileRow, isAudio, [sourceAudioFileInput]);
  setEditorRowAvailability(sourceGainRow, isAudio, [sourceGainInput]);
  setEditorRowAvailability(sourceLoopRow, isAudio, [sourceLoopInput]);
  setEditorRowAvailability(sourceSpatializationRow, isAudio || isGenerator, [sourceSpatializationInput]);
  setEditorRowAvailability(sourceGeneratorPitchRow, isGenerator, [sourceGeneratorPitchInput]);
  setEditorRowAvailability(sourceGeneratorPeriodRow, isMidiGenerator, [sourceGeneratorPeriodInput]);
  setEditorRowAvailability(sourceGeneratorDurationRow, isMidiGenerator, [sourceGeneratorDurationInput]);
  setEditorRowAvailability(sourceGeneratorVelocityRow, isGenerator, [sourceGeneratorVelocityInput]);
  setEditorRowAvailability(sourceGeneratorWaveformRow, isMidiGenerator, [sourceGeneratorWaveformInput]);
  setEditorRowAvailability(sourceGeneratorOutputModeRow, isMidiGenerator, [sourceGeneratorOutputModeInput]);
  setEditorRowAvailability(sourceGeneratorOutputRow, showGeneratorOutput, [sourceGeneratorOutputInput]);
  setEditorRowAvailability(sourceGeneratorChannelRow, isMidiGenerator, [sourceGeneratorChannelInput]);
  sourceGeneratorMappingsPanel.hidden = !isGenerator;
  sourceGeneratorMappingAddButton.disabled = !isGenerator;
  for (const control of sourceGeneratorMappingList.querySelectorAll("[data-mapping-field]")) {
    control.disabled = !isGenerator;
  }
  for (const button of sourceGeneratorMappingList.querySelectorAll(".mapping-remove")) {
    button.disabled = !isGenerator;
  }
  setEditorRowAvailability(sourceMidiTrackRow, isMidiFile, [sourceMidiTrackInput]);
  setEditorRowAvailability(sourceMidiChannelRow, isMidiFile, [sourceMidiChannelInput]);
  setEditorRowAvailability(sourceMidiProgramRow, isMidiFile, [sourceMidiProgramInput]);
  setEditorRowAvailability(sourceMidiDrumsRow, isMidiFile, [sourceMidiDrumsInput]);
  setEditorRowAvailability(sourceMutedRow, isAudio || isGenerator, [sourceMutedInput]);
  sourceToggleMuteButton.disabled = !(isAudio || isGenerator);
  sourceRemoveBindingButton.disabled = !(isAudio || isGenerator);
  sourceToggleMuteButton.hidden = !(isAudio || isGenerator);
  sourceRemoveBindingButton.hidden = !(isAudio || isGenerator);
}

function setEditorRowAvailability(row, visible, controls = []) {
  row.hidden = !visible;
  for (const control of controls) {
    control.disabled = !visible;
  }
}

function updateSourceOutputTypeOptions(hasMidiBinding) {
  sourceOutputTypeInput.disabled = false;
  const midiFileOption = sourceOutputTypeInput.querySelector(`option[value="${SOURCE_OUTPUT_MIDI_FILE}"]`);
  if (midiFileOption) {
    midiFileOption.disabled = !hasMidiBinding;
  }
}

async function refreshSourceGeneratorMidiOutputs() {
  if (
    sourceOutputTypeInput.value !== SOURCE_OUTPUT_MIDI_OSTINATO ||
    sourceGeneratorOutputModeInput.value !== "external"
  ) {
    return;
  }

  const selectedOutputId = sourceGeneratorOutputInput.value;
  cachedSourceGeneratorMidiOutputs = await generatorClient.availableMidiOutputs();
  sourceGeneratorOutputInput.replaceChildren();

  if (cachedSourceGeneratorMidiOutputs.length === 0) {
    const option = document.createElement("option");
    option.value = selectedOutputId || "";
    option.textContent = selectedOutputId ? "Saved MIDI output unavailable" : "No MIDI outputs";
    sourceGeneratorOutputInput.append(option);
    sourceGeneratorOutputInput.value = option.value;
    sourceGeneratorOutputInput.disabled = true;
    return;
  }

  sourceGeneratorOutputInput.disabled = false;
  for (const output of cachedSourceGeneratorMidiOutputs) {
    const option = document.createElement("option");
    option.value = output.id;
    option.textContent = output.name;
    sourceGeneratorOutputInput.append(option);
  }
  sourceGeneratorOutputInput.value = selectedOutputId || cachedSourceGeneratorMidiOutputs[0].id;
}

function fillSourceGeneratorEditor(generator) {
  const nextGenerator = generator || {
    pitch: 60,
    frequencyHz: 261.63,
    gain: 0.18,
    periodMs: 1000,
    durationMs: 160,
    velocity: 80,
    channel: 1,
    muted: false,
    waveform: "triangle",
    outputMode: "internal",
    outputId: "",
    spatialization: "pan-distance"
  };

  const pitch =
    nextGenerator.type === SOURCE_OUTPUT_ADDITIVE_SYNTH
      ? Math.round(frequencyToMidi(nextGenerator.frequencyHz ?? 261.63))
      : (nextGenerator.pitch ?? 60);
  sourceGeneratorPitchInput.value = String(pitch);
  sourceGeneratorPeriodInput.value = String(nextGenerator.periodMs ?? 1000);
  sourceGeneratorDurationInput.value = String(nextGenerator.durationMs ?? 160);
  sourceGeneratorVelocityInput.value = String(
    nextGenerator.type === SOURCE_OUTPUT_ADDITIVE_SYNTH
      ? Math.round((nextGenerator.gain ?? 0.18) * 127)
      : (nextGenerator.velocity ?? 80)
  );
  sourceGeneratorWaveformInput.value = nextGenerator.waveform || "triangle";
  sourceGeneratorOutputModeInput.value = nextGenerator.outputMode === "external" ? "external" : "internal";
  sourceGeneratorOutputInput.value = nextGenerator.outputId || "";
  sourceGeneratorChannelInput.value = String(nextGenerator.channel ?? 1);
  sourceSpatializationInput.value = nextGenerator.spatialization || "pan-distance";
  sourceMutedInput.checked = Boolean(nextGenerator.muted);
}

function fillSourceMidiFileEditor(binding) {
  const nextBinding = binding || {};
  sourceMidiTrackInput.value = nextBinding.track || `Track ${nextBinding.trackIndex ?? ""}`.trim();
  sourceMidiChannelInput.value = String(nextBinding.channel ?? 1);
  sourceMidiProgramInput.value = String(nextBinding.program ?? 1);
  sourceMidiDrumsInput.checked = Boolean(nextBinding.isDrums);
}

function fillPatchMappingsEditor(mappings = []) {
  if (!patchMappingList) {
    return;
  }

  const targetOptions = parameterMappingTargetOptions();
  const sourceOptions = parameterMappingSourceOptions();
  const canEditMappings = targetOptions.length > 0 && sourceOptions.length > 0;
  if (patchMappingEditor) {
    patchMappingEditor.hidden = !canEditMappings && mappings.length === 0;
  }
  if (patchMappingAddButton) {
    patchMappingAddButton.disabled = !canEditMappings;
  }
  if (patchMappingApplyButton) {
    patchMappingApplyButton.disabled = !canEditMappings && mappings.length === 0;
  }

  patchMappingList.replaceChildren();
  for (const mapping of mappings) {
    addPatchMappingRow(mapping);
  }
}

function defaultParameterMapping() {
  const sourceName = parameterMappingSourceOptions()[0] || "";
  const target = parameterMappingTargetOptions()[0] || "";
  const featureSpec = sourceGeneratorFeatureSpec("distance");
  const targetSpec = parameterMappingTargetSpec(target);

  return {
    source: sourceName,
    feature: "distance",
    target,
    inputMin: featureSpec.defaultMin,
    inputMax: featureSpec.defaultMax,
    outputMin: targetSpec.defaultMin,
    outputMax: targetSpec.defaultMax,
    curve: targetSpec.defaultCurve || "linear"
  };
}

function addPatchMappingRow(mapping = defaultParameterMapping()) {
  if (!patchMappingList) {
    return;
  }

  const sourceOptions = parameterMappingSourceOptions();
  const targetOptions = parameterMappingTargetOptions();
  const row = document.createElement("div");
  row.className = "mapping-row";
  row.append(
    createMappingSelect("Source", "source", sourceOptions, mapping.source),
    createMappingSelect("Feature", "feature", SOURCE_GENERATOR_MAPPING_FEATURES, mapping.feature),
    createMappingSelect("Target", "target", targetOptions, mapping.target),
    createMappingNumber("Input min", "input-min", mapping.inputMin),
    createMappingNumber("Input max", "input-max", mapping.inputMax),
    createMappingNumber("Output min", "output-min", mapping.outputMin),
    createMappingNumber("Output max", "output-max", mapping.outputMax),
    createMappingSelect("Curve", "curve", SOURCE_GENERATOR_MAPPING_CURVES, mapping.curve || "linear"),
    createMappingOptionalNumber("Quantize", "quantize", mapping.quantize),
    createMappingText("Values", "values", mapping.values)
  );

  row.querySelector("[data-mapping-field='feature']").addEventListener("change", () => {
    updateMappingFeatureFields(row, { resetValues: true });
    updatePatchMappingRowReadout(row);
  });
  row.querySelector("[data-mapping-field='target']").addEventListener("change", () => {
    updatePatchMappingTargetFields(row, { resetValues: true });
    updatePatchMappingRowReadout(row);
  });
  updateMappingFeatureFields(row, { resetValues: false });
  updatePatchMappingTargetFields(row, { resetValues: false });

  for (const control of row.querySelectorAll("[data-mapping-field]")) {
    control.addEventListener("input", () => updatePatchMappingRowReadout(row));
    control.addEventListener("change", () => updatePatchMappingRowReadout(row));
  }

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "mapping-remove";
  removeButton.title = "Remove mapping";
  removeButton.setAttribute("aria-label", "Remove mapping");
  removeButton.textContent = "X";
  removeButton.addEventListener("click", () => row.remove());
  row.append(removeButton);

  const readout = document.createElement("output");
  readout.className = "mapping-readout";
  readout.dataset.mappingReadout = "true";
  row.append(readout);
  updatePatchMappingRowReadout(row);
  patchMappingList.append(row);
}

function parameterMappingSourceOptions() {
  return [...state.sources, ...state.movingObjects].map((entity) => entity.name);
}

function parameterMappingTargetOptions() {
  const metadata = parameterClient.targetMetadata?.() || {};
  return Array.isArray(metadata.parameters) ? metadata.parameters : [];
}

function parameterMappingTargetSpec(target) {
  const defaults = parameterClient.targetDefaults?.() || {};
  const targetSpec = parameterClient.targetSpec?.() || {};
  const declared =
    targetSpec.parameters?.[target] || targetSpec.params?.[target] || targetSpec.defaults?.[target] || {};
  const config = parameterClient.targetParameterConfig?.(target) || {};
  const defaultValue = Number(declared.default ?? defaults[target] ?? 1);
  const hasDeclaredRange = Number.isFinite(Number(declared.min)) && Number.isFinite(Number(declared.max));

  if (hasDeclaredRange) {
    return {
      min: Number(declared.min),
      max: Number(declared.max),
      step: parameterMappingStep(config),
      defaultMin: Number(declared.min),
      defaultMax: Number(declared.max),
      defaultCurve: target.includes("freq") || target.includes("frequency") ? "exp" : "linear"
    };
  }

  if (target.includes("freq") || target.includes("frequency")) {
    return { min: 20, max: 20000, step: 1, defaultMin: 110, defaultMax: 4200, defaultCurve: "exp" };
  }
  if (target.includes("/filter/q")) {
    return { min: 0.1, max: 30, step: 0.01, defaultMin: 0.5, defaultMax: 18, defaultCurve: "linear" };
  }
  if (target.includes("gain") || target.includes("spread")) {
    return {
      min: 0,
      max: 1,
      step: 0.01,
      defaultMin: 0,
      defaultMax: Math.max(0.2, defaultValue || 0.2),
      defaultCurve: "linear"
    };
  }
  if (target.includes("/grain/rate")) {
    return { min: 1, max: 80, step: 0.1, defaultMin: 4, defaultMax: 42, defaultCurve: "linear" };
  }
  if (target.includes("/grain/size")) {
    return { min: 0.01, max: 1, step: 0.001, defaultMin: 0.03, defaultMax: 0.22, defaultCurve: "linear" };
  }
  if (target.includes("/grain/pitch")) {
    return { min: 0.1, max: 4, step: 0.01, defaultMin: 0.5, defaultMax: 2, defaultCurve: "linear" };
  }

  const max = Math.max(1, Number.isFinite(defaultValue) ? Math.abs(defaultValue) * 2 : 1);
  return {
    min: 0,
    max,
    step: parameterMappingStep(config),
    defaultMin: 0,
    defaultMax: max,
    defaultCurve: "linear"
  };
}

function parameterMappingStep(config = {}) {
  const digits = Number.isInteger(config.digits) ? config.digits : 2;
  return digits <= 0 ? 1 : 1 / 10 ** Math.min(digits, 6);
}

function updatePatchMappingTargetFields(row, { resetValues = false } = {}) {
  const target = row.querySelector("[data-mapping-field='target']").value;
  const spec = parameterMappingTargetSpec(target);
  const outputMinInput = row.querySelector("[data-mapping-field='output-min']");
  const outputMaxInput = row.querySelector("[data-mapping-field='output-max']");

  for (const input of [outputMinInput, outputMaxInput]) {
    input.min = String(spec.min);
    input.max = String(spec.max);
    input.step = String(spec.step);
  }

  if (resetValues) {
    outputMinInput.value = String(roundEditorValue(spec.defaultMin));
    outputMaxInput.value = String(roundEditorValue(spec.defaultMax));
    row.querySelector("[data-mapping-field='curve']").value = spec.defaultCurve || "linear";
    return;
  }

  outputMinInput.value = String(
    roundEditorValue(clampNumberInput(outputMinInput.value, spec.min, spec.max, spec.defaultMin))
  );
  outputMaxInput.value = String(
    roundEditorValue(clampNumberInput(outputMaxInput.value, spec.min, spec.max, spec.defaultMax))
  );
}

function updateOpenPatchMappingReadouts() {
  if (!patchInspector.hidden && patchMappingList) {
    for (const row of patchMappingList.querySelectorAll(".mapping-row")) {
      updatePatchMappingRowReadout(row);
    }
  }
}

function updatePatchMappingRowReadout(row) {
  const readout = row.querySelector("[data-mapping-readout='true']");
  if (!readout) {
    return;
  }

  const mapping = parameterMappingFromRow(row);
  const entity = getObjectByName(mapping.source);
  if (!entity || !mapping.target) {
    readout.value = "Choose a source and target.";
    readout.textContent = readout.value;
    return;
  }

  const rawValue = parameterFeatureValue(mapping.feature, entity);
  const mappedValue = mappedSourceGeneratorValue(mapping, rawValue);
  const featureLabel = formatMappingOption(mapping.feature);
  const text = `Current: ${mapping.source}.${featureLabel} ${formatMappingValue(rawValue, mapping.feature)} -> ${mapping.target} ${formatParameterMappingValue(mappedValue, mapping.target)}`;
  readout.value = text;
  readout.textContent = text;
}

function parameterMappingFromRow(row) {
  const source = row.querySelector("[data-mapping-field='source']").value;
  const feature = row.querySelector("[data-mapping-field='feature']").value;
  const target = row.querySelector("[data-mapping-field='target']").value;
  const featureSpec = sourceGeneratorFeatureSpec(feature);
  const targetSpec = parameterMappingTargetSpec(target);
  const normalized = {
    source,
    feature,
    target,
    inputMin: numberFromMappingField(
      row,
      "input-min",
      featureSpec.defaultMin,
      featureSpec.min,
      featureSpec.max
    ),
    inputMax: numberFromMappingField(
      row,
      "input-max",
      featureSpec.defaultMax,
      featureSpec.min,
      featureSpec.max
    ),
    outputMin: numberFromMappingField(
      row,
      "output-min",
      targetSpec.defaultMin,
      targetSpec.min,
      targetSpec.max
    ),
    outputMax: numberFromMappingField(
      row,
      "output-max",
      targetSpec.defaultMax,
      targetSpec.min,
      targetSpec.max
    ),
    curve: row.querySelector("[data-mapping-field='curve']").value
  };
  return mappingWithSnapFields(row, normalized);
}

function parameterMappingsFromEditor() {
  if (!patchMappingList) {
    return [];
  }
  return Array.from(patchMappingList.querySelectorAll(".mapping-row")).map((row) =>
    parameterMappingFromRow(row)
  );
}

function formatParameterMappingValue(value, target) {
  if (!Number.isFinite(Number(value))) {
    return "?";
  }
  const config = parameterClient.targetParameterConfig?.(target) || { suffix: "", digits: 2 };
  const digits = Number.isInteger(config.digits) ? config.digits : 2;
  return `${Number(value).toFixed(Math.max(0, Math.min(6, digits)))}${config.suffix || ""}`;
}

function applyPatchMappingsEditor() {
  if (!patchMappingList) {
    return;
  }

  pushUndoSnapshot("edit parameter mappings");
  const mappings = parameterClient.setMappings(parameterMappingsFromEditor());
  setConstraintStatus(`${mappings.length} parameter mapping${mappings.length === 1 ? "" : "s"} applied.`);
  updatePatchInspector();
  drawAll();
}

function fillSourceGeneratorMappingsEditor(mappings = []) {
  sourceGeneratorMappingList.replaceChildren();
  const editorMappings = mappings.length > 0 ? mappings : [defaultSourceGeneratorMapping()];
  for (const mapping of editorMappings) {
    addSourceGeneratorMappingRow(mapping);
  }
}

function defaultSourceGeneratorMapping() {
  const featureSpec = sourceGeneratorFeatureSpec("distance");
  const spec = sourceGeneratorParameterSpec("pitch");
  return {
    feature: "distance",
    parameter: "pitch",
    inputMin: featureSpec.defaultMin,
    inputMax: featureSpec.defaultMax,
    outputMin: spec.defaultMin,
    outputMax: spec.defaultMax,
    curve: "linear"
  };
}

function addSourceGeneratorMappingRow(mapping = defaultSourceGeneratorMapping()) {
  const row = document.createElement("div");
  row.className = "mapping-row";
  row.append(
    createMappingSelect("Source motion", "feature", SOURCE_GENERATOR_MAPPING_FEATURES, mapping.feature),
    createMappingSelect(
      "Controls generator",
      "parameter",
      SOURCE_GENERATOR_MAPPING_PARAMETERS,
      mapping.parameter || mapping.target
    ),
    createMappingNumber("Motion min", "input-min", mapping.inputMin),
    createMappingNumber("Motion max", "input-max", mapping.inputMax),
    createMappingNumber("Parameter min", "output-min", mapping.outputMin),
    createMappingNumber("Parameter max", "output-max", mapping.outputMax),
    createMappingSelect("Curve", "curve", SOURCE_GENERATOR_MAPPING_CURVES, mapping.curve || "linear"),
    createMappingOptionalNumber("Quantize", "quantize", mapping.quantize),
    createMappingText("Values", "values", mapping.values)
  );
  row.querySelector("[data-mapping-field='parameter']").addEventListener("change", () => {
    updateMappingParameterFields(row, { resetValues: true });
    updateMappingRowReadout(row);
  });
  row.querySelector("[data-mapping-field='feature']").addEventListener("change", () => {
    updateMappingFeatureFields(row, { resetValues: true });
    updateMappingRowReadout(row);
  });
  updateMappingFeatureFields(row, { resetValues: false });
  updateMappingParameterFields(row, { resetValues: false });
  for (const control of row.querySelectorAll("[data-mapping-field]")) {
    control.addEventListener("input", () => updateMappingRowReadout(row));
    control.addEventListener("change", () => updateMappingRowReadout(row));
  }
  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "mapping-remove";
  removeButton.title = "Remove mapping";
  removeButton.setAttribute("aria-label", "Remove mapping");
  removeButton.textContent = "X";
  removeButton.addEventListener("click", () => row.remove());
  row.append(removeButton);
  const readout = document.createElement("output");
  readout.className = "mapping-readout";
  readout.dataset.mappingReadout = "true";
  row.append(readout);
  updateMappingRowReadout(row);
  sourceGeneratorMappingList.append(row);
}

function sourceGeneratorFeatureSpec(feature) {
  return SOURCE_GENERATOR_FEATURE_SPECS[feature] || SOURCE_GENERATOR_FEATURE_SPECS.distance;
}

function sourceGeneratorParameterSpec(parameter) {
  return SOURCE_GENERATOR_PARAMETER_SPECS[parameter] || SOURCE_GENERATOR_PARAMETER_SPECS.pitch;
}

function updateMappingFeatureFields(row, { resetValues = false } = {}) {
  const feature = row.querySelector("[data-mapping-field='feature']").value;
  const spec = sourceGeneratorFeatureSpec(feature);
  const inputMinInput = row.querySelector("[data-mapping-field='input-min']");
  const inputMaxInput = row.querySelector("[data-mapping-field='input-max']");

  for (const input of [inputMinInput, inputMaxInput]) {
    input.min = String(spec.min);
    input.max = String(spec.max);
    input.step = String(spec.step);
  }

  if (resetValues) {
    inputMinInput.value = String(roundEditorValue(spec.defaultMin));
    inputMaxInput.value = String(roundEditorValue(spec.defaultMax));
    return;
  }

  inputMinInput.value = String(
    roundEditorValue(clampNumberInput(inputMinInput.value, spec.min, spec.max, spec.defaultMin))
  );
  inputMaxInput.value = String(
    roundEditorValue(clampNumberInput(inputMaxInput.value, spec.min, spec.max, spec.defaultMax))
  );
}

function updateMappingParameterFields(row, { resetValues = false } = {}) {
  const parameter = row.querySelector("[data-mapping-field='parameter']").value;
  const spec = sourceGeneratorParameterSpec(parameter);
  const outputMinInput = row.querySelector("[data-mapping-field='output-min']");
  const outputMaxInput = row.querySelector("[data-mapping-field='output-max']");

  for (const input of [outputMinInput, outputMaxInput]) {
    input.min = String(spec.min);
    input.max = String(spec.max);
    input.step = String(spec.step);
  }

  if (resetValues) {
    outputMinInput.value = String(spec.defaultMin);
    outputMaxInput.value = String(spec.defaultMax);
    return;
  }

  outputMinInput.value = String(clampNumberInput(outputMinInput.value, spec.min, spec.max, spec.defaultMin));
  outputMaxInput.value = String(clampNumberInput(outputMaxInput.value, spec.min, spec.max, spec.defaultMax));
}

function updateOpenSourceMappingReadouts() {
  if (!sourceEditor.hidden && activeSourceEditorSource) {
    for (const row of sourceGeneratorMappingList.querySelectorAll(".mapping-row")) {
      updateMappingRowReadout(row);
    }
  }
}

function updateMappingRowReadout(row) {
  const readout = row.querySelector("[data-mapping-readout='true']");
  if (!readout) {
    return;
  }

  const source = activeSourceEditorSource;
  if (!source) {
    readout.value = "";
    readout.textContent = "";
    return;
  }

  const mapping = sourceGeneratorMappingFromRow(row);
  const rawValue = parameterFeatureValue(mapping.feature, source);
  const mappedValue = mappedSourceGeneratorValue(mapping, rawValue);
  const normalizedValue = normalizeSourceGeneratorMappedParameter(mapping.parameter, mappedValue);
  const featureLabel = formatMappingOption(mapping.feature);
  const parameterLabel = formatMappingOption(mapping.parameter);
  const text = `Current: ${featureLabel} ${formatMappingValue(rawValue, mapping.feature)} -> ${parameterLabel} ${formatMappingValue(normalizedValue, mapping.parameter)}`;
  readout.value = text;
  readout.textContent = text;
}

function sourceGeneratorMappingFromRow(row) {
  const feature = row.querySelector("[data-mapping-field='feature']").value;
  const parameter = row.querySelector("[data-mapping-field='parameter']").value;
  const featureSpec = sourceGeneratorFeatureSpec(feature);
  const spec = sourceGeneratorParameterSpec(parameter);
  const normalized = {
    feature,
    parameter,
    inputMin: numberFromMappingField(
      row,
      "input-min",
      featureSpec.defaultMin,
      featureSpec.min,
      featureSpec.max
    ),
    inputMax: numberFromMappingField(
      row,
      "input-max",
      featureSpec.defaultMax,
      featureSpec.min,
      featureSpec.max
    ),
    outputMin: numberFromMappingField(row, "output-min", spec.defaultMin, spec.min, spec.max),
    outputMax: numberFromMappingField(row, "output-max", spec.defaultMax, spec.min, spec.max),
    curve: row.querySelector("[data-mapping-field='curve']").value
  };
  return mappingWithSnapFields(row, normalized);
}

function mappedSourceGeneratorValue(mapping, value) {
  return MusicSpaceMapping.valueFromMapping(mapping, value);
}

function normalizeSourceGeneratorMappedParameter(parameter, value) {
  const spec = sourceGeneratorParameterSpec(parameter);
  const clamped = clamp(Number(value), spec.min, spec.max);
  if (["pitch", "velocity", "channel"].includes(parameter)) {
    return Math.round(clamped);
  }
  return clamped;
}

function formatMappingValue(value, kind) {
  if (!Number.isFinite(Number(value))) {
    return "?";
  }
  const number = Number(value);
  if (kind === "periodMs" || kind === "durationMs") {
    return `${Math.round(number)} ms`;
  }
  if (kind === "frequencyHz") {
    return `${roundEditorValue(number)} Hz`;
  }
  if (kind === "gain") {
    return number.toFixed(2);
  }
  if (kind === "angle") {
    return `${roundEditorValue(number)} rad`;
  }
  if (kind === "distance" || kind === "x" || kind === "y") {
    return `${Math.round(number)} px`;
  }
  return String(roundEditorValue(number));
}

function createMappingSelect(labelText, key, options, value) {
  const label = document.createElement("label");
  const select = document.createElement("select");
  select.dataset.mappingField = key;
  const selectOptions = options.length > 0 ? options : [""];
  for (const optionValue of selectOptions) {
    const option = document.createElement("option");
    option.value = optionValue;
    option.textContent = optionValue ? formatMappingOption(optionValue) : "None";
    option.disabled = optionValue === "";
    select.append(option);
  }
  select.value = selectOptions.includes(value) ? value : selectOptions[0];
  label.append(labelText, select);
  return label;
}

function createMappingNumber(labelText, key, value) {
  const label = document.createElement("label");
  const input = document.createElement("input");
  input.dataset.mappingField = key;
  input.type = "number";
  input.step = "0.001";
  input.value = String(Number.isFinite(Number(value)) ? value : 0);
  label.append(labelText, input);
  return label;
}

function createMappingOptionalNumber(labelText, key, value) {
  const label = document.createElement("label");
  const input = document.createElement("input");
  input.dataset.mappingField = key;
  input.type = "number";
  input.step = "0.001";
  input.min = "0";
  input.placeholder = "Off";
  input.value = Number.isFinite(Number(value)) && Number(value) > 0 ? String(value) : "";
  label.append(labelText, input);
  return label;
}

function createMappingText(labelText, key, value) {
  const label = document.createElement("label");
  const input = document.createElement("input");
  input.dataset.mappingField = key;
  input.type = "text";
  input.placeholder = "e.g. 1,2,3";
  input.value = Array.isArray(value) ? value.join(", ") : "";
  label.append(labelText, input);
  return label;
}

function formatMappingOption(value) {
  if (!value) {
    return "None";
  }
  if (value === "periodMs") {
    return "Period";
  }
  if (value === "durationMs") {
    return "Duration";
  }
  if (value === "frequencyHz") {
    return "Frequency";
  }
  if (value === "gain") {
    return "Gain";
  }
  if (value === "linear") {
    return "Linear";
  }
  if (value === "exp") {
    return "Exponential";
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function sourceGeneratorMappingsFromEditor() {
  return Array.from(sourceGeneratorMappingList.querySelectorAll(".mapping-row")).map((row) => {
    return sourceGeneratorMappingFromRow(row);
  });
}

function numberFromMappingField(row, field, fallback, min = null, max = null) {
  const input = row.querySelector(`[data-mapping-field='${field}']`);
  const value = Number(input?.value);
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Number.isFinite(min) && Number.isFinite(max) ? clamp(value, min, max) : value;
}

function mappingWithSnapFields(row, mapping) {
  const quantize = Number(row.querySelector("[data-mapping-field='quantize']")?.value);
  const values = parseMappingValues(row.querySelector("[data-mapping-field='values']")?.value);
  return {
    ...mapping,
    ...(Number.isFinite(quantize) && quantize > 0 ? { quantize } : {}),
    ...(values.length > 0 ? { values } : {})
  };
}

function parseMappingValues(value) {
  if (typeof value !== "string" || value.trim() === "") {
    return [];
  }
  return value
    .split(/[\s,]+/)
    .map(Number)
    .filter((number) => Number.isFinite(number));
}

function sourceGeneratorFromEditor(sourceName) {
  const outputId =
    sourceGeneratorOutputModeInput.value === "external" ? sourceGeneratorOutputInput.value : "";
  const output = cachedSourceGeneratorMidiOutputs.find((candidate) => candidate.id === outputId);
  const [existingGenerator] = activeSourceEditorSource
    ? generatorClient.generatorsForSource(activeSourceEditorSource.name)
    : [];
  const pitch = clampIntegerInput(sourceGeneratorPitchInput.value, 0, 127, 60);
  const velocity = clampIntegerInput(sourceGeneratorVelocityInput.value, 1, 127, 80);

  if (sourceOutputTypeInput.value === SOURCE_OUTPUT_ADDITIVE_SYNTH) {
    return {
      source: sourceName,
      type: SOURCE_OUTPUT_ADDITIVE_SYNTH,
      frequencyHz: midiToFrequency(pitch),
      gain: clamp(velocity / 127, 0, 1),
      attackMs: existingGenerator?.attackMs ?? 90,
      releaseMs: existingGenerator?.releaseMs ?? 450,
      muted: sourceMutedInput.checked,
      spatialization: sourceSpatializationInput.value || "pan-distance",
      partials:
        Array.isArray(existingGenerator?.partials) && existingGenerator.partials.length > 0
          ? existingGenerator.partials.map((partial) => ({ ...partial }))
          : defaultAdditivePartials()
    };
  }

  return {
    source: sourceName,
    type: SOURCE_OUTPUT_MIDI_OSTINATO,
    pitch,
    periodMs: clampNumberInput(sourceGeneratorPeriodInput.value, 40, 60000, 1000),
    durationMs: clampNumberInput(sourceGeneratorDurationInput.value, 10, 10000, 160),
    velocity,
    channel: clampIntegerInput(sourceGeneratorChannelInput.value, 1, 16, 1),
    muted: sourceMutedInput.checked,
    waveform: sourceGeneratorWaveformInput.value || "triangle",
    outputMode: sourceGeneratorOutputModeInput.value === "external" ? "external" : "internal",
    outputId,
    outputName: output?.name || existingGenerator?.outputName || "",
    spatialization: sourceSpatializationInput.value || "pan-distance"
  };
}

function defaultAdditivePartials() {
  return [
    {
      ratio: 1,
      amplitude: 1,
      amplitudeLfoHz: 0.05,
      amplitudeLfoDepth: 0.06,
      swellHz: 0.03,
      swellDepth: 0.18
    },
    {
      ratio: 2,
      amplitude: 0.42,
      detuneCents: 1.5,
      detuneLfoHz: 0.04,
      detuneLfoCents: 3,
      swellHz: 0.05,
      swellDepth: 0.28
    },
    {
      ratio: 3,
      amplitude: 0.24,
      detuneCents: -2,
      amplitudeLfoHz: 0.07,
      amplitudeLfoDepth: 0.1,
      swellHz: 0.07,
      swellDepth: 0.35
    },
    { ratio: 5, amplitude: 0.12, detuneLfoHz: 0.03, detuneLfoCents: 5, swellHz: 0.09, swellDepth: 0.46 },
    {
      ratio: 8,
      amplitude: 0.07,
      detuneCents: 3,
      amplitudeLfoHz: 0.09,
      amplitudeLfoDepth: 0.16,
      swellHz: 0.12,
      swellDepth: 0.55
    }
  ];
}

function sourceMidiFileBindingFromEditor(sourceName) {
  const [existingBinding] = midiFileClient.bindingsForSource(sourceName);
  return {
    track: existingBinding?.track || sourceMidiTrackInput.value,
    trackIndex: existingBinding?.trackIndex,
    source: sourceName,
    channel: clampIntegerInput(sourceMidiChannelInput.value, 1, 16, existingBinding?.channel || 1),
    program: clampIntegerInput(sourceMidiProgramInput.value, 1, 128, existingBinding?.program || 1),
    isDrums: sourceMidiDrumsInput.checked
  };
}

function clampNumberInput(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return clamp(number, min, max);
}

function clampIntegerInput(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isInteger(number)) {
    return fallback;
  }
  return clamp(number, min, max);
}

function openSourceEditor(source) {
  if (!isViewKind(source, "SoundSource")) {
    return;
  }

  rotationEditor.hidden = true;
  activeRotationMover = null;
  shuttleEditor.hidden = true;
  activeShuttleMover = null;
  closeConstraintEditor();
  closeListenerEditor();
  activeSourceEditorSource = source;
  pendingSourceAudioFile = null;

  const [binding] = sourceAudioClient.bindingsForSource(source.name);
  const [generator] = generatorClient.generatorsForSource(source.name);
  const [midiBinding] = midiFileClient.bindingsForSource(source.name);
  const generatorMappings = generatorClient.mappingsForSource(source.name);
  sourceNameInput.value = source.name;
  sourceMassRow.hidden = !source.dynamics;
  sourceMassInput.value = String(source.dynamics?.mass ?? 1);
  sourceOutputTypeInput.value =
    binding?.type === SOURCE_BINDING_AUDIO_FILE
      ? SOURCE_BINDING_AUDIO_FILE
      : [SOURCE_OUTPUT_MIDI_OSTINATO, SOURCE_OUTPUT_ADDITIVE_SYNTH].includes(generator?.type)
        ? generator.type
        : midiBinding
          ? SOURCE_OUTPUT_MIDI_FILE
          : "none";
  updateSourceOutputTypeOptions(Boolean(midiBinding));
  activeSourceEditorInitialOutputType = sourceOutputTypeInput.value;
  sourceSpatializationInput.value = binding?.spatialization || generator?.spatialization || "pan-distance";
  sourceGainInput.value = String(binding?.gain ?? 1);
  sourceLoopInput.checked = binding?.loop !== false;
  sourceMutedInput.checked = Boolean(generator ? generator.muted : binding?.muted);
  fillSourceGeneratorEditor(generator);
  fillSourceMidiFileEditor(midiBinding);
  fillSourceGeneratorMappingsEditor(generatorMappings);
  if (sourceOutputTypeInput.value === SOURCE_BINDING_AUDIO_FILE) {
    sourceSpatializationInput.value = binding?.spatialization || "pan-distance";
    sourceMutedInput.checked = Boolean(binding?.muted);
  } else if (!generator && !midiBinding) {
    sourceSpatializationInput.value = "pan-distance";
  }
  sourceAudioFileInput.value = "";
  sourceAudioFileName.textContent = midiBinding
    ? `MIDI file track: ${midiBinding.track || "track"} · ch ${midiBinding.channel || 1}`
    : generator
      ? generator.type === SOURCE_OUTPUT_ADDITIVE_SYNTH
        ? "Additive synth generator assigned."
        : "MIDI ostinato generator assigned."
      : binding?.name
        ? `Selected: ${binding.name}`
        : "No audio file assigned.";
  updateSourceEditorVisibility();
  refreshSourceGeneratorMidiOutputs();
  sourceEditor.hidden = false;
  updateInspectorNavButtons();
  setConstraintStatus(`Editing source ${source.name}.`);
  revealEditor(sourceEditor);
}

async function handleSourceAudioFileChange() {
  const file = sourceAudioFileInput.files?.[0];
  if (!file) {
    return;
  }

  try {
    const dataUrl = await readFileAsDataUrl(file);
    pendingSourceAudioFile = {
      name: file.name,
      mimeType: file.type || "audio/*",
      dataUrl
    };
    sourceOutputTypeInput.value = SOURCE_BINDING_AUDIO_FILE;
    updateSourceEditorVisibility();
    sourceAudioFileName.textContent = `Selected: ${file.name}`;
  } catch (error) {
    pendingSourceAudioFile = null;
    sourceAudioFileName.textContent = "Could not read audio file.";
  }
}

function applySourceEditor() {
  if (!activeSourceEditorSource) {
    return;
  }

  const mass = Number(sourceMassInput.value);
  if (activeSourceEditorSource.dynamics && (!Number.isFinite(mass) || mass <= 0)) {
    setConstraintStatus("Mass must be finite and positive.");
    return;
  }
  const previousName = activeSourceEditorSource.name;
  const requestedName = sourceNameInput.value.trim();
  const renameProblem = sourceRenameProblem(activeSourceEditorSource, requestedName);

  if (renameProblem) {
    setConstraintStatus(renameProblem);
    return;
  }

  const [existingBinding] = sourceAudioClient.bindingsForSource(previousName);
  const audioFile = pendingSourceAudioFile || existingBinding;
  const outputType = sourceOutputTypeInput.value;
  if (outputType === SOURCE_BINDING_AUDIO_FILE && !audioFile?.dataUrl && !audioFile?.url) {
    setConstraintStatus(`Choose an audio file for ${requestedName}.`);
    return;
  }

  if (
    !editGeometry("edit source", () => {
      if (activeSourceEditorSource.dynamics) activeSourceEditorSource.dynamics.mass = mass;
      activeSourceEditorSource.name = requestedName;
      renameTrajectoryEndpointReferences(previousName, requestedName);
    })
  )
    return;
  renameSourceBindings(previousName, requestedName);
  const sourceName = activeSourceEditorSource.name;

  if (outputType === "none") {
    sourceAudioClient.removeBinding(sourceName);
    generatorClient.removeGenerator(sourceName);
    midiFileClient.removeTrackBinding(sourceName);
    pendingSourceAudioFile = null;
    sourceAudioFileName.textContent = "No sound assigned.";
    setConstraintStatus(`${sourceName} has no sound or generator binding.`);
    updatePatchInspector();
    drawAll();
    return;
  }

  if (outputType === SOURCE_OUTPUT_MIDI_OSTINATO || outputType === SOURCE_OUTPUT_ADDITIVE_SYNTH) {
    sourceAudioClient.removeBinding(sourceName);
    midiFileClient.removeTrackBinding(sourceName);
    const generator = generatorClient.upsertGenerator(sourceGeneratorFromEditor(sourceName));
    generatorClient.setMappingsForSource(sourceName, sourceGeneratorMappingsFromEditor());
    pendingSourceAudioFile = null;
    sourceAudioFileInput.value = "";
    const generatorLabel = outputType === SOURCE_OUTPUT_ADDITIVE_SYNTH ? "additive synth" : "MIDI ostinato";
    sourceAudioFileName.textContent = generator
      ? `${capitalize(generatorLabel)} generator assigned.`
      : `Could not create ${generatorLabel} generator.`;
    setConstraintStatus(
      generator
        ? `${sourceName} ${generatorLabel} updated.`
        : `${sourceName} ${generatorLabel} could not be updated.`
    );
    updatePatchInspector();
    drawAll();
    return;
  }

  if (outputType === SOURCE_OUTPUT_MIDI_FILE) {
    sourceAudioClient.removeBinding(sourceName);
    generatorClient.removeGenerator(sourceName);
    const updatedBinding = midiFileClient.updateTrackBinding(
      sourceName,
      sourceMidiFileBindingFromEditor(sourceName)
    );
    sourceAudioFileName.textContent = updatedBinding
      ? `MIDI file track: ${updatedBinding.track || "track"} · ch ${updatedBinding.channel || 1}`
      : "No MIDI file track assigned.";
    setConstraintStatus(
      updatedBinding
        ? `${sourceName} MIDI file track updated.`
        : `${sourceName} has no MIDI file track binding.`
    );
    updatePatchInspector();
    drawAll();
    return;
  }

  if (outputType !== activeSourceEditorInitialOutputType) {
    generatorClient.removeGenerator(sourceName);
  }
  midiFileClient.removeTrackBinding(sourceName);
  const gain = Number(sourceGainInput.value);
  sourceAudioClient.upsertBinding({
    source: sourceName,
    type: SOURCE_BINDING_AUDIO_FILE,
    name: audioFile.name || "Audio file",
    mimeType: audioFile.mimeType || "",
    dataUrl: audioFile.dataUrl || "",
    url: audioFile.url || "",
    loop: sourceLoopInput.checked,
    gain: Number.isFinite(gain) ? clamp(gain, 0, 2) : 1,
    muted: sourceMutedInput.checked,
    spatialization: sourceSpatializationInput.value || "pan-distance"
  });
  pendingSourceAudioFile = null;
  sourceAudioFileName.textContent = `Selected: ${audioFile.name || audioFile.url || "audio file"}`;
  setConstraintStatus(`${sourceName} sound binding updated.`);
  updatePatchInspector();
  drawAll();
}

function sourceRenameProblem(source, nextName) {
  if (!nextName) {
    return "Source name cannot be empty.";
  }
  if (nextName === "Listener") {
    return "Source name cannot be Listener.";
  }

  const existing = getObjectByName(nextName);
  if (existing && existing !== source) {
    return `Another object is already named ${nextName}.`;
  }

  return "";
}

function renameSourceBindings(previousName, nextName) {
  if (previousName === nextName) return;
  parameterClient.renameSource(previousName, nextName);
  sourceAudioClient.renameSource(previousName, nextName);
  midiFileClient.renameSource(previousName, nextName);
  generatorClient.renameSource(previousName, nextName);
}

function renameTrajectoryEndpointReferences(previousName, nextName) {
  for (const mover of state.movingObjects) {
    const trajectory = mover.trajectory;
    if (trajectory?.start?.type === "object" && trajectory.start.name === previousName) {
      trajectory.start = { ...trajectory.start, name: nextName };
    }
    if (trajectory?.end?.type === "object" && trajectory.end.name === previousName) {
      trajectory.end = { ...trajectory.end, name: nextName };
    }
  }
}

function removeSourceBindingFromEditor() {
  if (!activeSourceEditorSource) {
    return;
  }

  pushUndoSnapshot("remove source audio");
  sourceAudioClient.removeBinding(activeSourceEditorSource.name);
  generatorClient.removeGenerator(activeSourceEditorSource.name);
  pendingSourceAudioFile = null;
  sourceOutputTypeInput.value = "none";
  sourceMutedInput.checked = false;
  sourceAudioFileInput.value = "";
  sourceAudioFileName.textContent = "No sound assigned.";
  updateSourceEditorVisibility();
  setConstraintStatus(`${activeSourceEditorSource.name} sound binding or generator removed.`);
  updatePatchInspector();
  drawAll();
}

function closeSourceEditor() {
  sourceEditor.hidden = true;
  activeSourceEditorSource = null;
  activeSourceEditorInitialOutputType = "none";
  pendingSourceAudioFile = null;
  updateSourceOutputTypeOptions(false);
  updateInspectorNavButtons();
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => reject(reader.error || new Error("Could not read file.")));
    reader.readAsDataURL(file);
  });
}

function deleteSelectedEntity() {
  if (!selectedEntity) {
    setConstraintStatus("Select an object or constraint to delete.");
    return;
  }

  if (selectedEntity === state.listener) {
    setConstraintStatus("The listener cannot be deleted.");
    return;
  }

  const entity = selectedEntity;

  const constraintIndex = state.constraints.findIndex((constraint) => constraint.node === entity);
  if (constraintIndex >= 0) {
    const removed = state.constraints[constraintIndex];
    if (!editGeometry(`delete ${entityLabel(entity)}`, () => state.constraints.splice(constraintIndex, 1)))
      return;
    if (activeConstraintEditorConstraint === removed) {
      closeConstraintEditor();
    }
    selectedEntity = null;
    setConstraintStatus(`${removed.node.label} constraint deleted.`);
    drawAll();
    return;
  }

  if (
    !editGeometry(`delete ${entityLabel(entity)}`, () => {
      for (const mover of state.movingObjects)
        for (const key of ["start", "end"]) {
          if (mover.trajectory?.[key]?.type === "object" && mover.trajectory[key].name === entity.name)
            mover.trajectory[key] = { type: "fixed", x: entity.x, y: entity.y };
        }
      state.sources = state.sources.filter((source) => source !== entity);
      state.movingObjects = state.movingObjects.filter((mover) => mover !== entity);
      state.constraints = state.constraints.filter(
        (constraint) => !constraintReferencesEntity(constraint, entity)
      );
    })
  )
    return;
  parameterClient.setMappings(parameterClient.mappings().filter((mapping) => mapping.source !== entity.name));
  midiFileClient.removeTrackBinding(entity.name);

  if (activeRotationMover === entity) {
    closeRotationEditor();
  }
  if (activeShuttleMover === entity) {
    closeShuttleEditor();
  }
  if (activeSourceEditorSource === entity) {
    closeSourceEditor();
  }
  if (isViewKind(entity, "SoundSource")) {
    sourceAudioClient.removeBinding(entity.name);
    generatorClient.removeGenerator(entity.name);
  }
  sourceAudioClient.removeBindingsForMissingSources(state.sources.map((source) => source.name));
  generatorClient.removeGeneratorsForMissingSources(state.sources.map((source) => source.name));

  selectedEntity = null;
  pendingToolEntities = pendingToolEntities.filter((candidate) => candidate !== entity);
  setConstraintStatus(`${entityLabel(entity)} deleted.`);
  drawAll();
}

function nextSourceName() {
  const usedNames = new Set([...state.sources, ...state.movingObjects].map((object) => object.name));
  for (let index = 0; index < 26; index += 1) {
    const candidate = String.fromCharCode(65 + index);
    if (!usedNames.has(candidate)) {
      return candidate;
    }
  }
  let index = state.sources.length + 1;
  while (usedNames.has(`S${index}`)) index++;
  return `S${index}`;
}

function nextMoverName() {
  let index = state.movingObjects.length + 1;
  const usedNames = new Set([...state.sources, ...state.movingObjects].map((object) => object.name));
  while (usedNames.has(`M${index}`)) {
    index += 1;
  }
  return `M${index}`;
}

function getPointerPosition(event) {
  const view = canvasViewport();
  return {
    x: (event.clientX - view.rect.left - view.offsetX) / view.scaleX,
    y: (event.clientY - view.rect.top - view.offsetY) / view.scaleY
  };
}

function findEntityAt(x, y, pointerType = "mouse") {
  if (pointerType === "touch") {
    const view = canvasViewport();
    const entities = [
      state.listener,
      ...state.sources,
      ...state.movingObjects,
      ...state.constraints.map((constraint) => constraint.node)
    ];
    // Use screen pixels so a finger can grab a small object on a scaled canvas.
    // Nearest wins when the enlarged touch targets overlap.
    let nearest = null;
    let nearestDistance = Infinity;
    for (const entity of entities) {
      const distance = Math.hypot((entity.x - x) * view.scaleX, (entity.y - y) * view.scaleY);
      if ((distance <= 22 || containsPoint(entity, x, y)) && distance < nearestDistance) {
        nearest = entity;
        nearestDistance = distance;
      }
    }
    return nearest;
  }
  if (containsPoint(state.listener, x, y)) {
    return state.listener;
  }

  for (const source of state.sources) {
    if (containsPoint(source, x, y)) {
      return source;
    }
  }

  for (const mover of state.movingObjects) {
    if (containsPoint(mover, x, y)) {
      return mover;
    }
  }

  for (const constraint of state.constraints) {
    if (containsPoint(constraint.node, x, y)) {
      return constraint.node;
    }
  }

  return null;
}

function findDoubleClickEntityAt(x, y) {
  for (const mover of state.movingObjects) {
    const trajectoryType = mover.trajectory?.type;
    if ((trajectoryType === "rotator" || trajectoryType === "shuttle") && containsPoint(mover, x, y)) {
      return mover;
    }
  }

  return findEntityAt(x, y);
}

function isRepeatedCanvasClick(event, x, y, entity) {
  if (!lastCanvasClick || !entity || lastCanvasClick.entity !== entity) {
    return false;
  }

  return (
    event.timeStamp - lastCanvasClick.time <= DOUBLE_CLICK_MS &&
    Math.hypot(x - lastCanvasClick.x, y - lastCanvasClick.y) <= canvasClickDistance(event)
  );
}

function canvasClickDistance(event) {
  return event.pointerType === "touch" ? 22 / canvasViewport().scaleX : DOUBLE_CLICK_DISTANCE;
}

function handleEntityDoubleClick(entity) {
  if (isViewKind(entity, "MovingObject") && entity.trajectory?.type === "rotator") {
    openRotationEditor(entity);
    selectedEntity = entity;
    drawAll();
    return true;
  }

  if (isViewKind(entity, "MovingObject") && entity.trajectory?.type === "shuttle") {
    openShuttleEditor(entity);
    selectedEntity = entity;
    drawAll();
    return true;
  }

  if (isViewKind(entity, "MovingObject")) {
    setConstraintStatus("Use Spin to convert this mover into a rotative object.");
    return true;
  }

  if (isViewKind(entity, "SoundSource")) {
    openSourceEditor(entity);
    selectedEntity = entity;
    drawAll();
    return true;
  }

  if (entity === state.listener) {
    openListenerEditor();
    selectedEntity = state.listener;
    drawAll();
    return true;
  }

  const constraint = findConstraintForNode(entity);
  if (constraint) {
    openConstraintEditor(constraint);
    selectedEntity = constraint.node;
    drawAll();
    return true;
  }

  return false;
}

function moveEntity(entity, x, y, options) {
  scene.moveEntity(entity, x, y, {
    ...options,
    bounds: isCanvasFullscreen ? canvasViewport() : null
  });
  drawTracesForChangedEntities();
  drawAll();
}

function resumePropagationAfterPausedDrag() {
  scene.resumePropagationAfterPausedDrag();
  setConstraintStatus("Propagation resumed; constraints retargeted to paused positions.");
}

function setConstraintStatus(message) {
  constraintStatus.textContent = message;
}

function setListenerMode(nextMode) {
  state.listenerMode = nextMode;
  listenerModeRetargetButton.setAttribute(
    "aria-pressed",
    String(state.listenerMode === LISTENER_MODE_RETARGET)
  );
  listenerModePreserveButton.setAttribute(
    "aria-pressed",
    String(state.listenerMode === LISTENER_MODE_PRESERVE)
  );
}

function setAnimationPressedState(isPressed) {
  animationToggle.setAttribute("aria-pressed", String(isPressed));
  animationToggle.classList.toggle("is-playing", isPressed);
  updateToolbarAvailability();
}

function updateTraceSelectedButton() {
  const canTrace = selectedEntity && selectedEntity !== null;
  traceSelectedButton.disabled = !canTrace;
  traceSelectedButton.setAttribute("aria-pressed", String(Boolean(selectedEntity?.drawTrace)));
}

function toggleSelectedSourceMute() {
  if (!isViewKind(selectedEntity, "SoundSource")) {
    setConstraintStatus("Select a source to mute or unmute.");
    return;
  }

  const [binding] = sourceAudioClient.bindingsForSource(selectedEntity.name);
  const [generator] = generatorClient.generatorsForSource(selectedEntity.name);
  if (!binding && !generator) {
    setConstraintStatus(`${selectedEntity.name} has no sound binding or generator to mute.`);
    return;
  }

  pushUndoSnapshot(`toggle mute for ${selectedEntity.name}`);
  const updated = binding
    ? sourceAudioClient.toggleSourceMuted(selectedEntity.name)
    : generatorClient.toggleSourceMuted(selectedEntity.name);
  if (!updated) {
    setConstraintStatus(`${selectedEntity.name} has no sound binding or generator to mute.`);
    return;
  }

  if (activeSourceEditorSource === selectedEntity) {
    sourceMutedInput.checked = Boolean(updated.muted);
  }
  setConstraintStatus(`${selectedEntity.name} ${updated.muted ? "muted" : "unmuted"}.`);
  updatePatchInspector();
  drawAll();
}

function toggleSelectedTrace() {
  if (!selectedEntity) {
    setConstraintStatus("Select an object to toggle drawing.");
    updateTraceSelectedButton();
    return;
  }

  pushUndoSnapshot(`toggle drawing for ${entityLabel(selectedEntity)}`);
  selectedEntity.drawTrace = !selectedEntity.drawTrace;
  selectedEntity.prevX = selectedEntity.x;
  selectedEntity.prevY = selectedEntity.y;
  updateTraceSelectedButton();
  setConstraintStatus(`${entityLabel(selectedEntity)} drawing ${selectedEntity.drawTrace ? "on" : "off"}.`);
}

function stopAllDrawing() {
  const traceableEntities = getTraceableEntities();
  const enabledCount = traceableEntities.filter((entity) => entity.drawTrace).length;
  if (enabledCount === 0) {
    setConstraintStatus("No objects are drawing.");
    updateTraceSelectedButton();
    return;
  }

  pushUndoSnapshot("stop all drawing");
  for (const entity of traceableEntities) {
    entity.drawTrace = false;
    entity.prevX = entity.x;
    entity.prevY = entity.y;
  }
  updateTraceSelectedButton();
  setConstraintStatus(`Drawing stopped for ${enabledCount} object${enabledCount === 1 ? "" : "s"}.`);
}

function syncTracePositions() {
  for (const entity of getTraceableEntities()) {
    entity.prevX = entity.x;
    entity.prevY = entity.y;
  }
}

function getTraceableEntities() {
  return [
    state.listener,
    ...state.sources,
    ...state.movingObjects,
    ...state.constraints.map((constraint) => constraint.node)
  ].filter(Boolean);
}

function drawTracesForChangedEntities() {
  for (const entity of getTraceableEntities()) {
    if (entity.prevX === undefined || entity.prevY === undefined) {
      entity.prevX = entity.x;
      entity.prevY = entity.y;
    }

    const distance = Math.hypot(entity.x - entity.prevX, entity.y - entity.prevY);
    if (distance > 0.25 && entity.drawTrace) {
      drawTraceSegment(entity, entity.x, entity.y, traceColorForEntity(entity));
    } else {
      entity.prevX = entity.x;
      entity.prevY = entity.y;
    }
  }
}

function drawTraceSegment(entity, nextX = entity.x, nextY = entity.y, color = traceColorForEntity(entity)) {
  configureCanvasResolution();
  if (entity.prevX === undefined || entity.prevY === undefined) {
    entity.prevX = entity.x;
    entity.prevY = entity.y;
  }

  traceCtx.beginPath();
  traceCtx.moveTo(entity.prevX, entity.prevY);
  traceCtx.lineTo(nextX, nextY);
  traceCtx.strokeStyle = color;
  traceCtx.lineWidth = 2;
  traceCtx.stroke();

  entity.prevX = nextX;
  entity.prevY = nextY;
}

function traceColorForEntity(entity) {
  if (isViewKind(entity, "MovingObject")) {
    return "rgba(8, 145, 178, 0.45)";
  }

  if (isViewKind(entity, "ConstraintNode")) {
    return "rgba(124, 58, 237, 0.45)";
  }

  if (entity === state.listener) {
    return "rgba(17, 24, 39, 0.45)";
  }

  return "rgba(220, 38, 38, 0.45)";
}

function stepAnimation(dt) {
  scene.step(dt);
  drawTracesForChangedEntities();
}

function animate(timestamp) {
  if (!isAnimating) return;
  if (document.hidden) {
    simulationClock.reset();
  } else {
    simulationClock.advance(timestamp, stepAnimation);
    drawAll();
  }
  animationFrame = requestAnimationFrame(animate);
}

function startAnimation() {
  if (isAnimating) {
    return;
  }

  if (!patchHasMovers()) {
    setConstraintStatus("This patch has no movers or dynamics to animate.");
    updateToolbarAvailability();
    return;
  }

  simulationClock.reset();
  isAnimating = true;
  animationToggle.textContent = scene.hasDynamics() ? "Stop Motion" : "Stop Movers";
  setAnimationPressedState(true);
  syncTracePositions();
  animationFrame = requestAnimationFrame(animate);
}

function stopAnimation() {
  isAnimating = false;
  simulationClock.reset();
  animationToggle.textContent = scene.hasDynamics() ? "Start Motion" : "Start Movers";
  setAnimationPressedState(false);

  if (animationFrame !== null) {
    cancelAnimationFrame(animationFrame);
    animationFrame = null;
  }
}

function toggleAnimation() {
  if (isAnimating) {
    stopAnimation();
  } else {
    startAnimation();
  }
}

function clearTrace() {
  configureCanvasResolution();
  clearCanvasSurface(traceCtx, traceCanvas);
  syncTracePositions();
}

function saveTrace() {
  const link = document.createElement("a");
  link.download = "musicspace_trace.png";
  link.href = traceCanvas.toDataURL("image/png");
  link.click();
}

function savePatch() {
  const patch = serializePatch();
  const link = document.createElement("a");
  const blob = new Blob([JSON.stringify(patch, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  link.download = `${slugify(patch.name || "musicspace-patch")}.json`;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}

function slugify(value) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "musicspace-patch"
  );
}

function loadPatchFile(file) {
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const patch = JSON.parse(reader.result);
      patch.name = patch.name || file.name.replace(/\.json$/i, "");
      if (loadPatch(patch, { preserveAsActive: true, clearUndo: true })) {
        stopAnimation();
        patchSelect.value = "";
      }
    } catch (error) {
      setConstraintStatus("Could not load patch JSON.");
    }
  });
  reader.readAsText(file);
}

function togglePatchJsonEditor() {
  openPatchInspector();
  const isOpening = patchJsonEditor.hidden;
  patchJsonEditor.hidden = !isOpening;
  setPatchJsonPressedState(isOpening);

  if (isOpening) {
    const patch = currentPatchSnapshot();
    patchJsonTextarea.value = patch ? JSON.stringify(patch, null, 2) : "";
    patchJsonTextarea.focus();
  }
}

function openPatchInspector() {
  patchInspector.hidden = false;
  setPatchInspectorPressedState(true);
  updatePatchInspector({ refreshJson: false });
}

function closePatchInspector() {
  patchInspector.hidden = true;
  setPatchInspectorPressedState(false);
  patchJsonEditor.hidden = true;
  setPatchJsonPressedState(false);
}

function setPatchInspectorPressedState(isPressed) {
  patchInspectorToggle.setAttribute("aria-pressed", String(isPressed));
  patchInspectorInlineToggle.setAttribute("aria-pressed", String(isPressed));
}

function setPatchJsonPressedState(isPressed) {
  patchJsonToggle.setAttribute("aria-pressed", String(isPressed));
  patchJsonInlineToggle.setAttribute("aria-pressed", String(isPressed));
}

function togglePatchInspector() {
  if (patchInspector.hidden) {
    openPatchInspector();
  } else {
    closePatchInspector();
  }
}

function validatePatchEditor() {
  const patch = patchJsonEditor.hidden ? currentPatchSnapshot() : parsePatchJsonEditor();
  if (!patch) {
    return;
  }
  renderPatchValidation(validatePatch(patch));
}

function applyPatchJsonEditor() {
  const patch = parsePatchJsonEditor();
  if (!patch) {
    return;
  }

  patch.name = patch.name || "Edited Patch";
  if (!patch.key || builtInPatches.some((candidate) => candidate.key === patch.key)) {
    patch.key = `edited-${slugify(patch.name)}-${Date.now()}`;
  }

  const previous = clonePatch(serializePatch());
  if (!loadPatch(clonePatch(patch), { preserveAsActive: true, clearUndo: false })) return;
  undoStack.push({ reason: "edit patch JSON", patch: previous });
  if (undoStack.length > 60) undoStack.shift();
  updateUndoStatus();
  stopAnimation();
  selectPatchOptionForPatch(patch);
  patchJsonTextarea.value = JSON.stringify(currentPatchSnapshot(), null, 2);
  setConstraintStatus("Patch JSON applied.");
}

function focusCanvasWithoutScrolling() {
  try {
    canvas.focus({ preventScroll: true });
  } catch (error) {
    canvas.focus();
  }
}

function parsePatchJsonEditor() {
  try {
    return JSON.parse(patchJsonTextarea.value);
  } catch (error) {
    renderPatchValidation([{ level: "error", message: "Patch JSON could not be parsed." }]);
    return null;
  }
}

function updateHoverState(entity) {
  hoveredEntity = entity;
  canvas.style.cursor = activeTool === TOOL_SELECT ? (hoveredEntity ? "grab" : "default") : "crosshair";
}

function beginDrag(event) {
  if (dragged || event.isPrimary === false) return;
  const { x, y } = getPointerPosition(event);
  const entity = findEntityAt(x, y, event.pointerType);
  const doubleClickEntity = event.pointerType === "touch" ? entity : findDoubleClickEntityAt(x, y);

  if (activeTool !== TOOL_SELECT) {
    lastCanvasClick = null;
    handleToolClick(x, y, entity);
    event.preventDefault();
    return;
  }

  if (!entity) {
    lastCanvasClick = null;
    selectedEntity = null;
    drawAll();
    return;
  }

  if (isRepeatedCanvasClick(event, x, y, doubleClickEntity) && handleEntityDoubleClick(doubleClickEntity)) {
    lastCanvasClick = null;
    event.preventDefault();
    return;
  }

  focusCanvasWithoutScrolling();
  selectedEntity = entity;
  dragged = {
    entity,
    pointerId: event.pointerId,
    offsetX: x - entity.x,
    offsetY: y - entity.y,
    startX: x,
    startY: y,
    dragThreshold: event.pointerType === "touch" ? 6 / canvasViewport().scaleX : 2,
    doubleClickEntity,
    didSnapshot: false,
    skipPropagation: false
  };
  scene.beginDrag(entity);
  if (scene.hasDynamics()) startAnimation();
  stage.classList.add("is-dragging");
  canvas.style.cursor = "grabbing";
  canvas.setPointerCapture(event.pointerId);
  event.preventDefault();
  drawAll();
}

function continueDrag(event) {
  if (!dragged || event.pointerId !== dragged.pointerId) {
    const { x, y } = getPointerPosition(event);
    updateHoverState(findEntityAt(x, y));
    return;
  }

  const { x, y } = getPointerPosition(event);
  const dragDistance = Math.hypot(x - dragged.startX, y - dragged.startY);
  if (!dragged.didSnapshot && dragDistance <= dragged.dragThreshold) {
    return;
  }

  if (!dragged.didSnapshot && dragDistance > dragged.dragThreshold) {
    pushUndoSnapshot(`move ${entityLabel(dragged.entity)}`);
    if (state.constraints.some((constraint) => constraint.node === dragged.entity)) {
      dragged.entity.isManual = true;
    }
    dragged.didSnapshot = true;
  }
  dragged.skipPropagation = dragged.skipPropagation || event.shiftKey;
  moveEntity(dragged.entity, x - dragged.offsetX, y - dragged.offsetY, {
    skipPropagation: dragged.skipPropagation
  });
}

function endDrag(event) {
  if (!dragged || event.pointerId !== dragged.pointerId) {
    return;
  }

  const clickEntity = dragged.doubleClickEntity || dragged.entity;
  const wasClick = !dragged.didSnapshot;
  const releasedEntity = dragged.entity;
  const startX = dragged.startX;
  const startY = dragged.startY;
  const wasPropagationPaused = state.propagationPaused;

  if (canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }

  scene.endDrag({ refine: !wasClick && !wasPropagationPaused });
  stage.classList.remove("is-dragging");
  dragged = null;
  const { x, y } = getPointerPosition(event);
  if (
    event.type === "pointerup" &&
    wasClick &&
    Math.hypot(x - startX, y - startY) <= canvasClickDistance(event)
  ) {
    lastCanvasClick = {
      entity: clickEntity,
      time: event.timeStamp,
      x,
      y
    };
  } else {
    lastCanvasClick = null;
  }
  updateHoverState(findEntityAt(x, y));
  if (wasPropagationPaused) {
    resumePropagationAfterPausedDrag();
  } else {
    state.propagationPaused = false;
  }
  if (!wasClick && !wasPropagationPaused && refineXpbdAfterDrag(releasedEntity)) {
    drawTracesForChangedEntities();
    drawAll();
  }
  if (wasPropagationPaused) {
    drawAll();
  }
}

canvas.addEventListener("pointerdown", beginDrag);

canvas.addEventListener("pointermove", continueDrag);

canvas.addEventListener("pointerup", endDrag);

canvas.addEventListener("pointercancel", endDrag);
canvas.addEventListener("lostpointercapture", endDrag);

canvas.addEventListener("pointerleave", () => {
  if (!dragged) {
    updateHoverState(null);
  }
});

globalThis.addEventListener?.("resize", () => {
  if (configureCanvasResolution()) {
    drawAll();
  }
});

canvas.addEventListener("dblclick", (event) => {
  const { x, y } = getPointerPosition(event);
  const entity = findDoubleClickEntityAt(x, y);

  if (handleEntityDoubleClick(entity)) {
    lastCanvasClick = null;
    event.preventDefault();
  }
});

canvas.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && isCanvasFullscreen) {
    exitCanvasFullscreen();
    event.preventDefault();
    return;
  }

  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
    undoLastEdit();
    event.preventDefault();
    return;
  }

  if (event.key === "Backspace" || event.key === "Delete") {
    deleteSelectedEntity();
    event.preventDefault();
    return;
  }

  if (!event.metaKey && !event.ctrlKey && !event.altKey && event.key.toLowerCase() === "m") {
    toggleSelectedSourceMute();
    event.preventDefault();
    return;
  }

  if (
    !event.metaKey &&
    !event.ctrlKey &&
    !event.altKey &&
    event.shiftKey &&
    (event.key === " " || event.key === "Spacebar")
  ) {
    toggleAnimation();
    event.preventDefault();
    return;
  }

  if (
    !event.metaKey &&
    !event.ctrlKey &&
    !event.altKey &&
    !event.shiftKey &&
    (event.key === " " || event.key === "Spacebar")
  ) {
    toggleSoundOutput();
    event.preventDefault();
    return;
  }

  const directions = {
    ArrowUp: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 },
    ArrowLeft: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 }
  };
  const direction = directions[event.key];

  if (!direction) {
    return;
  }

  const entity = selectedEntity || state.listener;
  const step = event.shiftKey ? 10 : 4;
  pushUndoSnapshot(`nudge ${entityLabel(entity)}`);
  selectedEntity = entity;
  moveEntity(entity, entity.x + direction.x * step, entity.y + direction.y * step);
  event.preventDefault();
});

globalThis.addEventListener?.("keydown", (event) => {
  if (event.key === "Escape" && isCanvasFullscreen) {
    exitCanvasFullscreen();
    event.preventDefault();
  }
});

document.addEventListener?.("fullscreenchange", handleDocumentFullscreenChange);

for (const button of toolButtons) {
  button.addEventListener("click", () => {
    handleToolButtonClick(button.dataset.tool);
  });
}

uiModePlayButton.addEventListener("click", () => setUiMode(UI_MODE_PLAY));

uiModeEditButton.addEventListener("click", () => setUiMode(UI_MODE_EDIT));

animationToggle.addEventListener("click", toggleAnimation);

targetToggleButton.addEventListener("click", () => {
  toggleSoundOutput();
});

traceSelectedButton.addEventListener("click", toggleSelectedTrace);

traceNoneButton.addEventListener("click", stopAllDrawing);

listenerModeRetargetButton.addEventListener("click", () => {
  setListenerMode(LISTENER_MODE_RETARGET);
  if (!listenerEditor.hidden) {
    setConstraintStatus("Listener drag mode: re-anchor constraints to the new geometry.");
    drawAll();
  }
});

listenerModePreserveButton.addEventListener("click", () => {
  setListenerMode(LISTENER_MODE_PRESERVE);
  if (!listenerEditor.hidden) {
    setConstraintStatus("Listener drag mode: preserve current constraints while moving.");
    drawAll();
  }
});

solverModePropagationButton.addEventListener("click", () => {
  setSolverMode(SOLVER_MODE_PROPAGATION, { updateUrl: true });
});

solverModeXpbdButton.addEventListener("click", () => {
  setSolverMode(SOLVER_MODE_XPBD, { updateUrl: true });
});

patchSelect.addEventListener("change", () => {
  stopAnimation();
  loadMenuPatch(patchSelect.value, { clearUndo: true });
});

savePatchButton.addEventListener("click", savePatch);

loadPatchButton.addEventListener("click", () => {
  patchFileInput.click();
});

patchFileInput.addEventListener("change", () => {
  loadPatchFile(patchFileInput.files[0]);
  patchFileInput.value = "";
});

patchJsonToggle.addEventListener("click", togglePatchJsonEditor);

patchInspectorInlineToggle.addEventListener("click", togglePatchInspector);

patchJsonInlineToggle.addEventListener("click", togglePatchJsonEditor);

patchJsonApplyButton.addEventListener("click", applyPatchJsonEditor);

patchInspectorToggle.addEventListener("click", togglePatchInspector);

patchInspectorClose.addEventListener("click", closePatchInspector);

patchValidateButton.addEventListener("click", validatePatchEditor);

patchMappingAddButton.addEventListener("click", () => addPatchMappingRow());

patchMappingApplyButton.addEventListener("click", applyPatchMappingsEditor);

midiLoadSequenceButton.addEventListener("click", () => {
  midiSequenceFileInput.click();
});

midiSequenceFileInput.addEventListener("change", async () => {
  const file = midiSequenceFileInput.files[0];
  midiSequenceFileInput.value = "";
  if (!file) {
    return;
  }

  try {
    stopAnimation();
    const patch = await MusicSpaceMidiFileClient.createPatchFromSequenceFile(file);
    selectPatchOptionForPatch(patch);
    loadPatch(patch, { preserveAsActive: true, clearUndo: true });
  } catch (error) {
    setConstraintStatus(error.message || "Could not load MIDI/MusicXML file.");
  }
});

clearTraceButton.addEventListener("click", clearTrace);

saveTraceButton.addEventListener("click", saveTrace);

resetButton.addEventListener("click", () => {
  stopAnimation();
  resetScene();
});

fullscreenToggleButton.addEventListener("click", toggleCanvasFullscreen);
canvasFullscreenButton.addEventListener("click", toggleCanvasFullscreen);
mobileToolsButton.addEventListener("click", () => {
  const expanded = mobileToolsButton.getAttribute("aria-expanded") !== "true";
  mobileToolsButton.setAttribute("aria-expanded", String(expanded));
  document.body.classList.toggle("mobile-tools-open", expanded);
});

rotationApplyButton.addEventListener("click", applyRotationEditor);

rotationCloseButton.addEventListener("click", closeRotationEditor);

shuttleApplyButton.addEventListener("click", applyShuttleEditor);

shuttleCloseButton.addEventListener("click", closeShuttleEditor);

rotationPrevButton.addEventListener("click", () => navigateInspector(-1));

rotationNextButton.addEventListener("click", () => navigateInspector(1));

shuttlePrevButton.addEventListener("click", () => navigateInspector(-1));

shuttleNextButton.addEventListener("click", () => navigateInspector(1));

constraintPrevButton.addEventListener("click", () => navigateInspector(-1));

constraintNextButton.addEventListener("click", () => navigateInspector(1));

constraintRecaptureButton.addEventListener("click", recaptureConstraintFromGeometry);

constraintApplyButton.addEventListener("click", applyConstraintEditor);

constraintCloseButton.addEventListener("click", closeConstraintEditor);

sourceAudioFileInput.addEventListener("change", handleSourceAudioFileChange);

sourceOutputTypeInput.addEventListener("change", () => {
  updateSourceEditorVisibility();
  refreshSourceGeneratorMidiOutputs();
  if (sourceOutputTypeInput.value === SOURCE_OUTPUT_MIDI_OSTINATO) {
    sourceAudioFileName.textContent = "MIDI ostinato generator assigned.";
  } else if (sourceOutputTypeInput.value === SOURCE_OUTPUT_ADDITIVE_SYNTH) {
    sourceAudioFileName.textContent = "Additive synth generator assigned.";
  } else if (sourceOutputTypeInput.value === SOURCE_OUTPUT_MIDI_FILE) {
    sourceAudioFileName.textContent = "MIDI file track assigned.";
  } else if (sourceOutputTypeInput.value === "none") {
    sourceAudioFileName.textContent = "No sound assigned.";
  }
});

sourceGeneratorOutputModeInput.addEventListener("change", () => {
  updateSourceEditorVisibility();
  refreshSourceGeneratorMidiOutputs();
});

sourceGeneratorMappingAddButton.addEventListener("click", () => {
  addSourceGeneratorMappingRow();
});

sourceApplyButton.addEventListener("click", applySourceEditor);

sourcePrevButton.addEventListener("click", () => navigateInspector(-1));

sourceNextButton.addEventListener("click", () => navigateInspector(1));

sourceToggleMuteButton.addEventListener("click", toggleSelectedSourceMute);

sourceRemoveBindingButton.addEventListener("click", removeSourceBindingFromEditor);

sourceCloseButton.addEventListener("click", closeSourceEditor);

listenerApplyButton.addEventListener("click", applyListenerEditor);

listenerPrevButton.addEventListener("click", () => navigateInspector(-1));

listenerNextButton.addEventListener("click", () => navigateInspector(1));

listenerCloseButton.addEventListener("click", closeListenerEditor);

async function initializeApp() {
  patchSelect.disabled = true;
  patchSelect.replaceChildren();
  const loadingOption = document.createElement("option");
  loadingOption.textContent = "Loading patches...";
  patchSelect.append(loadingOption);

  setActiveTool(TOOL_SELECT);
  setUiMode(UI_MODE_PLAY);
  setListenerMode(LISTENER_MODE_RETARGET);
  state.solverMode = getInitialSolverMode();
  updateSolverIndicator();
  updateSoundToggleButton();

  try {
    if (usePackageEngine) {
      const notice = document.getElementById("package-engine-notice");
      notice.hidden = false;
      try {
        await scene.initialize();
      } catch (error) {
        document.getElementById("package-engine-message").textContent =
          "Package unavailable. Run npm run build --prefix packages/musicspace-engine, then reload.";
        loadingOption.textContent = "Package engine unavailable";
        uiModeEditButton.disabled = true;
        for (const button of toolButtons) button.disabled = true;
        canvas.style.pointerEvents = "none";
        canvas.tabIndex = -1;
        resetButton.disabled = true;
        setConstraintStatus(error.message);
        return;
      }
    }
    await loadBuiltInPatchLibrary();
    populatePatchSelect();
    patchSelect.disabled = false;
    const initialKey = new URL(window.location.href).searchParams.get("patch");
    activePatch = clonePatch(builtInPatches.find((patch) => patch.key === initialKey) || builtInPatches[0]);
    patchSelect.value = activePatch.key;
    resetScene();
  } catch (error) {
    console.error(error);
    patchSelect.replaceChildren();
    const errorOption = document.createElement("option");
    errorOption.textContent = "Patch JSON unavailable";
    patchSelect.append(errorOption);
    setConstraintStatus(
      `Could not load built-in patch JSON: ${error.message}. Serve this directory over HTTP, then reload.`
    );
  }
}

initializeApp();

// Generated from MusicSpace's shared sources. MIT license.
const api = (() => {
const modules = {"./musicspace-constants": function(module, exports, require) {
// Shared model units and bounded solver defaults.
(function exposeConstants(global) {
  const WIDTH = 800;
  const HEIGHT = 600;
  const LISTENER_MODE_RETARGET = "retarget";
  const LISTENER_MODE_PRESERVE = "preserve";
  const MIN_DISTANCE = 2;
  const CONSTRAINT_EPSILON = 0.5;
  const PRODUCT_EPSILON = 0.01;
  const MAX_PROPAGATION_STEPS = 96;
  const MAX_ENTITY_PROPAGATION_COUNT = 8;
  const SOLVER_MODE_PROPAGATION = "propagation";
  const SOLVER_MODE_XPBD = "xpbd";
  const DEFAULT_SOLVER_MODE = SOLVER_MODE_PROPAGATION;
  const XPBD_ITERATIONS_DRAG = 10;
  const XPBD_ITERATIONS_RELEASE = 40;
  const MAX_XPBD_COMPONENT_ENTITIES = 48;
  const MAX_XPBD_COMPONENT_CONSTRAINTS = 96;
  const ANGLE_EPSILON = 0.01;
  const RATIO_EPSILON = 0.01;
  const RELATIVE_PRODUCT_EPSILON = 0.001;
  const FRAMES_PER_SECOND = 60;
  const api = {
    WIDTH,
    HEIGHT,
    LISTENER_MODE_RETARGET,
    LISTENER_MODE_PRESERVE,
    MIN_DISTANCE,
    CONSTRAINT_EPSILON,
    PRODUCT_EPSILON,
    MAX_PROPAGATION_STEPS,
    MAX_ENTITY_PROPAGATION_COUNT,
    SOLVER_MODE_PROPAGATION,
    SOLVER_MODE_XPBD,
    DEFAULT_SOLVER_MODE,
    XPBD_ITERATIONS_DRAG,
    XPBD_ITERATIONS_RELEASE,
    MAX_XPBD_COMPONENT_ENTITIES,
    MAX_XPBD_COMPONENT_CONSTRAINTS,
    ANGLE_EPSILON,
    RATIO_EPSILON,
    RELATIVE_PRODUCT_EPSILON,
    FRAMES_PER_SECOND
  };
  if (typeof module === "object" && module.exports) module.exports = api;
  else global.MusicSpaceConstants = api;
})(globalThis);

},
"./musicspace-patch": function(module, exports, require) {
// Patch validation is independent of the browser and output runtimes.
(function exposePatch(global) {
  function createPatchTools(options = {}) {
    const SOURCE_BINDING_AUDIO_FILE = "audio-file";
    const SOURCE_OUTPUT_MIDI_OSTINATO = "midi-ostinato";
    const SOURCE_OUTPUT_ADDITIVE_SYNTH = "additive-synth";
    const SOURCE_GENERATOR_MAPPING_PARAMETERS = [
      "pitch",
      "periodMs",
      "durationMs",
      "velocity",
      "channel",
      "frequencyHz",
      "gain"
    ];
    function validatePatch(patch) {
      const findings = [];
      const add = (level, message) => findings.push({ level, message });

      if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
        add("error", "Patch is not a JSON object.");
        return findings;
      }

      if (!patch.listener || !isFinitePoint(patch.listener)) {
        add("error", "Patch needs a listener with finite x/y coordinates.");
      }

      if (patch.version !== undefined && patch.version !== 1)
        add("error", "Unsupported patch version; expected 1.");
      if (patch.gravity !== undefined && !isFinitePoint(patch.gravity))
        add("error", "Gravity needs finite x/y coordinates.");
      const scene = validateSceneObjects(patch, add);
      validateTrajectories(patch.movingObjects, scene.names, add);
      validateConstraintSpecs(patch.constraints || [], scene.names, add);
      validateBackendSpec(patch, add);
      validateSourceBindings(patch.sourceBindings || [], scene.names, add);
      validateSourceGenerators(patch.sourceGenerators || [], scene.names, add);
      validateSourceGeneratorMappings(patch.sourceGeneratorMappings || [], scene.names, add);
      validateParameterMappings(
        patch.parameterMappings || patch.audioMappings || [],
        scene.names,
        patch.target || patch.audioSynth,
        add
      );
      validateMidiSpec(patch.midiFile, scene.names, patch.target || patch.audioSynth, add);

      if (!findings.some((finding) => finding.level === "error" || finding.level === "warning")) {
        add(
          "ok",
          "Patch structure, references, constraints, source bindings, generators, mappings, and backend declaration look coherent."
        );
      }

      return findings;
    }

    function validateSceneObjects(patch, add) {
      const names = new Set(["Listener"]);
      const seen = new Set(["Listener"]);

      validateObjectArray(patch.sources, "source", names, seen, add);
      validateObjectArray(patch.movingObjects || [], "moving object", names, seen, add);

      if (!Array.isArray(patch.sources)) {
        add("error", "Patch sources must be an array.");
      }

      return { names };
    }

    function validateTrajectories(movers, names, add) {
      if (!Array.isArray(movers)) return;
      for (const mover of movers) {
        const trajectory = mover?.trajectory;
        if (trajectory === undefined) continue;
        if (!trajectory || typeof trajectory !== "object" || Array.isArray(trajectory)) {
          add("error", "Mover trajectory must be an object.");
          continue;
        }
        if (
          trajectory.type &&
          !["free", "rotation", "rotator", "translation", "bounce", "shuttle"].includes(trajectory.type)
        )
          add("error", `Unknown trajectory: ${trajectory.type}.`);
        for (const field of [
          "vx",
          "vy",
          "centerX",
          "centerY",
          "radius",
          "phase",
          "angularSpeed",
          "periodSeconds",
          "direction",
          "ax",
          "ay",
          "bx",
          "by",
          "speed"
        ]) {
          if (trajectory[field] !== undefined) validateNumber(trajectory[field], `trajectory.${field}`, add);
        }
        if (trajectory.periodSeconds !== undefined && trajectory.periodSeconds <= 0)
          add("error", "Trajectory periodSeconds must be positive.");
        for (const endpoint of [trajectory.start, trajectory.end]) {
          if (!endpoint) continue;
          if (endpoint.type === "object") validateReference(endpoint.name, "trajectory endpoint", names, add);
          else if (!isFinitePoint(endpoint))
            add("error", "Fixed trajectory endpoint needs finite coordinates.");
        }
      }
    }

    function validateObjectArray(objects, label, names, seen, add) {
      if (!Array.isArray(objects)) {
        add("error", `Patch ${label}s must be an array.`);
        return;
      }

      for (const object of objects) {
        if (!object || typeof object.name !== "string" || object.name.trim() === "") {
          add("error", `Every ${label} needs a non-empty name.`);
          continue;
        }
        if (seen.has(object.name)) {
          add("error", `Duplicate scene object name: ${object.name}.`);
        }
        if (!isFinitePoint(object)) {
          add("error", `${capitalize(label)} ${object.name} needs finite x/y coordinates.`);
        }
        if (object.dynamics !== undefined) {
          const body = object.dynamics;
          if (!body || typeof body !== "object" || Array.isArray(body))
            add("error", "Object dynamics must be an object.");
          else {
            if (body.mass !== undefined && (!Number.isFinite(body.mass) || body.mass <= 0))
              add("error", "Dynamics mass must be finite and positive.");
            for (const field of ["vx", "vy"])
              if (body[field] !== undefined && !Number.isFinite(body[field]))
                add("error", `Dynamics ${field} must be finite.`);
          }
        }
        seen.add(object.name);
        names.add(object.name);
      }
    }

    function validateConstraintSpecs(constraints, names, add) {
      if (!Array.isArray(constraints)) {
        add("error", "Patch constraints must be an array.");
        return;
      }

      for (const spec of constraints) {
        if (!spec || typeof spec.type !== "string") {
          add("error", "Every constraint needs a type.");
          continue;
        }

        for (const field of ["angle", "totalDistance", "product", "offsetX", "offsetY"]) {
          if (spec[field] !== undefined) validateNumber(spec[field], `constraint.${field}`, add);
        }
        if (spec.node && !isFinitePoint(spec.node))
          add("error", "Constraint node needs finite x/y coordinates.");
        if (spec.type === "angle") {
          validateNamedList(spec.sources, 2, spec.type, names, add);
        } else if (spec.type === "sum" || spec.type === "product") {
          validateNamedList(spec.sources, 2, spec.type, names, add);
        } else if (spec.type === "radialLimit") {
          validateReference(spec.source, "radialLimit.source", names, add);
          validateMinMax(spec.minDistance, spec.maxDistance, "radialLimit distance", add);
        } else if (spec.type === "spring") {
          validateReference(spec.anchor, "spring.anchor", names, add);
          validateReference(spec.target, "spring.target", names, add);
          if (spec.anchor === spec.target) add("error", "Spring endpoints must be different objects.");
          for (const field of ["restLength", "stiffness", "damping"]) {
            if (spec[field] !== undefined && (!Number.isFinite(spec[field]) || spec[field] < 0))
              add("error", `spring.${field} must be finite and nonnegative.`);
          }
        } else if (spec.type === "fixedDistance") {
          validateReference(spec.anchor, "fixedDistance.anchor", names, add);
          validateReference(spec.target, "fixedDistance.target", names, add);
          validateNonNegativeNumber(spec.distance, "fixedDistance.distance", add);
        } else if (spec.type === "distanceRatio") {
          validateNamedList(spec.sources, 2, spec.type, names, add);
          validatePositiveNumber(spec.ratio, "distanceRatio.ratio", add);
        } else if (spec.type === "pin") {
          validateReference(spec.target, "pin.target", names, add);
          if (!Number.isFinite(Number(spec.x)) || !Number.isFinite(Number(spec.y))) {
            add("error", "pin needs finite x/y coordinates.");
          }
        } else if (spec.type === "solid") {
          validateReference(spec.carrier, "solid.carrier", names, add);
          validateReference(spec.attached, "solid.attached", names, add);
        } else if (spec.type === "separation") {
          validateNamedList(spec.sources, 2, spec.type, names, add);
          validateNonNegativeNumber(spec.minDistance, "separation.minDistance", add);
        } else if (spec.type === "angleSector") {
          validateReference(spec.source, "angleSector.source", names, add);
          validateNumber(spec.centerAngle, "angleSector.centerAngle", add);
          validatePositiveNumber(spec.width, "angleSector.width", add);
        } else {
          add("error", `Unknown constraint type: ${spec.type}.`);
        }
      }
    }

    function validateBackendSpec(patch, add) {
      const target = patch.target || patch.audioSynth || null;
      const targetApi = options.targetApi;
      const knownBackends = new Set((targetApi?.listTargetBackends?.() || []).map((backend) => backend.type));

      if (target?.type && knownBackends.size > 0 && !knownBackends.has(target.type)) {
        add("error", `Unknown target backend: ${target.type}.`);
      }

      if (patch.midiFile && target?.type !== "midi-file") {
        add("warning", "Patch has midiFile data but target.type is not midi-file.");
      }
      if (target?.type === "midi-file" && !patch.midiFile) {
        add("error", "midi-file target needs a midiFile block.");
      }
      if (target?.type === "faust-wasm") {
        if (!target.module) {
          add("error", "faust-wasm target needs an adapter module.");
        }
        if (!target.dsp && !target.wasm && !target.json && !target.metadata) {
          add("warning", "faust-wasm target has no DSP, WASM, or metadata artifact reference.");
        }
      }
      if ((patch.parameterMappings || patch.audioMappings || []).length > 0 && !target) {
        add("warning", "Parameter mappings use the default subtractive backend because target is omitted.");
      }
    }

    function validateParameterMappings(mappings, names, target, add) {
      if (!Array.isArray(mappings)) {
        add("error", "parameterMappings must be an array.");
        return;
      }

      const supportedParameters = targetParameterNames(target);
      const supportedFeatures = new Set(["x", "y", "angle", "distance"]);

      for (const mapping of mappings) {
        if (!mapping || typeof mapping !== "object") {
          add("error", "Every parameter mapping must be an object.");
          continue;
        }

        validateReference(mapping.source, "mapping.source", names, add);
        if (!supportedFeatures.has(mapping.feature)) {
          add("error", `Unsupported mapping feature: ${mapping.feature || "(missing)"}.`);
        }
        if (!mapping.target) {
          add("error", "Every parameter mapping needs a target.");
        } else if (supportedParameters.size > 0 && !supportedParameters.has(mapping.target)) {
          add(
            "error",
            `Mapping target ${mapping.target} is not declared by backend ${target?.type || "subtractive"}.`
          );
        }

        validateNumber(mapping.inputMin, "mapping.inputMin", add);
        validateNumber(mapping.inputMax, "mapping.inputMax", add);
        validateNumber(mapping.outputMin, "mapping.outputMin", add);
        validateNumber(mapping.outputMax, "mapping.outputMax", add);
        validateMappingSnap(mapping, "mapping", add);
        if (mapping.inputMin === mapping.inputMax) {
          add("warning", `Mapping ${mapping.target || ""} has identical inputMin/inputMax.`);
        }
        if (mapping.curve === "exp" && (Number(mapping.outputMin) <= 0 || Number(mapping.outputMax) <= 0)) {
          add("error", `Exponential mapping ${mapping.target || ""} needs positive outputMin/outputMax.`);
        }
      }
    }

    function validateMidiSpec(midiFile, names, target, add) {
      if (!midiFile) {
        return;
      }

      if (!midiFile.url && !midiFile.sequenceData) {
        add("error", "midiFile needs either a url or embedded sequenceData.");
      }
      if (target?.type && target.type !== "midi-file") {
        add("warning", "MIDI sequence playback should use target.type = midi-file.");
      }
      if (!Array.isArray(midiFile.trackBindings) || midiFile.trackBindings.length === 0) {
        add("warning", "midiFile has no trackBindings.");
        return;
      }

      for (const binding of midiFile.trackBindings) {
        validateReference(binding?.source, "midiFile.trackBindings.source", names, add);
        if (binding?.channel !== undefined) {
          const channel = Number(binding.channel);
          if (!Number.isInteger(channel) || channel < 1 || channel > 16) {
            add("error", `MIDI channel must be an integer from 1 to 16 for ${binding.source || "binding"}.`);
          }
        }
        if (binding?.program !== undefined) {
          const program = Number(binding.program);
          if (!Number.isInteger(program) || program < 1 || program > 128) {
            add("error", `MIDI program must be an integer from 1 to 128 for ${binding.source || "binding"}.`);
          }
        }
      }
    }

    function validateSourceBindings(bindings, names, add) {
      if (!Array.isArray(bindings)) {
        add("error", "sourceBindings must be an array.");
        return;
      }

      const seenSources = new Set();
      for (const binding of bindings) {
        if (!binding || typeof binding !== "object") {
          add("error", "Every source binding must be an object.");
          continue;
        }

        validateReference(binding.source, "sourceBindings.source", names, add);
        if (seenSources.has(binding.source)) {
          add(
            "warning",
            `Source ${binding.source} has multiple source bindings; only one is edited by the source inspector.`
          );
        }
        seenSources.add(binding.source);

        if (binding.type !== SOURCE_BINDING_AUDIO_FILE) {
          add("error", `Unsupported source binding type: ${binding.type || "(missing)"}.`);
          continue;
        }
        if (!binding.dataUrl && !binding.url) {
          add("error", `Audio source binding for ${binding.source || "?"} needs a dataUrl or url.`);
        }
        if (binding.gain !== undefined) {
          validateNonNegativeNumber(binding.gain, "sourceBindings.gain", add);
        }
        if (binding.muted !== undefined && typeof binding.muted !== "boolean") {
          add("error", "sourceBindings.muted must be a boolean when present.");
        }
        if (binding.spatialization && !["pan-distance", "stereo-pan"].includes(binding.spatialization)) {
          add("error", `Unsupported source spatialization: ${binding.spatialization}.`);
        }
      }
    }

    function validateSourceGenerators(generators, names, add) {
      if (!Array.isArray(generators)) {
        add("error", "sourceGenerators must be an array.");
        return;
      }

      const seenSources = new Set();
      for (const generator of generators) {
        if (!generator || typeof generator !== "object") {
          add("error", "Every source generator must be an object.");
          continue;
        }

        validateReference(generator.source, "sourceGenerators.source", names, add);
        if (seenSources.has(generator.source)) {
          add("warning", `Source ${generator.source} has multiple source generators.`);
        }
        seenSources.add(generator.source);

        if (![SOURCE_OUTPUT_MIDI_OSTINATO, SOURCE_OUTPUT_ADDITIVE_SYNTH].includes(generator.type)) {
          add("error", `Unsupported source generator type: ${generator.type || "(missing)"}.`);
          continue;
        }

        if (generator.type === SOURCE_OUTPUT_MIDI_OSTINATO) {
          validateMidiValue(
            generator.pitch,
            0,
            127,
            `sourceGenerators.pitch for ${generator.source || "generator"}`,
            add
          );
          validateMidiValue(
            generator.channel,
            1,
            16,
            `sourceGenerators.channel for ${generator.source || "generator"}`,
            add
          );
          validatePositiveNumber(
            generator.periodMs,
            `sourceGenerators.periodMs for ${generator.source || "generator"}`,
            add
          );
          validatePositiveNumber(
            generator.durationMs,
            `sourceGenerators.durationMs for ${generator.source || "generator"}`,
            add
          );
          validateMidiValue(
            generator.velocity,
            1,
            127,
            `sourceGenerators.velocity for ${generator.source || "generator"}`,
            add
          );
        }

        if (generator.type === SOURCE_OUTPUT_ADDITIVE_SYNTH) {
          validatePositiveNumber(
            generator.frequencyHz,
            `sourceGenerators.frequencyHz for ${generator.source || "generator"}`,
            add
          );
          if (Number(generator.frequencyHz) < 20 || Number(generator.frequencyHz) > 16000) {
            add(
              "error",
              `sourceGenerators.frequencyHz for ${generator.source || "generator"} must be from 20 to 16000.`
            );
          }
          validateNonNegativeNumber(
            generator.gain,
            `sourceGenerators.gain for ${generator.source || "generator"}`,
            add
          );
          if (Number(generator.gain) > 1) {
            add("error", `sourceGenerators.gain for ${generator.source || "generator"} must be from 0 to 1.`);
          }
          if (generator.attackMs !== undefined) {
            validatePositiveNumber(
              generator.attackMs,
              `sourceGenerators.attackMs for ${generator.source || "generator"}`,
              add
            );
          }
          if (generator.releaseMs !== undefined) {
            validatePositiveNumber(
              generator.releaseMs,
              `sourceGenerators.releaseMs for ${generator.source || "generator"}`,
              add
            );
          }
          if (!Array.isArray(generator.partials) || generator.partials.length === 0) {
            add(
              "error",
              `Additive source generator for ${generator.source || "generator"} needs at least one partial.`
            );
          } else {
            generator.partials.forEach((partial, index) =>
              validateAdditivePartial(partial, generator.source, index, add)
            );
          }
        }

        if (generator.muted !== undefined && typeof generator.muted !== "boolean") {
          add("error", "sourceGenerators.muted must be a boolean when present.");
        }
        if (
          generator.type === SOURCE_OUTPUT_MIDI_OSTINATO &&
          generator.waveform &&
          !["sine", "triangle", "sawtooth", "square"].includes(generator.waveform)
        ) {
          add("error", `Unsupported source generator waveform: ${generator.waveform}.`);
        }
        if (
          generator.type === SOURCE_OUTPUT_MIDI_OSTINATO &&
          generator.outputMode &&
          !["internal", "external"].includes(generator.outputMode)
        ) {
          add("error", `Unsupported source generator output mode: ${generator.outputMode}.`);
        }
        if (generator.outputId !== undefined && typeof generator.outputId !== "string") {
          add("error", "sourceGenerators.outputId must be a string when present.");
        }
        if (generator.outputName !== undefined && typeof generator.outputName !== "string") {
          add("error", "sourceGenerators.outputName must be a string when present.");
        }
        if (generator.spatialization && !["pan-distance", "stereo-pan"].includes(generator.spatialization)) {
          add("error", `Unsupported source generator spatialization: ${generator.spatialization}.`);
        }
      }
    }

    function validateAdditivePartial(partial, sourceName, index, add) {
      const label = `sourceGenerators.partials[${index}] for ${sourceName || "generator"}`;
      if (!partial || typeof partial !== "object") {
        add("error", `${label} must be an object.`);
        return;
      }
      if (partial.frequencyHz === undefined) {
        validatePositiveNumber(partial.ratio ?? partial.frequencyRatio, `${label}.ratio`, add);
      } else {
        validatePositiveNumber(partial.frequencyHz, `${label}.frequencyHz`, add);
      }
      validateNonNegativeNumber(partial.amplitude, `${label}.amplitude`, add);
      if (Number(partial.amplitude) > 1) {
        add("error", `${label}.amplitude must be from 0 to 1.`);
      }
      if (partial.detuneCents !== undefined) {
        validateNumber(partial.detuneCents, `${label}.detuneCents`, add);
      }
      if (partial.amplitudeLfoHz !== undefined) {
        validateNonNegativeNumber(partial.amplitudeLfoHz, `${label}.amplitudeLfoHz`, add);
      }
      if (partial.amplitudeLfoDepth !== undefined) {
        validateNonNegativeNumber(partial.amplitudeLfoDepth, `${label}.amplitudeLfoDepth`, add);
        if (Number(partial.amplitudeLfoDepth) > 1) {
          add("error", `${label}.amplitudeLfoDepth must be from 0 to 1.`);
        }
      }
      if (partial.detuneLfoHz !== undefined) {
        validateNonNegativeNumber(partial.detuneLfoHz, `${label}.detuneLfoHz`, add);
      }
      if (partial.detuneLfoCents !== undefined) {
        validateNonNegativeNumber(partial.detuneLfoCents, `${label}.detuneLfoCents`, add);
      }
      if (partial.swellHz !== undefined) {
        validateNonNegativeNumber(partial.swellHz, `${label}.swellHz`, add);
      }
      if (partial.swellDepth !== undefined) {
        validateNonNegativeNumber(partial.swellDepth, `${label}.swellDepth`, add);
        if (Number(partial.swellDepth) > 1) {
          add("error", `${label}.swellDepth must be from 0 to 1.`);
        }
      }
      if (partial.swellShape !== undefined) {
        validatePositiveNumber(partial.swellShape, `${label}.swellShape`, add);
      }
      if (partial.lfoPhase !== undefined) {
        validateNumber(partial.lfoPhase, `${label}.lfoPhase`, add);
      }
    }

    function validateSourceGeneratorMappings(mappings, names, add) {
      if (!Array.isArray(mappings)) {
        add("error", "sourceGeneratorMappings must be an array.");
        return;
      }

      const supportedFeatures = new Set(["x", "y", "angle", "distance"]);
      const supportedParameters = new Set(SOURCE_GENERATOR_MAPPING_PARAMETERS);

      for (const mapping of mappings) {
        if (!mapping || typeof mapping !== "object") {
          add("error", "Every source generator mapping must be an object.");
          continue;
        }

        validateReference(mapping.source, "sourceGeneratorMappings.source", names, add);
        if (!supportedFeatures.has(mapping.feature)) {
          add("error", `Unsupported source generator mapping feature: ${mapping.feature || "(missing)"}.`);
        }
        const parameter = mapping.parameter || mapping.target;
        if (!supportedParameters.has(parameter)) {
          add("error", `Unsupported source generator mapping parameter: ${parameter || "(missing)"}.`);
        }
        validateNumber(mapping.inputMin, "sourceGeneratorMappings.inputMin", add);
        validateNumber(mapping.inputMax, "sourceGeneratorMappings.inputMax", add);
        validateNumber(mapping.outputMin, "sourceGeneratorMappings.outputMin", add);
        validateNumber(mapping.outputMax, "sourceGeneratorMappings.outputMax", add);
        validateMappingSnap(mapping, "sourceGeneratorMappings", add);
        if (mapping.inputMin === mapping.inputMax) {
          add(
            "warning",
            `${mapping.source || "Generator"} ${parameter || "mapping"} has identical inputMin/inputMax.`
          );
        }
        if (mapping.curve === "exp" && (Number(mapping.outputMin) <= 0 || Number(mapping.outputMax) <= 0)) {
          add(
            "error",
            `Exponential source generator mapping ${parameter || ""} needs positive outputMin/outputMax.`
          );
        }
      }
    }

    function validateMidiValue(value, min, max, label, add) {
      const number = Number(value);
      if (!Number.isInteger(number) || number < min || number > max) {
        add("error", `${label} must be an integer from ${min} to ${max}.`);
      }
    }

    function validateMappingSnap(mapping, label, add) {
      if (mapping.quantize !== undefined) {
        const quantize = Number(mapping.quantize);
        if (!Number.isFinite(quantize) || quantize <= 0) {
          add("error", `${label}.quantize must be a positive number when present.`);
        }
      }

      if (mapping.values !== undefined) {
        if (!Array.isArray(mapping.values) || mapping.values.length === 0) {
          add("error", `${label}.values must be a non-empty array of numbers when present.`);
          return;
        }
        for (const value of mapping.values) {
          if (!Number.isFinite(Number(value))) {
            add("error", `${label}.values must contain only numbers.`);
            return;
          }
        }
      }
    }

    function targetParameterNames(target) {
      if (target?.parameters && typeof target.parameters === "object") {
        return new Set(Object.keys(target.parameters));
      }

      const targetApi = options.targetApi;
      const targetType = target?.type || "subtractive";
      const backend = (targetApi?.listTargetBackends?.() || []).find(
        (candidate) => candidate.type === targetType
      );
      return new Set(backend?.parameters || []);
    }

    function validateNamedList(values, expectedLength, label, names, add) {
      if (!Array.isArray(values) || values.length < expectedLength) {
        add("error", `${label} constraint needs at least ${expectedLength} source reference(s).`);
        return;
      }
      for (const value of values) {
        validateReference(value, `${label}.sources`, names, add);
      }
    }

    function validateReference(name, label, names, add) {
      if (typeof name !== "string" || name.trim() === "") {
        add("error", `${label} needs a non-empty object name.`);
        return;
      }
      if (!names.has(name)) {
        add("error", `${label} references unknown object ${name}.`);
      }
    }

    function validateMinMax(min, max, label, add) {
      validateNumber(min, `${label} min`, add);
      validateNumber(max, `${label} max`, add);
      if (Number.isFinite(Number(min)) && Number.isFinite(Number(max)) && Number(min) > Number(max)) {
        add("error", `${label} min must be less than or equal to max.`);
      }
    }

    function validatePositiveNumber(value, label, add) {
      validateNumber(value, label, add);
      if (Number.isFinite(Number(value)) && Number(value) <= 0) {
        add("error", `${label} must be positive.`);
      }
    }

    function validateNonNegativeNumber(value, label, add) {
      validateNumber(value, label, add);
      if (Number.isFinite(Number(value)) && Number(value) < 0) {
        add("error", `${label} must be non-negative.`);
      }
    }

    function validateNumber(value, label, add) {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        add("error", `${label} must be a finite number.`);
      }
    }

    function isFinitePoint(point) {
      return Number.isFinite(point?.x) && Number.isFinite(point?.y);
    }

    function capitalize(value) {
      return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
    }
    return { validatePatch };
  }
  function clonePatch(patch) {
    return JSON.parse(JSON.stringify(patch));
  }
  const api = { createPatchTools, clonePatch };
  if (typeof module === "object" && module.exports) module.exports = api;
  else global.MusicSpacePatch = api;
})(globalThis);

},
"./musicspace-trajectories": function(module, exports, require) {
// Authored v1 trajectory speeds are expressed per 1/60-second simulation step.
(function exposeTrajectories(global) {
  const isNode = typeof module === "object" && module.exports;
  const { WIDTH, HEIGHT, FRAMES_PER_SECOND } = isNode
    ? require("./musicspace-constants")
    : global.MusicSpaceConstants;
  function createTrajectories({ getListener, getObjectByName }) {
    function clamp(value, min, max) {
      return Math.min(max, Math.max(min, value));
    }
    function rotatorFrameDelta(trajectory) {
      const periodSeconds = Math.max(0.5, trajectory.periodSeconds || 20);
      return (trajectory.direction * (Math.PI * 2)) / (periodSeconds * FRAMES_PER_SECOND);
    }

    function resolveTrajectoryEndpoint(endpoint, fallbackX, fallbackY) {
      if (endpoint?.type === "object") {
        const object = getObjectByName(endpoint.name);
        if (object) {
          return { x: object.x, y: object.y };
        }
      }

      return {
        x: endpoint?.x ?? fallbackX,
        y: endpoint?.y ?? fallbackY
      };
    }

    function normalizeTrajectory(trajectory, x, y) {
      const type = trajectory && trajectory.type ? trajectory.type : "free";

      if (type === "translation") {
        return {
          type,
          vx: trajectory.vx ?? 1.2,
          vy: trajectory.vy ?? 0.6,
          bounce: trajectory.bounce ?? true
        };
      }

      if (type === "rotation") {
        const centerX = trajectory.centerX ?? getListener()?.x ?? WIDTH / 2;
        const centerY = trajectory.centerY ?? getListener()?.y ?? HEIGHT / 2;
        return {
          type,
          centerX,
          centerY,
          radius: trajectory.radius ?? Math.max(40, Math.hypot(x - centerX, y - centerY)),
          phase: trajectory.phase ?? Math.atan2(y - centerY, x - centerX),
          angularSpeed: trajectory.angularSpeed ?? 0.018
        };
      }

      if (type === "shuttle") {
        const start = normalizeTrajectoryEndpoint(
          trajectory.start,
          trajectory.ax ?? x - 80,
          trajectory.ay ?? y
        );
        const end = normalizeTrajectoryEndpoint(trajectory.end, trajectory.bx ?? x + 80, trajectory.by ?? y);
        return {
          type,
          start,
          end,
          ax: start.x,
          ay: start.y,
          bx: end.x,
          by: end.y,
          phase: trajectory.phase ?? 0.5,
          speed: trajectory.speed ?? 0.01,
          direction: trajectory.direction ?? 1,
          showPath: trajectory.showPath ?? true
        };
      }

      if (type === "bounce") {
        return {
          type,
          vx: trajectory.vx ?? 1.8,
          vy: trajectory.vy ?? 1.1
        };
      }

      if (type === "rotator") {
        return {
          type,
          running: trajectory.running ?? true,
          periodSeconds: trajectory.periodSeconds ?? 20,
          direction: trajectory.direction ?? 1,
          displacementInducesRotation: trajectory.displacementInducesRotation ?? true,
          phase: trajectory.phase ?? 0,
          rotationDelta: 0
        };
      }

      return { type: "free" };
    }

    function normalizeTrajectoryEndpoint(endpoint, fallbackX, fallbackY) {
      if (endpoint?.type === "object") {
        const object = getObjectByName(endpoint.name);
        return {
          type: "object",
          name: endpoint.name,
          x: object?.x ?? endpoint.x ?? fallbackX,
          y: object?.y ?? endpoint.y ?? fallbackY
        };
      }

      return {
        type: "fixed",
        x: endpoint?.x ?? fallbackX,
        y: endpoint?.y ?? fallbackY
      };
    }
    function tick(mover) {
      const trajectory = mover.trajectory || { type: "free" };
      trajectory.rotationDelta = 0;

      if (trajectory.type === "translation") {
        mover.x += trajectory.vx;
        mover.y += trajectory.vy;
        if (trajectory.bounce) {
          reflectWithinBounds(mover, trajectory);
        }
        return true;
      }

      if (trajectory.type === "rotation") {
        trajectory.phase += trajectory.angularSpeed;
        mover.x = trajectory.centerX + trajectory.radius * Math.cos(trajectory.phase);
        mover.y = trajectory.centerY + trajectory.radius * Math.sin(trajectory.phase);
        return true;
      }

      if (trajectory.type === "shuttle") {
        trajectory.phase += trajectory.speed * trajectory.direction;
        if (trajectory.phase > 1 || trajectory.phase < 0) {
          trajectory.phase = clamp(trajectory.phase, 0, 1);
          trajectory.direction *= -1;
        }
        const start = resolveTrajectoryEndpoint(trajectory.start, trajectory.ax, trajectory.ay);
        const end = resolveTrajectoryEndpoint(trajectory.end, trajectory.bx, trajectory.by);
        mover.x = start.x + (end.x - start.x) * trajectory.phase;
        mover.y = start.y + (end.y - start.y) * trajectory.phase;
        return true;
      }

      if (trajectory.type === "bounce") {
        mover.x += trajectory.vx;
        mover.y += trajectory.vy;
        reflectWithinBounds(mover, trajectory);
        return true;
      }

      if (trajectory.type === "rotator") {
        if (!trajectory.running) {
          return false;
        }

        trajectory.rotationDelta = rotatorFrameDelta(trajectory);
        trajectory.phase += trajectory.rotationDelta;
        return Math.abs(trajectory.rotationDelta) > 0;
      }

      return false;
    }
    function reflectWithinBounds(mover, trajectory) {
      if (mover.x < mover.radius || mover.x > WIDTH - mover.radius) {
        trajectory.vx *= -1;
        mover.x = clamp(mover.x, mover.radius, WIDTH - mover.radius);
      }

      if (mover.y < mover.radius || mover.y > HEIGHT - mover.radius) {
        trajectory.vy *= -1;
        mover.y = clamp(mover.y, mover.radius, HEIGHT - mover.radius);
      }
    }
    return {
      normalizeTrajectory,
      normalizeTrajectoryEndpoint,
      rotatorFrameDelta,
      resolveTrajectoryEndpoint,
      tick
    };
  }
  const api = { createTrajectories };
  if (isNode) module.exports = api;
  else global.MusicSpaceTrajectories = api;
})(globalThis);

},
"./musicspace-graph": function(module, exports, require) {
// Constraint adjacency follows topology changes, not position changes.
(function exposeGraph(global) {
  function createConstraintGraph() {
    let constraints = [];
    let dirty = true;
    let adjacency = new Map();
    let rebuilds = 0;
    function invalidate() {
      dirty = true;
    }
    function track(next) {
      constraints = new Proxy(next, {
        set(target, key, value) {
          target[key] = value;
          invalidate();
          return true;
        },
        deleteProperty(target, key) {
          delete target[key];
          invalidate();
          return true;
        }
      });
      invalidate();
      return constraints;
    }
    function neighbors(entity) {
      if (dirty) {
        adjacency = new Map();
        for (const constraint of constraints) {
          for (const affected of new Set(constraint.affectedEntities().filter(Boolean))) {
            if (!adjacency.has(affected)) adjacency.set(affected, []);
            adjacency.get(affected).push(constraint);
          }
        }
        dirty = false;
        rebuilds += 1;
      }
      return adjacency.get(entity) || [];
    }
    return { track, neighbors, invalidate, stats: () => ({ rebuilds }) };
  }
  const api = { createConstraintGraph };
  if (typeof module === "object" && module.exports) module.exports = api;
  else global.MusicSpaceGraph = api;
})(globalThis);

},
"./musicspace-solvers": function(module, exports, require) {
// Bounded propagation and iterative geometric projection, with no UI dependencies.
(function exposeSolvers(global) {
  const constants =
    typeof module === "object" && module.exports
      ? require("./musicspace-constants")
      : global.MusicSpaceConstants;
  function createSolvers({ state, classes, graph, geometry, onStatus = () => {} }) {
    const {
      MIN_DISTANCE,
      CONSTRAINT_EPSILON,
      MAX_PROPAGATION_STEPS,
      MAX_ENTITY_PROPAGATION_COUNT,
      SOLVER_MODE_PROPAGATION,
      SOLVER_MODE_XPBD,
      XPBD_ITERATIONS_DRAG,
      XPBD_ITERATIONS_RELEASE,
      MAX_XPBD_COMPONENT_ENTITIES,
      MAX_XPBD_COMPONENT_CONSTRAINTS
    } = constants;
    const {
      MovingObject,
      AngleConstraint,
      SumConstraint,
      ProductConstraint,
      RadialLimitConstraint,
      FixedDistanceConstraint,
      SpringConstraint,
      DistanceRatioConstraint,
      PinConstraint,
      SolidAttachmentConstraint,
      MinimumSeparationConstraint,
      AngleSectorConstraint
    } = classes;
    const { translateEntity, rotateVector, entityLabel, normalizeAngle, clamp } = geometry;
    const setConstraintStatus = onStatus;
    function enforceConstraints(moved, options = {}) {
      if (state.solverMode === SOLVER_MODE_XPBD || isDynamicComponent(buildConstraintComponent(moved))) {
        const xpbdReport = enforceConstraintsWithXpbd(moved, options);
        if (xpbdReport) {
          state.lastPropagationReport = xpbdReport;
          setConstraintStatus(formatPropagationStatus(state.lastPropagationReport));
          return;
        }
      }

      enforceConstraintsByPropagation(moved);
    }

    function refineXpbdAfterDrag(entity) {
      if (
        !entity ||
        isDynamicComponent(buildConstraintComponent(entity)) ||
        state.solverMode !== SOLVER_MODE_XPBD
      ) {
        return false;
      }

      const xpbdReport = enforceConstraintsWithXpbd(entity, { iterations: XPBD_ITERATIONS_RELEASE });
      if (!xpbdReport) {
        return false;
      }

      state.lastPropagationReport = xpbdReport;
      setConstraintStatus(formatPropagationStatus(state.lastPropagationReport));
      return true;
    }

    function enforceConstraintsWithXpbd(
      moved,
      { iterations = XPBD_ITERATIONS_DRAG, preserveTrajectoryFrame = false } = {}
    ) {
      const component = buildConstraintComponent(moved);
      if (
        !component ||
        component.entities.length > MAX_XPBD_COMPONENT_ENTITIES ||
        component.constraints.length > MAX_XPBD_COMPONENT_CONSTRAINTS
      ) {
        return null;
      }

      applyXpbdRotatorFrameDeltas(component.constraints);

      const positions = component.entities.map((entity) => ({ x: entity.x, y: entity.y }));
      const originalPositions = component.entities.map((entity) => ({ x: entity.x, y: entity.y }));
      const dynamic = isDynamicComponent(component);
      const mobility = createXpbdMobility(component, moved, dynamic);
      const intent =
        !dynamic && moved && component.indexByEntity.has(moved)
          ? {
              index: component.indexByEntity.get(moved),
              x: moved.x,
              y: moved.y,
              stiffness: 0.35
            }
          : null;

      const ordered = orderedXpbdConstraints(component.constraints);
      for (let iteration = 0; iteration < iterations; iteration += 1) {
        applyXpbdSoftIntent(positions, mobility, intent);

        for (const constraint of ordered) {
          projectXpbdConstraint(constraint, component.indexByEntity, positions, mobility);
        }
      }

      for (const constraint of component.constraints) {
        projectXpbdHardConstraint(constraint, component.indexByEntity, positions, mobility);
      }

      const movedEntities = [];
      for (let index = 0; index < component.entities.length; index += 1) {
        const entity = component.entities[index];
        const next = positions[index];
        const dx = next.x - entity.x;
        const dy = next.y - entity.y;
        if (dynamic ? dx !== 0 || dy !== 0 : Math.hypot(dx, dy) > 0.001) {
          commitXpbdEntityPosition(entity, next, { preserveTrajectoryFrame });
        }
        if (
          Math.hypot(next.x - originalPositions[index].x, next.y - originalPositions[index].y) >
          CONSTRAINT_EPSILON
        ) {
          movedEntities.push(entity);
        }
      }

      for (const constraint of component.constraints) {
        constraint.updateNode?.();
      }

      return createPropagationReport({
        hitEntityCap: false,
        hitStepCap: false,
        messages: [],
        movedEntities,
        processCounts: new Map(),
        propagationSteps: iterations * component.constraints.length,
        solverMode: SOLVER_MODE_XPBD
      });
    }

    function isTrajectoryDriven(entity) {
      return entity instanceof MovingObject && entity.trajectory.type !== "free";
    }

    function isDynamicComponent(component) {
      return Boolean(
        component &&
        (component.constraints.some((c) => c instanceof SpringConstraint) ||
          component.entities.some((entity) => entity.dynamics))
      );
    }

    function dynamicComponents() {
      const seeds = [
        ...state.constraints.filter((c) => c instanceof SpringConstraint).map((c) => c.anchor),
        ...state.sources.filter((entity) => entity.dynamics),
        ...state.movingObjects.filter((entity) => entity.dynamics)
      ];
      const visited = new Set();
      const components = [];
      for (const seed of seeds) {
        if (visited.has(seed)) continue;
        const component = buildConstraintComponent(seed);
        for (const entity of component.entities) visited.add(entity);
        components.push(component);
      }
      return components;
    }

    function initializeDynamics() {
      const components = dynamicComponents();
      for (const component of components) {
        const pinned = new Set(
          component.constraints.filter((c) => c instanceof PinConstraint).map((c) => c.target)
        );
        for (const entity of component.entities) {
          if (entity !== state.listener && !pinned.has(entity) && !isTrajectoryDriven(entity)) {
            entity.dynamics ??= { mass: 1, vx: 0, vy: 0 };
          }
        }
      }
      return components;
    }

    function hasDynamics() {
      return (
        state.constraints.some((c) => c instanceof SpringConstraint) ||
        [...state.sources, ...state.movingObjects].some((entity) => entity.dynamics)
      );
    }

    // Time is in seconds; positions are canvas pixels. Four substeps per 60 Hz tick
    // reduce implicit-integration energy loss while sharing the geometric projectors.
    function stepDynamics(dt = 1 / 60) {
      if (!Number.isFinite(dt) || dt <= 0 || dt > 0.25)
        throw new RangeError("Dynamics dt must be in (0, 0.25] seconds.");
      if (state.propagationPaused) return false;
      const components = initializeDynamics();
      if (!components.length) return false;
      const substeps = Math.ceil(dt / (1 / 240));
      const h = dt / substeps;
      const movedEntities = new Set();
      let projectionCount = 0;
      for (const component of components) {
        const { entities, indexByEntity } = component;
        const mobility = createXpbdMobility(component, null, true);
        const springs = component.constraints.filter((c) => c instanceof SpringConstraint);
        const geometric = orderedXpbdConstraints(
          component.constraints.filter((c) => !(c instanceof SpringConstraint))
        );
        for (let step = 0; step < substeps; step += 1) {
          const positions = entities.map((entity) => ({ x: entity.x, y: entity.y }));
          for (const constraint of geometric) {
            if (constraint instanceof PinConstraint)
              projectXpbdHardConstraint(constraint, indexByEntity, positions, mobility);
          }
          const previous = positions.map((position) => ({ ...position }));
          for (let i = 0; i < entities.length; i += 1) {
            const body = entities[i].dynamics;
            if (!mobility[i]) {
              if (body) {
                body.vx = 0;
                body.vy = 0;
              }
              continue;
            }
            body.vx += state.gravity.x * h;
            body.vy += state.gravity.y * h;
            positions[i].x += body.vx * h;
            positions[i].y += body.vy * h;
          }
          // Multipliers persist across iterations, and reset for every substep.
          const lambdas = new Map();
          for (let iteration = 0; iteration < 24; iteration += 1) {
            for (const spring of springs)
              projectXpbdSpring(spring, indexByEntity, positions, previous, mobility, lambdas, h);
            for (const constraint of geometric)
              projectXpbdConstraint(constraint, indexByEntity, positions, mobility);
          }
          // Finish with the ordinary constraints so stiff springs cannot leave links stretched.
          for (let iteration = 0; iteration < 8; iteration += 1) {
            for (const constraint of geometric)
              projectXpbdConstraint(constraint, indexByEntity, positions, mobility);
          }
          projectionCount += 24 * springs.length + 32 * geometric.length;
          for (let i = 0; i < entities.length; i += 1) {
            const entity = entities[i];
            const next = positions[i];
            if (mobility[i]) {
              entity.dynamics.vx = (next.x - previous[i].x) / h;
              entity.dynamics.vy = (next.y - previous[i].y) / h;
            }
            if (next.x !== entity.x || next.y !== entity.y) {
              commitXpbdEntityPosition(entity, next);
              movedEntities.add(entity);
            }
          }
        }
        for (const constraint of component.constraints) constraint.updateNode?.();
      }
      state.lastPropagationReport = createPropagationReport({
        hitEntityCap: false,
        hitStepCap: false,
        messages: [],
        movedEntities: [...movedEntities],
        processCounts: new Map(),
        propagationSteps: projectionCount,
        solverMode: SOLVER_MODE_XPBD
      });
      setConstraintStatus(formatPropagationStatus(state.lastPropagationReport));
      return true;
    }

    function projectXpbdSpring(spring, indexes, positions, previous, mobility, lambdas, h) {
      const ai = indexes.get(spring.anchor);
      const bi = indexes.get(spring.target);
      const a = positions[ai];
      const b = positions[bi];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distance = Math.hypot(dx, dy);
      const oldDx = previous[bi].x - previous[ai].x;
      const oldDy = previous[bi].y - previous[ai].y;
      const oldDistance = Math.hypot(oldDx, oldDy);
      // Coincident endpoints use a deterministic direction, avoiding division by zero.
      const nx = distance > 1e-9 ? dx / distance : oldDistance > 1e-9 ? oldDx / oldDistance : 1;
      const ny = distance > 1e-9 ? dy / distance : oldDistance > 1e-9 ? oldDy / oldDistance : 0;
      const w = mobility[ai] + mobility[bi];
      if (!w) return;
      const lambda = lambdas.get(spring) || 0;
      const displacement = nx * (dx - oldDx) + ny * (dy - oldDy);
      // XPBD compliance alpha = 1/k, alphaTilde = alpha/h², gamma = c/(k*h).
      // Multiply numerator/denominator by k*h²: also well-defined for k=0 (dashpot).
      const elastic = spring.stiffness * h * h;
      const viscous = spring.damping * h;
      const delta =
        (-elastic * (distance - spring.restLength) - lambda - viscous * displacement) /
        (1 + (elastic + viscous) * w);
      lambdas.set(spring, lambda + delta);
      a.x -= mobility[ai] * nx * delta;
      a.y -= mobility[ai] * ny * delta;
      b.x += mobility[bi] * nx * delta;
      b.y += mobility[bi] * ny * delta;
    }

    function orderedXpbdConstraints(componentConstraints) {
      const hard = [];
      const structural = [];
      const aggregate = [];

      for (const constraint of componentConstraints) {
        if (
          constraint instanceof PinConstraint ||
          constraint instanceof RadialLimitConstraint ||
          constraint instanceof AngleSectorConstraint
        ) {
          hard.push(constraint);
        } else if (
          constraint instanceof SolidAttachmentConstraint ||
          constraint instanceof FixedDistanceConstraint ||
          constraint instanceof MinimumSeparationConstraint
        ) {
          structural.push(constraint);
        } else {
          aggregate.push(constraint);
        }
      }

      return [...hard, ...structural, ...aggregate];
    }

    function applyXpbdRotatorFrameDeltas(componentConstraints) {
      for (const constraint of componentConstraints) {
        if (constraint instanceof SolidAttachmentConstraint) {
          constraint.applyCarrierRotation();
        }
      }
    }

    function commitXpbdEntityPosition(entity, next, { preserveTrajectoryFrame = false } = {}) {
      if (preserveTrajectoryFrame && entity instanceof MovingObject) {
        entity.x = next.x;
        entity.y = next.y;
        return;
      }

      translateEntity(entity, next.x - entity.x, next.y - entity.y);
    }

    function buildConstraintComponent(startEntity) {
      if (!startEntity) {
        return null;
      }

      const entities = [];
      const componentConstraints = [];
      const entitySet = new Set();
      const constraintSet = new Set();
      const queue = [startEntity];
      entitySet.add(startEntity);

      let head = 0;
      while (head < queue.length) {
        const entity = queue[head++];
        for (const constraint of graph.neighbors(entity)) {
          if (constraintSet.has(constraint)) {
            continue;
          }

          const affected = constraint.affectedEntities?.().filter(Boolean) || [];
          if (!affected.includes(entity)) {
            continue;
          }

          constraintSet.add(constraint);
          componentConstraints.push(constraint);

          for (const affectedEntity of affected) {
            if (!entitySet.has(affectedEntity)) {
              entitySet.add(affectedEntity);
              queue.push(affectedEntity);
            }
          }
        }
      }

      for (const entity of entitySet) {
        entities.push(entity);
      }

      return {
        constraints: componentConstraints,
        entities,
        indexByEntity: new Map(entities.map((entity, index) => [entity, index]))
      };
    }

    function createXpbdMobility(component, moved, dynamic = false) {
      const pinned = new Set(
        component.constraints
          .filter((constraint) => constraint instanceof PinConstraint)
          .map((constraint) => constraint.target)
      );

      return component.entities.map((entity) => {
        if (pinned.has(entity)) {
          return 0;
        }

        if (entity === state.listener && entity !== moved) {
          return 0;
        }

        if (dynamic) {
          if (entity === moved || entity === state.draggedEntity || isTrajectoryDriven(entity)) return 0;
          return 1 / (entity.dynamics?.mass ?? 1);
        }
        return 1;
      });
    }

    function applyXpbdSoftIntent(positions, mobility, intent) {
      if (!intent || mobility[intent.index] <= 0) {
        return;
      }

      const position = positions[intent.index];
      position.x += (intent.x - position.x) * intent.stiffness;
      position.y += (intent.y - position.y) * intent.stiffness;
    }

    function projectXpbdConstraint(constraint, indexByEntity, positions, mobility) {
      if (
        constraint instanceof PinConstraint ||
        constraint instanceof RadialLimitConstraint ||
        constraint instanceof AngleSectorConstraint
      ) {
        projectXpbdHardConstraint(constraint, indexByEntity, positions, mobility);
        return;
      }

      if (constraint instanceof FixedDistanceConstraint) {
        projectXpbdDistance(
          indexByEntity.get(constraint.anchor),
          indexByEntity.get(constraint.target),
          constraint.distance,
          positions,
          mobility
        );
      } else if (constraint instanceof SolidAttachmentConstraint) {
        projectXpbdSolid(constraint, indexByEntity, positions, mobility);
      } else if (constraint instanceof MinimumSeparationConstraint) {
        projectXpbdMinSeparation(constraint, indexByEntity, positions, mobility);
      } else if (constraint instanceof SumConstraint) {
        projectXpbdSum(constraint, indexByEntity, positions, mobility);
      } else if (constraint instanceof ProductConstraint) {
        projectXpbdProduct(constraint, indexByEntity, positions, mobility);
      } else if (constraint instanceof DistanceRatioConstraint) {
        projectXpbdRatio(constraint, indexByEntity, positions, mobility);
      } else if (constraint instanceof AngleConstraint) {
        projectXpbdAngle(constraint, indexByEntity, positions, mobility);
      }
    }

    function projectXpbdHardConstraint(constraint, indexByEntity, positions, mobility) {
      if (constraint instanceof PinConstraint) {
        const index = indexByEntity.get(constraint.target);
        if (index === undefined) {
          return;
        }
        positions[index].x = constraint.fixedX;
        positions[index].y = constraint.fixedY;
      } else if (constraint instanceof RadialLimitConstraint) {
        projectXpbdRadialLimit(constraint, indexByEntity, positions, mobility);
      } else if (constraint instanceof AngleSectorConstraint) {
        projectXpbdAngleSector(constraint, indexByEntity, positions, mobility);
      }
    }

    function projectXpbdDistance(aIndex, bIndex, targetDistance, positions, mobility) {
      if (aIndex === undefined || bIndex === undefined) {
        return;
      }

      const a = positions[aIndex];
      const b = positions[bIndex];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 0.000001) {
        return;
      }

      const aMobility = mobility[aIndex];
      const bMobility = mobility[bIndex];
      const mobilitySum = aMobility + bMobility;
      if (mobilitySum <= 0) {
        return;
      }

      const residual = distance - targetDistance;
      const nx = dx / distance;
      const ny = dy / distance;
      a.x += nx * residual * (aMobility / mobilitySum);
      a.y += ny * residual * (aMobility / mobilitySum);
      b.x -= nx * residual * (bMobility / mobilitySum);
      b.y -= ny * residual * (bMobility / mobilitySum);
    }

    function projectXpbdRadialLimit(constraint, indexByEntity, positions, mobility) {
      const sourceIndex = indexByEntity.get(constraint.source);
      const listenerIndex = indexByEntity.get(constraint.listener);
      if (sourceIndex === undefined || listenerIndex === undefined || mobility[sourceIndex] <= 0) {
        return;
      }

      const source = positions[sourceIndex];
      const anchor = positions[listenerIndex];
      const dx = source.x - anchor.x;
      const dy = source.y - anchor.y;
      const distance = Math.hypot(dx, dy);
      const clampedDistance = clamp(distance, constraint.minDistance, constraint.maxDistance);
      if (Math.abs(distance - clampedDistance) <= CONSTRAINT_EPSILON) {
        return;
      }

      const angle = distance === 0 ? 0 : Math.atan2(dy, dx);
      source.x = anchor.x + clampedDistance * Math.cos(angle);
      source.y = anchor.y + clampedDistance * Math.sin(angle);
    }

    function projectXpbdAngleSector(constraint, indexByEntity, positions, mobility) {
      const sourceIndex = indexByEntity.get(constraint.source);
      const listenerIndex = indexByEntity.get(constraint.listener);
      if (sourceIndex === undefined || listenerIndex === undefined || mobility[sourceIndex] <= 0) {
        return;
      }

      const source = positions[sourceIndex];
      const anchor = positions[listenerIndex];
      const distance = Math.hypot(source.x - anchor.x, source.y - anchor.y);
      const angle = Math.atan2(source.y - anchor.y, source.x - anchor.x);
      const delta = normalizeAngle(angle - constraint.centerAngle);
      const halfWidth = constraint.width / 2;
      if (Math.abs(delta) <= halfWidth) {
        return;
      }

      const clampedAngle = constraint.centerAngle + clamp(delta, -halfWidth, halfWidth);
      source.x = anchor.x + distance * Math.cos(clampedAngle);
      source.y = anchor.y + distance * Math.sin(clampedAngle);
    }

    function projectXpbdSolid(constraint, indexByEntity, positions, mobility) {
      const carrierIndex = indexByEntity.get(constraint.carrier);
      const attachedIndex = indexByEntity.get(constraint.attached);
      if (carrierIndex === undefined || attachedIndex === undefined) {
        return;
      }

      const carrier = positions[carrierIndex];
      const attached = positions[attachedIndex];
      const errorX = attached.x - carrier.x - constraint.offsetX;
      const errorY = attached.y - carrier.y - constraint.offsetY;
      const carrierMobility = mobility[carrierIndex];
      const attachedMobility = mobility[attachedIndex];
      const mobilitySum = carrierMobility + attachedMobility;
      if (mobilitySum <= 0) {
        return;
      }

      carrier.x += errorX * (carrierMobility / mobilitySum);
      carrier.y += errorY * (carrierMobility / mobilitySum);
      attached.x -= errorX * (attachedMobility / mobilitySum);
      attached.y -= errorY * (attachedMobility / mobilitySum);
    }

    function projectXpbdMinSeparation(constraint, indexByEntity, positions, mobility) {
      const aIndex = indexByEntity.get(constraint.a);
      const bIndex = indexByEntity.get(constraint.b);
      if (aIndex === undefined || bIndex === undefined) {
        return;
      }

      const a = positions[aIndex];
      const b = positions[bIndex];
      const distance = Math.hypot(b.x - a.x, b.y - a.y);
      if (distance >= constraint.minDistance) {
        return;
      }

      projectXpbdDistance(aIndex, bIndex, constraint.minDistance, positions, mobility);
    }

    function projectXpbdSum(constraint, indexByEntity, positions, mobility) {
      const listenerIndex = indexByEntity.get(constraint.listener);
      if (listenerIndex === undefined) {
        return;
      }

      const anchor = positions[listenerIndex];
      const sourceIndexes = constraint.sources
        .map((source) => indexByEntity.get(source))
        .filter((index) => index !== undefined && mobility[index] > 0);
      const total = constraint.sources.reduce((sum, source) => {
        const index = indexByEntity.get(source);
        if (index === undefined) {
          return sum;
        }
        return sum + Math.hypot(positions[index].x - anchor.x, positions[index].y - anchor.y);
      }, 0);
      const mobilitySum = sourceIndexes.reduce((sum, index) => sum + mobility[index], 0);
      if (mobilitySum <= 0) {
        return;
      }

      const residual = total - constraint.totalDistance;
      for (const index of sourceIndexes) {
        const source = positions[index];
        const dx = source.x - anchor.x;
        const dy = source.y - anchor.y;
        const distance = Math.hypot(dx, dy);
        const angle = distance === 0 ? 0 : Math.atan2(dy, dx);
        const nextDistance = Math.max(MIN_DISTANCE, distance - residual * (mobility[index] / mobilitySum));
        source.x = anchor.x + nextDistance * Math.cos(angle);
        source.y = anchor.y + nextDistance * Math.sin(angle);
      }
    }

    function projectXpbdProduct(constraint, indexByEntity, positions, mobility) {
      const listenerIndex = indexByEntity.get(constraint.listener);
      if (listenerIndex === undefined || constraint.product <= 0) {
        return;
      }

      const anchor = positions[listenerIndex];
      const sourceIndexes = constraint.sources
        .map((source) => indexByEntity.get(source))
        .filter((index) => index !== undefined && mobility[index] > 0);
      const mobilitySum = sourceIndexes.reduce((sum, index) => sum + mobility[index], 0);
      if (mobilitySum <= 0) {
        return;
      }

      const currentLogProduct = constraint.sources.reduce((sum, source) => {
        const index = indexByEntity.get(source);
        if (index === undefined) {
          return sum;
        }
        return (
          sum +
          Math.log(
            Math.max(MIN_DISTANCE, Math.hypot(positions[index].x - anchor.x, positions[index].y - anchor.y))
          )
        );
      }, 0);
      const logResidual = currentLogProduct - Math.log(Math.max(1, constraint.product));

      for (const index of sourceIndexes) {
        const source = positions[index];
        const dx = source.x - anchor.x;
        const dy = source.y - anchor.y;
        const distance = Math.max(MIN_DISTANCE, Math.hypot(dx, dy));
        const angle = Math.atan2(dy, dx);
        const nextDistance = distance * Math.exp(-logResidual * (mobility[index] / mobilitySum));
        source.x = anchor.x + nextDistance * Math.cos(angle);
        source.y = anchor.y + nextDistance * Math.sin(angle);
      }
    }

    function projectXpbdRatio(constraint, indexByEntity, positions, mobility) {
      const listenerIndex = indexByEntity.get(constraint.listener);
      const aIndex = indexByEntity.get(constraint.a);
      const bIndex = indexByEntity.get(constraint.b);
      if (
        listenerIndex === undefined ||
        aIndex === undefined ||
        bIndex === undefined ||
        constraint.ratio <= 0
      ) {
        return;
      }

      const anchor = positions[listenerIndex];
      const a = positions[aIndex];
      const b = positions[bIndex];
      const distanceA = Math.max(MIN_DISTANCE, Math.hypot(a.x - anchor.x, a.y - anchor.y));
      const distanceB = Math.max(MIN_DISTANCE, Math.hypot(b.x - anchor.x, b.y - anchor.y));
      const mobilitySum = mobility[aIndex] + mobility[bIndex];
      if (mobilitySum <= 0) {
        return;
      }

      const logResidual = Math.log(distanceA / distanceB) - Math.log(constraint.ratio);
      if (mobility[aIndex] > 0) {
        setXpbdPolarDistance(
          a,
          anchor,
          distanceA * Math.exp(-logResidual * (mobility[aIndex] / mobilitySum))
        );
      }
      if (mobility[bIndex] > 0) {
        setXpbdPolarDistance(b, anchor, distanceB * Math.exp(logResidual * (mobility[bIndex] / mobilitySum)));
      }
    }

    function projectXpbdAngle(constraint, indexByEntity, positions, mobility) {
      const listenerIndex = indexByEntity.get(constraint.listener);
      const aIndex = indexByEntity.get(constraint.a);
      const bIndex = indexByEntity.get(constraint.b);
      if (listenerIndex === undefined || aIndex === undefined || bIndex === undefined) {
        return;
      }

      const anchor = positions[listenerIndex];
      const a = positions[aIndex];
      const b = positions[bIndex];
      const angleA = Math.atan2(a.y - anchor.y, a.x - anchor.x);
      const angleB = Math.atan2(b.y - anchor.y, b.x - anchor.x);
      const residual = normalizeAngle(angleB - angleA - constraint.angle);
      const mobilitySum = mobility[aIndex] + mobility[bIndex];
      if (mobilitySum <= 0) {
        return;
      }

      if (mobility[aIndex] > 0) {
        rotateXpbdAround(a, anchor, residual * (mobility[aIndex] / mobilitySum));
      }
      if (mobility[bIndex] > 0) {
        rotateXpbdAround(b, anchor, -residual * (mobility[bIndex] / mobilitySum));
      }
    }

    function setXpbdPolarDistance(position, anchor, distance) {
      const angle = Math.atan2(position.y - anchor.y, position.x - anchor.x);
      position.x = anchor.x + Math.max(MIN_DISTANCE, distance) * Math.cos(angle);
      position.y = anchor.y + Math.max(MIN_DISTANCE, distance) * Math.sin(angle);
    }

    function rotateXpbdAround(position, anchor, deltaAngle) {
      const dx = position.x - anchor.x;
      const dy = position.y - anchor.y;
      const rotated = rotateVector(dx, dy, deltaAngle);
      position.x = anchor.x + rotated.x;
      position.y = anchor.y + rotated.y;
    }

    function enforceConstraintsByPropagation(moved) {
      const messages = [];
      const queue = [];
      const queuedEntities = new Set();
      const processCounts = new Map();
      const movedEntities = new Set();
      let propagationSteps = 0;
      let hitEntityCap = false;

      enqueuePropagationEntity(moved, queue, queuedEntities, processCounts);

      let head = 0;
      while (head < queue.length && propagationSteps < MAX_PROPAGATION_STEPS) {
        const currentMoved = queue[head++];
        queuedEntities.delete(currentMoved);

        const processCount = processCounts.get(currentMoved) || 0;
        if (processCount >= MAX_ENTITY_PROPAGATION_COUNT) {
          hitEntityCap = true;
          continue;
        }
        processCounts.set(currentMoved, processCount + 1);
        movedEntities.add(currentMoved);
        propagationSteps += 1;

        for (const constraint of graph.neighbors(currentMoved)) {
          const result = constraint.enforce(currentMoved);
          if (result && result.message && !messages.includes(result.message)) {
            messages.push(result.message);
          }
          for (const movedEntity of result?.movedEntities || []) {
            enqueuePropagationEntity(movedEntity, queue, queuedEntities, processCounts, currentMoved);
          }
          if (result?.movedEntity) {
            enqueuePropagationEntity(result.movedEntity, queue, queuedEntities, processCounts, currentMoved);
          }
        }
      }

      state.lastPropagationReport = createPropagationReport({
        hitEntityCap:
          hitEntityCap || [...processCounts.values()].some((count) => count >= MAX_ENTITY_PROPAGATION_COUNT),
        hitStepCap: head < queue.length,
        messages,
        movedEntities: [...movedEntities],
        processCounts,
        propagationSteps
      });
      setConstraintStatus(formatPropagationStatus(state.lastPropagationReport));
    }

    function enqueuePropagationEntity(entity, queue, queuedEntities, processCounts, currentMoved = null) {
      if (!entity || entity === currentMoved || queuedEntities.has(entity)) {
        return;
      }

      if ((processCounts.get(entity) || 0) >= MAX_ENTITY_PROPAGATION_COUNT) {
        return;
      }

      queue.push(entity);
      queuedEntities.add(entity);
    }

    function createPropagationReport({
      hitEntityCap,
      hitStepCap,
      messages,
      movedEntities,
      processCounts,
      propagationPaused = false,
      propagationSteps,
      solverMode = SOLVER_MODE_PROPAGATION
    }) {
      const residuals = measureConstraintResiduals();

      return {
        hitEntityCap,
        hitStepCap,
        messages,
        movedEntities,
        processCounts,
        propagationPaused,
        propagationSteps,
        residuals,
        solverMode,
        satisfied: residuals.length === 0 && !hitEntityCap && !hitStepCap && !propagationPaused
      };
    }

    function measureConstraintResiduals() {
      return state.constraints
        .map((constraint) => ({
          constraint,
          measurement: normalizeConstraintMeasurement(constraint)
        }))
        .filter(({ measurement }) => measurement.error > measurement.tolerance);
    }

    function normalizeConstraintMeasurement(constraint) {
      const measurement = constraint.measureError?.() || {
        error: 0,
        label: constraint.node?.label || "Constraint",
        tolerance: CONSTRAINT_EPSILON,
        unit: "px"
      };

      return {
        error: Number.isFinite(measurement.error) ? measurement.error : Number.POSITIVE_INFINITY,
        label: measurement.label || constraint.node?.label || "Constraint",
        tolerance: measurement.tolerance ?? CONSTRAINT_EPSILON,
        unit: measurement.unit || ""
      };
    }

    function formatPropagationStatus(report) {
      const statusParts = [...report.messages];

      if (report.solverMode === SOLVER_MODE_XPBD) {
        if (report.residuals.length > 0) {
          statusParts.push("Best fit.");
        }
      } else {
        if (report.hitStepCap) {
          statusParts.push(`Propagation stopped after ${MAX_PROPAGATION_STEPS} steps.`);
        } else if (report.hitEntityCap) {
          statusParts.push(`Propagation capped one entity after ${MAX_ENTITY_PROPAGATION_COUNT} passes.`);
        }
      }

      if (report.residuals.length > 0) {
        const residual = report.residuals[0].measurement;
        const suffix = report.residuals.length > 1 ? ` (+${report.residuals.length - 1} more)` : "";
        statusParts.push(`${residual.label} residual ${formatConstraintError(residual)}${suffix}.`);
      }

      return statusParts.join(" ");
    }

    function formatConstraintError(measurement) {
      const roundedError =
        measurement.error >= 10
          ? measurement.error.toFixed(1)
          : measurement.error.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
      const roundedTolerance =
        measurement.tolerance >= 10
          ? measurement.tolerance.toFixed(1)
          : measurement.tolerance.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
      const unit = measurement.unit ? ` ${measurement.unit}` : "";
      return `${roundedError}${unit} > ${roundedTolerance}${unit}`;
    }

    function getLastPropagationReport() {
      if (!state.lastPropagationReport) {
        return null;
      }

      return {
        hitEntityCap: state.lastPropagationReport.hitEntityCap,
        hitStepCap: state.lastPropagationReport.hitStepCap,
        messages: [...state.lastPropagationReport.messages],
        movedEntities: state.lastPropagationReport.movedEntities.map(entityLabel),
        propagationPaused: state.lastPropagationReport.propagationPaused,
        propagationSteps: state.lastPropagationReport.propagationSteps,
        residuals: state.lastPropagationReport.residuals.map(({ measurement }) => ({
          error: measurement.error,
          label: measurement.label,
          tolerance: measurement.tolerance,
          unit: measurement.unit
        })),
        solverMode: state.lastPropagationReport.solverMode,
        satisfied: state.lastPropagationReport.satisfied
      };
    }
    return {
      enforceConstraints,
      hasDynamics,
      initializeDynamics,
      stepDynamics,
      refineXpbdAfterDrag,
      enforceConstraintsWithXpbd,
      createPropagationReport,
      measureConstraintResiduals,
      formatPropagationStatus,
      getLastPropagationReport
    };
  }
  const api = { createSolvers };
  if (typeof module === "object" && module.exports) module.exports = api;
  else global.MusicSpaceSolvers = api;
})(globalThis);

},
"./musicspace-model": function(module, exports, require) {
// Headless scene state, entities and edit operations. Rendering is attached by the UI.
(function exposeModel(global) {
  const isNode = typeof module === "object" && module.exports;
  const constants = isNode ? require("./musicspace-constants") : global.MusicSpaceConstants;
  const patchApi = isNode ? require("./musicspace-patch") : global.MusicSpacePatch;
  const trajectoryApi = isNode ? require("./musicspace-trajectories") : global.MusicSpaceTrajectories;
  const graphApi = isNode ? require("./musicspace-graph") : global.MusicSpaceGraph;
  const solverApi = isNode ? require("./musicspace-solvers") : global.MusicSpaceSolvers;
  function createSceneModel(options = {}) {
    const {
      WIDTH,
      HEIGHT,
      LISTENER_MODE_RETARGET,
      MIN_DISTANCE,
      CONSTRAINT_EPSILON,
      PRODUCT_EPSILON,
      SOLVER_MODE_PROPAGATION,
      SOLVER_MODE_XPBD,
      DEFAULT_SOLVER_MODE,
      ANGLE_EPSILON,
      RATIO_EPSILON,
      RELATIVE_PRODUCT_EPSILON
    } = constants;
    const state = {
      listener: null,
      sources: [],
      movingObjects: [],
      constraints: [],
      listenerMode: LISTENER_MODE_RETARGET,
      solverMode: DEFAULT_SOLVER_MODE,
      lastPropagationReport: null,
      propagationPaused: false,
      gravity: { x: 0, y: 0 },
      draggedEntity: null
    };
    const graph = graphApi.createConstraintGraph();
    let trackedConstraints = graph.track(state.constraints);
    Object.defineProperty(state, "constraints", {
      enumerable: true,
      get: () => trackedConstraints,
      set(next) {
        trackedConstraints = graph.track(next);
      }
    });
    const setConstraintStatus = options.onStatus || (() => {});
    const { validatePatch } = patchApi.createPatchTools(options);
    let patchData = {};
    let lastValidation = [];
    const trajectories = trajectoryApi.createTrajectories({
      getListener: () => state.listener,
      getObjectByName
    });
    const { normalizeTrajectory, resolveTrajectoryEndpoint } = trajectories;
    class Entity {
      constructor(x, y, color = "#2563eb") {
        this.x = x;
        this.y = y;
        this.radius = 13;
        this.color = color;
        this.prevX = x;
        this.prevY = y;
        this.drawTrace = false;
      }

      isInside(px, py) {
        return (px - this.x) ** 2 + (py - this.y) ** 2 <= this.radius ** 2;
      }
    }

    class Listener extends Entity {
      constructor(x, y) {
        super(x, y, "#111827");
        this.name = "Listener";
      }
    }

    class SoundSource extends Entity {
      constructor(x, y, name) {
        super(x, y, "#dc2626");
        this.name = name;
        this.prevX = x;
        this.prevY = y;
      }
    }

    class MovingObject extends Entity {
      constructor(x, y, name, trajectory = { type: "free" }) {
        super(x, y, "#0891b2");
        this.name = name;
        this.radius = 11;
        this.prevX = x;
        this.prevY = y;
        this.trajectory = normalizeTrajectory(trajectory, x, y);
      }

      tick() {
        return trajectories.tick(this);
      }
    }

    class ConstraintNode extends Entity {
      constructor(x, y, label, color = "#d97706", glyph = label[0]) {
        super(x, y, color);
        this.label = label;
        this.glyph = glyph;
        this.isManual = false;
      }
    }

    class AngleConstraint {
      constructor(listener, a, b) {
        this.listener = listener;
        this.a = a;
        this.b = b;
        this.angle = this.computeAngle();
        this.node = new ConstraintNode((a.x + b.x) / 2, (a.y + b.y) / 2, "Angle", "#2563eb");
      }

      computeAngle() {
        return (
          Math.atan2(this.b.y - this.listener.y, this.b.x - this.listener.x) -
          Math.atan2(this.a.y - this.listener.y, this.a.x - this.listener.x)
        );
      }

      affectedEntities() {
        return [this.listener, this.a, this.b];
      }

      measureError() {
        return {
          label: this.node.label,
          error: Math.abs(normalizeAngle(this.computeAngle() - this.angle)),
          tolerance: ANGLE_EPSILON,
          unit: "rad"
        };
      }

      refresh() {
        this.angle = this.computeAngle();
        this.updateNode();
      }

      updateNode() {
        if (!this.node.isManual) {
          this.node.x = (this.a.x + this.b.x) / 2;
          this.node.y = (this.a.y + this.b.y) / 2;
        }
      }

      enforce(moved) {
        if (moved !== this.a && moved !== this.b && moved !== this.listener) {
          return;
        }

        if (moved === this.b) {
          const baseAngle = Math.atan2(this.b.y - this.listener.y, this.b.x - this.listener.x);
          const newAngle = baseAngle - this.angle;
          const dist = Math.hypot(this.a.x - this.listener.x, this.a.y - this.listener.y);

          const nextX = this.listener.x + dist * Math.cos(newAngle);
          const nextY = this.listener.y + dist * Math.sin(newAngle);
          translateEntity(this.a, nextX - this.a.x, nextY - this.a.y);
          this.updateNode();
          return { satisfied: true, movedEntity: this.a };
        } else {
          const baseAngle = Math.atan2(this.a.y - this.listener.y, this.a.x - this.listener.x);
          const newAngle = baseAngle + this.angle;
          const dist = Math.hypot(this.b.x - this.listener.x, this.b.y - this.listener.y);

          const nextX = this.listener.x + dist * Math.cos(newAngle);
          const nextY = this.listener.y + dist * Math.sin(newAngle);
          translateEntity(this.b, nextX - this.b.x, nextY - this.b.y);
          this.updateNode();
          return { satisfied: true, movedEntity: this.b };
        }
      }
    }

    class SumConstraint {
      constructor(listener, sources) {
        this.listener = listener;
        this.sources = sources;
        this.totalDistance = this.computeTotalDistance();
        this.node = new ConstraintNode(listener.x + 90, listener.y, "Sum", "#059669");
      }

      computeTotalDistance() {
        return this.sources.reduce((sum, source) => sum + this.distanceToListener(source), 0);
      }

      distanceToListener(source) {
        return Math.hypot(source.x - this.listener.x, source.y - this.listener.y);
      }

      affectedEntities() {
        return [this.listener, ...this.sources];
      }

      measureError() {
        return {
          label: this.node.label,
          error: Math.abs(this.computeTotalDistance() - this.totalDistance),
          tolerance: CONSTRAINT_EPSILON,
          unit: "px"
        };
      }

      refresh() {
        this.totalDistance = this.computeTotalDistance();
      }

      enforce(moved) {
        if (moved !== this.listener && !this.sources.includes(moved)) {
          return;
        }

        const adjustableSources =
          moved === this.listener ? [...this.sources] : this.sources.filter((source) => source !== moved);
        const currentTotal = this.computeTotalDistance();
        const delta = this.totalDistance - currentTotal;
        const result = distributeDistanceDelta(adjustableSources, delta, this.listener);

        if (!result.satisfied && moved !== this.listener && this.sources.includes(moved)) {
          const movedDistance = this.distanceToListener(moved);
          setSourceDistance(
            moved,
            this.listener,
            Math.max(MIN_DISTANCE, movedDistance + result.remainingDelta)
          );
        }

        const remainingError = this.totalDistance - this.computeTotalDistance();
        if (Math.abs(remainingError) > CONSTRAINT_EPSILON) {
          return {
            satisfied: false,
            movedEntities: result.movedEntities,
            message: "Sum constraint reached its limit; source motion was backed off."
          };
        }

        if (!result.satisfied) {
          return {
            satisfied: true,
            movedEntities: result.movedEntities,
            message: "Sum constraint used backoff to keep distances non-negative."
          };
        }

        return { satisfied: true, movedEntities: result.movedEntities };
      }
    }

    class ProductConstraint {
      constructor(listener, sources) {
        this.listener = listener;
        this.sources = sources;
        this.product = this.computeProduct();
        this.node = new ConstraintNode(listener.x - 90, listener.y, "Product", "#7c3aed", "π");
      }

      computeProduct() {
        return this.sources.reduce((product, source) => product * this.distanceToListener(source), 1);
      }

      distanceToListener(source) {
        return Math.max(MIN_DISTANCE, Math.hypot(source.x - this.listener.x, source.y - this.listener.y));
      }

      affectedEntities() {
        return [this.listener, ...this.sources];
      }

      measureError() {
        return {
          label: this.node.label,
          error: Math.abs(this.computeProduct() - this.product) / Math.max(1, Math.abs(this.product)),
          tolerance: RELATIVE_PRODUCT_EPSILON,
          unit: "relative"
        };
      }

      refresh() {
        this.product = this.computeProduct();
      }

      enforce(moved) {
        if (moved !== this.listener && !this.sources.includes(moved)) {
          return;
        }

        const adjustableSources =
          moved === this.listener ? [...this.sources] : this.sources.filter((source) => source !== moved);
        const result = distributeProduct(adjustableSources, this.product, this.sources, this.listener);
        const error = Math.abs(this.computeProduct() - this.product);

        if (error > PRODUCT_EPSILON) {
          return {
            satisfied: false,
            movedEntities: result.movedEntities,
            message: "Product constraint has no solution within the active limits."
          };
        }

        if (result.usedBackoff) {
          return {
            satisfied: true,
            movedEntities: result.movedEntities,
            message: "Product constraint skipped a limited source and propagated to the remaining sources."
          };
        }

        return { satisfied: true, movedEntities: result.movedEntities };
      }
    }

    class RadialLimitConstraint {
      constructor(listener, source, minDistance, maxDistance) {
        this.listener = listener;
        this.source = source;
        this.minDistance = minDistance;
        this.maxDistance = maxDistance;
        this.node = new ConstraintNode(source.x, source.y - 56, "Limit", "#ea580c");
      }

      refresh() {
        this.updateNode();
      }

      affectedEntities() {
        return [this.listener, this.source];
      }

      measureError() {
        const distance = distanceBetween(this.source, this.listener);
        return {
          label: this.node.label,
          error: Math.max(0, this.minDistance - distance, distance - this.maxDistance),
          tolerance: CONSTRAINT_EPSILON,
          unit: "px"
        };
      }

      updateNode() {
        if (!this.node.isManual) {
          this.node.x = (this.listener.x + this.source.x) / 2;
          this.node.y = (this.listener.y + this.source.y) / 2;
        }
      }

      enforce(moved) {
        if (moved !== this.source && moved !== this.listener) {
          return;
        }

        const distance = Math.hypot(this.source.x - this.listener.x, this.source.y - this.listener.y);
        const clampedDistance = clamp(distance, this.minDistance, this.maxDistance);

        if (Math.abs(distance - clampedDistance) > CONSTRAINT_EPSILON) {
          setSourceDistance(this.source, this.listener, clampedDistance);
          this.updateNode();
          return {
            satisfied: true,
            movedEntity: this.source,
            message: `${this.source.name} reached its radial limit.`
          };
        }

        this.updateNode();
        return { satisfied: true };
      }
    }

    class FixedDistanceConstraint {
      constructor(anchor, target, distance = distanceBetween(anchor, target)) {
        this.anchor = anchor;
        this.target = target;
        this.distance = distance;
        this.node = new ConstraintNode(
          (anchor.x + target.x) / 2,
          (anchor.y + target.y) / 2,
          "Distance",
          "#0f766e"
        );
      }

      refresh() {
        this.distance = distanceBetween(this.anchor, this.target);
        this.updateNode();
      }

      affectedEntities() {
        return [this.anchor, this.target];
      }

      measureError() {
        return {
          label: this.node.label,
          error: Math.abs(distanceBetween(this.anchor, this.target) - this.distance),
          tolerance: CONSTRAINT_EPSILON,
          unit: "px"
        };
      }

      updateNode() {
        if (!this.node.isManual) {
          this.node.x = (this.anchor.x + this.target.x) / 2;
          this.node.y = (this.anchor.y + this.target.y) / 2;
        }
      }

      enforce(moved) {
        if (moved !== this.anchor && moved !== this.target) {
          return;
        }

        if (moved === this.anchor) {
          setEntityDistance(this.target, this.anchor, this.distance);
        } else {
          setEntityDistance(this.target, this.anchor, this.distance);
        }

        this.updateNode();
        return {
          satisfied: true,
          movedEntity: this.target
        };
      }
    }

    class SpringConstraint {
      constructor(
        anchor,
        target,
        restLength = Math.hypot(target.x - anchor.x, target.y - anchor.y),
        stiffness = 40,
        damping = 2
      ) {
        this.anchor = anchor;
        this.target = target;
        this.restLength = restLength;
        this.stiffness = stiffness;
        this.damping = damping;
        this.node = new ConstraintNode(
          (anchor.x + target.x) / 2,
          (anchor.y + target.y) / 2,
          "Spring",
          "#be185d",
          "S"
        );
      }

      affectedEntities() {
        return [this.anchor, this.target];
      }

      refresh() {
        this.restLength = Math.hypot(this.target.x - this.anchor.x, this.target.y - this.anchor.y);
        this.updateNode();
      }

      updateNode() {
        if (!this.node.isManual) {
          this.node.x = (this.anchor.x + this.target.x) / 2;
          this.node.y = (this.anchor.y + this.target.y) / 2;
        }
      }

      // Extension stores energy; it is not a failed geometric constraint.
      measureError() {
        return { label: "Spring", error: 0, tolerance: CONSTRAINT_EPSILON, unit: "px" };
      }
      enforce() {
        this.updateNode();
        return { satisfied: true };
      }
    }

    class DistanceRatioConstraint {
      constructor(listener, a, b, ratio = distanceBetween(a, listener) / distanceBetween(b, listener)) {
        this.listener = listener;
        this.a = a;
        this.b = b;
        this.ratio = ratio;
        this.node = new ConstraintNode((a.x + b.x) / 2, (a.y + b.y) / 2, "Ratio", "#9333ea");
      }

      refresh() {
        this.ratio = distanceBetween(this.a, this.listener) / distanceBetween(this.b, this.listener);
        this.updateNode();
      }

      affectedEntities() {
        return [this.listener, this.a, this.b];
      }

      measureError() {
        const currentRatio =
          distanceBetween(this.a, this.listener) /
          Math.max(MIN_DISTANCE, distanceBetween(this.b, this.listener));
        return {
          label: this.node.label,
          error: Math.abs(currentRatio - this.ratio),
          tolerance: RATIO_EPSILON,
          unit: "ratio"
        };
      }

      updateNode() {
        if (!this.node.isManual) {
          this.node.x = (this.a.x + this.b.x) / 2;
          this.node.y = (this.a.y + this.b.y) / 2;
        }
      }

      enforce(moved) {
        if (moved !== this.listener && moved !== this.a && moved !== this.b) {
          return;
        }

        let movedEntity;
        if (moved === this.b) {
          setEntityDistance(this.a, this.listener, distanceBetween(this.b, this.listener) * this.ratio);
          movedEntity = this.a;
        } else {
          setEntityDistance(this.b, this.listener, distanceBetween(this.a, this.listener) / this.ratio);
          movedEntity = this.b;
        }

        this.updateNode();
        return { satisfied: true, movedEntity };
      }
    }

    class PinConstraint {
      constructor(target, x = target.x, y = target.y) {
        this.target = target;
        this.fixedX = x;
        this.fixedY = y;
        this.node = new ConstraintNode(target.x + 34, target.y - 34, "Pin", "#475569");
      }

      refresh() {
        this.fixedX = this.target.x;
        this.fixedY = this.target.y;
        this.updateNode();
      }

      affectedEntities() {
        return [this.target];
      }

      measureError() {
        return {
          label: this.node.label,
          error: Math.hypot(this.target.x - this.fixedX, this.target.y - this.fixedY),
          tolerance: CONSTRAINT_EPSILON,
          unit: "px"
        };
      }

      updateNode() {
        if (!this.node.isManual) {
          this.node.x = this.target.x + 34;
          this.node.y = this.target.y - 34;
        }
      }

      enforce(moved) {
        if (moved !== this.target) {
          return;
        }

        translateEntity(this.target, this.fixedX - this.target.x, this.fixedY - this.target.y);
        this.updateNode();
        return {
          satisfied: true,
          movedEntity: this.target,
          message: `${entityLabel(this.target)} is pinned.`
        };
      }
    }

    class SolidAttachmentConstraint {
      constructor(carrier, attached, offsetX = attached.x - carrier.x, offsetY = attached.y - carrier.y) {
        this.carrier = carrier;
        this.attached = attached;
        this.offsetX = offsetX;
        this.offsetY = offsetY;
        this.node = new ConstraintNode(
          (carrier.x + attached.x) / 2,
          (carrier.y + attached.y) / 2,
          "Link",
          "#0369a1"
        );
      }

      refresh() {
        this.offsetX = this.attached.x - this.carrier.x;
        this.offsetY = this.attached.y - this.carrier.y;
        this.updateNode();
      }

      affectedEntities() {
        return [this.carrier, this.attached];
      }

      measureError() {
        return {
          label: this.node.label,
          error: Math.hypot(
            this.attached.x - this.carrier.x - this.offsetX,
            this.attached.y - this.carrier.y - this.offsetY
          ),
          tolerance: CONSTRAINT_EPSILON,
          unit: "px"
        };
      }

      updateNode() {
        if (!this.node.isManual) {
          this.node.x = (this.carrier.x + this.attached.x) / 2;
          this.node.y = (this.carrier.y + this.attached.y) / 2;
        }
      }

      enforce(moved) {
        if (moved === this.carrier) {
          this.applyCarrierRotation();
          const nextX = this.carrier.x + this.offsetX;
          const nextY = this.carrier.y + this.offsetY;
          translateEntity(this.attached, nextX - this.attached.x, nextY - this.attached.y);
          this.updateNode();
          return { satisfied: true, movedEntity: this.attached };
        }

        if (moved === this.attached) {
          const nextX = this.attached.x - this.offsetX;
          const nextY = this.attached.y - this.offsetY;
          translateEntity(this.carrier, nextX - this.carrier.x, nextY - this.carrier.y);
          this.updateNode();
          return { satisfied: true, movedEntity: this.carrier };
        }

        return undefined;
      }

      applyCarrierRotation() {
        if (!(this.carrier instanceof MovingObject) || this.carrier.trajectory?.type !== "rotator") {
          return;
        }

        const delta = this.carrier.trajectory.rotationDelta || 0;
        if (Math.abs(delta) < 0.000001) {
          return;
        }

        const rotated = rotateVector(this.offsetX, this.offsetY, delta);
        this.offsetX = rotated.x;
        this.offsetY = rotated.y;
      }
    }

    class MinimumSeparationConstraint {
      constructor(a, b, minDistance = 80) {
        this.a = a;
        this.b = b;
        this.minDistance = minDistance;
        this.node = new ConstraintNode((a.x + b.x) / 2, (a.y + b.y) / 2, "Separate", "#be123c");
      }

      refresh() {
        this.minDistance = Math.max(this.minDistance, distanceBetween(this.a, this.b));
        this.updateNode();
      }

      affectedEntities() {
        return [this.a, this.b];
      }

      measureError() {
        return {
          label: this.node.label,
          error: Math.max(0, this.minDistance - distanceBetween(this.a, this.b)),
          tolerance: CONSTRAINT_EPSILON,
          unit: "px"
        };
      }

      updateNode() {
        if (!this.node.isManual) {
          this.node.x = (this.a.x + this.b.x) / 2;
          this.node.y = (this.a.y + this.b.y) / 2;
        }
      }

      enforce(moved) {
        if (moved !== this.a && moved !== this.b) {
          return;
        }

        const distance = Math.hypot(this.b.x - this.a.x, this.b.y - this.a.y);
        if (distance >= this.minDistance) {
          this.updateNode();
          return { satisfied: true };
        }

        const pushed = moved === this.a ? this.b : this.a;
        const anchor = moved === this.a ? this.a : this.b;
        const angle = distance === 0 ? 0 : Math.atan2(pushed.y - anchor.y, pushed.x - anchor.x);
        const nextX = anchor.x + this.minDistance * Math.cos(angle);
        const nextY = anchor.y + this.minDistance * Math.sin(angle);
        translateEntity(pushed, nextX - pushed.x, nextY - pushed.y);
        this.updateNode();
        return {
          satisfied: true,
          movedEntity: pushed,
          message: "Minimum separation pushed the paired object away."
        };
      }
    }

    class AngleSectorConstraint {
      constructor(
        listener,
        source,
        centerAngle = Math.atan2(source.y - listener.y, source.x - listener.x),
        width = Math.PI / 2
      ) {
        this.listener = listener;
        this.source = source;
        this.centerAngle = centerAngle;
        this.width = width;
        this.node = new ConstraintNode(source.x, source.y - 52, "Sector", "#c2410c");
      }

      refresh() {
        this.centerAngle = Math.atan2(this.source.y - this.listener.y, this.source.x - this.listener.x);
        this.updateNode();
      }

      affectedEntities() {
        return [this.listener, this.source];
      }

      measureError() {
        const angle = Math.atan2(this.source.y - this.listener.y, this.source.x - this.listener.x);
        const delta = normalizeAngle(angle - this.centerAngle);
        return {
          label: this.node.label,
          error: Math.max(0, Math.abs(delta) - this.width / 2),
          tolerance: ANGLE_EPSILON,
          unit: "rad"
        };
      }

      updateNode() {
        if (!this.node.isManual) {
          this.node.x = (this.listener.x + this.source.x) / 2;
          this.node.y = (this.listener.y + this.source.y) / 2;
        }
      }

      enforce(moved) {
        if (moved !== this.source && moved !== this.listener) {
          return;
        }

        const distance = distanceBetween(this.source, this.listener);
        const angle = Math.atan2(this.source.y - this.listener.y, this.source.x - this.listener.x);
        const delta = normalizeAngle(angle - this.centerAngle);
        const halfWidth = this.width / 2;

        if (Math.abs(delta) > halfWidth) {
          const clampedAngle = this.centerAngle + clamp(delta, -halfWidth, halfWidth);
          const nextX = this.listener.x + distance * Math.cos(clampedAngle);
          const nextY = this.listener.y + distance * Math.sin(clampedAngle);
          translateEntity(this.source, nextX - this.source.x, nextY - this.source.y);
          this.updateNode();
          return {
            satisfied: true,
            movedEntity: this.source,
            message: `${entityLabel(this.source)} reached its angle sector.`
          };
        }

        this.updateNode();
        return { satisfied: true };
      }
    }
    function createObjectMap() {
      const objectByName = new Map([[state.listener.name, state.listener]]);
      for (const source of state.sources) {
        objectByName.set(source.name, source);
      }
      for (const mover of state.movingObjects) {
        objectByName.set(mover.name, mover);
      }
      return objectByName;
    }

    function createConstraintFromSpec(spec, objectByName) {
      let constraint = null;

      if (spec.type === "angle") {
        constraint = new AngleConstraint(
          state.listener,
          objectByName.get(spec.sources[0]),
          objectByName.get(spec.sources[1])
        );
      } else if (spec.type === "sum") {
        constraint = new SumConstraint(
          state.listener,
          spec.sources.map((name) => objectByName.get(name))
        );
      } else if (spec.type === "product") {
        constraint = new ProductConstraint(
          state.listener,
          spec.sources.map((name) => objectByName.get(name))
        );
      } else if (spec.type === "radialLimit") {
        constraint = new RadialLimitConstraint(
          state.listener,
          objectByName.get(spec.source),
          spec.minDistance,
          spec.maxDistance
        );
      } else if (spec.type === "spring") {
        constraint = new SpringConstraint(
          objectByName.get(spec.anchor),
          objectByName.get(spec.target),
          spec.restLength,
          spec.stiffness,
          spec.damping
        );
      } else if (spec.type === "fixedDistance") {
        constraint = new FixedDistanceConstraint(
          objectByName.get(spec.anchor),
          objectByName.get(spec.target),
          spec.distance
        );
      } else if (spec.type === "distanceRatio") {
        constraint = new DistanceRatioConstraint(
          state.listener,
          objectByName.get(spec.sources[0]),
          objectByName.get(spec.sources[1]),
          spec.ratio
        );
      } else if (spec.type === "pin") {
        constraint = new PinConstraint(objectByName.get(spec.target), spec.x, spec.y);
      } else if (spec.type === "solid") {
        constraint = new SolidAttachmentConstraint(
          objectByName.get(spec.carrier),
          objectByName.get(spec.attached),
          spec.offsetX,
          spec.offsetY
        );
      } else if (spec.type === "separation") {
        constraint = new MinimumSeparationConstraint(
          objectByName.get(spec.sources[0]),
          objectByName.get(spec.sources[1]),
          spec.minDistance
        );
      } else if (spec.type === "angleSector") {
        constraint = new AngleSectorConstraint(
          state.listener,
          objectByName.get(spec.source),
          spec.centerAngle,
          spec.width
        );
      }

      if (!constraint || hasMissingConstraintSources(constraint)) {
        return null;
      }

      if (constraint instanceof AngleConstraint && spec.angle !== undefined) constraint.angle = spec.angle;
      if (constraint instanceof SumConstraint && spec.totalDistance !== undefined)
        constraint.totalDistance = spec.totalDistance;
      if (constraint instanceof ProductConstraint && spec.product !== undefined)
        constraint.product = spec.product;

      if (spec.node) {
        constraint.node.x = spec.node.x;
        constraint.node.y = spec.node.y;
        constraint.node.isManual = Boolean(spec.node.isManual);
        constraint.node.drawTrace = Boolean(spec.node.drawTrace);
      }

      return constraint;
    }

    function hasMissingConstraintSources(constraint) {
      if (constraint instanceof AngleConstraint) {
        return !constraint.a || !constraint.b;
      }

      if (constraint instanceof SumConstraint || constraint instanceof ProductConstraint) {
        return constraint.sources.some((source) => !source);
      }

      if (constraint instanceof RadialLimitConstraint) {
        return !constraint.source;
      }

      if (constraint instanceof FixedDistanceConstraint || constraint instanceof SpringConstraint) {
        return !constraint.anchor || !constraint.target;
      }

      if (constraint instanceof DistanceRatioConstraint) {
        return !constraint.a || !constraint.b;
      }

      if (constraint instanceof PinConstraint) {
        return !constraint.target;
      }

      if (constraint instanceof SolidAttachmentConstraint) {
        return !constraint.carrier || !constraint.attached;
      }

      if (constraint instanceof MinimumSeparationConstraint) {
        return !constraint.a || !constraint.b;
      }

      if (constraint instanceof AngleSectorConstraint) {
        return !constraint.source;
      }

      return true;
    }

    function constraintReferencesEntity(constraint, entity) {
      if (constraint.node === entity) {
        return true;
      }

      if (constraint instanceof AngleConstraint) {
        return constraint.a === entity || constraint.b === entity || constraint.listener === entity;
      }

      if (constraint instanceof SumConstraint || constraint instanceof ProductConstraint) {
        return constraint.listener === entity || constraint.sources.includes(entity);
      }

      if (constraint instanceof RadialLimitConstraint) {
        return constraint.listener === entity || constraint.source === entity;
      }

      if (constraint instanceof FixedDistanceConstraint || constraint instanceof SpringConstraint) {
        return constraint.anchor === entity || constraint.target === entity;
      }

      if (constraint instanceof DistanceRatioConstraint) {
        return constraint.listener === entity || constraint.a === entity || constraint.b === entity;
      }

      if (constraint instanceof PinConstraint) {
        return constraint.target === entity;
      }

      if (constraint instanceof SolidAttachmentConstraint) {
        return constraint.carrier === entity || constraint.attached === entity;
      }

      if (constraint instanceof MinimumSeparationConstraint) {
        return constraint.a === entity || constraint.b === entity;
      }

      if (constraint instanceof AngleSectorConstraint) {
        return constraint.listener === entity || constraint.source === entity;
      }

      return false;
    }

    function serializeConstraint(constraint) {
      const node = {
        x: constraint.node.x,
        y: constraint.node.y,
        isManual: constraint.node.isManual,
        drawTrace: constraint.node.drawTrace
      };

      if (constraint instanceof AngleConstraint) {
        return {
          type: "angle",
          angle: constraint.angle,
          sources: [entityLabel(constraint.a), entityLabel(constraint.b)],
          node
        };
      }

      if (constraint instanceof SumConstraint) {
        return {
          type: "sum",
          totalDistance: constraint.totalDistance,
          sources: constraint.sources.map(entityLabel),
          node
        };
      }

      if (constraint instanceof ProductConstraint) {
        return {
          type: "product",
          product: constraint.product,
          sources: constraint.sources.map(entityLabel),
          node
        };
      }

      if (constraint instanceof RadialLimitConstraint) {
        return {
          type: "radialLimit",
          source: entityLabel(constraint.source),
          minDistance: constraint.minDistance,
          maxDistance: constraint.maxDistance,
          node
        };
      }

      if (constraint instanceof SpringConstraint) {
        return {
          type: "spring",
          anchor: entityLabel(constraint.anchor),
          target: entityLabel(constraint.target),
          restLength: constraint.restLength,
          stiffness: constraint.stiffness,
          damping: constraint.damping,
          node
        };
      }

      if (constraint instanceof FixedDistanceConstraint) {
        return {
          type: "fixedDistance",
          anchor: entityLabel(constraint.anchor),
          target: entityLabel(constraint.target),
          distance: constraint.distance,
          node
        };
      }

      if (constraint instanceof DistanceRatioConstraint) {
        return {
          type: "distanceRatio",
          sources: [entityLabel(constraint.a), entityLabel(constraint.b)],
          ratio: constraint.ratio,
          node
        };
      }

      if (constraint instanceof PinConstraint) {
        return {
          type: "pin",
          target: entityLabel(constraint.target),
          x: constraint.fixedX,
          y: constraint.fixedY,
          node
        };
      }

      if (constraint instanceof SolidAttachmentConstraint) {
        return {
          type: "solid",
          carrier: entityLabel(constraint.carrier),
          attached: entityLabel(constraint.attached),
          offsetX: constraint.offsetX,
          offsetY: constraint.offsetY,
          node
        };
      }

      if (constraint instanceof MinimumSeparationConstraint) {
        return {
          type: "separation",
          sources: [entityLabel(constraint.a), entityLabel(constraint.b)],
          minDistance: constraint.minDistance,
          node
        };
      }

      if (constraint instanceof AngleSectorConstraint) {
        return {
          type: "angleSector",
          source: entityLabel(constraint.source),
          centerAngle: constraint.centerAngle,
          width: constraint.width,
          node
        };
      }

      return null;
    }

    function distanceBetween(a, b) {
      return Math.max(MIN_DISTANCE, Math.hypot(a.x - b.x, a.y - b.y));
    }

    function setEntityDistance(entity, anchor, distance) {
      const currentDistance = Math.hypot(entity.x - anchor.x, entity.y - anchor.y);
      const angle = currentDistance === 0 ? 0 : Math.atan2(entity.y - anchor.y, entity.x - anchor.x);

      const nextX = anchor.x + distance * Math.cos(angle);
      const nextY = anchor.y + distance * Math.sin(angle);
      translateEntity(entity, nextX - entity.x, nextY - entity.y);
    }

    function setSourceDistance(source, anchor, distance) {
      setEntityDistance(source, anchor, distance);
    }

    function translateEntity(entity, dx, dy) {
      if (entity instanceof MovingObject && entity.trajectory?.type === "rotator") {
        updateRotatorDisplacementDelta(entity, dx, dy);
      }

      entity.x += dx;
      entity.y += dy;

      if (entity instanceof MovingObject) {
        translateTrajectoryFrame(entity.trajectory, dx, dy);
      }
    }

    function translateTrajectoryFrame(trajectory, dx, dy) {
      if (!trajectory) {
        return;
      }

      if (trajectory.type === "rotation") {
        trajectory.centerX += dx;
        trajectory.centerY += dy;
      } else if (trajectory.type === "shuttle") {
        translateShuttleEndpoint(trajectory.start, dx, dy);
        translateShuttleEndpoint(trajectory.end, dx, dy);
        trajectory.ax = trajectory.start.x;
        trajectory.ay = trajectory.start.y;
        trajectory.bx = trajectory.end.x;
        trajectory.by = trajectory.end.y;
      }
    }

    function translateShuttleEndpoint(endpoint, dx, dy) {
      if (!endpoint || endpoint.type !== "fixed") {
        return;
      }

      endpoint.x += dx;
      endpoint.y += dy;
    }

    function updateRotatorDisplacementDelta(mover, dx, dy) {
      const trajectory = mover.trajectory;
      trajectory.rotationDelta = 0;

      if (!trajectory.displacementInducesRotation) {
        return;
      }

      const displacement = Math.hypot(dx, dy);
      if (displacement <= 0.001) {
        return;
      }

      const radius = averageAttachmentRadius(mover);
      trajectory.rotationDelta = (trajectory.direction * displacement) / radius;
      trajectory.phase += trajectory.rotationDelta;
    }

    function averageAttachmentRadius(mover) {
      const radii = state.constraints
        .filter(
          (constraint) => constraint instanceof SolidAttachmentConstraint && constraint.carrier === mover
        )
        .map((constraint) => Math.max(MIN_DISTANCE, Math.hypot(constraint.offsetX, constraint.offsetY)));

      if (radii.length === 0) {
        return 80;
      }

      return radii.reduce((sum, radius) => sum + radius, 0) / radii.length;
    }

    function rotateVector(x, y, angle) {
      return {
        x: x * Math.cos(angle) - y * Math.sin(angle),
        y: x * Math.sin(angle) + y * Math.cos(angle)
      };
    }

    function getObjectByName(name) {
      if (!name) {
        return null;
      }

      if (state.listener?.name === name) {
        return state.listener;
      }

      return (
        (state.sources || []).find((source) => source.name === name) ||
        (state.movingObjects || []).find((mover) => mover.name === name) ||
        null
      );
    }

    function entityLabel(entity) {
      if (entity instanceof ConstraintNode) {
        return `${entity.label} constraint`;
      }

      return entity && entity.name ? entity.name : "Object";
    }

    function normalizeAngle(angle) {
      let nextAngle = angle;
      while (nextAngle <= -Math.PI) {
        nextAngle += Math.PI * 2;
      }
      while (nextAngle > Math.PI) {
        nextAngle -= Math.PI * 2;
      }
      return nextAngle;
    }

    function getRadialLimitsForSource(source) {
      const limit = state.constraints.find(
        (constraint) => constraint instanceof RadialLimitConstraint && constraint.source === source
      );

      if (!limit) {
        return { minDistance: MIN_DISTANCE, maxDistance: Number.POSITIVE_INFINITY };
      }

      return {
        minDistance: limit.minDistance,
        maxDistance: limit.maxDistance
      };
    }

    function distributeDistanceDelta(sourcesToAdjust, totalDelta, anchor) {
      let remainingDelta = totalDelta;
      const activeSources = [...sourcesToAdjust];
      const movedEntities = new Set();

      while (activeSources.length > 0 && Math.abs(remainingDelta) > CONSTRAINT_EPSILON) {
        const share = remainingDelta / activeSources.length;
        let appliedDelta = 0;
        let clampedAny = false;

        for (let index = activeSources.length - 1; index >= 0; index -= 1) {
          const source = activeSources[index];
          const currentDistance = Math.hypot(source.x - anchor.x, source.y - anchor.y);
          const nextDistance = currentDistance + share;

          if (nextDistance < MIN_DISTANCE) {
            setSourceDistance(source, anchor, MIN_DISTANCE);
            movedEntities.add(source);
            appliedDelta += MIN_DISTANCE - currentDistance;
            activeSources.splice(index, 1);
            clampedAny = true;
          }
        }

        if (!clampedAny) {
          for (const source of activeSources) {
            const currentDistance = Math.hypot(source.x - anchor.x, source.y - anchor.y);
            setSourceDistance(source, anchor, currentDistance + share);
            movedEntities.add(source);
          }
          remainingDelta = 0;
          break;
        }

        remainingDelta -= appliedDelta;
      }

      return {
        satisfied: Math.abs(remainingDelta) <= CONSTRAINT_EPSILON,
        remainingDelta,
        movedEntities: [...movedEntities]
      };
    }

    function distributeProduct(sourcesToAdjust, targetProduct, allSources, anchor) {
      const activeSources = [...sourcesToAdjust];
      const movedEntities = new Set();
      let usedBackoff = false;

      while (activeSources.length > 0) {
        const fixedProduct = allSources
          .filter((source) => !activeSources.includes(source))
          .reduce((product, source) => product * distanceBetween(source, anchor), 1);
        const targetActiveProduct = targetProduct / fixedProduct;
        const currentActiveProduct = activeSources.reduce(
          (product, source) => product * distanceBetween(source, anchor),
          1
        );

        if (targetActiveProduct <= 0 || currentActiveProduct <= 0) {
          return { satisfied: false, usedBackoff, movedEntities: [...movedEntities] };
        }

        const factor = Math.pow(targetActiveProduct / currentActiveProduct, 1 / activeSources.length);
        let clampedAny = false;

        for (let index = activeSources.length - 1; index >= 0; index -= 1) {
          const source = activeSources[index];
          const currentDistance = distanceBetween(source, anchor);
          const nextDistance = currentDistance * factor;
          const { minDistance, maxDistance } = getRadialLimitsForSource(source);
          const clampedDistance = clamp(nextDistance, minDistance, maxDistance);

          if (Math.abs(nextDistance - clampedDistance) > CONSTRAINT_EPSILON) {
            setSourceDistance(source, anchor, clampedDistance);
            movedEntities.add(source);
            activeSources.splice(index, 1);
            clampedAny = true;
            usedBackoff = true;
          }
        }

        if (!clampedAny) {
          for (const source of activeSources) {
            const currentDistance = distanceBetween(source, anchor);
            setSourceDistance(source, anchor, currentDistance * factor);
            if (Math.abs(currentDistance * factor - currentDistance) > CONSTRAINT_EPSILON) {
              movedEntities.add(source);
            }
          }
          return { satisfied: true, usedBackoff, movedEntities: [...movedEntities] };
        }
      }

      return { satisfied: false, usedBackoff, movedEntities: [...movedEntities] };
    }

    function parameterFeatureValue(feature, entity) {
      if (feature === "x") {
        return entity.x;
      }

      if (feature === "y") {
        return entity.y;
      }

      if (feature === "angle") {
        return Math.atan2(entity.y - state.listener.y, entity.x - state.listener.x);
      }

      return distanceBetween(entity, state.listener);
    }

    function refreshConstraints() {
      for (const constraint of state.constraints) {
        if (constraint instanceof SpringConstraint) constraint.updateNode();
        else constraint.refresh();
      }
      state.propagationPaused = false;
      state.lastPropagationReport = null;
      setConstraintStatus("");
    }

    function moveEntity(entity, x, y, { skipPropagation = false, bounds = null } = {}) {
      const nextX = clamp(x, bounds?.left ?? 0, bounds?.right ?? WIDTH);
      const nextY = clamp(y, bounds?.top ?? 0, bounds?.bottom ?? HEIGHT);
      translateEntity(entity, nextX - entity.x, nextY - entity.y);
      if (entity.dynamics) {
        entity.dynamics.vx = 0;
        entity.dynamics.vy = 0;
      }

      if (skipPropagation) {
        pausePropagation(entity);
      } else if (entity === state.listener && state.listenerMode === LISTENER_MODE_RETARGET) {
        state.propagationPaused = false;
        refreshConstraints();
      } else {
        state.propagationPaused = false;
        enforceConstraints(entity);
      }

      return getLastPropagationReport();
    }

    function pausePropagation(entity) {
      state.propagationPaused = true;
      state.lastPropagationReport = createPropagationReport({
        hitEntityCap: false,
        hitStepCap: false,
        messages: ["Propagation paused (Shift). Constraints are not being enforced."],
        movedEntities: entity ? [entity] : [],
        processCounts: new Map(),
        propagationPaused: true,
        propagationSteps: 0
      });
      setConstraintStatus(formatPropagationStatus(state.lastPropagationReport));
    }

    function resumePropagationAfterPausedDrag() {
      state.propagationPaused = false;
      refreshConstraints();
      setConstraintStatus("Propagation resumed; constraints retargeted to paused positions.");
    }

    function clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }
    const classes = {
      Entity,
      Listener,
      SoundSource,
      MovingObject,
      ConstraintNode,
      AngleConstraint,
      SumConstraint,
      ProductConstraint,
      RadialLimitConstraint,
      FixedDistanceConstraint,
      SpringConstraint,
      DistanceRatioConstraint,
      PinConstraint,
      SolidAttachmentConstraint,
      MinimumSeparationConstraint,
      AngleSectorConstraint
    };
    const solvers = solverApi.createSolvers({
      state,
      classes,
      graph,
      geometry: { translateEntity, rotateVector, distanceBetween, entityLabel, normalizeAngle, clamp },
      onStatus: setConstraintStatus
    });
    const { enforceConstraints, createPropagationReport, formatPropagationStatus, getLastPropagationReport } =
      solvers;

    function loadPatch(patch) {
      lastValidation = validatePatch(patch);
      if (lastValidation.some((finding) => finding.level === "error")) return false;
      const previous = { ...state };
      try {
        const candidate = patchApi.clonePatch(patch);
        state.listener = new Listener(candidate.listener.x, candidate.listener.y);
        state.listener.drawTrace = Boolean(candidate.listener.drawTrace);
        state.sources = candidate.sources.map((source) =>
          Object.assign(new SoundSource(source.x, source.y, source.name), {
            drawTrace: Boolean(source.drawTrace),
            ...(source.dynamics ? { dynamics: normalizeDynamics(source.dynamics) } : {})
          })
        );
        state.movingObjects = (candidate.movingObjects || []).map((mover) =>
          Object.assign(new MovingObject(mover.x, mover.y, mover.name, { type: "free" }), {
            drawTrace: Boolean(mover.drawTrace),
            ...(mover.dynamics ? { dynamics: normalizeDynamics(mover.dynamics) } : {})
          })
        );
        state.movingObjects.forEach((mover, index) => {
          mover.trajectory = normalizeTrajectory(candidate.movingObjects[index].trajectory, mover.x, mover.y);
        });
        const byName = createObjectMap();
        state.constraints = (candidate.constraints || []).map((spec) =>
          createConstraintFromSpec(spec, byName)
        );
        if (state.constraints.some((constraint) => !constraint))
          throw new Error("Could not construct constraints.");
        state.gravity = { x: 0, y: 0, ...candidate.gravity };
        state.draggedEntity = null;
        solvers.initializeDynamics();
        state.lastPropagationReport = null;
        state.propagationPaused = false;
        patchData = candidate;
        return true;
      } catch (error) {
        Object.assign(state, previous);
        lastValidation = [{ level: "error", message: error.message }];
        return false;
      }
    }
    function normalizeDynamics(body = {}) {
      return { mass: body.mass ?? 1, vx: body.vx ?? 0, vy: body.vy ?? 0 };
    }
    function serializePatch() {
      return patchApi.clonePatch({
        ...patchData,
        version: 1,
        ...(patchData.gravity || state.gravity.x || state.gravity.y ? { gravity: { ...state.gravity } } : {}),
        listener: { x: state.listener.x, y: state.listener.y, drawTrace: state.listener.drawTrace },
        sources: state.sources.map((source) => ({
          name: source.name,
          x: source.x,
          y: source.y,
          drawTrace: source.drawTrace,
          ...(source.dynamics ? { dynamics: { ...source.dynamics } } : {})
        })),
        movingObjects: state.movingObjects.map((mover) => ({
          name: mover.name,
          x: mover.x,
          y: mover.y,
          drawTrace: mover.drawTrace,
          trajectory: mover.trajectory,
          ...(mover.dynamics ? { dynamics: { ...mover.dynamics } } : {})
        })),
        constraints: state.constraints.map(serializeConstraint).filter(Boolean)
      });
    }
    function step(dt = 1 / 60) {
      for (const mover of state.movingObjects) {
        if (mover.tick()) enforceConstraints(mover, { preserveTrajectoryFrame: true });
      }
      solvers.stepDynamics(dt);
      return getLastPropagationReport();
    }
    return {
      state,
      classes,
      graph,
      ...solvers,
      constraintReferencesEntity,
      distanceBetween,
      translateEntity,
      resolveTrajectoryEndpoint,
      getObjectByName,
      entityLabel,
      normalizeTrajectory,
      parameterFeatureValue,
      refreshConstraints,
      moveEntity,
      resumePropagationAfterPausedDrag,
      clamp,
      loadPatch,
      serializePatch,
      step,
      beginDrag(entity) {
        state.draggedEntity = entity;
        if (entity.dynamics) {
          entity.dynamics.vx = 0;
          entity.dynamics.vy = 0;
        }
      },
      endDrag() {
        state.draggedEntity = null;
      },
      validatePatch,
      validation: () => lastValidation.slice(),
      getSolverMode: () => state.solverMode,
      setSolverMode(mode) {
        state.solverMode = mode === SOLVER_MODE_XPBD ? mode : SOLVER_MODE_PROPAGATION;
      }
    };
  }
  const api = { createSceneModel };
  if (isNode) module.exports = api;
  else global.MusicSpaceModel = api;
})(globalThis);

},
"./musicspace-clock": function(module, exports, require) {
// Fixed simulation steps driven by elapsed time, independent of display refresh.
(function exposeClock(global) {
  function createClock({ stepSeconds = 1 / 60, maxSteps = 8 } = {}) {
    let previous = null;
    let accumulated = 0;
    return {
      reset(timestamp = null) {
        previous = timestamp;
        accumulated = 0;
      },
      advance(timestamp, step) {
        if (!Number.isFinite(timestamp)) return 0;
        if (previous === null) {
          previous = timestamp;
          return 0;
        }
        const elapsed = Math.max(0, (timestamp - previous) / 1000);
        previous = timestamp;
        accumulated = Math.min(accumulated + elapsed, maxSteps * stepSeconds);
        let count = 0;
        while (accumulated + 1e-10 >= stepSeconds && count < maxSteps) {
          step(stepSeconds);
          accumulated -= stepSeconds;
          count += 1;
        }
        accumulated = Math.max(0, accumulated);
        return count;
      }
    };
  }
  const api = { createClock };
  if (typeof module === "object" && module.exports) module.exports = api;
  else global.MusicSpaceClock = api;
})(globalThis);

},
"./space": function(module, exports, require) {
const { createSceneModel } = require("./musicspace-model");
const { createClock } = require("./musicspace-clock");
const CENTER = "$center";
const EMPTY = "$musicspace-empty";
const FREE_BOUNDS = { left: -Infinity, top: -Infinity, right: Infinity, bottom: Infinity };
const clone = (value) => structuredClone(value);

function finite(value, label) {
  if (!Number.isFinite(value)) throw new TypeError(`${label} must be finite.`);
}
function identifier(id) {
  if (typeof id !== "string" || !id.trim() || [CENTER, EMPTY, "Listener"].includes(id))
    throw new TypeError(`Invalid or reserved id: ${id}`);
}
function coreId(id) {
  return id === CENTER ? "Listener" : id;
}
function publicId(id) {
  return id === "Listener" ? CENTER : id;
}
function constraintToCore(spec) {
  const { id: _id, enabled: _enabled, points, point, ...rest } = spec;
  if (points) rest.sources = points.map(coreId);
  if (point !== undefined) rest.source = coreId(point);
  for (const key of ["anchor", "target", "carrier", "attached"])
    if (rest[key] !== undefined) rest[key] = coreId(rest[key]);
  return rest;
}
function constraintFromCore(spec) {
  const { node: _node, sources, source, ...rest } = spec;
  if (sources) rest.points = sources.map(publicId);
  if (source !== undefined) rest.point = publicId(source);
  for (const key of ["anchor", "target", "carrier", "attached"])
    if (rest[key] !== undefined) rest[key] = publicId(rest[key]);
  return rest;
}
function trajectoryToCore(trajectory) {
  const result = clone(trajectory);
  for (const key of ["start", "end"]) {
    if (result[key]?.type === "object") {
      result[key].name = coreId(result[key].id);
      delete result[key].id;
    }
  }
  return result;
}
function trajectoryFromCore(trajectory) {
  const result = clone(trajectory);
  delete result.rotationDelta;
  for (const key of ["start", "end"]) {
    if (result[key]?.type === "object") {
      result[key].id = publicId(result[key].name);
      delete result[key].name;
    }
  }
  return result;
}
function references(spec) {
  return [
    ...(spec.points || []),
    ...["point", "anchor", "target", "carrier", "attached"].flatMap((key) =>
      spec[key] === undefined ? [] : [spec[key]]
    )
  ];
}

/** A facade over the shared engine. No renderer, audio output or automatic timer. */
function createSpace(initial = {}) {
  let model;
  let definition;
  let dragging = null;
  let pointsById = new Map();
  let activeConstraintIds = new Map();
  const subscribers = new Set();
  const clock = createClock();

  function install(input) {
    if (!input || typeof input !== "object" || Array.isArray(input))
      throw new TypeError("A scene must be an object.");
    const next = clone({
      version: 1,
      center: { x: 0, y: 0 },
      points: [],
      constraints: [],
      solver: "propagation",
      centerMode: "preserve",
      gravity: { x: 0, y: 0 },
      ...input
    });
    if (next.version !== 1) throw new TypeError("Unsupported scene version.");
    if (!["propagation", "xpbd"].includes(next.solver)) throw new TypeError("Unknown solver.");
    if (!["preserve", "retarget"].includes(next.centerMode)) throw new TypeError("Unknown center mode.");
    if (!Array.isArray(next.points) || !Array.isArray(next.constraints))
      throw new TypeError("points and constraints must be arrays.");
    const ids = new Set([CENTER]);
    for (const point of next.points) {
      identifier(point.id);
      if (ids.has(point.id)) throw new TypeError(`Duplicate point: ${point.id}`);
      ids.add(point.id);
      if (point.trajectory) {
        for (const key of [
          "vx",
          "vy",
          "centerX",
          "centerY",
          "radius",
          "phase",
          "angularSpeed",
          "periodSeconds",
          "speed"
        ])
          if (point.trajectory[key] !== undefined) finite(point.trajectory[key], `trajectory.${key}`);
        if (point.trajectory.direction !== undefined && ![1, -1].includes(point.trajectory.direction))
          throw new TypeError("Trajectory direction must be 1 or -1.");
      }
    }
    const constraintIds = new Set();
    for (const spec of next.constraints) {
      identifier(spec.id);
      if (constraintIds.has(spec.id)) throw new TypeError(`Duplicate constraint: ${spec.id}`);
      constraintIds.add(spec.id);
      if (spec.enabled !== undefined && typeof spec.enabled !== "boolean")
        throw new TypeError("enabled must be boolean.");
      for (const key of [
        "angle",
        "totalDistance",
        "product",
        "minDistance",
        "maxDistance",
        "distance",
        "restLength",
        "stiffness",
        "damping",
        "ratio",
        "x",
        "y",
        "offsetX",
        "offsetY",
        "centerAngle",
        "width"
      ])
        if (spec[key] !== undefined) finite(spec[key], `constraint.${key}`);
      if (["source", "sources", "node"].some((key) => key in spec))
        throw new TypeError("Use point/points in the public constraint API.");
      if (["angle", "distanceRatio", "separation"].includes(spec.type) && spec.points?.length !== 2)
        throw new TypeError(`${spec.type} needs exactly two points.`);
      const refs = references(spec);
      if (new Set(refs).size !== refs.length) throw new TypeError("Constraint endpoints must be distinct.");
      for (const id of refs) if (!ids.has(id)) throw new TypeError(`Unknown point: ${id}`);
    }
    // The application's patch loader requires a source. An isolated temporary
    // source lets the package support empty scenes and scenes containing only movers.
    const sources = next.points.filter((p) => !p.trajectory).map(({ id, ...p }) => ({ ...p, name: id }));
    const movers = next.points
      .filter((p) => p.trajectory)
      .map(({ id, ...p }) => ({
        ...p,
        name: id,
        trajectory: trajectoryToCore(p.trajectory)
      }));
    for (const p of next.points)
      for (const key of ["start", "end"])
        if (p.trajectory?.[key]?.type === "object" && !ids.has(p.trajectory[key].id))
          throw new TypeError(`Unknown trajectory endpoint: ${p.trajectory[key].id}`);
    const candidate = createSceneModel();
    const patch = {
      version: 1,
      listener: next.center,
      gravity: next.gravity,
      sources: sources.length ? sources : [{ name: EMPTY, x: 0, y: 0 }],
      movingObjects: movers,
      constraints: next.constraints.map(constraintToCore)
    };
    if (!candidate.loadPatch(patch))
      throw new TypeError(
        candidate
          .validation()
          .filter((f) => f.level === "error")
          .map((f) => f.message)
          .join("\n")
      );
    if (!sources.length) candidate.state.sources = [];
    const normalized = candidate.serializePatch().constraints;
    next.constraints = next.constraints.map((spec, i) => ({
      ...constraintFromCore(normalized[i]),
      id: spec.id,
      enabled: spec.enabled !== false
    }));
    candidate.state.constraints = candidate.state.constraints.filter((_, i) => next.constraints[i].enabled);
    candidate.setSolverMode(next.solver);
    candidate.state.listenerMode = next.centerMode;
    if (dragging && ids.has(dragging)) candidate.beginDrag(candidate.getObjectByName(coreId(dragging)));
    else dragging = null;
    model = candidate;
    definition = next;
    pointsById = new Map(entities().map((point) => [publicId(point.name), point]));
    const activeSpecs = next.constraints.filter((spec) => spec.enabled);
    activeConstraintIds = new Map(
      candidate.state.constraints.map((constraint, index) => [constraint, activeSpecs[index].id])
    );
  }
  function entities() {
    return [model.state.listener, ...model.state.sources, ...model.state.movingObjects];
  }
  function positions() {
    return entities().map((entity) => ({ id: publicId(entity.name), x: entity.x, y: entity.y }));
  }
  function entity(id) {
    const value = pointsById.get(id);
    if (!value) throw new TypeError(`Unknown point: ${id}`);
    return value;
  }
  function snapshot() {
    const patch = model.serializePatch();
    let activeIndex = 0;
    const constraints = definition.constraints.map((spec) =>
      spec.enabled
        ? {
            ...constraintFromCore(patch.constraints[activeIndex++]),
            id: spec.id,
            enabled: true
          }
        : clone(spec)
    );
    const points = [...patch.sources, ...patch.movingObjects].map(({ name, drawTrace: _trace, ...p }) => ({
      ...p,
      id: name,
      ...(p.trajectory ? { trajectory: trajectoryFromCore(p.trajectory) } : {})
    }));
    // serializePatch already owns all nested data. The transformed records below
    // can be returned directly without a second whole-scene clone.
    return {
      version: 1,
      center: { x: patch.listener.x, y: patch.listener.y },
      points,
      constraints,
      solver: model.getSolverMode(),
      centerMode: model.state.listenerMode,
      gravity: patch.gravity || { x: 0, y: 0 }
    };
  }
  function diagnostics() {
    const residuals = model.measureConstraintResiduals().map(({ constraint, measurement }) => ({
      id: activeConstraintIds.get(constraint),
      ...measurement
    }));
    const report = model.getLastPropagationReport();
    const hitStepCap = Boolean(report?.hitStepCap);
    const hitEntityCap = Boolean(report?.hitEntityCap);
    const propagationPaused = model.state.propagationPaused;
    return {
      satisfied: !residuals.length && !hitStepCap && !hitEntityCap && !propagationPaused,
      residuals,
      hitStepCap,
      hitEntityCap,
      propagationPaused,
      solver: model.getSolverMode()
    };
  }
  function publish(reason, before) {
    const after = positions();
    const beforeById = new Map(before.map((point) => [point.id, point]));
    const afterIds = new Set(after.map((point) => point.id));
    const changed = after.filter((point) => {
      const previous = beforeById.get(point.id);
      return !previous || previous.x !== point.x || previous.y !== point.y;
    });
    const removed = before.filter((point) => !afterIds.has(point.id)).map((point) => point.id);
    const event = { reason, positions: after, changed, removed, diagnostics: diagnostics() };
    // Each observer receives its own data; mutating it cannot change the engine.
    for (const listener of subscribers) listener(clone(event));
    return event;
  }
  function edit(reason, mutate) {
    const before = positions();
    const next = snapshot();
    mutate(next);
    install(next);
    return publish(reason, before);
  }
  function constraintIndex(scene, id) {
    const index = scene.constraints.findIndex((c) => c.id === id);
    if (index < 0) throw new TypeError(`Unknown constraint: ${id}`);
    return index;
  }
  install(initial);
  return {
    snapshot,
    positions,
    diagnostics,
    getPoint(id) {
      const p = entity(id);
      return { id, x: p.x, y: p.y };
    },
    onChange(listener) {
      if (typeof listener !== "function") throw new TypeError("Expected a function.");
      subscribers.add(listener);
      return () => subscribers.delete(listener);
    },
    addPoint(point) {
      return edit("addPoint", (s) => s.points.push(clone(point)));
    },
    updatePoint(id, changes) {
      if (id === CENTER) throw new TypeError("Use move(CENTER, x, y) to move the center.");
      return edit("updatePoint", (s) => {
        const i = s.points.findIndex((p) => p.id === id);
        if (i < 0) throw new TypeError(`Unknown point: ${id}`);
        s.points[i] = { ...s.points[i], ...clone(changes), id };
      });
    },
    removePoint(id) {
      if (id === CENTER) throw new TypeError("The center cannot be removed.");
      entity(id);
      return edit("removePoint", (s) => {
        // Freeze object-referenced shuttle endpoints at their last position.
        const position = s.points.find((p) => p.id === id);
        for (const p of s.points)
          for (const key of ["start", "end"])
            if (p.trajectory?.[key]?.type === "object" && p.trajectory[key].id === id)
              p.trajectory[key] = { type: "fixed", x: position.x, y: position.y };
        s.points = s.points.filter((p) => p.id !== id);
        s.constraints = s.constraints.filter((c) => !references(c).includes(id));
      });
    },
    addConstraint(spec) {
      return edit("addConstraint", (s) => s.constraints.push(clone(spec)));
    },
    updateConstraint(id, changes) {
      return edit("updateConstraint", (s) => {
        const i = constraintIndex(s, id);
        s.constraints[i] = { ...s.constraints[i], ...clone(changes), id };
      });
    },
    removeConstraint(id) {
      return edit("removeConstraint", (s) => s.constraints.splice(constraintIndex(s, id), 1));
    },
    move(id, x, y, { bounds = FREE_BOUNDS, skipPropagation = false } = {}) {
      finite(x, "x");
      finite(y, "y");
      if (bounds !== FREE_BOUNDS) {
        for (const key of ["left", "top", "right", "bottom"]) finite(bounds?.[key], `bounds.${key}`);
        if (bounds.left > bounds.right || bounds.top > bounds.bottom)
          throw new TypeError("Invalid bounds ordering.");
      }
      if (typeof skipPropagation !== "boolean") throw new TypeError("skipPropagation must be boolean.");
      const p = entity(id),
        before = positions();
      model.moveEntity(p, x, y, { bounds, skipPropagation });
      return publish("move", before);
    },
    resumePropagation() {
      const before = positions();
      model.resumePropagationAfterPausedDrag();
      return publish("resumePropagation", before);
    },
    beginDrag(id) {
      model.beginDrag(entity(id));
      dragging = id;
    },
    endDrag({ refine = true } = {}) {
      if (typeof refine !== "boolean") throw new TypeError("refine must be boolean.");
      const before = positions();
      const p = dragging ? entity(dragging) : null;
      model.endDrag();
      dragging = null;
      if (refine && p && model.getSolverMode() === "xpbd" && !model.state.propagationPaused)
        model.refineXpbdAfterDrag(p);
      return publish("endDrag", before);
    },
    solve(id = CENTER) {
      const p = entity(id),
        before = positions();
      model.enforceConstraints(p);
      return publish("solve", before);
    },
    step() {
      const before = positions();
      model.step();
      return publish("step", before);
    },
    advance(timestampMs) {
      finite(timestampMs, "timestampMs");
      const before = positions();
      const count = clock.advance(timestampMs, () => model.step());
      if (count) publish("advance", before);
      return count;
    },
    resetClock() {
      clock.reset();
    },
    configure(options) {
      const solver = options.solver === undefined ? model.state.solverMode : options.solver;
      const centerMode = options.centerMode === undefined ? model.state.listenerMode : options.centerMode;
      const gravity = options.gravity === undefined ? model.state.gravity : clone(options.gravity);
      if (!["propagation", "xpbd"].includes(solver)) throw new TypeError("Unknown solver.");
      if (!["preserve", "retarget"].includes(centerMode)) throw new TypeError("Unknown center mode.");
      finite(gravity?.x, "gravity.x");
      finite(gravity?.y, "gravity.y");
      const before = positions();
      // Runtime settings must preserve trajectory deltas, velocities, drag state
      // and paused propagation. Rebuilding a scene loses those transient values.
      model.setSolverMode(solver);
      model.state.listenerMode = centerMode;
      model.state.gravity = { x: gravity.x, y: gravity.y };
      return publish("configure", before);
    },
    restore(scene) {
      const before = positions();
      install(scene);
      model.endDrag();
      dragging = null;
      clock.reset();
      return publish("restore", before);
    }
  };
}
module.exports = { createSpace, CENTER };

}};
const cache = new Map();
function require(id) {
 if (cache.has(id)) return cache.get(id).exports;
 if (!modules[id]) throw new Error('Unknown bundled module: ' + id);
 const module = {exports: {}}; cache.set(id, module);
 modules[id](module, module.exports, require); return module.exports;
}
return require("./space");
})();
export const {createSpace, CENTER} = api;

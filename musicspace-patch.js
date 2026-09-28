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

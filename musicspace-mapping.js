// Generic MusicSpace parameter mapping.
//
// This layer knows how to turn scene features into target parameter values.
// It does not know about Web Audio, Faust, MIDI, OSC, or the canvas UI.

(function exposeMusicSpaceMapping(global) {
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function normalizeMappings(mappings, options = {}) {
    const isSupportedTarget = options.isSupportedTarget || (() => true);

    return mappings
      .filter((mapping) => mapping && mapping.source && mapping.target && mapping.feature)
      .map((mapping) => ({
        source: mapping.source,
        feature: mapping.feature,
        target: mapping.target,
        inputMin: Number(mapping.inputMin),
        inputMax: Number(mapping.inputMax),
        outputMin: Number(mapping.outputMin),
        outputMax: Number(mapping.outputMax),
        curve: mapping.curve === "exp" ? "exp" : "linear"
      }))
      .filter((mapping) =>
        Number.isFinite(mapping.inputMin) &&
        Number.isFinite(mapping.inputMax) &&
        Number.isFinite(mapping.outputMin) &&
        Number.isFinite(mapping.outputMax) &&
        isSupportedTarget(mapping.target)
      );
  }

  function valuesForMappings({ mappings, defaults, getEntity, getFeature }) {
    const values = { ...defaults };

    for (const mapping of mappings) {
      const entity = getEntity(mapping.source);
      if (!entity) {
        continue;
      }

      values[mapping.target] = valueFromMapping(mapping, getFeature(mapping.feature, entity));
    }

    return values;
  }

  function valueFromMapping(mapping, rawValue) {
    const inputSpan = mapping.inputMax - mapping.inputMin;
    const normalized = inputSpan === 0
      ? 0
      : clamp((rawValue - mapping.inputMin) / inputSpan, 0, 1);

    if (mapping.curve === "exp" && mapping.outputMin > 0 && mapping.outputMax > 0) {
      return mapping.outputMin * ((mapping.outputMax / mapping.outputMin) ** normalized);
    }

    return mapping.outputMin + (mapping.outputMax - mapping.outputMin) * normalized;
  }

  global.MusicSpaceMapping = {
    normalizeMappings,
    valuesForMappings
  };
})(window);

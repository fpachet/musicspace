// Generic parameter target client for MusicSpace.
//
// This module owns target controller lifecycle, parameter monitor UI, and
// mapping application. The canvas engine only supplies scene entities and
// feature values; target backends can be Web Audio, Faust, MIDI, OSC, or any
// other consumer that implements the MusicSpaceTargets interface.

(function exposeMusicSpaceParameterClient(global) {
  function createParameterClient(options = {}) {
    const mappingApi = global.MusicSpaceMapping;
    const targetApi = global.MusicSpaceTargets;
    const toggleButton = options.toggleButton || null;
    const panel = options.panel || null;
    const grid = options.grid || null;
    const onStatus = options.onStatus || (() => {});
    const getEntity = options.getEntity || (() => null);
    const getFeature = options.getFeature || (() => 0);

    const monitorRows = new Map();
    const now = options.now || (() => global.performance?.now?.() ?? Date.now());
    const monitorIntervalMs = options.monitorIntervalMs ?? 100;
    let lastMonitorUpdate = -Infinity;
    let generation = 0;
    let mappings = [];
    let targetController = null;
    let targetSpec = targetApi.normalizeTargetSpec();
    let targetParamValues = {};

    resetTargetController();

    if (toggleButton) {
      toggleButton.addEventListener("click", () => {
        toggleTarget();
      });
    }

    return {
      loadPatch(patch = {}) {
        resetTargetController(patch.target || patch.audioSynth);
        mappings = normalizeMappings(patch.parameterMappings || patch.audioMappings || []);
        update({ immediate: true });
      },
      serialize() {
        return {
          target: { ...targetSpec },
          parameterMappings: mappings.map((mapping) => ({ ...mapping }))
        };
      },
      update,
      hasMappings() {
        return mappings.length > 0;
      },
      mappings() {
        return mappings.map((mapping) => ({ ...mapping }));
      },
      setMappings(nextMappings = []) {
        mappings = normalizeMappings(nextMappings);
        update({ immediate: true });
        updateToggle();
        return mappings.map((mapping) => ({ ...mapping }));
      },
      mappedEntityNames() {
        return Array.from(new Set(mappings.map((mapping) => mapping.source)));
      },
      targetSpec() {
        return { ...targetSpec };
      },
      targetDefaults() {
        return targetController?.defaults() || {};
      },
      targetMetadata() {
        return targetController?.metadata() || { parameters: [] };
      },
      targetParameterConfig(target) {
        return targetController?.parameterConfig(target) || { suffix: "", digits: 2 };
      },
      renameSource(oldName, newName) {
        mappings = mappings.map((mapping) =>
          mapping.source === oldName ? { ...mapping, source: newName } : mapping
        );
        update({ immediate: true });
      },
      parameterValues() {
        return { ...targetParamValues };
      },
      isEnabled() {
        return Boolean(targetController?.isEnabled());
      },
      async setEnabled(enabled) {
        const shouldEnable = Boolean(enabled) && mappings.length > 0;
        const ticket = generation;
        const nextEnabled = await targetController?.setEnabled(shouldEnable);
        if (ticket !== generation) return false;
        updateToggle();
        return Boolean(nextEnabled);
      },
      stop() {
        return targetController?.setEnabled(false);
      },
      dispose() {
        generation += 1;
        targetController?.dispose();
      }
    };

    function resetTargetController(spec) {
      generation += 1;
      targetController?.dispose();
      monitorRows.clear();
      grid?.replaceChildren();
      lastMonitorUpdate = -Infinity;
      targetSpec = targetApi.normalizeTargetSpec(spec);
      targetController = targetApi.createTargetController(targetSpec, { onStatus });
      targetParamValues = targetController.defaults();
      updateToggle();
      updatePanel();
    }

    function normalizeMappings(nextMappings) {
      return mappingApi.normalizeMappings(nextMappings, {
        isSupportedTarget: (target) => targetController?.hasParameter(target)
      });
    }

    function update({ immediate = false } = {}) {
      targetParamValues = mappingApi.valuesForMappings({
        mappings,
        defaults: targetController?.defaults() || {},
        getEntity,
        getFeature
      });

      updatePanel(immediate);
      targetController?.apply(targetParamValues, { immediate });
    }

    async function toggleTarget() {
      const nextEnabled = !targetController?.isEnabled() && mappings.length > 0;
      await targetController?.setEnabled(nextEnabled);
      updateToggle();
    }

    function updateToggle() {
      if (!toggleButton) {
        return;
      }

      const enabled = Boolean(targetController?.isEnabled());
      toggleButton.textContent = enabled ? "Stop Sound" : "Play Sound";
      toggleButton.setAttribute("aria-pressed", String(enabled));
    }

    function updatePanel(immediate = false) {
      if (!panel || !grid) return;
      panel.hidden = mappings.length === 0;
      if (panel.hidden) {
        if (monitorRows.size > 0) {
          grid.replaceChildren();
          monitorRows.clear();
        }
        return;
      }
      const timestamp = now();
      if (!immediate && timestamp - lastMonitorUpdate < monitorIntervalMs) return;
      lastMonitorUpdate = timestamp;
      for (const [target, value] of Object.entries(targetParamValues)) {
        const config = targetController?.parameterConfig(target) || { suffix: "", digits: 2 };
        let output = monitorRows.get(target);
        if (!output) {
          const row = document.createElement("div");
          const label = document.createElement("span");
          output = document.createElement("output");
          row.className = "target-param";
          label.textContent = target;
          row.append(label, output);
          grid.append(row);
          monitorRows.set(target, output);
        }
        const formatted = `${value.toFixed(config.digits)}${config.suffix}`;
        if (output.value !== formatted) output.value = formatted;
      }
    }
  }

  global.MusicSpaceParameterClient = {
    createParameterClient
  };
})(window);

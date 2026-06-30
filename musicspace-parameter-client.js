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
      mappedEntityNames() {
        return Array.from(new Set(mappings.map((mapping) => mapping.source)));
      },
      parameterValues() {
        return { ...targetParamValues };
      },
      isEnabled() {
        return Boolean(targetController?.isEnabled());
      },
      async setEnabled(enabled) {
        const nextEnabled = await targetController?.setEnabled(Boolean(enabled));
        updateToggle();
        return Boolean(nextEnabled);
      },
      dispose() {
        targetController?.dispose();
      }
    };

    function resetTargetController(spec) {
      targetController?.dispose();
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

      updatePanel();
      targetController?.apply(targetParamValues, { immediate });
    }

    async function toggleTarget() {
      const nextEnabled = !targetController?.isEnabled();
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

    function updatePanel() {
      if (!panel || !grid) {
        return;
      }

      panel.hidden = mappings.length === 0;
      grid.replaceChildren();

      for (const [target, value] of Object.entries(targetParamValues)) {
        const config = targetController?.parameterConfig(target) || { suffix: "", digits: 2 };
        const row = document.createElement("div");
        const label = document.createElement("span");
        const output = document.createElement("output");

        row.className = "target-param";
        label.textContent = target;
        output.value = `${value.toFixed(config.digits)}${config.suffix}`;
        row.append(label, output);
        grid.append(row);
      }
    }
  }

  global.MusicSpaceParameterClient = {
    createParameterClient
  };
})(window);

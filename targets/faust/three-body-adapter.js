// Actual compiled Faust DSP, through the workbench's existing faust-wasm contract.
const worklets = new WeakMap();
export async function createFaustNode(context, target) {
  const [wasmResponse, jsonResponse] = await Promise.all([fetch(target.wasm), fetch(target.json)]);
  if (!wasmResponse.ok || !jsonResponse.ok)
    throw new Error("Could not load the Three-Body Faust instrument.");
  const [module, metadata] = await Promise.all([
    wasmResponse.arrayBuffer().then((bytes) => WebAssembly.compile(bytes)),
    jsonResponse.json()
  ]);
  if (!worklets.has(context)) {
    const pending = context.audioWorklet.addModule(new URL("./three-body-worklet.mjs", import.meta.url));
    worklets.set(context, pending);
    pending.catch(() => worklets.delete(context));
  }
  await worklets.get(context);
  const values = Object.fromEntries(
    Object.entries(target.parameters || {}).map(([path, config]) => [path, config.default ?? 0])
  );
  const node = new AudioWorkletNode(context, "three-body", {
    numberOfInputs: 0,
    numberOfOutputs: 1,
    outputChannelCount: [2],
    processorOptions: { module, metadata, values }
  });
  let disposed = false,
    pending = null;
  return {
    node,
    setParamValue(path, value) {
      if (disposed || !Number.isFinite(value) || values[path] === value) return;
      values[path] = value;
      if (!pending) {
        pending = {};
        queueMicrotask(() => {
          if (!disposed) node.port.postMessage(pending);
          pending = null;
        });
      }
      pending[path] = value;
    },
    destroy() {
      disposed = true;
      node.port.postMessage("dispose");
      node.disconnect();
      node.port.close();
    }
  };
}

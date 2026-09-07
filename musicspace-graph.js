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

// Bundle the existing, unchanged CommonJS model in private module scopes.
// Browser consumers need neither globals, a loader nor a build tool.
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "../../..");
const pkg = path.resolve(__dirname, "..");
const names = ["constants", "patch", "trajectories", "graph", "solvers", "model", "clock"];
const entries = names.map((name) => [
  `./musicspace-${name}`,
  fs.readFileSync(path.join(root, `musicspace-${name}.js`), "utf8")
]);
entries.push(["./space", fs.readFileSync(path.join(pkg, "src/space.cjs"), "utf8")]);
const modules = entries
  .map(([id, source]) => `${JSON.stringify(id)}: function(module, exports, require) {\n${source}\n}`)
  .join(",\n");
const bundle = `// Generated from MusicSpace's shared sources. MIT license.\nconst api = (() => {\nconst modules = {${modules}};\nconst cache = new Map();\nfunction require(id) {\n if (cache.has(id)) return cache.get(id).exports;\n if (!modules[id]) throw new Error('Unknown bundled module: ' + id);\n const module = {exports: {}}; cache.set(id, module);\n modules[id](module, module.exports, require); return module.exports;\n}\nreturn require('./space');\n})();\n`;
fs.mkdirSync(path.join(pkg, "dist"), { recursive: true });
fs.writeFileSync(path.join(pkg, "dist/index.cjs"), bundle + "module.exports = api;\n");
fs.writeFileSync(path.join(pkg, "dist/index.mjs"), bundle + "export const {createSpace, CENTER} = api;\n");
fs.copyFileSync(path.join(pkg, "src/index.d.ts"), path.join(pkg, "dist/index.d.ts"));
fs.copyFileSync(path.join(root, "LICENSE"), path.join(pkg, "LICENSE"));
console.log("Built standalone ESM, CommonJS and TypeScript declarations.");

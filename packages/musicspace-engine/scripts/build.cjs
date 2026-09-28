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
entries.push(["./legacy-patch", fs.readFileSync(path.join(pkg, "src/legacy-patch.cjs"), "utf8")]);
function bundle(entry, selected) {
  const modules = selected
    .map(([id, source]) => `${JSON.stringify(id)}: function(module, exports, require) {\n${source}\n}`)
    .join(",\n");
  return `// Generated from MusicSpace's shared sources. MIT license.
const api = (() => {
const modules = {${modules}};
const cache = new Map();
function require(id) {
 if (cache.has(id)) return cache.get(id).exports;
 if (!modules[id]) throw new Error('Unknown bundled module: ' + id);
 const module = {exports: {}}; cache.set(id, module);
 modules[id](module, module.exports, require); return module.exports;
}
return require(${JSON.stringify(entry)});
})();
`;
}
fs.mkdirSync(path.join(pkg, "dist"), { recursive: true });
for (const [filename, entry, exports] of [
  ["index", "./space", "createSpace, CENTER"],
  ["legacy-patch", "./legacy-patch", "importLegacyPatch, exportLegacyPatch"]
]) {
  const selected = entry === "./space" ? entries.filter(([id]) => id !== "./legacy-patch") : entries;
  const source = bundle(entry, selected);
  fs.writeFileSync(path.join(pkg, `dist/${filename}.cjs`), source + "module.exports = api;\n");
  fs.writeFileSync(path.join(pkg, `dist/${filename}.mjs`), source + `export const {${exports}} = api;\n`);
}
fs.copyFileSync(path.join(pkg, "src/index.d.ts"), path.join(pkg, "dist/index.d.ts"));
fs.copyFileSync(path.join(pkg, "src/legacy-patch.d.ts"), path.join(pkg, "dist/legacy-patch.d.ts"));
fs.copyFileSync(path.join(root, "LICENSE"), path.join(pkg, "LICENSE"));
console.log("Built standalone ESM, CommonJS and TypeScript declarations.");

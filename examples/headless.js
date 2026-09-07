// Run with npm run example; no browser, audio device or server is needed.
const fs = require("node:fs");
const path = require("node:path");
const { createSceneModel } = require("../musicspace-model");
const model = createSceneModel();
const patch = JSON.parse(fs.readFileSync(path.join(__dirname, "../patches/product-limit.json"), "utf8"));
if (!model.loadPatch(patch)) throw new Error(JSON.stringify(model.validation()));
const source = model.getObjectByName("A");
model.moveEntity(source, source.x + 25, source.y);
console.log(JSON.stringify(model.getLastPropagationReport(), null, 2));

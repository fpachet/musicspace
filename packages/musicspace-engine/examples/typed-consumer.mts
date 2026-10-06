import { createSpace, CENTER, type Change, type Constraint, type Scene } from "@fpachet/musicspace-engine";
import {
  importLegacyPatch,
  exportLegacyPatch,
  type LegacyPatch
} from "@fpachet/musicspace-engine/legacy-patch";

// This example runs from a project that has installed the archive.
const balance: Constraint = { id: "balance", type: "sum", points: ["A", "B"] };
const space = createSpace({
  points: [
    { id: "A", x: 100, y: 0 },
    { id: "B", x: 0, y: 100 }
  ],
  constraints: [balance]
});
let changes = 0;
const unsubscribe = space.onChange((event: Change) => {
  changes += event.changed.length;
});
space.beginDrag("A");
space.move("A", 130, 0);
space.endDrag();
if (Math.abs(space.getPoint("B").y - 70) > 0.5) throw new Error("Balance did not propagate");
space.move(CENTER, 10, 10);
space.configure({ solver: "xpbd", centerMode: "preserve" });
const saved: Scene = space.snapshot();
space.restore(saved);
unsubscribe();
if (!changes) throw new Error("Missing change notifications");

const patch: LegacyPatch = {
  listener: { x: 0, y: 0 },
  sources: [{ name: "Control", x: 100, y: 0 }],
  custom: { retained: true }
};
const imported = importLegacyPatch(patch);
const legacySpace = createSpace(imported.scene);
legacySpace.move(imported.context.pointIds.Control, 150, 0);
const exported = exportLegacyPatch(legacySpace.snapshot(), imported.context);
if (JSON.stringify(exported.custom) !== JSON.stringify(patch.custom)) throw new Error("Metadata was lost");
console.log("TypeScript consumer passed");

const gravity: Constraint = {
  id: "gravity",
  type: "gravitational",
  anchor: "A",
  target: "B",
  strength: 1_000_000,
  softening: 10
};
const orbit = createSpace({
  points: [
    { id: "A", x: 0, y: 0, dynamics: { mass: 2 } },
    { id: "B", x: 200, y: 0, dynamics: { mass: 1 } }
  ],
  constraints: [gravity]
});
orbit.step();
if (orbit.getPoint("A").x <= 0) throw new Error("Gravity did not attract");

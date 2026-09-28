import { createSpace } from "../dist/index.mjs";

const space = createSpace({
  center: { x: 0, y: 0 },
  points: [
    { id: "a", x: 100, y: 0 },
    { id: "b", x: 0, y: 100 }
  ],
  constraints: [{ id: "balance", type: "sum", points: ["a", "b"] }]
});

space.onChange(({ changed, diagnostics }) => {
  console.log("Positions to redraw:", changed);
  console.log("Constraints satisfied:", diagnostics.satisfied);
});

space.move("a", 130, 0); // B moves to (0, 70): the sum of distances stays 200.

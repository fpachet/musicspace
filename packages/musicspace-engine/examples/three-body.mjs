// Run from this repository after building, or import the npm package in your app.
import { createSpace } from "../dist/index.mjs";

const radius = 150;
const strength = 1_000_000;
const softening = 10;
// Equilateral configuration: each body feels the attraction of the other two.
const omega = Math.sqrt((3 * strength) / (3 * radius ** 2 + softening ** 2) ** 1.5);
const points = ["A", "B", "C"].map((id, i) => {
  const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 3;
  const x = radius * Math.cos(angle),
    y = radius * Math.sin(angle);
  return { id, x: 400 + x, y: 300 + y, dynamics: { mass: 1, vx: -omega * y, vy: omega * x } };
});
export const space = createSpace({
  points,
  constraints: [
    ["A", "B"],
    ["B", "C"],
    ["C", "A"]
  ].map(([anchor, target]) => ({
    id: `${anchor}-${target}`,
    type: "gravitational",
    anchor,
    target,
    strength,
    softening
  }))
});

// In a UI use space.advance(timestampMs) in requestAnimationFrame instead.
for (let i = 0; i < 600; i++) space.step();
console.log(space.positions());

import { createSpace, CENTER } from "../dist/index.mjs";

const scenes = {
  balance: {
    hint: "Drag A or B: their distances to the center add up to 300. Move the center to reshape the pair.",
    definition: {
      center: { x: 400, y: 250 },
      points: [
        { id: "A", x: 250, y: 250 },
        { id: "B", x: 550, y: 250 }
      ],
      constraints: [{ id: "balance", type: "sum", points: ["A", "B"] }]
    }
  },
  rotator: {
    hint: "The rotor carries three linked points. Drag it while the constellation rotates, or pause to arrange it.",
    definition: {
      center: { x: 400, y: 250 },
      points: [
        { id: "Rotor", x: 400, y: 250, trajectory: { type: "rotator", periodSeconds: 8 } },
        { id: "A", x: 530, y: 250 },
        { id: "B", x: 340, y: 355 },
        { id: "C", x: 340, y: 145 }
      ],
      constraints: ["A", "B", "C"].map((id) => ({
        id: `link-${id}`,
        type: "solid",
        carrier: "Rotor",
        attached: id
      }))
    }
  },
  spring: {
    hint: "Drag and release A or B to excite the coupled springs. Anchor stays pinned.",
    definition: {
      center: { x: 100, y: 100 },
      points: [
        { id: "Anchor", x: 200, y: 250 },
        { id: "A", x: 380, y: 250, dynamics: { mass: 1 } },
        { id: "B", x: 560, y: 250, dynamics: { mass: 1 } }
      ],
      constraints: [
        { id: "pin", type: "pin", target: "Anchor", x: 200, y: 250 },
        {
          id: "spring-a",
          type: "spring",
          anchor: "Anchor",
          target: "A",
          restLength: 180,
          stiffness: 60,
          damping: 0.5
        },
        {
          id: "spring-b",
          type: "spring",
          anchor: "A",
          target: "B",
          restLength: 180,
          stiffness: 60,
          damping: 0.5
        }
      ]
    }
  }
};
const canvas = document.querySelector("#canvas");
const selector = document.querySelector("#scene");
const play = document.querySelector("#play");
const status = document.querySelector("#status");
const ns = "http://www.w3.org/2000/svg";
let space,
  unsubscribe,
  running = true,
  dragging = null,
  drawn = new Map(),
  links = [];
function svgElement(tag, attrs) {
  const node = document.createElementNS(ns, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
}
function render({ positions = space.positions(), diagnostics = space.diagnostics() } = {}) {
  const byId = new Map(positions.map((p) => [p.id, p]));
  for (const { line, a, b } of links) {
    const start = byId.get(a),
      end = byId.get(b);
    line.setAttribute("x1", start.x);
    line.setAttribute("y1", start.y);
    line.setAttribute("x2", end.x);
    line.setAttribute("y2", end.y);
  }
  for (const point of positions) {
    const node = drawn.get(point.id);
    node?.setAttribute("transform", `translate(${point.x},${point.y})`);
  }
  status.textContent = diagnostics.satisfied
    ? "All constraints satisfied"
    : [
        diagnostics.hitStepCap || diagnostics.hitEntityCap ? "Propagation limit reached" : "",
        ...diagnostics.residuals.map((r) => `${r.id}: ${r.error.toFixed(2)} ${r.unit}`)
      ]
        .filter(Boolean)
        .join(" · ");
}
function mount(definition) {
  unsubscribe?.();
  dragging = null;
  space = createSpace(definition);
  drawn = new Map();
  links = [];
  canvas.replaceChildren();
  const scene = space.snapshot();
  const edges = scene.constraints.flatMap((c) => {
    if (c.type === "solid") return [[c.carrier, c.attached]];
    if (c.anchor && c.target) return [[c.anchor, c.target]];
    return c.points ? c.points.map((id) => [CENTER, id]) : [];
  });
  for (const [a, b] of edges) {
    const line = svgElement("line", { stroke: "#b5c8bd", "stroke-width": 2 });
    canvas.append(line);
    links.push({ line, a, b });
  }
  for (const point of space.positions()) {
    // Center is hidden in examples where it does not participate in the constraints.
    if (point.id === CENTER && !edges.some(([a, b]) => a === CENTER || b === CENTER)) continue;
    const group = svgElement("g", {});
    const circle = svgElement("circle", {
      r: 17,
      fill: point.id === CENTER ? "#21362e" : "#e5ae69",
      "data-id": point.id
    });
    const label = svgElement("text", { y: -29, "text-anchor": "middle" });
    label.textContent = point.id === CENTER ? "Center" : point.id;
    group.append(circle, label);
    canvas.append(group);
    drawn.set(point.id, group);
  }
  unsubscribe = space.onChange(render);
  render();
}
function reset() {
  const scene = scenes[selector.value];
  document.querySelector("#hint").textContent = scene.hint;
  mount(scene.definition);
}
canvas.addEventListener("pointerdown", (event) => {
  const id = event.target.getAttribute("data-id");
  if (!id || dragging) return;
  dragging = { id, pointerId: event.pointerId };
  space.beginDrag(id);
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener("pointermove", (event) => {
  if (!dragging || event.pointerId !== dragging.pointerId) return;
  const matrix = canvas.getScreenCTM();
  if (!matrix) return;
  const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
  space.move(dragging.id, point.x, point.y);
});
function release(event) {
  if (!dragging || event.pointerId !== dragging.pointerId) return;
  space.endDrag();
  dragging = null;
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
}
canvas.addEventListener("pointerup", release);
canvas.addEventListener("pointercancel", release);
canvas.addEventListener("lostpointercapture", release);
selector.addEventListener("change", reset);
document.querySelector("#reset").addEventListener("click", reset);
play.addEventListener("click", () => {
  running = !running;
  space.resetClock();
  play.textContent = running ? "Pause motion" : "Resume motion";
});
document.querySelector("#save").addEventListener("click", () => {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(space.snapshot(), null, 2)], { type: "application/json" })
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "musicspace-scene.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
const file = document.querySelector("#file");
document.querySelector("#load").addEventListener("click", () => file.click());
file.addEventListener("change", async () => {
  const selected = file.files[0];
  if (!selected) return;
  try {
    const definition = JSON.parse(await selected.text());
    createSpace(definition); // Validate before replacing the current interface.
    mount(definition);
    document.querySelector("#hint").textContent = "Loaded scene. Drag its points to interact.";
  } catch (error) {
    status.textContent = error.message;
  }
  file.value = "";
});
document.addEventListener("visibilitychange", () => space.resetClock());
function animate(timestamp) {
  if (running && !document.hidden) space.advance(timestamp);
  requestAnimationFrame(animate);
}
reset();
requestAnimationFrame(animate);

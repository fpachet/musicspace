// MusicSpace Prototype - HTML + JavaScript

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
canvas.width = 800;
canvas.height = 600;

const icons = {
  listener: new Image(),
  source: new Image(),
  angle: new Image(),
  sum: new Image()
};
icons.listener.src = "https://img.icons8.com/ios-filled/50/ear.png";
icons.source.src = "https://img.icons8.com/ios-filled/50/musical-notes.png";
icons.angle.src = "https://img.icons8.com/ios-filled/50/angle.png";
icons.sum.src = "https://img.icons8.com/ios-filled/50/sigma.png";

// drawAll will be called after setup at the end

function drawAll() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let c of constraints) {
    if (typeof c.draw === 'function') c.draw(ctx);
  }
  listener.draw(ctx);
  for (let s of sources) {
    s.draw(ctx);
  }
}

class Entity {
  constructor(x, y, color = "blue") {
    this.x = x;
    this.y = y;
    this.radius = 10;
    this.color = color;
  }

  draw(ctx, icon = null) {
    if (icon && icon.naturalWidth > 0) {
      try {
        ctx.drawImage(icon, this.x - 10, this.y - 10, 20, 20);
        return;
      } catch (e) {
        console.warn("Icon draw failed:", e);
      }
    }
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
  }

  isInside(px, py) {
    return (px - this.x) ** 2 + (py - this.y) ** 2 <= this.radius ** 2;
  }
}

class Listener extends Entity {
  constructor(x, y) {
    super(x, y, "black");
  }

  draw(ctx) {
    super.draw(ctx, icons.listener);
  }
}

class SoundSource extends Entity {
  constructor(x, y, name) {
    super(x, y, "red");
    this.name = name;
  }

  draw(ctx) {
    super.draw(ctx, icons.source);
  }
}

class ConstraintNode extends Entity {
  constructor(x, y, label, iconKey, color = "orange") {
    super(x, y, color);
    this.label = label;
    this.iconKey = iconKey;
  }

  draw(ctx) {
    super.draw(ctx, icons[this.iconKey]);
    ctx.fillStyle = "black";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(this.label, this.x, this.y - 15);
  }
}

class AngleConstraint {
  constructor(listener, a, b) {
    this.listener = listener;
    this.a = a;
    this.b = b;
    this.angle = this.computeAngle();
    this.node = new ConstraintNode((a.x + b.x) / 2, (a.y + b.y) / 2, "Angle", "angle");
  }

  computeAngle() {
    return Math.atan2(this.b.y - this.listener.y, this.b.x - this.listener.x) -
           Math.atan2(this.a.y - this.listener.y, this.a.x - this.listener.x);
  }

  enforce(moved) {
    if (moved !== this.a && moved !== this.b && moved !== this.listener && moved !== this.node) return;

    const baseAngle = Math.atan2(this.a.y - this.listener.y, this.a.x - this.listener.x);
    const newAngle = baseAngle + this.angle;
    const dist = Math.hypot(this.b.x - this.listener.x, this.b.y - this.listener.y);

    this.b.x = this.listener.x + dist * Math.cos(newAngle);
    this.b.y = this.listener.y + dist * Math.sin(newAngle);

    // Only update the node position if it's not being dragged and hasn't been manually moved
    if (moved !== this.node && !this.node.isManual) {
      this.node.x = (this.a.x + this.b.x) / 2;
      this.node.y = (this.a.y + this.b.y) / 2;
    }
  }

  draw(ctx) {
    ctx.strokeStyle = "blue";
    ctx.beginPath();
    ctx.moveTo(this.node.x, this.node.y);
    ctx.lineTo(this.a.x, this.a.y);
    ctx.moveTo(this.node.x, this.node.y);
    ctx.lineTo(this.b.x, this.b.y);
    ctx.moveTo(this.node.x, this.node.y);
    ctx.lineTo(this.listener.x, this.listener.y);
    ctx.stroke();
    this.node.draw(ctx);
  }
}

class SumConstraint {
  constructor(listener, sources) {
    this.listener = listener;
    this.sources = sources;
    this.totalDistance = this.computeTotalDistance();
    this.node = new ConstraintNode(listener.x + 80, listener.y, "Sum", "sum");
  }

  computeTotalDistance() {
    return this.sources.reduce((sum, s) => sum + this.distanceToListener(s), 0);
  }

  distanceToListener(source) {
    return Math.hypot(source.x - this.listener.x, source.y - this.listener.y);
  }

  enforce(moved) {
    if (moved !== this.listener && this.sources.includes(moved)) {
      const others = this.sources.filter(s => s !== moved);
      const remaining = this.totalDistance - this.distanceToListener(moved);
      const share = remaining / others.length;

      for (let s of others) {
        const angle = Math.atan2(s.y - this.listener.y, s.x - this.listener.x);
        s.x = this.listener.x + share * Math.cos(angle);
        s.y = this.listener.y + share * Math.sin(angle);
      }
    }
  }

  draw(ctx) {
    ctx.strokeStyle = "green";
    ctx.beginPath();
    for (let s of this.sources) {
      ctx.moveTo(this.node.x, this.node.y);
      ctx.lineTo(s.x, s.y);
    }
    ctx.moveTo(this.node.x, this.node.y);
    ctx.lineTo(this.listener.x, this.listener.y);
    ctx.stroke();
    this.node.draw(ctx);
  }
}

const listener = new Listener(canvas.width / 2, canvas.height / 2);
const sources = [
  new SoundSource(300, 200, "A"),
  new SoundSource(400, 200, "B"),
  new SoundSource(350, 300, "C")
];
const constraints = [
  new AngleConstraint(listener, sources[0], sources[1]),
  new SumConstraint(listener, sources)
];

let dragged = null;

canvas.addEventListener("mousedown", (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  if (listener.isInside(x, y)) {
    dragged = listener;
    return;
  }

  for (let s of sources) {
    if (s.isInside(x, y)) {
      dragged = s;
      return;
    }
  }

  for (let c of constraints) {
    if (c.node.isInside(x, y)) {
    dragged = c.node;
    c.node.isManual = true;
      return;
    }
  }
});

canvas.addEventListener("mousemove", (e) => {
  if (!dragged) return;
  const rect = canvas.getBoundingClientRect();
  dragged.x = e.clientX - rect.left;
  dragged.y = e.clientY - rect.top;

  for (let c of constraints) {
    c.enforce(dragged);
  }

  drawAll();

// Animate one source with smooth random walk
let vx = 0, vy = 0;
function animate() {
  const source = sources[0]; // source A

  // Slightly change velocity
  vx += (Math.random() - 0.5) * 0.5;
  vy += (Math.random() - 0.5) * 0.5;

  // Limit speed
  const maxSpeed = 1;
  const speed = Math.hypot(vx, vy);
  if (speed > maxSpeed) {
    vx *= maxSpeed / speed;
    vy *= maxSpeed / speed;
  }

  source.x += vx;
  source.y += vy;

  // Keep within bounds
  source.x = Math.max(0, Math.min(canvas.width, source.x));
  source.y = Math.max(0, Math.min(canvas.height, source.y));

  for (let c of constraints) {
    c.enforce(source);
  }

  drawAll();
  requestAnimationFrame(animate);
}

animate();

animate();
});

canvas.addEventListener("mouseup", () => {
  dragged = null;
});

drawAll();

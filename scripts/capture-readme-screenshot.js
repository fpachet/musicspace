const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const screenshotDir = path.join(root, "assets", "screenshots");
const authoredCanvasSize = { width: 800, height: 600 };
const demoScreenshots = [
  {
    patchKey: "cycloid-percussion",
    outputName: "musicspace-cycloid-percussion.png",
    crop: { x: 115, y: 155, width: 675, height: 375 }
  },
  {
    patchKey: "openspace-ostinatos",
    outputName: "musicspace-openspace-ostinatos.png",
    crop: { x: 0, y: 0, width: 800, height: 600 }
  },
  {
    patchKey: "jazz-trio-midi",
    outputName: "musicspace-jazz-trio-midi.png",
    crop: { x: 0, y: 0, width: 800, height: 600 }
  },
  {
    patchKey: "granular-cloud-study",
    outputName: "musicspace-granular-cloud-study.png",
    crop: { x: 0, y: 0, width: 800, height: 600 }
  }
];

const contentTypes = {
  ".css": "text/css",
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".mid": "audio/midi",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".wav": "audio/wav"
};

function requestPath(url) {
  const parsed = new URL(url, "http://127.0.0.1");
  const pathname = parsed.pathname === "/" ? "/index.html" : parsed.pathname;
  const target = path.normalize(path.join(root, pathname));
  if (!target.startsWith(root)) {
    return null;
  }
  return target;
}

function serveFile(request, response) {
  const target = requestPath(request.url);
  if (!target) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.stat(target, (statError, stats) => {
    if (statError || !stats.isFile()) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    const isPatchJson =
      target.startsWith(path.join(root, "patches")) &&
      path.extname(target) === ".json" &&
      path.basename(target) !== "index.json";

    if (isPatchJson) {
      try {
        const patch = JSON.parse(fs.readFileSync(target, "utf8"));
        for (const mover of patch.movingObjects || []) {
          if (mover.trajectory) {
            mover.trajectory.running = false;
          }
        }
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify(patch));
        return;
      } catch (error) {
        response.writeHead(500);
        response.end(`Unable to prepare screenshot patch: ${error.message}`);
        return;
      }
    }

    response.writeHead(200, {
      "Content-Type": contentTypes[path.extname(target)] || "application/octet-stream"
    });
    fs.createReadStream(target).pipe(response);
  });
}

async function stopMoversIfRunning(page) {
  const animationToggle = page.locator("#animation-toggle");
  if (!(await animationToggle.isVisible())) {
    return;
  }
  if ((await animationToggle.getAttribute("aria-pressed")) === "true") {
    await animationToggle.click();
    await page.waitForFunction(() => document.querySelector("#animation-toggle")?.getAttribute("aria-pressed") === "false");
  }
}

async function main() {
  fs.mkdirSync(screenshotDir, { recursive: true });

  const server = http.createServer(serveFile);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
  const failures = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      failures.push(message.text());
    }
  });
  page.on("pageerror", (error) => failures.push(error.message));

  try {
    await page.goto(`${baseUrl}/musicspace.html`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.querySelectorAll("#patch-select option").length > 0);

    for (const demo of demoScreenshots) {
      await page.selectOption("#patch-select", demo.patchKey);
      await page.waitForFunction(
        (patchKey) => document.querySelector("#patch-select")?.value === patchKey,
        demo.patchKey
      );
      await stopMoversIfRunning(page);
      await page.waitForTimeout(150);

      const stageBox = await page.locator("#stage").boundingBox();
      if (!stageBox) {
        throw new Error(`Unable to locate stage for ${demo.patchKey} screenshot`);
      }
      const scaleX = stageBox.width / authoredCanvasSize.width;
      const scaleY = stageBox.height / authoredCanvasSize.height;
      await page.screenshot({
        path: path.join(screenshotDir, demo.outputName),
        clip: {
          x: stageBox.x + demo.crop.x * scaleX,
          y: stageBox.y + demo.crop.y * scaleY,
          width: demo.crop.width * scaleX,
          height: demo.crop.height * scaleY
        }
      });
    }

    if (failures.length > 0) {
      throw new Error(`Browser errors while capturing screenshot:\n${failures.join("\n")}`);
    }
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

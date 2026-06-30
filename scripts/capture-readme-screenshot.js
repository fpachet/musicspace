const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const outputPath = path.join(root, "assets", "screenshots", "musicspace-cycloid-percussion.png");
const readmeCanvasCrop = {
  x: 115,
  y: 155,
  width: 675,
  height: 375
};

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

    response.writeHead(200, {
      "Content-Type": contentTypes[path.extname(target)] || "application/octet-stream"
    });
    fs.createReadStream(target).pipe(response);
  });
}

async function main() {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

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
    await page.selectOption("#patch-select", "cycloid-percussion");
    await page.waitForFunction(() => document.querySelector("#patch-summary")?.textContent.includes("Cycloid Percussion"));
    const stageBox = await page.locator("#stage").boundingBox();
    const canvasSize = await page.locator("#canvas").evaluate((canvas) => ({
      width: canvas.width,
      height: canvas.height
    }));
    if (!stageBox) {
      throw new Error("Unable to locate stage for README screenshot");
    }
    const scaleX = stageBox.width / canvasSize.width;
    const scaleY = stageBox.height / canvasSize.height;
    await page.screenshot({
      path: outputPath,
      clip: {
        x: stageBox.x + readmeCanvasCrop.x * scaleX,
        y: stageBox.y + readmeCanvasCrop.y * scaleY,
        width: readmeCanvasCrop.width * scaleX,
        height: readmeCanvasCrop.height * scaleY
      }
    });

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

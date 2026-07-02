const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const videoDir = path.join(root, "assets", "videos");
const defaultDemoVideos = [
  {
    patchKey: "cycloid-rotator",
    outputName: "musicspace-cycloid-rotator.webm",
    durationMs: 7000
  },
  {
    patchKey: "cycloid-percussion",
    outputName: "musicspace-cycloid-percussion.webm",
    durationMs: 7000
  },
  {
    patchKey: "faust-control-study",
    outputName: "musicspace-faust-control-study.webm",
    durationMs: 7000
  },
  {
    patchKey: "granular-cloud-study",
    outputName: "musicspace-granular-cloud-study.webm",
    durationMs: 7000
  }
];
const demoVideos = demosFromArgs(process.argv.slice(2));

const contentTypes = {
  ".css": "text/css",
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".mid": "audio/midi",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webm": "video/webm",
  ".wav": "audio/wav"
};

function demosFromArgs(args) {
  if (args.length === 0) {
    return defaultDemoVideos;
  }

  const [patchKey, outputName = `musicspace-${patchKey}.webm`, durationText = "7000"] = args;
  const durationMs = Number(durationText);
  if (!patchKey || !Number.isFinite(durationMs) || durationMs <= 0) {
    throw new Error("Usage: node scripts/capture-demo-videos.js [patch-key] [output.webm] [duration-ms]");
  }

  return [{ patchKey, outputName, durationMs }];
}

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

function decodeDataUrl(dataUrl) {
  const commaIndex = dataUrl.lastIndexOf(",");
  if (commaIndex === -1) {
    throw new Error("Recorded video data URL is malformed.");
  }
  return Buffer.from(dataUrl.slice(commaIndex + 1), "base64");
}

async function setPressed(page, selector, pressed) {
  const button = page.locator(selector);
  if (!(await button.isVisible())) {
    return false;
  }
  const isPressed = (await button.getAttribute("aria-pressed")) === "true";
  if (isPressed !== pressed) {
    await button.click();
    await page.waitForFunction(
      ([buttonSelector, expected]) =>
        document.querySelector(buttonSelector)?.getAttribute("aria-pressed") === String(expected),
      [selector, pressed]
    );
  }
  return true;
}

async function recordCanvasClip(page, durationMs, includeAudio = true) {
  return page.evaluate(async ({ recordingMs, withAudio }) => {
    const canvas = document.querySelector("#canvas");
    if (!canvas?.captureStream) {
      throw new Error("Canvas captureStream() is not available in this browser.");
    }
    if (!globalThis.MediaRecorder) {
      throw new Error("MediaRecorder is not available in this browser.");
    }

    function supportedMime(candidates) {
      return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) || "";
    }

    function makeRecorder(stream, mimeCandidates, options = {}) {
      const mimeType = supportedMime(mimeCandidates);
      const chunks = [];
      const recorder = new MediaRecorder(stream, { ...options, mimeType });
      const stopped = new Promise((resolve, reject) => {
        recorder.addEventListener("dataavailable", (event) => {
          if (event.data.size > 0) {
            chunks.push(event.data);
          }
        });
        recorder.addEventListener("stop", resolve, { once: true });
        recorder.addEventListener("error", () => reject(recorder.error), { once: true });
      });
      return { chunks, mimeType, recorder, stopped };
    }

    async function blobToDataUrl(blob) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.addEventListener("load", () => resolve(reader.result), { once: true });
        reader.addEventListener("error", reject, { once: true });
        reader.readAsDataURL(blob);
      });
    }

    const canvasStream = canvas.captureStream(30);
    const videoStream = new MediaStream(canvasStream.getVideoTracks());
    const audioStream = withAudio ? await globalThis.MusicSpaceAudioCapture?.stream?.() : null;
    const audioTracks = audioStream?.getAudioTracks?.() || [];
    const videoRecorder = makeRecorder(
      videoStream,
      ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"],
      { videoBitsPerSecond: 1_800_000 }
    );
    const audioRecorder = audioStream
      ? makeRecorder(audioStream, ["audio/webm;codecs=opus", "audio/webm"], { audioBitsPerSecond: 128_000 })
      : null;

    let activeAudioRecorder = audioRecorder;
    let audioRecorderError = "";
    videoRecorder.recorder.start(250);
    try {
      activeAudioRecorder?.recorder.start(250);
    } catch (error) {
      audioRecorderError = error.message || "Audio MediaRecorder could not start.";
      activeAudioRecorder = null;
    }
    await new Promise((resolve) => setTimeout(resolve, recordingMs));
    videoRecorder.recorder.stop();
    activeAudioRecorder?.recorder.stop();
    await Promise.all([videoRecorder.stopped, activeAudioRecorder?.stopped].filter(Boolean));

    for (const track of videoStream.getTracks()) {
      track.stop();
    }

    const videoBlob = new Blob(videoRecorder.chunks, { type: videoRecorder.mimeType || "video/webm" });
    const audioBlob = activeAudioRecorder
      ? new Blob(activeAudioRecorder.chunks, { type: activeAudioRecorder.mimeType || "audio/webm" })
      : null;

    return {
      videoDataUrl: await blobToDataUrl(videoBlob),
      audioDataUrl: audioBlob && audioBlob.size > 0 ? await blobToDataUrl(audioBlob) : null,
      audioTrackCount: audioTracks.length,
      videoMimeType: videoBlob.type,
      audioMimeType: audioBlob?.type || "",
      videoSize: videoBlob.size,
      audioSize: audioBlob?.size || 0,
      audioRecorderError
    };
  }, { recordingMs: durationMs, withAudio: includeAudio });
}

function writeRecording(outputPath, recording) {
  const videoBuffer = decodeDataUrl(recording.videoDataUrl);
  if (!recording.audioDataUrl || recording.audioSize < 1024) {
    fs.writeFileSync(outputPath, videoBuffer);
    return { audioMuxed: false };
  }

  const tempVideoPath = `${outputPath}.video.webm`;
  const tempAudioPath = `${outputPath}.audio.webm`;
  fs.writeFileSync(tempVideoPath, videoBuffer);
  fs.writeFileSync(tempAudioPath, decodeDataUrl(recording.audioDataUrl));

  const result = spawnSync("ffmpeg", [
    "-y",
    "-loglevel",
    "error",
    "-i",
    tempVideoPath,
    "-i",
    tempAudioPath,
    "-c",
    "copy",
    "-shortest",
    outputPath
  ], {
    encoding: "utf8"
  });

  fs.unlinkSync(tempVideoPath);
  fs.unlinkSync(tempAudioPath);

  if (result.error || result.status !== 0) {
    fs.writeFileSync(outputPath, videoBuffer);
    return {
      audioMuxed: false,
      warning: result.error?.message || result.stderr?.trim() || "ffmpeg could not mux audio and video."
    };
  }

  return { audioMuxed: true };
}

async function main() {
  fs.mkdirSync(videoDir, { recursive: true });

  const server = http.createServer(serveFile);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1180, height: 850 },
    deviceScaleFactor: 1
  });

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

    for (const demo of demoVideos) {
      await page.selectOption("#patch-select", demo.patchKey);
      await page.waitForFunction(
        (patchKey) => document.querySelector("#patch-select")?.value === patchKey,
        demo.patchKey
      );
      await page.waitForTimeout(250);
      await setPressed(page, "#animation-toggle", true);
      const soundStarted = await setPressed(page, "#target-toggle", true);
      await page.waitForTimeout(soundStarted ? 600 : 250);

      let recording = await recordCanvasClip(page, demo.durationMs, true);
      if (recording.videoSize < 1024) {
        console.warn(`${demo.outputName}: video capture returned an empty clip; retrying video-only.`);
        recording = await recordCanvasClip(page, demo.durationMs, false);
      }
      const outputPath = path.join(videoDir, demo.outputName);
      const writeResult = writeRecording(outputPath, recording);
      if (recording.audioRecorderError) {
        console.warn(`${demo.outputName}: ${recording.audioRecorderError}`);
      }
      if (writeResult.warning) {
        console.warn(`${demo.outputName}: ${writeResult.warning}`);
      }
      console.log(
        `${demo.outputName}: ${Math.round(recording.videoSize / 1024)} KB video, ` +
          `${Math.round(recording.audioSize / 1024)} KB audio, ` +
          `${recording.audioTrackCount} audio track(s), ` +
          `${writeResult.audioMuxed ? "muxed audio" : "video only"}`
      );

      await setPressed(page, "#target-toggle", false);
      await setPressed(page, "#animation-toggle", false);
      await page.waitForTimeout(100);
    }

    if (failures.length > 0) {
      throw new Error(`Browser errors while capturing videos:\n${failures.join("\n")}`);
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

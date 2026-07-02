const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const sourceDir = path.join(root, "assets", "videos");
const outputDir = path.join(sourceDir, "linkedin");

const clips = [
  {
    input: "musicspace-cycloid-percussion.webm",
    output: "musicspace-cycloid-percussion-linkedin.mp4"
  },
  {
    input: "musicspace-faust-control-study.webm",
    output: "musicspace-faust-control-study-linkedin.mp4"
  },
  {
    input: "musicspace-granular-cloud-study.webm",
    output: "musicspace-granular-cloud-study-linkedin.mp4"
  }
];

function runFfmpeg(inputPath, outputPath) {
  const result = spawnSync("ffmpeg", [
    "-y",
    "-loglevel",
    "error",
    "-i",
    inputPath,
    "-map",
    "0:v:0",
    "-map",
    "0:a:0?",
    "-vf",
    "scale=trunc(iw/2)*2:trunc(ih/2)*2",
    "-c:v",
    "libx264",
    "-profile:v",
    "high",
    "-pix_fmt",
    "yuv420p",
    "-crf",
    "20",
    "-preset",
    "medium",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-ar",
    "48000",
    "-ac",
    "2",
    "-movflags",
    "+faststart",
    outputPath
  ], {
    encoding: "utf8"
  });

  if (result.error || result.status !== 0) {
    throw new Error(result.error?.message || result.stderr || `ffmpeg failed for ${inputPath}`);
  }
}

function main() {
  fs.mkdirSync(outputDir, { recursive: true });

  for (const clip of clips) {
    const inputPath = path.join(sourceDir, clip.input);
    const outputPath = path.join(outputDir, clip.output);
    if (!fs.existsSync(inputPath)) {
      throw new Error(`Missing input video: ${inputPath}`);
    }
    runFfmpeg(inputPath, outputPath);
    const sizeMb = fs.statSync(outputPath).size / (1024 * 1024);
    console.log(`${path.relative(root, outputPath)} (${sizeMb.toFixed(1)} MB)`);
  }
}

main();

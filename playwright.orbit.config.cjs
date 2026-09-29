const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "tests",
  testMatch: "browser-orbit.spec.js",
  timeout: 30000,
  use: { baseURL: "http://127.0.0.1:8011", browserName: "chromium", viewport: { width: 1440, height: 1100 } },
  webServer: {
    command: "python3 -m http.server 8011 --bind 127.0.0.1",
    url: "http://127.0.0.1:8011/examples/orbit-musicspace/",
    reuseExistingServer: !process.env.CI
  }
});

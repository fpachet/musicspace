const { expect, test } = require("@playwright/test");

test("musicspace page loads and core controls respond", async ({ page }) => {
  const failures = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      failures.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    failures.push(error.message);
  });

  await page.goto("/musicspace.html");
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute("href", "assets/favicon.svg");
  const faviconResponse = await page.request.get("/assets/favicon.svg");
  expect(faviconResponse.ok()).toBe(true);

  const patchSelect = page.locator("#patch-select");
  await expect(patchSelect).toBeEnabled();
  await expect.poll(async () => patchSelect.locator("option").count()).toBeGreaterThan(0);
  await patchSelect.selectOption("cycloid-percussion");

  await expect(page.locator("#patch-summary")).toContainText("Cycloid Percussion");
  await expect(page.locator("#canvas")).toBeVisible();

  const animationToggle = page.locator("#animation-toggle");
  await animationToggle.click();
  await expect(animationToggle).toHaveAttribute("aria-pressed", "true");
  await animationToggle.click();
  await expect(animationToggle).toHaveAttribute("aria-pressed", "false");

  const soundToggle = page.locator("#target-toggle");
  await soundToggle.click();
  await expect(soundToggle).toHaveAttribute("aria-pressed", "true");
  await soundToggle.click();
  await expect(soundToggle).toHaveAttribute("aria-pressed", "false");

  await patchSelect.selectOption("openspace-ostinatos");
  await expect(page.locator("#patch-summary")).toContainText("OpenSpace Ostinatos");
  await expect(page.locator("#patch-summary")).toContainText("ostinato pitch");
  await soundToggle.click();
  await expect(soundToggle).toHaveAttribute("aria-pressed", "true");
  await soundToggle.click();
  await expect(soundToggle).toHaveAttribute("aria-pressed", "false");

  await page.locator("#reset").click();
  await expect(patchSelect).toHaveValue("openspace-ostinatos");

  expect(failures).toEqual([]);
});

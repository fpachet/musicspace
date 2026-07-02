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
  await expect(page.locator("#ui-mode-play")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#transport-toolbar-group")).toBeHidden();
  await expect(page.locator("#midi-toolbar-group")).toBeHidden();
  await patchSelect.selectOption("cycloid-percussion");

  const animationToggle = page.locator("#animation-toggle");
  await expect(animationToggle).toBeVisible();
  await animationToggle.click();
  await expect(animationToggle).toHaveAttribute("aria-pressed", "true");
  await animationToggle.click();
  await expect(animationToggle).toHaveAttribute("aria-pressed", "false");

  const soundToggle = page.locator("#target-toggle");
  await expect(soundToggle).toBeVisible();
  await soundToggle.click();
  await expect(soundToggle).toHaveAttribute("aria-pressed", "true");
  await soundToggle.click();
  await expect(soundToggle).toHaveAttribute("aria-pressed", "false");

  const playStageBox = await page.locator("#stage").boundingBox();
  expect(playStageBox).not.toBeNull();
  const patchInspectorToggle = page.locator("#patch-inspector-toggle");
  await expect(patchInspectorToggle).toBeHidden();
  await page.locator("#ui-mode-edit").click();
  await expect(patchInspectorToggle).toBeVisible();
  const editStageBox = await page.locator("#stage").boundingBox();
  expect(editStageBox).not.toBeNull();
  expect(Math.abs(editStageBox.x - playStageBox.x)).toBeLessThan(1);
  expect(Math.abs(editStageBox.y - playStageBox.y)).toBeLessThan(1);
  expect(Math.abs(editStageBox.width - playStageBox.width)).toBeLessThan(1);
  expect(Math.abs(editStageBox.height - playStageBox.height)).toBeLessThan(1);
  await expect(page.locator("#patch-inspector")).toBeHidden();
  await patchInspectorToggle.click();
  await expect(page.locator("#patch-inspector")).toBeVisible();
  await expect(page.locator("#patch-summary")).toContainText("Cycloid Percussion");
  await expect(page.locator("#canvas")).toBeVisible();

  await patchSelect.selectOption("openspace-ostinatos");
  await expect(page.locator("#patch-summary")).toContainText("OpenSpace Ostinatos");
  await expect(page.locator("#patch-summary")).toContainText("ostinato pitch");
  await page.locator("#ui-mode-play").click();
  await soundToggle.click();
  await expect(soundToggle).toHaveAttribute("aria-pressed", "true");
  await soundToggle.click();
  await expect(soundToggle).toHaveAttribute("aria-pressed", "false");

  await page.locator("#ui-mode-edit").click();
  await patchSelect.selectOption("rotating-partials");
  await expect(page.locator("#patch-summary")).toContainText("Rotating Partials");
  await expect(page.locator("#patch-summary")).toContainText("additive");
  await page.locator("#ui-mode-play").click();

  await page.locator("#reset").click();
  await expect(patchSelect).toHaveValue("rotating-partials");

  expect(failures).toEqual([]);
});

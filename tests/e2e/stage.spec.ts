import { expect, test } from '@playwright/test';

const motions = [
  'idle_breathe',
  'wave',
  'walk',
  'run',
  'jump',
  'dance_1',
  'dance_2',
  'spin',
  'sit_down',
  'cheer',
] as const;
const backgrounds = [
  'plain_cream',
  'meadow',
  'forest',
  'sky',
  'night',
  'ocean',
  'space',
  'city',
  'rainbow',
  'plain_blue',
  'plain_pink',
  'plain_lilac',
] as const;
const viewports = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
] as const;

async function openSampleStage(page: import('@playwright/test').Page) {
  await page.goto('/');
  const characterLink = page.locator('a.art[href*="/characters/"]').first();
  await expect(characterLink).toBeVisible();
  await characterLink.click();
  const stage = page.locator('.stage-surface');
  await expect(stage.locator('canvas')).toBeVisible({ timeout: 15_000 });
  await expect(stage.locator('canvas')).toHaveAttribute('width', /\d+/);
  await expect(stage.locator('canvas')).toHaveAttribute('height', /\d+/);
  await expect(page.locator('.controls .pick-grid').first()).toBeVisible();
  return stage;
}

for (const viewport of viewports) {
  test(`renders each motion and background at ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(180_000);
    await page.setViewportSize(viewport);
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    const stage = await openSampleStage(page);
    const motionButtons = page
      .locator('.controls .pick-grid')
      .first()
      .getByRole('button');
    const background = page.locator('.controls select').first();
    await expect(motionButtons).toHaveCount(motions.length);
    await expect(background.locator('option')).toHaveCount(backgrounds.length);

    // Cover each clip and background on all viewports without repeating the
    // entire Cartesian product. The plain background makes missing actors
    // detectable by pixels, unlike a canvas-size or screenshot-size assertion.
    const cases = [
      ...motions.map((motion, index) => ({
        motion,
        index,
        backgroundId: 'plain_cream',
      })),
      ...backgrounds
        .filter((id) => id !== 'plain_cream')
        .map((backgroundId) => ({ motion: 'wave', index: 1, backgroundId })),
    ];
    for (const { motion, index, backgroundId } of cases) {
      await motionButtons.nth(index).click();
      await expect(motionButtons.nth(index)).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await background.selectOption(backgroundId);
      await page.waitForTimeout(150);
      const screenshot = await stage.screenshot({
        path: testInfo.outputPath(
          `${viewport.name}-${motion}-${backgroundId}.png`,
        ),
      });
      expect(screenshot.byteLength).toBeGreaterThan(1_000);
      if (backgroundId === 'plain_cream') {
        const redPixels = await page.evaluate(async (encoded) => {
          const image = new Image();
          image.src = `data:image/png;base64,${encoded}`;
          await image.decode();
          const surface = document.createElement('canvas');
          surface.width = image.width;
          surface.height = image.height;
          const context = surface.getContext('2d')!;
          context.drawImage(image, 0, 0);
          const { data } = context.getImageData(
            0,
            0,
            surface.width,
            surface.height,
          );
          let count = 0;
          for (let i = 0; i < data.length; i += 4)
            if (data[i]! > 130 && data[i + 1]! < 130 && data[i + 2]! < 130)
              count++;
          return count;
        }, screenshot.toString('base64'));
        expect(
          redPixels,
          `${motion}: sample red shirt must remain visible`,
        ).toBeGreaterThan(50);
      }
    }
    expect(pageErrors).toEqual([]);
  });
}

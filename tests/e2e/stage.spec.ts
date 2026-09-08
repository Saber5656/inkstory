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
  test(`renders all motion/background combinations at ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(180_000);
    await page.setViewportSize(viewport);
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    const stage = await openSampleStage(page);
    const canvas = stage.locator('canvas');
    const motionButtons = page
      .locator('.controls .pick-grid')
      .first()
      .getByRole('button');
    const background = page.locator('.controls select').first();
    await expect(motionButtons).toHaveCount(motions.length);
    await expect(background.locator('option')).toHaveCount(backgrounds.length);

    for (let motionIndex = 0; motionIndex < motions.length; motionIndex += 1) {
      await motionButtons.nth(motionIndex).click();
      await expect(motionButtons.nth(motionIndex)).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      for (const backgroundId of backgrounds) {
        await background.selectOption(backgroundId);
        await page.waitForTimeout(80);
        const screenshot = await stage.screenshot({
          path: testInfo.outputPath(
            `${viewport.name}-${motions[motionIndex]}-${backgroundId}.png`,
          ),
        });
        expect(screenshot.byteLength).toBeGreaterThan(1_000);
        const canvasInfo = await canvas.evaluate((element) => {
          const target = element as HTMLCanvasElement;
          return {
            width: target.width,
            height: target.height,
            dataUrlLength: target.toDataURL('image/png').length,
          };
        });
        expect(canvasInfo.width).toBeGreaterThan(0);
        expect(canvasInfo.height).toBeGreaterThan(0);
        expect(canvasInfo.dataUrlLength).toBeGreaterThan(100);
      }
    }
    expect(pageErrors).toEqual([]);
  });
}

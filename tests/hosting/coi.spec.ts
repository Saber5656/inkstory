import { test, expect } from '@playwright/test';
test('headerless subpath hosting becomes isolated and works offline after the controlled reload', async ({
  page,
  context,
  request,
}) => {
  const response = await request.get('/inkstory/');
  expect(response.headers()['cross-origin-opener-policy']).toBeUndefined();
  await page.addInitScript(() => localStorage.setItem('inkstory.locale', 'en'));
  await page.goto('/inkstory/');
  await expect
    .poll(
      async () => page.evaluate(() => crossOriginIsolated).catch(() => false),
      { timeout: 30000 },
    )
    .toBe(true);
  await expect(
    page.getByRole('heading', { name: 'A little drawing. A whole new world.' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Explore a sample' }),
  ).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'A little drawing. A whole new world.' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Explore a sample' }).click();
  await expect(page.locator('.player canvas')).toBeVisible();
  expect(await page.evaluate(() => crossOriginIsolated)).toBe(true);
});

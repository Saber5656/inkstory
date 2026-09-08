import { test, expect } from '@playwright/test';
test('draft navigation guard covers header links and browser back', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem('inkstory.locale', 'ja'));
  await page.goto('/settings');
  await page
    .getByRole('link', { name: 'わたしのアトリエ', exact: true })
    .click();
  const welcome = page.getByRole('button', { name: 'とじる', exact: true });
  await expect(welcome).toBeVisible();
  await welcome.click();
  await page.getByRole('link', { name: '絵をうごかす' }).click();
  await page
    .getByTestId('drawing-input')
    .setInputFiles('public/samples/ink.png');
  await expect(page.getByRole('heading', { name: '切りぬく' })).toBeVisible();
  await page.getByRole('link', { name: 'せってい', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'やめる', exact: true }).click();
  await expect(page).toHaveURL(/characters\/new$/);
  await page.goBack();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'とじる', exact: true })
    .click();
  await expect(page).toHaveURL(/\/$/);
});

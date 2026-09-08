import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    () =>
      localStorage.getItem('inkstory.locale') ??
      localStorage.setItem('inkstory.locale', 'ja'),
  );
});
test('privacy: sample book loads, animates, ends, and survives offline reload', async ({
  page,
  context,
  browserName,
}) => {
  const external: string[] = [];
  page.on('request', (request) => {
    if (
      !request.url().startsWith('http://127.0.0.1:4173') &&
      !request.url().startsWith('blob:') &&
      !request.url().startsWith('data:')
    )
      external.push(request.url());
  });
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: 'サンプルであそぶ' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'サンプルであそぶ' }).click();
  await expect(page.getByText('こんにちは！ いんくちゃんです。')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'おしまい' })).toBeVisible({
    timeout: 25000,
  });
  expect(external).toEqual([]);
  const exit = page.getByRole('button', { name: 'おわる（1秒おしてね）' });
  await exit.dispatchEvent('pointerdown', { pointerId: 1 });
  await page.waitForTimeout(1100);
  await expect(
    page.getByRole('heading', { name: '描いた世界が、うごきだす。' }),
  ).toBeVisible();
  if (browserName === 'chromium') {
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.reload();
    await context.setOffline(true);
    await page.reload();
    await expect(
      page.getByRole('heading', { name: '描いた世界が、うごきだす。' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'いんくちゃん', exact: true }),
    ).toBeVisible();
  }
});
test('manual drawing, corrections, stage, story suggestion and persisted book', async ({
  page,
}) => {
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: 'サンプルであそぶ' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'とじる', exact: true }).click();
  await page.getByRole('link', { name: '絵をうごかす' }).click();
  await page
    .getByTestId('drawing-input')
    .setInputFiles('public/samples/ink.png');
  await expect(page.getByRole('heading', { name: '切りぬく' })).toBeVisible();
  await page.getByRole('button', { name: 'つぎへ' }).click();
  await expect(page.getByRole('heading', { name: '背景をけす' })).toBeVisible();
  await page.getByRole('button', { name: 'もどす', exact: true }).click();
  await page.getByRole('button', { name: 'つぎへ' }).click();
  await page
    .getByRole('button', { name: '手足のあるキャラクター', exact: true })
    .click();
  await page.getByRole('button', { name: 'つぎへ' }).click();
  await expect(
    page.getByRole('heading', { name: '関節をあわせる' }),
  ).toBeVisible();
  await page.getByRole('button', { name: '左から 1', exact: true }).click();
  await page.getByRole('button', { name: 'つぎへ' }).click();
  await page.getByLabel('なまえ', { exact: true }).fill('テストのともだち');
  await page.getByRole('button', { name: '保存する' }).click();
  await expect(page).toHaveURL(/characters\/(?!new)[^/]+$/);
  await expect(page.getByLabel('なまえ', { exact: true })).toHaveValue(
    'テストのともだち',
  );
  await page.getByRole('button', { name: 'もどる', exact: true }).click();
  await page.getByRole('tab', { name: /えほん/ }).click();
  await page.getByRole('button', { name: 'えほんをつくる' }).click();
  await page.getByRole('button', { name: 'ページをふやす' }).click();
  await page
    .getByRole('combobox', { name: 'キャラクター', exact: true })
    .selectOption({ label: 'テストのともだち' });
  await page.getByRole('textbox', { name: /^おはなし/ }).fill('じゃんぷ！');
  await expect(
    page.getByRole('combobox', { name: 'うごき', exact: true }),
  ).toHaveValue('jump');
  await page
    .getByRole('combobox', { name: 'うごき', exact: true })
    .selectOption('wave');
  await page
    .getByRole('textbox', { name: /^おはなし/ })
    .fill('はしって いったよ');
  await expect(
    page.getByRole('combobox', { name: 'うごき', exact: true }),
  ).toHaveValue('wave');
  await page.getByRole('button', { name: 'ページをふやす' }).click();
  await page.getByRole('textbox', { name: /^おはなし/ }).fill('おしまい');
  await page.getByRole('button', { name: 'よむ', exact: true }).click();
  await expect(page.getByText('はしって いったよ')).toBeVisible();
  await page.locator('.player').click({ position: { x: 60, y: 180 } });
  await expect(page.getByText('おしまい', { exact: true })).toBeVisible();
});
test('settings language and accessibility', async ({ page }) => {
  await page.goto('/settings');
  await page.getByLabel('ことば').selectOption('en');
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  expect(await page.locator('html').getAttribute('lang')).toBe('en');
  const result = await new AxeBuilder({ page }).analyze();
  expect(
    result.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    ),
  ).toEqual([]);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
});

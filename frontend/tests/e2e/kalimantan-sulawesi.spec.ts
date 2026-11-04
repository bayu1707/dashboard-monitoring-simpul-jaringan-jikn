import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { SnapshotData } from '../../app/types/domain';
import { useFixtureTiles } from './tileFixture';
import { waitForMapMotion } from './apiFixture';

// Data/API sungguhan Laravel; hanya tile diganti fixture agar tes tidak bergantung provider.
const pilot = JSON.parse(readFileSync('../public/data/datasets/pilot/snapshot.json', 'utf8')) as SnapshotData;
const regions = [
  ['61', '61.71'], ['62', '62.71'], ['63', '63.71'], ['64', '64.72'], ['65', '65.01'],
  ['71', '71.71'], ['72', '72.71'], ['73', '73.71'], ['74', '74.71'], ['75', '75.71'], ['76', '76.02'],
] as const;

test('11 provinsi baru: klik wilayah mengganti lapisan; filter, hover, tombol detail dan browser back', async ({ page }, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await useFixtureTiles(page);
  await page.goto('/simpul-jaringan');
  await expect(page.locator('[data-region-count-id]')).toHaveCount(38);
  for (const [provinceId, kabKotaId] of regions) {
    await page.locator('#desktop-province').selectOption(provinceId);
    await expect(page.locator('.map-stage')).toHaveAttribute('data-level', 'provinsi');
    await expect(page.locator(`[data-region-id="${kabKotaId}"]`).first()).toBeAttached();
    await waitForMapMotion(page);
    // Memilih polygon melalui keyboard memicu event wilayah, bukan sekadar mengubah zoom.
    await page.locator(`[data-region-id="${kabKotaId}"]`).first().focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.map-stage')).toHaveAttribute('data-level', 'instansi');
    await expect(page.locator('#desktop-kabkota')).toHaveValue(kabKotaId);
    await expect(page.locator('#desktop-jenis')).toHaveValue('');
    await expect(page.locator('.instansi-marker, .instansi-cluster').first()).toBeAttached();
  }
  await page.goto('/simpul-jaringan');
  await expect(page.locator('[data-region-count-id="61"]')).toBeAttached();
  await page.locator('[data-region-count-id="61"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.map-stage')).toHaveAttribute('data-level', 'provinsi');
  await expect(page.locator('#desktop-province')).toHaveValue('61');

  const row = pilot.instansi.find((item) => item.id === 'casefile-e111e450058a1fd64e57aeab')!;
  const search = page.locator('.global-search input[role="combobox"]');
  await search.fill(row.name);
  await expect(page.locator('.global-search [role="option"]')).toHaveCount(1);
  await search.press('Enter');
  const popup = page.locator('.leaflet-popup .instansi-popup');
  await expect(popup.getByRole('heading')).toHaveText(row.name);
  await expect(popup).toContainText(String(row.joinedYear));
  await expect(popup).toContainText('DATA SIMULASI');
  await expect(popup.getByRole('button', { name: /Landing Page/ })).toBeDisabled();
  await waitForMapMotion(page);
  await page.locator(`[data-instansi-id="${row.id}"]`).hover();
  const detail = popup.getByRole('link', { name: 'Lihat detail' });
  await detail.hover();
  await expect(popup).toBeVisible();
  const marker = await page.locator(`[data-instansi-id="${row.id}"]`).boundingBox();
  const tip = await page.locator('.leaflet-popup-tip-container').boundingBox();
  expect(Math.abs(tip!.x + tip!.width / 2 - marker!.x - marker!.width / 2)).toBeLessThanOrEqual(2);
  await page.screenshot({ path: info.outputPath('pontianak-popup-1440.png') });
  await detail.click();
  await expect(page.locator('.profile-identity h1')).toHaveText(row.name);
  await expect(page.locator('.profile-fields')).toContainText(String(row.joinedYear));
  await page.goBack();
  await expect(page.locator('#desktop-province')).toHaveValue('61');
  await expect(page.locator('#desktop-kabkota')).toHaveValue('61.71');
  await page.getByRole('button', { name: 'Kembali ke Provinsi', exact: true }).click();
  await expect(page.locator('.map-stage')).toHaveAttribute('data-level', 'provinsi');
  expect(errors).toEqual([]);
});

test('pengecualian Kolaka/Sinjai/Parepare tetap dapat dicari dan dibuka tanpa marker palsu', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await useFixtureTiles(page);
  for (const [city, id] of [
    ['74.01', 'casefile-e155d6b135b6848523b25714'],
    ['73.07', 'casefile-bf1032193988af5c61840d5b'],
    ['73.72', 'casefile-4d38343a923ea5817d9ae016'],
  ]) {
    await page.goto(`/simpul-jaringan?provinsi=${city!.slice(0, 2)}&kabKota=${city}`);
    await expect(page.locator('.map-stage')).toHaveAttribute('data-level', 'instansi');
    await expect(page.locator('.instansi-marker')).toHaveCount(0);
    await page.getByRole('button', { name: 'Daftar', exact: true }).click();
    const row = page.locator(`[data-result-instansi-id="${id}"]`);
    await expect(row).toContainText('Belum memiliki koordinat');
    await row.getByRole('button', { name: /Pratinjau/ }).click();
    await expect(page.locator('.list-profile-popup')).toBeVisible();
    await page.locator('.list-profile-popup').getByRole('link', { name: 'Lihat detail' }).click();
    await expect(page.locator('.profile-identity h1')).toHaveText(pilot.instansi.find((item) => item.id === id)!.name);
  }
  expect(errors).toEqual([]);
});

test('mobile 390: Sulawesi Selatan, pencarian Makassar, popup sentuh dan detail', async ({ browser }, info) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await useFixtureTiles(page);
    await page.goto('/simpul-jaringan?provinsi=73&kabKota=73.71');
    const row = pilot.instansi.find((item) => item.id === 'casefile-8151ea3e7b56817b890ba3bd')!;
    const input = page.locator('.global-search input[role="combobox"]');
    await input.fill(row.name);
    await page.locator('.global-search [role="option"]').tap();
    const popup = page.locator('.mobile-popup .instansi-popup');
    await expect(popup.getByRole('heading')).toHaveText(row.name);
    await expect(popup).toContainText(String(row.joinedYear));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath('makassar-popup-390.png') });
    await popup.getByRole('link', { name: 'Lihat detail' }).tap();
    await expect(page.locator('.profile-identity h1')).toHaveText(row.name);
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

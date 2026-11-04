import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { SnapshotData } from '../../app/types/domain';
import { useFixtureTiles } from './tileFixture';
import { waitForMapMotion } from './apiFixture';

// API/data Laravel sungguhan; tile fixture hanya menghilangkan ketergantungan provider peta.
const pilot = JSON.parse(readFileSync('../public/data/datasets/pilot/snapshot.json', 'utf8')) as SnapshotData;
const regions = [
  ['51', '51.71'], ['52', '52.71'], ['53', '53.71'], ['81', '81.71'], ['82', '82.71'],
  ['91', '91.71'], ['92', '92.02'], ['93', '93.01'], ['94', '94.01'], ['95', '95.03'], ['96', '96.71'],
] as const;

test('Indonesia 38 provinsi: 11 wilayah pelengkap membuka kab/kota dan marker; filter sinkron', async ({ page }, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await useFixtureTiles(page);
  await page.goto('/simpul-jaringan');
  await expect(page.locator('[data-region-count-id]')).toHaveCount(38);
  await expect(page.locator('.map-footer')).toContainText('643 instansi');
  await page.screenshot({ path: info.outputPath('indonesia-38-provinsi-1440.png') });
  for (const [province, city] of regions) {
    await page.locator('#desktop-province').selectOption(province);
    await expect(page.locator('.map-stage')).toHaveAttribute('data-level', 'provinsi');
    const polygon = page.locator(`[data-region-id="${city}"]`).first();
    await expect(polygon).toBeAttached();
    await waitForMapMotion(page);
    await polygon.focus(); await page.keyboard.press('Enter');
    await expect(page.locator('#desktop-kabkota')).toHaveValue(city);
    await expect(page.locator('.map-stage')).toHaveAttribute('data-level', 'instansi');
    await expect(page.locator('.instansi-marker, .instansi-cluster').first()).toBeAttached();
    const lkd = pilot.instansi.find((row) => row.kabKotaId === city && row.coordinates)!;
    await page.locator('#desktop-jenis').selectOption(lkd.jenisId!);
    await expect(page.locator('#desktop-province')).toHaveValue(province);
    await expect(page.locator('#desktop-kabkota')).toHaveValue(city);
    await expect(page.locator('.instansi-marker, .instansi-cluster').first()).toBeAttached();
  }
  expect(errors).toEqual([]);
});

test('Bali: popup stabil, panah sesuai pin, tahun/detail dan Landing Page disabled', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  // Opsional untuk bukti visual lokal; CI/default tetap memakai tile fixture.
  if (!process.env.NATIONAL_LIVE_TILES) await useFixtureTiles(page);
  await page.goto('/simpul-jaringan');
  const row = pilot.instansi.find((item) => item.kabKotaId === '51.71' && item.jenisId === 'lkd-kota')!;
  const input = page.locator('.global-search input[role="combobox"]');
  await input.fill(row.name); await expect(page.locator('.global-search [role="option"]')).toHaveCount(1);
  await input.press('Enter');
  await expect(page.locator('#desktop-province')).toHaveValue('51');
  await expect(page.locator('#desktop-kabkota')).toHaveValue('51.71');
  const popup = page.locator('.leaflet-popup .instansi-popup');
  await expect(popup.getByRole('heading')).toHaveText(row.name);
  await expect(popup).toContainText(String(row.joinedYear));
  await expect(popup).toContainText('DATA SIMULASI');
  await expect(popup.getByRole('button', { name: /Landing Page/ })).toBeDisabled();
  await waitForMapMotion(page);
  const marker = page.locator(`[data-instansi-id="${row.id}"]`);
  await marker.hover();
  const detail = popup.getByRole('link', { name: 'Lihat detail' });
  await detail.hover(); await expect(popup).toBeVisible();
  const m = await marker.boundingBox(); const tip = await page.locator('.leaflet-popup-tip-container').boundingBox();
  expect(Math.abs(tip!.x + tip!.width / 2 - m!.x - m!.width / 2)).toBeLessThanOrEqual(2);
  if (process.env.NATIONAL_LIVE_TILES) await expect(page.locator('.leaflet-tile-loaded').first()).toBeVisible();
  await page.screenshot({ path: info.outputPath('denpasar-popup-1440.png') });
  await detail.click();
  await expect(page.locator('.profile-identity h1')).toHaveText(row.name);
  await expect(page.locator('.profile-fields')).toContainText(String(row.joinedYear));
  await page.goBack();
  await expect(page.locator('#desktop-kabkota')).toHaveValue('51.71');
  await page.getByRole('button', { name: 'Kembali ke Nasional', exact: true }).click();
  await expect(page.locator('[data-region-count-id]')).toHaveCount(38);
  expect(errors).toEqual([]);
});

test('Papua: record tanpa pin tetap tersedia melalui Daftar, pratinjau dan pencarian global', async ({ page }, info) => {
  await useFixtureTiles(page);
  const row = pilot.instansi.find((item) => item.id === 'casefile-a23fa92695af7586e7667659')!;
  await page.goto('/simpul-jaringan?provinsi=95&kabKota=95.05');
  await expect(page.locator('.map-stage')).toHaveAttribute('data-level', 'instansi');
  await expect(page.locator('.instansi-marker')).toHaveCount(0);
  await page.getByRole('button', { name: 'Daftar', exact: true }).click();
  const result = page.locator(`[data-result-instansi-id="${row.id}"]`);
  await expect(result).toContainText('Belum memiliki koordinat');
  await result.getByRole('button', { name: /Pratinjau/ }).click();
  await expect(page.locator('.list-profile-popup')).toContainText(String(row.joinedYear));
  await page.screenshot({ path: info.outputPath('papua-tanpa-pin-tetap-diakses.png') });
  await page.locator('.list-profile-popup').getByRole('link', { name: 'Lihat detail' }).click();
  await expect(page.locator('.profile-identity h1')).toHaveText(row.name);
  await page.goto('/simpul-jaringan');
  const input = page.locator('.global-search input[role="combobox"]');
  await input.fill(row.name);
  await expect(page.locator('.global-search [role="option"]')).toHaveCount(1);
  await input.press('Enter');
  await expect(page.locator('.profile-identity h1')).toHaveText(row.name);
});

test('mobile 390: Maluku, popup sentuh, tahun dan detail tanpa overflow', async ({ browser }, info) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await useFixtureTiles(page); await page.goto('/simpul-jaringan');
    const row = pilot.instansi.find((item) => item.kabKotaId === '81.71' && item.jenisId === 'lkd-kota')!;
    const input = page.locator('.global-search input[role="combobox"]');
    await input.fill(row.name); await page.locator('.global-search [role="option"]').tap();
    const popup = page.locator('.mobile-popup .instansi-popup');
    await expect(popup.getByRole('heading')).toHaveText(row.name);
    await expect(popup).toContainText(String(row.joinedYear));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath('ambon-popup-390.png') });
    await popup.getByRole('link', { name: 'Lihat detail' }).tap();
    await expect(page.locator('.profile-identity h1')).toHaveText(row.name);
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

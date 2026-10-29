import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { SnapshotData } from '../../app/types/domain';
import { openFixtureMap, useApiFixture, waitForMapMotion } from './apiFixture';
import { useFixtureTiles } from './tileFixture';
const pilot = JSON.parse(readFileSync('../public/data/datasets/pilot/snapshot.json', 'utf8')) as SnapshotData;
const input = (page: Page) => page.getByRole('combobox', { name: 'Cari instansi seluruh wilayah' });
const popup = (page: Page) => page.locator('.leaflet-popup .instansi-popup');
const errors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
  const messages: string[] = [];
  errors.set(page, messages);
  page.on('pageerror', error => messages.push(error.message));
});
test.afterEach(({ page }) => expect(errors.get(page)).toEqual([]));
async function search(page: Page, text: string) {
  await input(page).fill(text);
  await expect(page.locator('.global-search').getByRole('option').filter({ hasText: text })).not.toHaveCount(0);
}

test('API nyata: lintas provinsi → marker ANRI → popup → detail/kembali/reset', async ({ page }, info) => {
  await useFixtureTiles(page);
  await page.goto('/simpul-jaringan?provinsi=36');
  await expect(page.locator('.map-canvas.leaflet-container')).toBeVisible();
  const anri = pilot.instansi.find(item => item.name === 'Arsip Nasional RI')!;
  const request = page.waitForRequest(request => new URL(request.url()).searchParams.get('search') === 'Arsip Nasional RI');
  await search(page, 'Arsip Nasional RI');
  expect(new URL((await request).url()).searchParams.has('provinceId')).toBe(false);
  await input(page).press('ArrowDown');
  await input(page).press('Enter');
  await expect(page.locator('#desktop-province')).toHaveValue(anri.provinceId!);
  await expect(page.locator('#desktop-kabkota')).toHaveValue(anri.kabKotaId!);
  await expect(page.locator('#desktop-jenis')).toHaveValue('');
  await expect(popup(page).getByRole('heading')).toHaveText(anri.name);
  await expect(page.locator(`[data-instansi-id="${anri.id}"]`)).toBeVisible();
  await popup(page).getByRole('link', { name: 'Lihat detail' }).focus();
  await expect(page.locator('.leaflet-popup')).toHaveCSS('opacity', '1');
  await page.screenshot({ path: info.outputPath('search-pilot-desktop.png') });
  await expect(popup(page).getByRole('link', { name: /Landing Page/ })).toHaveAttribute('href', anri.landingPageUrl!);
  await popup(page).getByRole('link', { name: 'Lihat detail' }).click();
  await expect(page.locator('.profile-identity h1')).toHaveText(anri.name);
  await page.getByRole('link', { name: 'Kembali ke Peta', exact: true }).click();
  await expect(page.locator('#desktop-kabkota')).toHaveValue(anri.kabKotaId!);
  await page.getByRole('button', { name: 'Reset seluruh filter', exact: true }).click();
  await expect(page.locator('.map-stage')).toHaveAttribute('data-level', 'nasional');
});

test('API nyata: nasional maksimum delapan, empty/Escape, Excel tanpa pin langsung detail', async ({ page }) => {
  await useFixtureTiles(page);
  await page.goto('/simpul-jaringan?data=excel');
  await expect(page.locator('.map-canvas.leaflet-container')).toBeVisible();
  await search(page, 'Dinas');
  await expect(page.locator('.global-search').getByRole('option')).toHaveCount(8);
  await input(page).press('Escape');
  await expect(input(page)).toHaveAttribute('aria-expanded', 'false');
  await input(page).fill('tidak-ada-xyz-qwerty');
  await expect(page.locator('.global-search-status')).toContainText('tidak ditemukan');
  await search(page, 'Arsip Nasional RI');
  await input(page).press('Enter');
  await expect(page).toHaveURL(/\/simpul-jaringan\/[^?]+\?data=excel/);
  await expect(page.locator('.profile-identity h1')).toHaveText('Arsip Nasional RI');
  await page.getByRole('link', { name: 'Kembali ke Peta', exact: true }).click();
  await expect(page).toHaveURL(/simpul-jaringan\?data=excel$/);
});

test('demo: search cluster/spiderfy membuka anchor marker aktual; kartu wilayah dan keyboard', async ({ page }, info) => {
  await useApiFixture(page);
  await openFixtureMap(page);
  const badge = page.locator('[data-region-id="36"]');
  await badge.focus();
  await expect(page.locator('.region-info-tooltip')).toContainText('7 instansi unik · 6 memiliki pin');
  await expect(page.locator('.region-info-kind')).toHaveText('Provinsi');
  await page.screenshot({ path: info.outputPath('region-card.png') });
  await page.keyboard.press('Enter');
  await expect(page.locator('.map-stage')).toHaveAttribute('data-level', 'provinsi');
  await waitForMapMotion(page);
  await page.locator('[data-region-id="36.73"]').focus();
  await expect(page.locator('.region-info-kind')).toHaveText('Kabupaten/Kota');
  await expect(page.locator('.region-info-tooltip')).toContainText('7 instansi unik · 6 memiliki pin');
  await search(page, 'Instansi Demo A');
  await input(page).press('Enter');
  await expect(popup(page).getByRole('heading')).toHaveText('Instansi Demo A');
  await waitForMapMotion(page);
  const a = await page.locator('[data-instansi-id="demo-a"]').boundingBox();
  const b = await page.locator('[data-instansi-id="demo-b"]').boundingBox();
  expect(Math.abs(a!.x - b!.x) + Math.abs(a!.y - b!.y)).toBeGreaterThan(10);
  const tip = await page.locator('.leaflet-popup-tip-container').boundingBox();
  expect(Math.abs(tip!.x + tip!.width / 2 - a!.x - a!.width / 2)).toBeLessThanOrEqual(2);
  expect(Math.abs(tip!.y + tip!.height - a!.y)).toBeLessThanOrEqual(2);
  await popup(page).getByRole('link', { name: 'Lihat detail' }).focus();
  await expect(page.locator('.leaflet-popup')).toHaveCSS('opacity', '1');
  await page.screenshot({ path: info.outputPath('search-spiderfy.png') });
});

test('autocomplete mengabaikan respons lama, kegagalan, dan Escape saat request aktif', async ({ page }) => {
  await useApiFixture(page);
  await openFixtureMap(page);
  let release: () => void = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/institutions?**', async route => {
    const term = new URL(route.request().url()).searchParams.get('search');
    if (term === 'Demo A') await gate;
    if (term === 'gagal') { await route.abort(); return; }
    await route.fallback();
  });
  const oldRequest = page.waitForRequest(request => new URL(request.url()).searchParams.get('search') === 'Demo A');
  await input(page).fill('Demo A');
  await oldRequest;
  await search(page, 'Demo B');
  const oldResponse = page.waitForResponse(response => new URL(response.url()).searchParams.get('search') === 'Demo A');
  release();
  await (await oldResponse).finished();
  await expect(page.locator('.global-search').getByRole('option')).toHaveCount(1);
  await expect(page.locator('.global-search').getByRole('option')).toContainText('Instansi Demo B');
  await input(page).fill('gagal');
  await expect(page.locator('.global-search-status')).toContainText('Pencarian gagal');
  await input(page).fill('Demo A');
  await input(page).press('Escape');
  // Debounce dibatalkan sebelum request: tidak menunggu respons yang memang tidak dikirim.
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await expect(input(page)).toHaveAttribute('aria-expanded', 'false');
});

test('mobile 390: autocomplete tap → popup sentuh, tanpa overflow', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await useApiFixture(page);
  await openFixtureMap(page);
  await search(page, 'Instansi Demo A');
  await page.locator('.global-search').getByRole('option').click();
  await expect(page.locator('.mobile-popup')).toContainText('Instansi Demo A');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('search-mobile-390.png') });
  await page.locator('.mobile-popup').getByRole('link', { name: 'Lihat detail' }).click();
  await expect(page.locator('.profile-identity h1')).toHaveText('Instansi Demo A');
});

test('badge pilot: total/pin sesuai ID unik, kartu mengikuti badge dan tetap di viewport', async ({ page }, info) => {
  await useFixtureTiles(page);
  await page.goto('/simpul-jaringan');
  const badge = page.locator('[data-region-count-id="36"]');
  await expect(badge).toBeVisible();
  await badge.focus();
  const items = [...new Map(pilot.instansi.filter(item => item.provinceId === '36').map(item => [item.id, item])).values()];
  await expect(page.locator('.region-info-tooltip')).toContainText(`${items.length} instansi unik · ${items.filter(item => item.coordinates).length} memiliki pin`);
  const box = await page.locator('.region-info-tooltip').boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(1440);
  expect(box!.y + box!.height).toBeLessThanOrEqual(900);
  await page.screenshot({ path: info.outputPath('region-pilot.png') });
  await page.keyboard.press('Enter');
  await expect(page.locator('#desktop-province')).toHaveValue('36');
  await expect(page.locator('.map-stage')).toHaveAttribute('data-level', 'provinsi');
});

test('respons detail lama tidak menimpa pilihan baru; reset membatalkan popup', async ({ page }) => {
  await useApiFixture(page);
  await openFixtureMap(page);
  let release: () => void = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/institutions/demo-a?**', async route => {
    await gate;
    await route.fallback();
  });
  const pending = page.waitForRequest(request => request.url().includes('/institutions/demo-a?'));
  await search(page, 'Demo A');
  await input(page).press('Enter');
  await pending;
  await search(page, 'Demo B');
  await input(page).press('Enter');
  await expect(popup(page).getByRole('heading')).toHaveText('Instansi Demo B');
  const response = page.waitForResponse(response => response.url().includes('/institutions/demo-a?'));
  release();
  await (await response).finished();
  await expect(popup(page).getByRole('heading')).toHaveText('Instansi Demo B');
  await page.getByRole('button', { name: 'Reset seluruh filter' }).click();
  await expect(popup(page)).toHaveCount(0);
  await expect(page.locator('.map-stage')).toHaveAttribute('data-level', 'nasional');
  await expect(input(page)).toHaveValue('');
});

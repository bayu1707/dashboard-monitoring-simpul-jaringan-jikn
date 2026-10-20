import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { SnapshotData } from '../../src/types/domain';

const pilot = JSON.parse(readFileSync('public/data/datasets/pilot/snapshot.json', 'utf8')) as SnapshotData;
const jepara = pilot.instansi.find((item) => item.kabKotaId === '33.20')!;

test.beforeEach(async ({ page }) => {
  // Tile fixture menjaga tes mandiri dan tidak mengunduh tile massal dari provider.
  await page.route('https://tile.openstreetmap.org/**', (route) => route.fulfill({
    contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#e7eef0"/></svg>',
  }));
  const failures: string[] = [];
  page.on('pageerror', (error) => failures.push(error.message));
  await page.exposeFunction('readRuntimeFailures', () => failures);
});
test.afterEach(async ({ page }) => {
  expect(await page.evaluate(async () => {
    const read = (window as unknown as { readRuntimeFailures: () => Promise<string[]> }).readRuntimeFailures;
    return read();
  })).toEqual([]);
});

async function mapSettled(page: Page) {
  await expect(page.locator('[data-zoom-moving="true"]')).toHaveCount(0);
  await expect.poll(async () => {
    const pane = page.locator('.leaflet-map-pane');
    const before = await pane.evaluate((element) => getComputedStyle(element).transform);
    await page.waitForTimeout(100);
    return before === await pane.evaluate((element) => getComputedStyle(element).transform);
  }).toBe(true);
}

test('clone: default Jawa → Jepara → hover → detail → kembali; Excel tetap 643 tanpa pin', async ({ page }) => {
  const privateRequests: string[] = [];
  page.on('request', (request) => { if (request.url().includes('/local-data/')) privateRequests.push(request.url()); });
  await page.goto('/simpul-jaringan');
  await expect(page.locator('.snapshot-note')).toContainText('418 instansi percontohan');
  await expect(page.locator('.region-count-marker')).toHaveCount(16);
  await page.locator('[data-region-count-id="33"]').click();
  await expect(page.locator('.map-stage')).toHaveAttribute('data-level', 'provinsi');
  await expect(page.locator('#desktop-province')).toHaveValue('33');
  await mapSettled(page);
  await page.locator('[data-region-count-id="33.20"]').click();
  await expect(page.locator('.map-stage')).toHaveAttribute('data-level', 'instansi');
  await expect(page.locator('#desktop-kabkota')).toHaveValue('33.20');
  await expect(page.locator('#desktop-jenis')).toHaveValue('');
  const marker = page.locator(`[data-instansi-id="${jepara.id}"]`);
  await mapSettled(page);
  await marker.hover();
  const popup = page.locator('.leaflet-popup .instansi-popup');
  await expect(popup.getByRole('heading')).toHaveText(jepara.name);
  await expect(popup).toContainText('DATA SIMULASI');
  await expect(popup.locator('.popup-metrics dd').last()).toHaveText(String(jepara.joinedYear));
  // Tunggu autopan menyelesaikan perpindahan sebelum menghitung posisi tombol.
  await mapSettled(page);
  await popup.getByRole('link', { name: 'Lihat detail' }).hover();
  await page.waitForTimeout(250);
  await expect(popup).toBeVisible();
  await popup.getByRole('link', { name: 'Lihat detail' }).click();
  await expect(page.locator('.profile-identity h1')).toHaveText(jepara.name);
  await page.getByRole('link', { name: 'Kembali ke Peta', exact: true }).click();
  await expect(page.locator('#desktop-kabkota')).toHaveValue('33.20');
  await page.goto('/simpul-jaringan?data=excel&daftar=instansi');
  await expect(page.locator('.results-panel')).toContainText('643 hasil');
  await expect(page.locator('.results-panel')).toContainText('643 belum memiliki koordinat');
  await expect(page.locator('.instansi-marker')).toHaveCount(0);
  await page.locator('#desktop-province').selectOption('36');
  await expect(page).toHaveURL(/data=excel/);
  expect(privateRequests).toEqual([]);
});

test('mobile 390: daftar dan detail memakai snapshot yang sama', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/simpul-jaringan?provinsi=33&kabKota=33.20`);
  await expect(page.locator('.snapshot-note')).toContainText('418 instansi percontohan');
  // Force touch via browser context is tested in touch-specific regressions; here mobile width uses click.
  await page.getByRole('button', { name: 'Daftar', exact: true }).click();
  await expect(page.locator('.results-panel')).toContainText(jepara.name);
  await page.locator('.results-panel').getByRole('link', { name: jepara.name, exact: true }).click();
  await expect(page.locator('.profile-identity h1')).toHaveText(jepara.name);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

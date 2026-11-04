import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import type { SnapshotData } from '../../src/types/domain';
import { useFixtureTiles } from './tileFixture';
import { activateRegionBadge } from './regionBadge';
const snapshot = JSON.parse(readFileSync('public/data/datasets/pilot/snapshot.json', 'utf8')) as SnapshotData;
const sumatra = snapshot.instansi.filter((row) => Number(row.provinceId) < 30);
const errors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  await useFixtureTiles(page);
  errors.set(page, []);
  page.on('pageerror', (error) => errors.get(page)!.push(error.message));
});
test.afterEach(({ page }) => expect(errors.get(page)).toEqual([]));
test('Banda Aceh: seluruh pin kota, provinsi dan kampus tampil; hover memakai identitas serta anchor marker yang benar', async ({ page }) => {
  const records = sumatra.filter((row) => row.kabKotaId === '11.71' && row.coordinates);
  expect(records).toHaveLength(3);
  await page.goto('/simpul-jaringan?provinsi=11&kabKota=11.71');
  await settled(page);
  await expect(page.locator('#desktop-jenis')).toHaveValue('');
  for (const record of records) {
    const marker = page.locator(`[data-instansi-id="${record.id}"]`);
    await expect(marker).toBeVisible();
    await marker.hover();
    const popup = page.locator('.leaflet-popup .instansi-popup');
    await expect(popup.getByRole('heading')).toHaveText(record.name);
    await expect(popup.locator('.popup-metrics dd').last()).toHaveText(String(record.joinedYear));
    await settled(page);
    await popup.getByRole('link', { name: 'Lihat detail', exact: true }).hover();
    await page.waitForTimeout(250);
    await expect(popup).toBeVisible();
    const pin = await marker.boundingBox();
    const tip = await page.locator('.leaflet-popup-tip-container').boundingBox();
    expect(pin).not.toBeNull(); expect(tip).not.toBeNull();
    expect(Math.abs(tip!.x + tip!.width / 2 - (pin!.x + pin!.width / 2))).toBeLessThan(3);
  }
  await page.screenshot({ path: '.local/qa/sumatra-pin-banda-aceh-1440.png' });
  await page.locator('#desktop-province').selectOption('12');
  await expect(page.locator('.instansi-popup')).toHaveCount(0);
});
async function settled(page: Page) {
  await expect(page.locator('[data-zoom-moving="true"]')).toHaveCount(0);
  await expect.poll(async () => {
    const pane = page.locator('.leaflet-map-pane');
    const before = await pane.evaluate((el) => getComputedStyle(el).transform);
    await page.waitForTimeout(120);
    return before === await pane.evaluate((el) => getComputedStyle(el).transform);
  }).toBe(true);
}
for (const provinceId of ['11', '12', '16', '19']) {
  test(`Sumatra ${provinceId}: klik provinsi → kab/kota → hover → detail → kembali`, async ({ page }) => {
    const record = sumatra.find((row) => row.provinceId === provinceId && row.coordinates)!;
    await page.goto('/simpul-jaringan');
    await expect(page.locator('.region-count-marker')).toHaveCount(38);
    await settled(page);
    await activateRegionBadge(page, provinceId);
    await expect(page.locator('.map-stage')).toHaveAttribute('data-level', 'provinsi');
    await expect(page.locator('#desktop-province')).toHaveValue(provinceId);
    await expect(page.locator('.instansi-popup')).toHaveCount(0);
    await settled(page);
    await activateRegionBadge(page, record.kabKotaId!);
    await expect(page.locator('.map-stage')).toHaveAttribute('data-level', 'instansi');
    await expect(page.locator('#desktop-kabkota')).toHaveValue(record.kabKotaId!);
    await expect(page.locator('#desktop-jenis')).toHaveValue('');
    await settled(page);
    const marker = page.locator(`[data-instansi-id="${record.id}"]`);
    if (!await marker.isVisible()) {
      const cluster = page.locator('.instansi-cluster').first();
      await expect(cluster).toBeVisible(); await cluster.click(); await settled(page);
    }
    await marker.hover();
    const popup = page.locator('.leaflet-popup .instansi-popup');
    await expect(popup.getByRole('heading')).toHaveText(record.name);
    await expect(popup.locator('.popup-metrics dd').last()).toHaveText(String(record.joinedYear));
    await expect(popup).toContainText('DATA SIMULASI');
    await expect(popup.getByRole('button', { name: /Landing Page/ })).toBeDisabled();
    await settled(page);
    const link = popup.getByRole('link', { name: 'Lihat detail', exact: true });
    await link.hover(); await page.waitForTimeout(250); await expect(popup).toBeVisible();
    if (provinceId === '11') await page.screenshot({ path: '.local/qa/sumatra-popup-1440.png' });
    await link.click();
    await expect(page.locator('.profile-identity h1')).toHaveText(record.name);
    await expect(page.locator('.profile-fields')).toContainText(String(record.joinedYear));
    await page.getByRole('link', { name: 'Kembali ke Peta', exact: true }).click();
    await expect(page.locator('#desktop-province')).toHaveValue(provinceId);
    await expect(page.locator('#desktop-kabkota')).toHaveValue(record.kabKotaId!);
  });
}
test('10 provinsi Sumatra dapat dipilih; tanpa pin tetap dapat dibuka dan reset menutup popup', async ({ page }) => {
  await page.goto('/simpul-jaringan');
  await expect(page.locator('#desktop-province option')).toHaveCount(39);
  for (const id of ['11', '12', '13', '14', '15', '16', '17', '18', '19', '21']) {
    await page.locator('#desktop-province').selectOption(id);
    await expect(page.locator('.map-stage')).toHaveAttribute('data-level', 'provinsi');
    await expect(page.locator('#desktop-kabkota')).toHaveValue('');
    await expect(page.locator('[data-region-count-kind="region"]').first()).toBeVisible();
  }
  const record = sumatra.find((row) => row.coordinates === null && row.kabKotaId)!;
  await page.locator('#desktop-province').selectOption(record.provinceId!);
  await page.locator('#desktop-kabkota').selectOption(record.kabKotaId!);
  await page.getByRole('button', { name: 'Daftar', exact: true }).click();
  const row = page.locator(`[data-result-instansi-id="${record.id}"]`);
  await expect(row).toContainText('Belum memiliki koordinat');
  await row.getByRole('link', { name: record.name, exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.profile-identity h1')).toHaveText(record.name);
  await page.getByRole('link', { name: 'Kembali ke Peta', exact: true }).click();
  await page.getByRole('button', { name: 'Reset seluruh filter', exact: true }).click();
  await expect(page.locator('.map-stage')).toHaveAttribute('data-level', 'nasional');
  await expect(page.locator('.instansi-popup')).toHaveCount(0);
});
test('mobile sentuh 390: pin Sumatra → sheet → detail; tile gagal tidak menghapus hasil', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const failures: string[] = []; page.on('pageerror', (error) => failures.push(error.message));
  await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
  const record = sumatra.find((row) => row.provinceId === '11' && row.coordinates)!;
  await page.goto(`/simpul-jaringan?provinsi=${record.provinceId}&kabKota=${record.kabKotaId}`);
  await settled(page);
  await expect(page.getByText('Peta dasar belum dapat dimuat.', { exact: false })).toBeVisible();
  await page.locator(`[data-instansi-id="${record.id}"]`).tap();
  const popup = page.locator('.mobile-popup .instansi-popup');
  await expect(popup.getByRole('heading')).toHaveText(record.name);
  await expect(popup.locator('.popup-metrics dd').last()).toHaveText(String(record.joinedYear));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.local/qa/sumatra-popup-390.png' });
  await popup.getByRole('link', { name: 'Lihat detail', exact: true }).tap();
  await expect(page.locator('.profile-identity h1')).toHaveText(record.name);
  expect(failures).toEqual([]); await context.close();
});

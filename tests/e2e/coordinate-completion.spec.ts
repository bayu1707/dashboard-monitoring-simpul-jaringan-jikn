import { useFixtureTiles } from './tileFixture';
import { expect, test } from '@playwright/test';
test.beforeEach(async ({ page }) => useFixtureTiles(page));
import { existsSync, readFileSync } from 'node:fs';
import type { SnapshotData } from '../../src/types/domain';

const snapshot: SnapshotData | null = existsSync('public/data/datasets/pilot/snapshot.json')
  ? JSON.parse(readFileSync('public/data/datasets/pilot/snapshot.json', 'utf8')) as SnapshotData : null;
const records = snapshot?.instansi ?? [];
const targetNames = [
  'Dinas Perpustakaan dan Kearsipan Kabupaten Ciamis',
  'Dinas Perpustakaan dan kearsipan Kabupaten Jember',
  'Dinas Perpustakaan dan Kearsipan Kabupaten Sampang',
  'Dinas Kearsipan dan Perpustakaan Kabupaten Rembang',
  'Dinas Kearsipan dan Perpustakaan Kabupaten Nganjuk',
  'Dinas Perpustakaan dan Kearsipan Kabupaten Sleman',
];
test.skip(!snapshot?.metadata.id.startsWith('pilot-jawa-')
  || targetNames.some((name) => !records.find((item) => item.name === name)?.coordinates),
'Dataset koordinat lokal hasil review belum tersedia.');

test('pin tambahan: hover stabil, panah mengikuti marker, tahun Excel, detail dan kembali', async ({ page }) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const name of targetNames.slice(0, 5)) {
    const record = records.find((item) => item.name === name)!;
    await page.goto(`/simpul-jaringan?provinsi=${record.provinceId}&kabKota=${record.kabKotaId}`);
    await expect(page.locator('.map-stage')).toHaveAttribute('data-level', 'instansi');
    await expect(page.locator('#desktop-jenis')).toHaveValue('');
    const marker = page.locator(`[data-instansi-id="${record.id}"]`);
    if (record.kabKotaId === '35.09') {
      // Dua pin Jember berdekatan pada cakupan kabupaten; uraikan cluster lewat UI.
      const cluster = page.locator('.instansi-cluster');
      await expect(cluster).toHaveCount(1);
      await cluster.click();
    }
    await expect(marker).toBeInViewport();
    await marker.hover();
    const popup = page.locator('.instansi-leaflet-popup .instansi-popup');
    await expect(popup.getByRole('heading')).toHaveText(record.name);
    await expect(popup.locator('.popup-metrics dd').last()).toHaveText(String(record.joinedYear));
    if (record.coordinateLocationLabel) await expect(popup).toContainText(`Lokasi: ${record.coordinateLocationLabel}`);
    await expect.poll(async () => {
      const pin = await marker.boundingBox();
      const tip = await page.locator('.leaflet-popup-tip-container').boundingBox();
      return pin && tip ? Math.max(Math.abs(tip.x + tip.width / 2 - pin.x - pin.width / 2),
        Math.abs(tip.y + tip.height - pin.y)) : Infinity;
    }).toBeLessThanOrEqual(2);
    const link = popup.getByRole('link', { name: 'Lihat detail', exact: true });
    // Tunggu autoPan menyelesaikan gerak konten sebelum menargetkan tombol.
    await expect.poll(async () => {
      const before = await link.boundingBox();
      await page.waitForTimeout(100);
      const after = await link.boundingBox();
      return before !== null && JSON.stringify(before) === JSON.stringify(after);
    }).toBe(true);
    await link.hover();
    await page.waitForTimeout(250); // Melampaui timer penutupan hover 200 ms.
    await expect(popup).toBeVisible();
    if (record.coordinateLocationLabel) await page.screenshot({ path: '.local/qa/koordinat-baru-popup-desktop.png' });
    await link.click();
    await expect(page.locator('.profile-identity h1')).toHaveText(record.name);
    await expect(page.locator('.profile-fields')).toContainText(String(record.joinedYear));
    if (record.coordinateLocationLabel) await expect(page.locator('.source-card')).toContainText(record.coordinateLocationLabel);
    await page.getByRole('link', { name: 'Kembali ke Peta', exact: true }).click();
    await expect(page.locator('#desktop-kabkota')).toHaveValue(record.kabKotaId!);
  }
  expect(errors).toEqual([]);
});

test('pin tambahan pada sentuh 390: sheet memuat lokasi unit dan detail yang sama', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const record = records.find((item) => item.name === targetNames[4])!;
  await page.goto(`/simpul-jaringan?provinsi=${record.provinceId}&kabKota=${record.kabKotaId}`);
  const marker = page.locator(`[data-instansi-id="${record.id}"]`);
  await expect(marker).toBeInViewport();
  await marker.tap();
  const popup = page.locator('.mobile-popup .instansi-popup');
  await expect(popup.getByRole('heading')).toHaveText(record.name);
  await expect(popup).toContainText(record.coordinateLocationLabel!);
  await expect(popup.locator('.popup-metrics dd').last()).toHaveText(String(record.joinedYear));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.local/qa/koordinat-baru-popup-mobile.png' });
  await popup.getByRole('link', { name: 'Lihat detail', exact: true }).tap();
  await expect(page.locator('.profile-identity h1')).toHaveText(record.name);
  expect(errors).toEqual([]);
  await context.close();
});

import { test, expect, type Page } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import type { SnapshotData } from '../../src/types/domain';

const path = '.local/casefile/snapshot.json';
const snapshot: SnapshotData | null = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) as SnapshotData : null;
test.skip(!snapshot, 'Snapshot pengguna belum diimpor di laptop ini; jalankan import:casefile untuk review lokal.');

async function mainData(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('Failed to load resource')) errors.push(message.text());
  });
  await page.goto('/simpul-jaringan?data=excel');
  await expect(page.locator('.map-stage')).toHaveAttribute('data-level', 'nasional');
  await expect(page.locator('.snapshot-note')).toContainText('Snapshot Excel');
  await expect(page.locator('.instansi-marker')).toHaveCount(0);
  return errors;
}
async function chooseCountRegion(page: Page, id: string, key?: 'Enter' | ' ') {
  const marker = page.locator(`[data-region-count-id="${id}"]`);
  await expect(marker).toBeVisible();
  if (key) { await marker.focus(); await page.keyboard.press(key); }
  else {
    // Pada skala Indonesia, Jakarta/Banten bisa terlalu rapat. Perbesar peta
    // melalui kontrol pengguna sampai pusat lingkaran ID tujuan tidak tertutup.
    for (let attempt = 0; attempt < 8; attempt++) {
      await expect(page.locator('[data-zoom-moving="true"]')).toHaveCount(0);
      const reachable = await marker.evaluate((element) => {
        const box = element.getBoundingClientRect();
        return document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
          ?.closest('[data-region-count-id]') === element;
      });
      if (reachable) break;
      // Zoom bertahap pada posisi target, agar Jakarta tidak keluar viewport
      // ketika overview Indonesia berpusat jauh di sebelah timurnya.
      const box = (await marker.boundingBox())!;
      const zoom = await page.evaluate(() => (JSON.parse(sessionStorage.getItem('jikn-map-session-v1') ?? '{}') as { zoom: number }).zoom);
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.wheel(0, -1200);
      await expect.poll(() => page.evaluate(() => (JSON.parse(sessionStorage.getItem('jikn-map-session-v1') ?? '{}') as { zoom: number }).zoom)).toBeGreaterThan(zoom);
      await expect(page.locator('[data-zoom-moving="true"]')).toHaveCount(0);
    }
    await marker.click();
  }
}

test('snapshot lokal nasional → Banten → Kota Serang → profil → detail dan kembali', async ({ page }) => {
  const errors = await mainData(page);
  await expect(page.locator('#desktop-province option')).toHaveCount(39);
  const banten = page.locator('[data-region-count-id="36"]');
  const provinceCount = new Set(snapshot!.instansi.filter((item) => item.provinceId === '36').map((item) => item.id)).size;
  await expect(banten).toContainText(String(provinceCount));
  await page.waitForFunction(() => {
    const tiles = [...document.querySelectorAll<HTMLImageElement>('.leaflet-tile')];
    return tiles.length > 0 && tiles.every((tile) => tile.complete);
  }, null, { timeout: 6000 }).catch(() => {});
  await page.screenshot({ path: '.local/qa/casefile-national.png' });
  await expect(page.locator('[data-region-id="36"]')).toBeVisible();
  await chooseCountRegion(page, '36');
  await expect(page.locator('.map-stage')).toHaveAttribute('data-level', 'provinsi');
  await expect(page.locator('#desktop-province')).toHaveValue('36');
  await expect(page.locator('[data-region-count-id="36"]')).toHaveCount(0);
  await expect(page.locator('[data-region-count-id="36.73"]')).toBeVisible();
  const provinceZoom = await page.evaluate(() => JSON.parse(sessionStorage.getItem('jikn-map-session-v1') ?? '{}').zoom as number);
  await expect(page.locator('[data-region-id="36.73"]')).toBeVisible();
  await chooseCountRegion(page, '36.73');
  await expect(page.locator('.map-stage')).toHaveAttribute('data-level', 'instansi');
  await expect(page.locator('#desktop-kabkota')).toHaveValue('36.73');
  await expect(page.locator('#desktop-jenis')).toHaveValue('');
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem('jikn-map-session-v1') ?? '{}').zoom as number),
    { message: 'Pemilihan Kota Serang harus memfokuskan bounds kota, bukan tetap pada Banten' }).toBeGreaterThan(provinceZoom);
  await expect(page.locator('.region-count-marker')).toHaveCount(0);
  const record = snapshot!.instansi.find((item) => item.kabKotaId === '36.73')!;
  await expect(page.locator('.results-panel')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Titik instansi belum tersedia' })).toBeVisible();
  await page.getByRole('button', { name: 'Daftar', exact: true }).click();
  await expect(page.locator('.results-panel')).toBeVisible();
  const row = page.locator('.result-item').filter({ has: page.getByRole('link', { name: record.name, exact: true }) });
  await row.hover();
  await expect(page.locator('.instansi-popup')).toHaveCount(0);
  await row.getByRole('button', { name: 'Pratinjau profil' }).click();
  const popup = page.locator('.instansi-popup');
  await expect(popup).toContainText(record.name);
  const popupBox = await popup.boundingBox();
  const listBox = await page.locator('.results-panel').boundingBox();
  expect(popupBox!.x + popupBox!.width, 'Popup daftar tidak menutupi baris asal').toBeLessThanOrEqual(listBox!.x);
  await expect(popup).toContainText(String(record.joinedYear));
  await expect(popup.getByRole('button', { name: 'Landing Page' })).toBeDisabled();
  await expect(popup).toContainText('Tautan belum tersedia');
  await expect(popup).toContainText('Belum tersedia');
  await popup.getByRole('link', { name: 'Lihat detail' }).hover();
  await page.waitForTimeout(350);
  await expect(popup).toBeVisible();
  await page.screenshot({ path: '.local/qa/casefile-desktop-popup.png' });
  await popup.getByRole('link', { name: 'Lihat detail' }).click();
  await expect(page.locator('.profile-identity h1')).toHaveText(record.name);
  await expect(page.locator('.source-card')).toContainText(record.joinedYearSource!);
  await expect(page.locator('.statistic-item strong')).toContainText(['Belum tersedia', 'Belum tersedia', 'Belum tersedia']);
  await expect(page.getByRole('tab')).toHaveCount(0);
  await page.setViewportSize({ width: 720, height: 450 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('link', { name: 'Kembali ke Peta', exact: true }).click();
  await expect(page.locator('#desktop-kabkota')).toHaveValue('36.73');
  await expect(page.locator('.results-panel')).toBeVisible();
  await page.locator('#desktop-jenis').selectOption('kl');
  await expect(page.getByRole('heading', { name: 'Hasil filter kosong' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('keyboard mengganti lapisan langsung, instansi tanpa koordinat tetap memakai daftar', async ({ page }) => {
  const errors = await mainData(page);
  await chooseCountRegion(page, '36', ' ');
  await expect(page.locator('#desktop-province')).toHaveValue('36');
  await chooseCountRegion(page, '36.73', 'Enter');
  await expect(page.locator('.results-panel')).toHaveCount(0);
  // Koordinat wilayah tidak menjadi titik kantor pada lapisan instansi.
  await expect(page.locator('.region-count-marker')).toHaveCount(0);
  await expect(page.locator('.instansi-marker')).toHaveCount(0);
  await page.getByRole('button', { name: 'Daftar', exact: true }).click();
  const record = snapshot!.instansi.find((item) => item.kabKotaId === '36.73')!;
  const row = page.locator(`[data-result-instansi-id="${record.id}"]`);
  await row.getByRole('link', { name: record.name, exact: true }).focus();
  await expect(page.locator('.instansi-popup')).toHaveCount(0);
  await page.screenshot({ path: '.local/qa/strict-flow-keyboard-list.png' });
  await page.keyboard.press('Enter');
  await expect(page.locator('.profile-identity h1')).toHaveText(record.name);
  await page.getByRole('link', { name: 'Kembali ke Peta', exact: true }).click();
  await expect(page.locator('#desktop-kabkota')).toHaveValue('36.73');
  await expect(page.locator('.instansi-marker')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('katalog seluruh instansi dan Belum Terpetakan tetap dapat diakses saat tile gagal', async ({ page }) => {
  await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
  const errors = await mainData(page);
  await page.getByRole('button', { name: /belum terpetakan/i }).click();
  await expect(page.locator('.result-item')).toHaveCount(snapshot!.instansi.filter((item) => item.provinceId === null).length);
  await page.getByLabel('Tampilkan', { exact: true }).selectOption('instansi');
  await expect(page.locator('.results-panel .result-item')).toHaveCount(snapshot!.instansi.length);
  await page.getByLabel('Tampilkan', { exact: true }).selectOption('belum-terpetakan');
  const unknown = snapshot!.instansi.filter((item) => item.provinceId === null);
  await expect(page.locator('.results-panel .result-item')).toHaveCount(unknown.length);
  await page.getByLabel('Cari nama atau kode').fill(unknown[0]!.name);
  await expect(page.locator('.result-item')).toHaveCount(1);
  await page.locator('.result-item').getByRole('button', { name: 'Pratinjau profil' }).click();
  await expect(page.locator('.instansi-popup')).toContainText(unknown[0]!.name);
  await page.keyboard.press('Escape');
  await page.locator('.result-item').getByRole('link').click();
  await expect(page.locator('.profile-fields')).toContainText('Belum tersedia');
  await page.getByRole('link', { name: 'Kembali ke Peta', exact: true }).click();
  await expect(page.getByLabel('Cari nama atau kode')).toHaveValue(unknown[0]!.name);
  await expect(page.locator('.map-stage')).toHaveAttribute('data-level', 'nasional');
  await expect(page.locator('.tile-error')).toContainText('Peta dasar belum dapat dimuat');
  await page.screenshot({ path: '.local/qa/casefile-unmapped.png' });
  expect(errors).toEqual([]);
});

test('wilayah Jawa, luar Jawa, dan pemekaran Papua memiliki lapisan kabupaten/kota', async ({ page }) => {
  const errors = await mainData(page);
  for (const province of ['33', '12', '92', '93', '94', '95', '96']) {
    await page.locator('#desktop-province').selectOption(province);
    await expect(page.locator('.map-stage')).toHaveAttribute('data-level', 'provinsi');
    const area = page.locator('[data-region-id]').first();
    await expect(area).toBeVisible();
    const id = await area.getAttribute('data-region-id');
    await area.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.map-stage')).toHaveAttribute('data-level', 'instansi');
    await expect(page.locator('#desktop-kabkota')).toHaveValue(id!);
    await page.getByRole('button', { name: 'Kembali ke Provinsi' }).click();
  }
  expect(errors).toEqual([]);
});

test('Jakarta langsung membuka enam kab/kota; Jakarta Selatan berganti ke lapisan instansi tanpa titik palsu', async ({ page }) => {
  const errors = await mainData(page);
  await chooseCountRegion(page, '31');
  await expect(page.locator('.map-stage')).toHaveAttribute('data-level', 'provinsi');
  await expect(page.locator('#desktop-province')).toHaveValue('31');
  await expect(page.locator('#desktop-kabkota option')).toHaveCount(7);
  const southJakarta = page.locator('[data-region-id="31.74"]').first();
  await expect(southJakarta).toBeVisible();
  await southJakarta.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.map-stage')).toHaveAttribute('data-level', 'instansi');
  await expect(page.locator('#desktop-kabkota')).toHaveValue('31.74');
  await expect(page.locator('#desktop-jenis')).toHaveValue('');
  await expect(page.locator('[data-region-id], .region-count-marker')).toHaveCount(0);
  // Snapshot lokal belum mempunyai record atau koordinat kantor yang terverifikasi di Jaksel.
  await expect(page.locator('.instansi-marker')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Hasil filter kosong' })).toBeVisible();
  await page.screenshot({ path: '.local/qa/jakarta-selatan-data-gap.png' });
  expect(errors).toEqual([]);
});

test('mobile 390: snapshot Excel dapat dibuka melalui daftar dan filter sentuh', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = await mainData(page);
  await page.getByRole('button', { name: 'Filter', exact: true }).tap();
  await page.locator('#mobile-province').selectOption('36');
  await page.locator('#mobile-kabkota').selectOption('36.73');
  await page.getByRole('button', { name: 'Terapkan', exact: true }).tap();
  await expect(page.locator('.results-panel')).toHaveCount(0);
  await page.getByRole('button', { name: 'Daftar', exact: true }).tap();
  await expect(page.locator('.results-panel')).toBeVisible();
  await page.locator('.result-item').first().getByRole('button', { name: 'Pratinjau profil' }).tap();
  await expect(page.locator('.mobile-popup')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Landing Page', exact: true })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.local/qa/casefile-mobile-popup.png' });
  await page.getByRole('link', { name: 'Lihat detail' }).tap();
  await expect(page.locator('.detail-snapshot-label')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  await context.close();
});

import { expect, test, type Page } from '@playwright/test';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { Instansi, SnapshotData } from '../../src/types/domain';

const reviewPath = '.local/coordinate-review-google-20261017/updates.json';
const snapshotPath = '.local/pilot/snapshot.json';
const snapshot: SnapshotData | null = existsSync(snapshotPath)
  ? JSON.parse(readFileSync(snapshotPath, 'utf8')) as SnapshotData : null;
const ids = new Set(existsSync(reviewPath)
  ? (JSON.parse(readFileSync(reviewPath, 'utf8')) as { records: { instansiId: string }[] }).records.map((item) => item.instansiId) : []);
const records = snapshot?.instansi.filter((item) => ids.has(item.id)) ?? [];
test.skip(records.length !== 108 || !snapshot?.metadata.id.startsWith('pilot-jawa-'),
  'Review privat 108 pin tambahan belum tersedia. Tes tidak mengisi dataset pengguna.');

async function settled(page: Page) {
  await expect(page.locator('[data-zoom-moving="true"]')).toHaveCount(0);
  await expect.poll(async () => {
    const pane = page.locator('.leaflet-map-pane');
    const before = await pane.evaluate((element) => getComputedStyle(element).transform);
    await page.waitForTimeout(100);
    return before === await pane.evaluate((element) => getComputedStyle(element).transform);
  }).toBe(true);
}

async function restoredPoint(page: Page, record: Instansi) {
  const query = `?provinsi=${record.provinceId}&kabKota=${record.kabKotaId}`;
  // Pakai jalur pemulihan viewport publik aplikasi untuk menguji pin yang rapat satu per satu.
  // Koordinat data tidak diubah, tidak menyuntik state Leaflet, dan cluster tetap dioperasikan melalui UI.
  await page.evaluate(({ query, center }) => sessionStorage.setItem('jikn-map-session-v1', JSON.stringify({
    datasetKind: 'pilot', query, center, zoom: 19, listScroll: 0, listOpen: false,
  })), { query, center: record.coordinates });
  await page.mouse.move(20, 20);
  await page.goto(`/simpul-jaringan${query}`);
  await expect(page.locator('.map-stage')).toHaveAttribute('data-level', 'instansi');
  await expect(page.locator('#desktop-kabkota')).toHaveValue(record.kabKotaId!);
  await expect(page.locator('#desktop-jenis')).toHaveValue('');
  const marker = page.locator(`[data-instansi-id="${record.id}"]`);
  await settled(page);
  if (!(await marker.isVisible())) {
    const map = (await page.locator('.map-canvas').boundingBox())!;
    const choices = await Promise.all((await page.locator('.instansi-cluster').all()).map(async (cluster) => {
      const box = await cluster.boundingBox();
      return { cluster, distance: box ? Math.hypot(box.x + box.width / 2 - map.x - map.width / 2,
        box.y + box.height / 2 - map.y - map.height / 2) : Infinity };
    }));
    const nearest = choices.sort((a, b) => a.distance - b.distance)[0];
    expect(nearest, `${record.name}: titik harus berupa marker atau anggota cluster`).toBeDefined();
    await nearest!.cluster.click();
    await page.mouse.move(20, 20);
  }
  await expect(marker).toBeInViewport();
  return marker;
}

for (const provinceId of ['31', '32', '33', '34', '35', '36']) {
  test(`108 pin tambahan — provinsi ${provinceId}: setiap marker dapat di-hover, tahun dan panah sesuai ID`, async ({ page }) => {
    test.setTimeout(180000);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    // Pengujian ini juga membuktikan semua pin baru tetap dapat diakses saat tile gagal.
    await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
    await page.goto('/simpul-jaringan');
    await expect(page.locator('.map-stage')).toHaveAttribute('data-level', 'nasional');
    const tested: string[] = [];
    for (const record of records.filter((item) => item.provinceId === provinceId)) {
      const marker = await restoredPoint(page, record);
      await marker.hover();
      const popup = page.locator('.instansi-leaflet-popup .instansi-popup');
      await expect(popup.getByRole('heading'), record.id).toHaveText(record.name);
      await expect(popup.locator('.popup-metrics dd').last()).toHaveText(String(record.joinedYear));
      if (record.coordinateLocationLabel) await expect(popup).toContainText(record.coordinateLocationLabel);
      await settled(page);
      await expect.poll(async () => {
        const pin = await marker.boundingBox();
        const tip = await page.locator('.leaflet-popup-tip-container').boundingBox();
        return pin && tip ? Math.max(Math.abs(tip.x + tip.width / 2 - pin.x - pin.width / 2),
          Math.abs(tip.y + tip.height - pin.y)) : Infinity;
      }, { message: `${record.id}: panah harus menunjuk marker aktif` }).toBeLessThanOrEqual(2);
      const detailLink = popup.getByRole('link', { name: 'Lihat detail', exact: true });
      await detailLink.focus();
      await page.waitForTimeout(230);
      await expect(popup).toBeVisible();
      await expect(detailLink).toHaveAttribute('href', `/simpul-jaringan/${record.id}?provinsi=${record.provinceId}&kabKota=${record.kabKotaId}`);
      if (tested.length === 0) {
        await page.keyboard.press('Enter');
        await expect(page.locator('.profile-identity h1')).toHaveText(record.name);
        await expect(page.locator('.profile-fields')).toContainText(String(record.joinedYear));
        await expect(page.locator('.source-card').getByRole('link', { name: 'Lihat pin Google Maps', exact: true }))
          .toHaveAttribute('href', record.coordinateSource!);
        await page.getByRole('link', { name: 'Kembali ke Peta', exact: true }).click();
        await expect(page.locator('#desktop-kabkota')).toHaveValue(record.kabKotaId!);
      }
      tested.push(record.id);
    }
    expect(errors).toEqual([]);
    writeFileSync(`.local/qa/google-pins-${provinceId}.json`, JSON.stringify({ provinceId, tested, errors }, null, 2));
  });
}

test('pin Google baru mobile 390: tap, sheet, detail, sumber dan kembali', async ({ browser }) => {
  const record = records.find((item) => item.id === 'casefile-0f835c9ea9945f4aeafb7e84')!; // Kota Batu.
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`/simpul-jaringan?provinsi=${record.provinceId}&kabKota=${record.kabKotaId}`);
  const marker = page.locator(`[data-instansi-id="${record.id}"]`);
  await expect(marker).toBeInViewport();
  await marker.tap();
  const popup = page.locator('.mobile-popup .instansi-popup');
  await expect(popup.getByRole('heading')).toHaveText(record.name);
  await expect(popup.locator('.popup-metrics dd').last()).toHaveText(String(record.joinedYear));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.local/qa/google-popup-mobile.png' });
  await popup.getByRole('link', { name: 'Lihat detail', exact: true }).tap();
  await expect(page.locator('.profile-identity h1')).toHaveText(record.name);
  await expect(page.locator('.source-card').getByRole('link', { name: 'Lihat pin Google Maps', exact: true }))
    .toHaveAttribute('href', record.coordinateSource!);
  await page.getByRole('link', { name: 'Kembali ke Peta', exact: true }).tap();
  await expect(marker).toBeInViewport();
  expect(errors).toEqual([]);
  await context.close();
});

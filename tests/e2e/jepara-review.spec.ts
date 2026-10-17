import { expect, test, type Page } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import type { SnapshotData } from '../../src/types/domain';

const snapshot: SnapshotData | null = existsSync('.local/pilot/snapshot.json')
  ? JSON.parse(readFileSync('.local/pilot/snapshot.json', 'utf8')) as SnapshotData : null;
const env = existsSync('.env.local') ? readFileSync('.env.local', 'utf8') : '';
test.skip(!snapshot?.metadata.id.startsWith('pilot-jawa-') || !/^VITE_LOCAL_PILOT=1\s*$/m.test(env),
  'Data percontohan privat belum tersedia atau belum aktif; tidak membuat data pengguna dari fixture.');
const jepara = snapshot?.instansi.find((item) => item.id === 'casefile-91d847febf4139c9ae964166');
async function stable(page: Page) {
  await expect(page.locator('[data-zoom-moving="true"]')).toHaveCount(0);
  await expect(page.locator('.map-canvas.leaflet-pan-anim, .map-canvas.leaflet-zoom-anim')).toHaveCount(0);
  await expect.poll(async () => {
    const pane = page.locator('.leaflet-map-pane');
    const before = await pane.evaluate((element) => getComputedStyle(element).transform);
    await page.waitForTimeout(100);
    return before === await pane.evaluate((element) => getComputedStyle(element).transform);
  }).toBe(true);
}

test('Jepara: klik Jawa Tengah → kabupaten → pin → hover tahun 2017 → detail dan kembali', async ({ page }) => {
  expect(jepara?.name).toBe('Dinas Kearsipan dan Perpustakaan Kabupaten Jepara');
  expect(jepara?.joinedYear).toBe(2017);
  expect(jepara?.coordinates).not.toBeNull();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/simpul-jaringan');
  const province = page.locator('[data-region-count-id="33"]');
  await province.click();
  await expect(page.locator('.map-stage')).toHaveAttribute('data-level', 'provinsi');
  await expect(page.locator('#desktop-province')).toHaveValue('33');
  await stable(page);
  const county = page.locator('[data-region-count-id="33.20"]');
  await expect(county.locator('.region-count-circle')).toHaveText('1');
  await county.hover();
  await expect(page.locator('.instansi-popup')).toHaveCount(0);
  await county.click();
  await expect(page.locator('.map-stage')).toHaveAttribute('data-level', 'instansi');
  await expect(page.locator('#desktop-kabkota')).toHaveValue('33.20');
  await expect(page.locator('#desktop-jenis')).toHaveValue('');
  await stable(page);
  const marker = page.locator(`[data-instansi-id="${jepara!.id}"]`);
  await expect(marker).toBeInViewport();
  await marker.hover();
  const popup = page.locator('.instansi-leaflet-popup .instansi-popup');
  await expect(popup.getByRole('heading')).toHaveText(jepara!.name);
  await expect(popup.locator('.popup-metrics dd').last()).toHaveText('2017');
  await expect(popup).toContainText('Gedung utama Diskarpus, Demaan');
  await stable(page);
  const link = popup.getByRole('link', { name: 'Lihat detail', exact: true });
  await link.hover();
  await page.waitForTimeout(250);
  await expect(popup).toBeVisible();
  const pin = (await marker.boundingBox())!;
  const tip = (await page.locator('.leaflet-popup-tip-container').boundingBox())!;
  expect(Math.abs(tip.x + tip.width / 2 - pin.x - pin.width / 2)).toBeLessThanOrEqual(2);
  expect(Math.abs(tip.y + tip.height - pin.y)).toBeLessThanOrEqual(2);
  await page.screenshot({ path: '.local/qa/jepara-popup-desktop.png' });
  await link.click();
  await expect(page.locator('.profile-identity h1')).toHaveText(jepara!.name);
  await expect(page.locator('.profile-fields')).toContainText('2017');
  await page.getByRole('link', { name: 'Kembali ke Peta', exact: true }).click();
  await expect(page.locator('#desktop-kabkota')).toHaveValue('33.20');
  expect(errors).toEqual([]);
});

test('Jepara mobile 390: navigasi wilayah dan tap pin membuka sheet', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/simpul-jaringan');
  await page.locator('[data-region-count-id="33"]').tap();
  await expect(page.locator('.map-stage')).toHaveAttribute('data-level', 'provinsi');
  await stable(page);
  await page.locator('[data-region-count-id="33.20"]').tap();
  await expect(page.locator('.map-stage')).toHaveAttribute('data-level', 'instansi');
  const marker = page.locator(`[data-instansi-id="${jepara!.id}"]`);
  await expect(marker).toBeInViewport();
  await marker.tap();
  const popup = page.locator('.mobile-popup .instansi-popup');
  await expect(popup.getByRole('heading')).toHaveText(jepara!.name);
  await expect(popup.locator('.popup-metrics dd').last()).toHaveText('2017');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.local/qa/jepara-popup-mobile.png' });
  await popup.getByRole('link', { name: 'Lihat detail', exact: true }).tap();
  await expect(page.locator('.profile-identity h1')).toHaveText(jepara!.name);
  expect(errors).toEqual([]);
  await context.close();
});

for (const id of [
  'casefile-dde64dd280bba7b437d5d4fc', // Kabupaten Magelang: DR. Sutomo 8A.
  'casefile-e52bbdef55cf688e55da9d70', // Brebes: gedung GOR, bukan kantor lama.
  'casefile-e8d2de79c2c437558984af88', // Kota Pekalongan: kantor Sabrawi, bukan depo.
]) {
  test(`pin review ${id}: filter, hover, tahun Excel dan tujuan detail konsisten`, async ({ page }) => {
    const record = snapshot!.instansi.find((item) => item.id === id)!;
    expect(record).toBeDefined();
    expect(record.coordinates).not.toBeNull();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`/simpul-jaringan?provinsi=${record.provinceId}&kabKota=${record.kabKotaId}`);
    await expect(page.locator('.map-stage')).toHaveAttribute('data-level', 'instansi');
    await expect(page.locator('#desktop-kabkota')).toHaveValue(record.kabKotaId!);
    await expect(page.locator('#desktop-jenis')).toHaveValue('');
    await stable(page);
    const marker = page.locator(`[data-instansi-id="${id}"]`);
    await expect(marker).toBeInViewport();
    await marker.hover();
    const popup = page.locator('.instansi-leaflet-popup .instansi-popup');
    await expect(popup.getByRole('heading')).toHaveText(record.name);
    await expect(popup.locator('.popup-metrics dd').last()).toHaveText(String(record.joinedYear));
    await stable(page);
    const link = popup.getByRole('link', { name: 'Lihat detail', exact: true });
    await link.hover();
    await page.waitForTimeout(250);
    await expect(popup).toBeVisible();
    await link.click();
    await expect(page.locator('.profile-identity h1')).toHaveText(record.name);
    await expect(page.locator('.source-card').getByRole('link', { name: 'Lihat pin Google Maps', exact: true }))
      .toHaveAttribute('href', record.coordinateSource!);
    expect(errors).toEqual([]);
  });
}

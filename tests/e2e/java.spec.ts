import { useFixtureTiles } from './tileFixture';
import { expect, test, type Page } from '@playwright/test';
test.beforeEach(async ({ page }) => useFixtureTiles(page));
import { existsSync, readFileSync } from 'node:fs';
import type { Instansi, MapSession, ReferenceData, SnapshotData } from '../../src/types/domain';

const snapshot: SnapshotData | null = existsSync('public/data/datasets/pilot/snapshot.json')
  ? JSON.parse(readFileSync('public/data/datasets/pilot/snapshot.json', 'utf8')) as SnapshotData : null;
const references: ReferenceData | null = existsSync('public/data/datasets/pilot/references.json')
  ? JSON.parse(readFileSync('public/data/datasets/pilot/references.json', 'utf8')) as ReferenceData : null;
test.beforeAll(() => {
  expect(snapshot?.metadata.datasetKind).toBe('pilot');
  expect(references?.provinces.map((row) => row.id)).toEqual(expect.arrayContaining(['31', '32', '33', '34', '35', '36']));
});
const viewport = (page: Page) => page.evaluate(() => JSON.parse(sessionStorage.getItem('jikn-map-session-v1') ?? '{}') as MapSession);
async function stable(page: Page) {
  await expect(page.locator('[data-zoom-moving="true"]')).toHaveCount(0);
  await expect(page.locator('.map-canvas.leaflet-zoom-anim, .map-canvas.leaflet-pan-anim')).toHaveCount(0);
  await expect.poll(async () => {
    const before = await viewport(page);
    const pane = page.locator('.leaflet-map-pane');
    const transform = await pane.evaluate((element) => getComputedStyle(element).transform);
    await page.waitForTimeout(100);
    const after = await viewport(page);
    return before.zoom === after.zoom && JSON.stringify(before.center) === JSON.stringify(after.center)
      && transform === await pane.evaluate((element) => getComputedStyle(element).transform);
  }).toBe(true);
}
async function open(page: Page) {
  await page.goto('/simpul-jaringan');
  await expect(page.locator('.map-stage.pilot-map')).toHaveAttribute('data-level', 'nasional');
  await expect(page.locator('.region-count-marker')).toHaveCount(references!.provinces.length);
  await stable(page);
}
const runtime = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
  const errors: string[] = [];
  runtime.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('Failed to load resource')) errors.push(message.text());
  });
});
test.afterEach(({ page }) => expect(runtime.get(page)).toEqual([]));

for (const name of [
  'Dinas Perpustakaan dan Kearsipan Kota Cirebon',
  'Dinas Perpustakaan dan Kearsipan Kabupaten Demak',
  'Dinas Perpustakaan dan Kearsipan Kabupaten Bantul',
  'Dinas Perpustakaan dan Kearsipan Kota Surabaya',
]) {
  test(`${name}: klik provinsi → kab/kota → hover → detail → kembali`, async ({ page }) => {
    const record = snapshot!.instansi.find((item) => item.name === name)!;
    expect(record, 'Nama harus ada di sumber Excel yang dipilih').toBeDefined();
    expect(record.coordinates).not.toBeNull();
    await open(page);
    await page.locator(`[data-region-count-id="${record.provinceId}"]`).click();
    await expect(page.locator('.map-stage')).toHaveAttribute('data-level', 'provinsi');
    await expect(page.locator('#desktop-province')).toHaveValue(record.provinceId!);
    await expect(page.locator('[data-region-id]').first()).toBeVisible();
    await stable(page);
    const city = page.locator(`[data-region-count-id="${record.kabKotaId}"]`);
    await city.hover();
    await expect(page.getByRole('tooltip').filter({ hasText: record.kabKotaName! })).toBeVisible();
    await expect(page.locator('.instansi-popup')).toHaveCount(0);
    await city.click();
    await expect(page.locator('.map-stage')).toHaveAttribute('data-level', 'instansi');
    await expect(page.locator('#desktop-kabkota')).toHaveValue(record.kabKotaId!);
    await expect(page.locator('#desktop-jenis')).toHaveValue('');
    await stable(page);
    const marker = page.locator(`[data-instansi-id="${record.id}"]`);
    await expect(marker).toBeInViewport();
    await marker.hover();
    const popup = page.locator('.leaflet-popup .instansi-popup');
    await expect(popup.getByRole('heading')).toHaveText(record.name);
    await expect(popup.locator('.popup-metrics dd').last()).toHaveText(String(record.joinedYear));
    await expect(popup).toContainText('DATA SIMULASI');
    await expect(popup.getByRole('button', { name: 'Landing Page', exact: true })).toBeDisabled();
    await stable(page); // Tunggu autopan sebelum mengarahkan ke posisi tombol yang sudah final.
    await popup.getByRole('link', { name: 'Lihat detail' }).hover();
    await page.waitForTimeout(250);
    await expect(popup).toBeVisible();
    await page.screenshot({ path: `.local/qa/java-popup-${record.provinceId}.png` });
    await popup.getByRole('link', { name: 'Lihat detail' }).click();
    const saved = await viewport(page);
    await expect(page.locator('.profile-identity h1')).toHaveText(record.name);
    await expect(page.locator('.profile-fields')).toContainText(String(record.joinedYear));
    await expect(page.locator('.source-card').getByRole('link', { name: 'Sumber koordinat', exact: true })).toHaveAttribute('href', record.coordinateSource!);
    await page.getByRole('link', { name: 'Kembali ke Peta', exact: true }).click();
    await expect(page.locator('#desktop-province')).toHaveValue(record.provinceId!);
    await expect(page.locator('#desktop-kabkota')).toHaveValue(record.kabKotaId!);
    await stable(page);
    const restored = await viewport(page);
    expect(restored.zoom).toBe(saved.zoom);
    restored.center.forEach((value, index) => expect(value).toBeCloseTo(saved.center[index]!, 6));
  });
}

test('enam provinsi, hitungan ID unik dan katalog LKD sesuai snapshot; pin Jawa Timur tersedia melalui daftar', async ({ page }) => {
  await open(page);
  await expect(page.locator('#desktop-province option')).toHaveCount(references!.provinces.length + 1);
  for (const province of references!.provinces.filter((item) => ['31', '32', '33', '34', '35', '36'].includes(item.id))) {
    const ids = new Set(snapshot!.instansi.filter((item) => item.provinceId === province.id).map((item) => item.id));
    await expect(page.locator(`[data-region-count-id="${province.id}"] .region-count-circle`)).toHaveText(String(ids.size));
  }
  await page.screenshot({ path: '.local/qa/java-overview-1440.png' });
  const record = snapshot!.instansi.find((item) => item.name === 'Dinas Perpustakaan dan Kearsipan Provinsi Jawa Timur')!;
  expect(record.coordinates).not.toBeNull();
  await page.locator('#desktop-province').selectOption(record.provinceId!);
  await page.locator('#desktop-kabkota').selectOption(record.kabKotaId!);
  await page.getByRole('button', { name: 'Daftar', exact: true }).click();
  const row = page.locator(`[data-result-instansi-id="${record.id}"]`);
  await expect(row).toContainText('Koordinat tersedia');
  await expect(page.locator('.results-description').first()).toContainText('0 belum memiliki koordinat');
  await row.getByRole('link', { name: record.name, exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.profile-identity h1')).toHaveText(record.name);
  await expect(page.locator('.profile-fields')).toContainText(String(record.joinedYear));
});

test('pusat lingkaran kab/kota Jawa tidak terhalang kotak transparan wilayah tetangga', async ({ page }) => {
  await open(page);
  for (const province of references!.provinces.filter((item) => ['31', '32', '33', '34', '35', '36'].includes(item.id))) {
    await page.locator('#desktop-province').selectOption(province.id);
    await stable(page);
    const blocked = await page.locator('.region-count-marker').evaluateAll((markers) => markers.flatMap((marker) => {
      const box = marker.getBoundingClientRect();
      const top = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      const hitId = top?.closest<HTMLElement>('[data-region-count-id]')?.dataset.regionCountId;
      const id = (marker as HTMLElement).dataset.regionCountId;
      return hitId === id ? [] : [{ id, hitId: hitId ?? top?.className }];
    }));
    expect(blocked, `Lingkaran ${province.name} harus bisa diarahkan pada pusatnya`).toEqual([]);
  }
});

test('mobile 390 Jawa: draft provinsi/jenis opsional, tap pin, sheet, detail tanpa overflow', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const record: Instansi = snapshot!.instansi.find((item) => item.name === 'Dinas Perpustakaan dan Kearsipan Kabupaten Bantul')!;
  await open(page);
  await page.getByRole('button', { name: 'Filter', exact: true }).tap();
  await expect(page.locator('#mobile-province option')).toHaveCount(references!.provinces.length + 1);
  await page.locator('#mobile-province').selectOption(record.provinceId!);
  await page.getByRole('button', { name: 'Terapkan', exact: true }).tap();
  await expect(page.locator('.map-stage')).toHaveAttribute('data-level', 'provinsi');
  await stable(page);
  await page.locator(`[data-region-count-id="${record.kabKotaId}"]`).tap();
  await expect(page.locator('.map-stage')).toHaveAttribute('data-level', 'instansi');
  await expect(page.locator(`[data-instansi-id="${record.id}"]`)).toBeInViewport();
  await page.locator(`[data-instansi-id="${record.id}"]`).tap();
  const sheet = page.locator('.mobile-popup');
  await expect(sheet.getByRole('heading')).toHaveText(record.name);
  await expect(sheet.locator('.popup-metrics dd').last()).toHaveText(String(record.joinedYear));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.local/qa/java-mobile-390.png' });
  await sheet.getByRole('link', { name: 'Lihat detail' }).tap();
  await expect(page.locator('.profile-identity h1')).toHaveText(record.name);
  expect(errors).toEqual([]);
  await context.close();
});

test('zoom lalu segera membuka detail dari Daftar tidak menyisakan callback peta yang sudah dilepas', async ({ page }) => {
  const record = snapshot!.instansi.find((item) => item.name === 'Dinas Perpustakaan dan Kearsipan Kabupaten Bantul')!;
  await page.goto(`/simpul-jaringan?provinsi=${record.provinceId}&kabKota=${record.kabKotaId}`);
  await expect(page.locator('.map-stage')).toHaveAttribute('data-level', 'instansi');
  await page.getByRole('button', { name: 'Daftar', exact: true }).click();
  const link = page.locator(`[data-result-instansi-id="${record.id}"]`).getByRole('link', { name: record.name, exact: true });
  await expect(link).toBeVisible();
  await page.locator('.map-canvas').focus();
  await page.keyboard.press('+');
  // Sengaja tidak menunggu zoom selesai sebelum route melepas MapContainer.
  await link.click();
  await expect(page.locator('.profile-identity h1')).toHaveText(record.name);
  await page.waitForTimeout(350); // Melewati timeout transisi Leaflet 1.9 (250 ms).
  expect(runtime.get(page)).toEqual([]);
});

import { useFixtureTiles } from './tileFixture';
import { expect, test, type Page } from '@playwright/test';
test.beforeEach(async ({ page }) => useFixtureTiles(page));
import { existsSync, readFileSync } from 'node:fs';
import type { Instansi, MapSession, ReferenceData, SnapshotData } from '../../src/types/domain';

const pilotPath = 'public/data/datasets/pilot/snapshot.json';
const snapshot: SnapshotData | null = existsSync(pilotPath)
  ? JSON.parse(readFileSync(pilotPath, 'utf8')) as SnapshotData
  : null;
const referencesPath = 'public/data/datasets/pilot/references.json';
const references: ReferenceData | null = existsSync(referencesPath)
  ? JSON.parse(readFileSync(referencesPath, 'utf8')) as ReferenceData : null;
test.skip(!snapshot || !references,
  'Pilot lokal belum dibuat atau VITE_LOCAL_PILOT=1 belum diaktifkan; data pengguna tidak dibuat oleh tes.');

const markerFor = (page: Page, id: string) => page.locator(`[data-instansi-id="${id}"]`);
const regionBadge = (page: Page, id: string) => page.locator(`[data-region-count-id="${id}"]`);
const nativePopup = (page: Page) => page.locator('.leaflet-popup .instansi-popup');
const rowsFor = (kabKotaId: string) => snapshot!.instansi.filter((item) => item.kabKotaId === kabKotaId);
function regionCounts(provinceId?: string) {
  const groups = new Map<string, Set<string>>();
  for (const item of snapshot!.instansi) {
    if (provinceId && item.provinceId !== provinceId) continue;
    const id = provinceId ? item.kabKotaId : item.provinceId;
    if (id === null) continue;
    if (!groups.has(id)) groups.set(id, new Set());
    groups.get(id)!.add(item.id);
  }
  return Object.fromEntries([...groups].map(([id, ids]) => [id, ids.size]));
}
const runtimeErrors = new WeakMap<Page, string[]>();

function trackRuntime(page: Page) {
  const errors: string[] = [];
  runtimeErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('Failed to load resource'))
      errors.push(message.text());
  });
  return errors;
}
test.beforeEach(({ page }) => { trackRuntime(page); });
test.afterEach(({ page }) => { expect(runtimeErrors.get(page)).toEqual([]); });

async function waitForMap(page: Page) {
  await expect(page.locator('[data-zoom-moving="true"]')).toHaveCount(0);
  await expect(page.locator('.map-canvas.leaflet-zoom-anim, .map-canvas.leaflet-pan-anim')).toHaveCount(0);
  await expect.poll(async () => {
    const pane = page.locator('.leaflet-map-pane');
    const before = await pane.evaluate((element) => getComputedStyle(element).transform);
    await page.waitForTimeout(100);
    return before === await pane.evaluate((element) => getComputedStyle(element).transform);
  }).toBe(true);
  await expect(page.locator('.map-canvas.leaflet-zoom-anim, .map-canvas.leaflet-pan-anim')).toHaveCount(0);
}
async function openPilot(page: Page) {
  await page.goto('/simpul-jaringan');
  await expect(page.locator('.map-stage.pilot-map')).toHaveAttribute('data-level', 'nasional');
  await expect(page.locator('.site-header')).toContainText('DATA SIMULASI');
  await expect(page.locator('.snapshot-note')).toContainText('Nama/tahun: Excel');
  await waitForMap(page);
}
async function chooseRegion(page: Page, id: string, keyboard = false) {
  // Lingkaran adalah navigasi utama; polygon tetap menjadi alternatif jika wilayah belum punya sampel.
  const badge = regionBadge(page, id);
  const region = await badge.count() ? badge : page.locator(`[data-region-id="${id}"]`).first();
  await expect(region).toBeVisible();
  if (keyboard) {
    await region.focus();
    await page.keyboard.press('Enter');
  } else await region.click();
  await waitForMap(page);
}
async function expectCompactRegions(page: Page, expected: Record<string, number>) {
  await expect(page.locator('.region-count-marker')).toHaveCount(Object.keys(expected).length);
  await expect(page.locator('.pilot-region-label, .region-count-caption, .region-count-leader')).toHaveCount(0);
  for (const [id, count] of Object.entries(expected)) {
    const badge = regionBadge(page, id);
    await expect(badge).toBeVisible();
    await expect(badge).toHaveClass(/region-count-compact/);
    await expect(badge.locator('.region-count-circle')).toHaveText(String(count));
    await expect(badge).toHaveAttribute('role', 'button');
  }
}
async function markerOnMap(page: Page, record: Instansi) {
  const target = markerFor(page, record.id);
  // Anggota cluster memang belum memiliki elemen marker: jangan menunggu
  // timeout locator sebelum helper sempat menekan cluster tersebut.
  if (!(await target.isVisible())) return false;
  const marker = await target.boundingBox({ timeout: 500 }).catch(() => null);
  const map = await page.locator('.map-canvas').boundingBox();
  return Boolean(marker && map && marker.x + marker.width / 2 > map.x
    && marker.x + marker.width / 2 < map.x + map.width && marker.y > map.y
    && marker.y + marker.height < map.y + map.height);
}
async function revealMarker(page: Page, record: Instansi) {
  expect(record.coordinates, 'Penguraian marker hanya untuk titik kantor yang tersedia').not.toBeNull();
  for (let attempt = 0; attempt < 10; attempt++) {
    await waitForMap(page);
    if (await markerOnMap(page, record)) return;
    const clusters = page.locator('.instansi-cluster');
    // Sesudah zoom, anggota lain boleh berada di luar viewport. Cari target saja;
    // jangan mensyaratkan semua kantor kota terlihat bersamaan.
    if (await markerFor(page, record.id).count() || !(await clusters.count())) {
      await page.getByTitle('Perkecil peta', { exact: true }).click();
      continue;
    }
    const session = await mapSession(page);
    const map = (await page.locator('.map-canvas').boundingBox())!;
    const project = ([lat, lng]: readonly number[]) => {
      const scale = 256 * 2 ** session.zoom;
      const sin = Math.sin(lat! * Math.PI / 180);
      return [scale * (lng! + 180) / 360, scale * (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI))];
    };
    const center = project(session.center);
    const target = project(record.coordinates!);
    const x = map.x + map.width / 2 + target[0]! - center[0]!;
    const y = map.y + map.height / 2 + target[1]! - center[1]!;
    const choices = await Promise.all((await clusters.all()).map(async (cluster) => {
      // Cluster dapat dilepas ketika animasi penguraian selesai di antara
      // pembacaan daftar dan boundingBox. Jangan menunggu layer lama 30 detik.
      const box = await cluster.boundingBox({ timeout: 500 }).catch(() => null);
      return { cluster, distance: box ? Math.hypot(box.x + box.width / 2 - x, box.y + box.height / 2 - y) : Infinity };
    }));
    const nearest = choices.filter((choice) => Number.isFinite(choice.distance)).sort((a, b) => a.distance - b.distance)[0];
    if (!nearest) continue;
    const cluster = nearest.cluster;
    try { await cluster.click({ timeout: 1500 }); }
    catch (error) {
      // Zoom dapat menyelesaikan penguraian sebelum aksi klik diarahkan ke cluster lama.
      if (await cluster.count() === 0 || await markerOnMap(page, record)) continue;
      throw error;
    }
    await page.mouse.move(20, 20);
    await waitForMap(page);
  }
  await expect(markerFor(page, record.id)).toBeInViewport();
}
async function mapSession(page: Page) {
  return page.evaluate(() => JSON.parse(sessionStorage.getItem('jikn-map-session-v1') ?? '{}') as MapSession);
}
async function hoverProfile(page: Page, record: Instansi) {
  await markerFor(page, record.id).hover();
  const popup = nativePopup(page);
  await expect(popup.getByRole('heading')).toHaveText(record.name);
  await expect(popup).toContainText('DATA SIMULASI');
  await expect(popup).toContainText('Statistik simulasi');
  await expect(popup.locator('.popup-metrics dd').last()).toHaveText(String(record.joinedYear));
  if (record.landingPageVerificationStatus === 'verified' && record.landingPageUrl) {
    await expect(popup.getByRole('link', { name: 'Landing Page', exact: true })).toHaveAttribute('href', record.landingPageUrl);
    await expect(popup).not.toContainText('Tautan belum tersedia');
  } else {
    await expect(popup.getByRole('button', { name: 'Landing Page', exact: true })).toBeDisabled();
    await expect(popup).toContainText('Tautan belum tersedia');
  }
  const link = popup.getByRole('link', { name: 'Lihat detail' });
  await expect(link).toHaveAttribute('href', new RegExp(`/simpul-jaringan/${record.id}(?:\\?|$)`));
  await waitForMap(page);
  await link.hover();
  await page.waitForTimeout(300); // Pointer melewati close delay; popup harus bertahan ketika tombol di-hover.
  await expect(popup).toBeVisible();
  return popup;
}

test('pilot bersih Jakarta → Jakarta Selatan → marker nyata → hover → detail dan viewport pulih', async ({ page }) => {
  await openPilot(page);
  await expect(page.locator('#desktop-province option')).toHaveCount(references!.provinces.length + 1);
  await expect(page.locator('[data-region-id="31"]')).toBeVisible();
  await expect(page.locator('[data-region-id="36"]')).toBeVisible();
  const provinces = regionCounts();
  await expectCompactRegions(page, provinces);
  await regionBadge(page, '31').hover();
  await expect(page.locator('.region-count-tooltip')).toContainText(`${provinces['31']} instansi percontohan`);
  await expect(nativePopup(page)).toHaveCount(0);
  await page.mouse.move(20, 20);
  await page.screenshot({ path: '.local/qa/pilot-overview.png' });
  const initial = await mapSession(page);
  expect(initial.center[0]).toBeGreaterThan(-9);
  expect(initial.center[0]).toBeLessThan(-5.2);
  expect(initial.center[1]).toBeGreaterThan(105);
  expect(initial.center[1]).toBeLessThan(116);
  await chooseRegion(page, '31', true);
  await expect(page.locator('.map-stage')).toHaveAttribute('data-level', 'provinsi');
  await expect(page.locator('#desktop-province')).toHaveValue('31');
  await expect(page.locator('#desktop-kabkota option')).toHaveCount(references!.kabKota.filter((item) => item.provinceId === '31').length + 1);
  await expect(page.locator('[data-region-id="31"]')).toHaveCount(0);
  await expectCompactRegions(page, regionCounts('31'));
  await expect.poll(async () => (await mapSession(page)).zoom).toBeGreaterThan(initial.zoom);
  await chooseRegion(page, '31.74');
  await expect(page.locator('.map-stage')).toHaveAttribute('data-level', 'instansi');
  await expect(page.locator('#desktop-kabkota')).toHaveValue('31.74');
  await expect(page.locator('#desktop-jenis')).toHaveValue('');
  expect(new URL(page.url()).searchParams.get('provinsi')).toBe('31');
  expect(new URL(page.url()).searchParams.get('kabKota')).toBe('31.74');
  await expect(page.locator('.region-count-marker')).toHaveCount(0);
  const records = rowsFor('31.74');
  expect(records.map((record) => record.name)).toEqual(expect.arrayContaining([
    'Arsip Nasional RI', 'Kementerian Kesehatan', 'Kementerian Ketenagakerjaan',
  ]));
  await expect(page.locator('.results-panel')).toHaveCount(0);
  const record = records.find((item) => item.name === 'Arsip Nasional RI')!;
  await revealMarker(page, record);
  const popup = await hoverProfile(page, record);
  await page.screenshot({ path: '.local/qa/pilot-jakarta-popup.png' });
  await popup.getByRole('link', { name: 'Lihat detail' }).click();
  const before = await mapSession(page);
  await expect(page.locator('.profile-identity h1')).toHaveText(record.name);
  await expect(page.locator('.profile-fields')).toContainText(record.kode!);
  await expect(page.locator('.profile-fields')).toContainText(String(record.joinedYear));
  await expect(page.locator('.detail-snapshot-label')).toContainText('DATA SIMULASI');
  for (const id of ['statistics-title', 'trend-title', 'distribution-title', 'creators-title'])
    await expect(page.locator(`#${id}`)).toContainText('SIMULASI');
  await expect(page.getByRole('tab')).toHaveCount(0);
  await page.screenshot({ path: '.local/qa/pilot-jakarta-detail.png', fullPage: true });
  await page.setViewportSize({ width: 720, height: 450 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('link', { name: 'Kembali ke Peta', exact: true }).click();
  await expect(page.locator('#desktop-province')).toHaveValue('31');
  await expect(page.locator('#desktop-kabkota')).toHaveValue('31.74');
  await expect(page.locator('#desktop-jenis')).toHaveValue('');
  await waitForMap(page);
  const after = await mapSession(page);
  expect(after.zoom).toBe(before.zoom);
  after.center.forEach((value, index) => expect(value).toBeCloseTo(before.center[index]!, 6));
});

test('Banten → Kota Serang menampilkan kantor provinsi, kota, kabupaten dan tahun Excel; jenis opsional', async ({ page }) => {
  await openPilot(page);
  const initial = await mapSession(page);
  await chooseRegion(page, '36');
  await expect(page.locator('.map-stage')).toHaveAttribute('data-level', 'provinsi');
  await expect(page.locator('#desktop-kabkota option')).toHaveCount(references!.kabKota.filter((item) => item.provinceId === '36').length + 1);
  await expect(page.locator('#desktop-province')).toHaveValue('36');
  expect(new URL(page.url()).searchParams.get('provinsi')).toBe('36');
  await expectCompactRegions(page, regionCounts('36'));
  await expect.poll(async () => (await mapSession(page)).zoom).toBeGreaterThan(initial.zoom);
  await page.mouse.move(20, 20);
  await page.screenshot({ path: '.local/qa/pilot-banten-kab-kota.png' });
  await chooseRegion(page, '36.73');
  await expect(page.locator('#desktop-kabkota')).toHaveValue('36.73');
  expect(new URL(page.url()).searchParams.get('kabKota')).toBe('36.73');
  await expect(page.locator('.region-count-marker')).toHaveCount(0);
  const records = rowsFor('36.73');
  expect(records.map((record) => record.name)).toEqual(expect.arrayContaining([
    'Dinas Perpustakaan dan Kearsipan Provinsi BANTEN',
    'Dinas Perpustakaan dan Kearsipan Kota Serang',
    'Dinas Perpustakaan dan Arsip Kabupaten Serang',
  ]));
  await expect(page.locator('#desktop-jenis')).toHaveValue('');
  for (const record of records) {
    await revealMarker(page, record);
    const popup = await hoverProfile(page, record);
    await popup.getByRole('link', { name: 'Lihat detail' }).click();
    await expect(page.locator('.profile-identity h1')).toHaveText(record.name);
    await expect(page.locator('.profile-fields')).toContainText(String(record.joinedYear));
    await page.getByRole('link', { name: 'Kembali ke Peta', exact: true }).click();
  }
  await revealMarker(page, records[0]!);
  await hoverProfile(page, records[0]!);
  await page.screenshot({ path: '.local/qa/pilot-banten-popup.png' });
  await page.getByRole('button', { name: 'Kembali ke Provinsi' }).click();
  await expect(page.locator('.map-stage')).toHaveAttribute('data-level', 'provinsi');
  await expect(page.locator('.instansi-popup')).toHaveCount(0);
  await expect(page.locator('.instansi-marker')).toHaveCount(0);
  await expect(page.locator('#desktop-kabkota')).toHaveValue('');
});

test('cluster pilot menghitung marker berkoordinat dan terurai tanpa memilih wilayah lain', async ({ page }) => {
  await page.goto('/simpul-jaringan?provinsi=31&kabKota=31.74');
  await expect(page.locator('.map-stage.pilot-map')).toHaveAttribute('data-level', 'instansi');
  await waitForMap(page);
  const records = rowsFor('31.74').filter((record) => record.coordinates !== null);
  for (let attempt = 0; attempt < 7; attempt++) {
    if (await page.locator('.instansi-cluster').count()) break;
    await page.getByTitle('Perkecil peta', { exact: true }).click();
    await waitForMap(page);
  }
  const cluster = page.locator('.instansi-cluster').first();
  await expect(cluster).toBeVisible();
  const count = Number(await cluster.innerText());
  expect(count).toBeGreaterThanOrEqual(2);
  expect(count).toBeLessThanOrEqual(new Set(records.map((record) => record.id)).size);
  const visibleBefore = new Set((await Promise.all(records.map(async (record) =>
    await markerOnMap(page, record) ? record.id : null))).filter(Boolean));
  await cluster.click();
  await waitForMap(page);
  await expect(page.locator('.map-stage')).toHaveAttribute('data-level', 'instansi');
  await expect(page.locator('#desktop-province')).toHaveValue('31');
  await expect(page.locator('#desktop-kabkota')).toHaveValue('31.74');
  await expect.poll(async () => (await Promise.all(records.map(async (record) =>
    !visibleBefore.has(record.id) && await markerOnMap(page, record)))).some(Boolean),
  { message: 'Klik cluster benar-benar menampilkan anggota yang sebelumnya dikelompokkan' }).toBe(true);
  // Pointer bekas klik cluster dapat tepat berada pada marker baru; keluar dulu dari profil itu.
  await page.mouse.move(20, 20);
  await expect(nativePopup(page)).toHaveCount(0);
  let visible: Instansi | undefined;
  for (const record of records) {
    if (!visibleBefore.has(record.id) && await markerOnMap(page, record)) { visible = record; break; }
  }
  expect(visible, 'Pilih anggota yang benar-benar terlihat setelah cluster diurai').toBeDefined();
  await hoverProfile(page, visible!);
});

test('mobile 390: filter provinsi, tap kab/kota dan marker membuka sheet → detail → kembali tanpa overflow', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = trackRuntime(page);
  await openPilot(page);
  await page.getByRole('button', { name: 'Filter', exact: true }).tap();
  await expect(page.locator('#mobile-province option')).toHaveCount(references!.provinces.length + 1);
  await page.locator('#mobile-province').selectOption('31');
  await page.getByRole('button', { name: 'Terapkan', exact: true }).tap();
  await expect(page.locator('.map-stage')).toHaveAttribute('data-level', 'provinsi');
  await waitForMap(page);
  await regionBadge(page, '31.74').tap();
  await expect(page.locator('.map-stage')).toHaveAttribute('data-level', 'instansi');
  const records = rowsFor('31.74');
  const record = records.find((item) => item.name === 'Kementerian Kesehatan')!;
  await revealMarker(page, record);
  await markerFor(page, record.id).tap();
  const sheet = page.locator('.mobile-popup');
  await expect(sheet.getByRole('heading')).toHaveText(record.name);
  await expect(sheet).toContainText('DATA SIMULASI');
  await expect(sheet.locator('.popup-metrics dd').last()).toHaveText(String(record.joinedYear));
  await expect(sheet.getByRole('button', { name: 'Landing Page', exact: true })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.local/qa/pilot-mobile-popup.png' });
  await sheet.getByRole('link', { name: 'Lihat detail' }).tap();
  await expect(page.locator('.profile-identity h1')).toHaveText(record.name);
  await expect(page.locator('.detail-snapshot-label')).toContainText('DATA SIMULASI');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('link', { name: 'Kembali ke Peta', exact: true }).tap();
  await expect(page.locator('.map-stage')).toHaveAttribute('data-level', 'instansi');
  await page.getByRole('button', { name: 'Filter', exact: true }).tap();
  await expect(page.locator('#mobile-province')).toHaveValue('31');
  await expect(page.locator('#mobile-kabkota')).toHaveValue('31.74');
  await page.getByRole('button', { name: 'Batal', exact: true }).tap();
  expect(errors).toEqual([]);
  await context.close();
});

test('Pandeglang: pin Google Maps membuka popup dengan catatan alamat, detail dan kembali', async ({ page }) => {
  const record = snapshot!.instansi.find((item) => item.name === 'Dinas Perpustakaan dan Arsip Daerah Kabupaten Pandeglang')!;
  expect(record.coordinates).toEqual([-6.3103441, 106.1077671]);
  expect(record.locationVerificationNotes).toContain('kesetaraan dengan alamat kantor resmi belum dipastikan');
  await page.goto(`/simpul-jaringan?provinsi=${record.provinceId}&kabKota=${record.kabKotaId}`);
  await expect(page.locator('.map-stage.pilot-map')).toHaveAttribute('data-level', 'instansi');
  await revealMarker(page, record);
  const popup = await hoverProfile(page, record);
  await expect(popup).toContainText(record.coordinateLocationLabel!);
  await page.waitForFunction(() => [...document.querySelectorAll<HTMLImageElement>('.leaflet-tile')]
    .every((tile) => tile.complete), null, { timeout: 4000 }).catch(() => {});
  await page.screenshot({ path: '.local/qa/google-popup-desktop.png' });
  await popup.getByRole('link', { name: 'Lihat detail', exact: true }).click();
  await expect(page.locator('.profile-identity h1')).toHaveText(record.name);
  await expect(page.locator('.profile-fields')).toContainText(String(record.joinedYear));
  await expect(page.locator('.source-card')).toContainText('kesetaraan dengan alamat kantor resmi belum dipastikan');
  await page.getByRole('link', { name: 'Kembali ke Peta', exact: true }).click();
  await expect(page.locator('#desktop-kabkota')).toHaveValue(record.kabKotaId!);
  await expect(markerFor(page, record.id)).toBeVisible();
});

test('Kepulauan Seribu: kantor utama Pulau Pramuka berpin tanpa mengganti koordinat dekat garis pantai', async ({ page }) => {
  const record = snapshot!.instansi.find((item) => item.name === 'Sekretariat Kabupaten Administrasi Kepulauan Seribu')!;
  expect(record.kabKotaId).toBe('31.01');
  expect(record.coordinates).toEqual([-5.7466247, 106.6130504]);
  await page.goto('/simpul-jaringan?provinsi=31');
  await expect(page.locator('.map-stage.pilot-map')).toHaveAttribute('data-level', 'provinsi');
  await waitForMap(page);
  await expect(page.locator('.instansi-marker, .instansi-cluster')).toHaveCount(0);
  await chooseRegion(page, '31.01');
  await expect(page.locator('#desktop-kabkota')).toHaveValue('31.01');
  await revealMarker(page, record);
  const popup = await hoverProfile(page, record);
  await expect(popup).toContainText(record.coordinateLocationLabel!);
  await popup.getByRole('link', { name: 'Lihat detail', exact: true }).click();
  await expect(page.locator('.profile-identity h1')).toHaveText(record.name);
  await expect(page.locator('.source-card')).toContainText('Tinjauan batas geometri');
  await expect(page.locator('.source-card')).toContainText('pin sumber tidak dipindahkan');
  await page.getByRole('link', { name: 'Kembali ke Peta', exact: true }).click();
  await expect(page.locator('#desktop-kabkota')).toHaveValue('31.01');
  await expect(markerFor(page, record.id)).toBeVisible();
});

test('Kota Tangerang: pin kantor Mayjen Sutoyo membuka popup, panah sesuai marker, detail dan kembali', async ({ page }) => {
  const record = snapshot!.instansi.find((item) => item.id === 'casefile-9b41c8c382a118db84e692d3')!;
  expect(record.joinedYear).toBe(2019);
  expect(record.coordinates).toEqual([-6.1719109, 106.6334132]);
  expect(record.locationVerificationStatus).toBe('verified');
  expect(record.coordinatesVerificationNotes).toContain('Mayjen Sutoyo');
  await openPilot(page);
  await chooseRegion(page, '36');
  await chooseRegion(page, '36.71');
  await expect(page.locator('#desktop-jenis')).toHaveValue('');
  await expect(page.locator('.map-navigation p')).toContainText('1 hasil · 1 terpetakan · 0 tanpa koordinat');
  await revealMarker(page, record);
  await expect(page.locator('.instansi-marker')).toHaveCount(1);
  const popup = await hoverProfile(page, record);
  const marker = (await markerFor(page, record.id).boundingBox())!;
  const tip = (await page.locator('.instansi-leaflet-popup .leaflet-popup-tip-container').boundingBox())!;
  expect(Math.abs(tip.x + tip.width / 2 - marker.x - marker.width / 2)).toBeLessThanOrEqual(2);
  expect(Math.abs(tip.y + tip.height - marker.y)).toBeLessThanOrEqual(2);
  await page.waitForFunction(() => [...document.querySelectorAll<HTMLImageElement>('.leaflet-tile')]
    .every((tile) => tile.complete), null, { timeout: 4000 }).catch(() => {});
  await page.screenshot({ path: '.local/qa/tangerang-popup-20261016.png' });
  await popup.getByRole('link', { name: 'Lihat detail' }).click();
  await expect(page.locator('.profile-identity h1')).toHaveText(record.name);
  await expect(page.locator('.profile-fields')).toContainText('2019');
  await expect(page.locator('.source-card').getByRole('link', { name: 'Lihat pin Google Maps' }))
    .toHaveAttribute('href', record.coordinateSource!);
  await page.getByRole('link', { name: 'Kembali ke Peta', exact: true }).click();
  await expect(page.locator('#desktop-kabkota')).toHaveValue('36.71');
  await expect(markerFor(page, record.id)).toBeVisible();
});

test('Kota Tangerang mobile 390: tap pin kantor membuka popup sentuh dan detail dengan tahun Excel', async ({ browser }) => {
  const record = snapshot!.instansi.find((item) => item.id === 'casefile-9b41c8c382a118db84e692d3')!;
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = trackRuntime(page);
  await page.goto('/simpul-jaringan?provinsi=36&kabKota=36.71');
  await expect(page.locator('.map-stage.pilot-map')).toHaveAttribute('data-level', 'instansi');
  await revealMarker(page, record);
  await markerFor(page, record.id).tap();
  const sheet = page.locator('.mobile-popup');
  await expect(sheet.getByRole('heading')).toHaveText(record.name);
  await expect(sheet.locator('.popup-metrics dd').last()).toHaveText('2019');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.local/qa/tangerang-mobile-20261016.png' });
  await sheet.getByRole('link', { name: 'Lihat detail' }).tap();
  await expect(page.locator('.profile-identity h1')).toHaveText(record.name);
  await page.getByRole('link', { name: 'Kembali ke Peta', exact: true }).tap();
  await expect(markerFor(page, record.id)).toBeVisible();
  expect(errors).toEqual([]);
  await context.close();
});

import { useFixtureTiles } from './tileFixture';
import { activateRegionBadge } from './regionBadge';
import { expect, test, type Page } from '@playwright/test';
test.beforeEach(async ({ page }) => useFixtureTiles(page));
import { existsSync, readFileSync } from 'node:fs';
import type { MapSession, ReferenceData, SnapshotData } from '../../src/types/domain';

const referencesPath = 'public/data/datasets/pilot/references.json';
const references: ReferenceData | null = existsSync(referencesPath)
  ? JSON.parse(readFileSync(referencesPath, 'utf8')) as ReferenceData : null;
const snapshot: SnapshotData | null = existsSync('public/data/datasets/pilot/snapshot.json')
  ? JSON.parse(readFileSync('public/data/datasets/pilot/snapshot.json', 'utf8')) as SnapshotData : null;
const overviewCount = new Set(snapshot?.instansi.map((item) => item.provinceId).filter(Boolean)).size;
test.skip(!references, 'Pilot lokal belum diaktifkan.');

const session = (page: Page) => page.evaluate(() =>
  JSON.parse(sessionStorage.getItem('jikn-map-session-v1') ?? '{}') as MapSession);
async function settled(page: Page) {
  await expect(page.locator('[data-zoom-moving="true"]')).toHaveCount(0);
  await expect(page.locator('.map-canvas.leaflet-zoom-anim, .map-canvas.leaflet-pan-anim')).toHaveCount(0);
  await expect.poll(async () => {
    const before = await session(page);
    await page.waitForTimeout(100);
    const after = await session(page);
    return before.zoom === after.zoom && JSON.stringify(before.center) === JSON.stringify(after.center);
  }).toBe(true);
  await expect(page.locator('.map-canvas.leaflet-zoom-anim, .map-canvas.leaflet-pan-anim')).toHaveCount(0);
}
async function zoomOut(page: Page) {
  const button = page.getByTitle('Perkecil peta', { exact: true });
  const before = await session(page);
  if (await button.getAttribute('aria-disabled') === 'true') {
    // Tombol disabled memang tidak dapat diklik. Coba jalur keyboard pada peta.
    await page.locator('.map-canvas').focus();
    await page.keyboard.press('-');
  } else {
    await button.click();
    await expect.poll(async () => before.zoom - (await session(page)).zoom).toBeGreaterThan(0);
    // Langkah terakhir dapat lebih kecil dari 0,5 ketika menyentuh batas fraksional.
    expect(before.zoom - (await session(page)).zoom).toBeLessThanOrEqual(0.5);
  }
  await settled(page);
}
async function assertPositions(page: Page) {
  const view = await session(page);
  const map = (await page.locator('.map-canvas').boundingBox())!;
  // Ukur posisi yang tampak terhadap proyeksi sumber WGS84/Web Mercator.
  // Bukan memeriksa offset internal atau sekadar jumlah elemen.
  const project = ([lat, lng]: readonly number[]) => {
    const scale = 256 * 2 ** view.zoom, sin = Math.sin(lat! * Math.PI / 180);
    return [scale * (lng! + 180) / 360, scale * (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI))];
  };
  const center = project(view.center);
  for (const badge of await page.locator('[data-region-count-id]').all()) {
    const id = await badge.getAttribute('data-region-count-id');
    const source = [...references!.provinces, ...references!.kabKota].find((region) => region.id === id)!;
    const point = project(source.labelPosition!);
    const box = (await badge.boundingBox())!;
    const visible = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const shift = Math.hypot(visible.x - (map.x + map.width / 2 + point[0]! - center[0]!),
      visible.y - (map.y + map.height / 2 + point[1]! - center[1]!));
    expect(shift, `${source.name} tidak boleh bergeser jauh dari posisi sumber`).toBeLessThan(1.6);
    expect(box.width).toBeGreaterThanOrEqual(44);
  }
}

for (const width of [1440, 390]) {
  for (const province of ['36', '31']) {
    test(`${width}px provinsi ${province}: zoom out berulang tidak menyebarkan lingkaran; pilihan tetap bekerja`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(`/simpul-jaringan?provinsi=${province}`);
      await expect(page.locator('.map-stage.pilot-map')).toHaveAttribute('data-level', 'provinsi');
      await expect(page.locator('[data-region-count-id]').first()).toBeVisible();
      await settled(page);
      const original = await session(page);
      const ids = await page.locator('[data-region-count-id]').evaluateAll((elements) => elements.map((el) => el.getAttribute('data-region-count-id')));
      await assertPositions(page);
      await page.getByTitle('Perbesar peta', { exact: true }).click();
      await expect.poll(async () => (await session(page)).zoom).toBe(original.zoom + 0.5);
      await settled(page);
      for (let attempt = 0; attempt < 5; attempt++) {
        await zoomOut(page);
      }
      const map = (await page.locator('.map-canvas').boundingBox())!;
      await page.mouse.move(map.x + map.width / 2, map.y + map.height * 0.7);
      await page.mouse.wheel(0, 2000);
      await page.waitForTimeout(350);
      await settled(page);
      expect((await session(page)).zoom).toBe(original.zoom);
      await expect(page.getByTitle('Perkecil peta', { exact: true })).toHaveAttribute('aria-disabled', 'true');
      expect(await page.locator('[data-region-count-id]').evaluateAll((elements) => elements.map((el) => el.getAttribute('data-region-count-id')))).toEqual(ids);
      await assertPositions(page);
      await page.mouse.move(10, 10);
      await page.screenshot({ path: `.local/qa/zoomout-after-${province}-${width}.png` });
      const city = province === '36' ? '36.71' : '31.74';
      await activateRegionBadge(page, city);
      await expect(page.locator('.map-stage')).toHaveAttribute('data-level', 'instansi');
      expect(new URL(page.url()).searchParams.get('kabKota')).toBe(city);
      await expect(page.locator('[data-region-count-id]')).toHaveCount(0);
      // Pada lapisan kantor, zoom out tetap bebas untuk penguraian/pengelompokan marker.
      await settled(page);
      // Setengah level per klik kini perlu beberapa langkah untuk melewati zoom provinsi.
      for (let attempt = 0; attempt < 24 && (await session(page)).zoom >= original.zoom; attempt++) {
        await zoomOut(page);
      }
      expect((await session(page)).zoom).toBeLessThan(original.zoom);
      expect(errors).toEqual([]);
    });
  }
}

test('sesi Banten dengan zoom lama terlalu kecil diperbaiki; resize dan kembali nasional menghitung ulang batas', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('jikn-map-session-v1', JSON.stringify({
    datasetKind: 'pilot', query: '?provinsi=36', center: [-6.4, 106.1], zoom: 3, listOpen: false, listScroll: 0,
  })));
  await page.goto('/simpul-jaringan?provinsi=36');
  await expect(page.locator('[data-region-count-id="36.71"]')).toBeVisible();
  await settled(page);
  const desktop = await session(page);
  expect(desktop.zoom).toBeGreaterThanOrEqual(9);
  await assertPositions(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  await zoomOut(page);
  expect((await session(page)).zoom).toBeLessThan(desktop.zoom);
  await assertPositions(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect.poll(async () => (await session(page)).zoom).toBe(desktop.zoom);
  await settled(page);
  await page.getByRole('button', { name: 'Kembali ke Nasional' }).click();
  await expect(page.locator('.map-stage')).toHaveAttribute('data-level', 'nasional');
  await settled(page);
  const overview = await session(page);
  expect(overview.zoom).toBeLessThan(desktop.zoom);
  await expect(page.locator('[data-region-count-id]')).toHaveCount(overviewCount);
  await zoomOut(page);
  expect((await session(page)).zoom).toBe(overview.zoom - 0.5);
  // Overview boleh overlap, tetapi semua pusat badge tetap pada anchor sumber.
  await assertPositions(page);
});

for (const width of [1440, 390]) {
  test(`${width}px tampilan awal bebas zoom out, sesi dipulihkan, lalu provinsi tetap dapat dibuka`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/simpul-jaringan');
    await expect(page.locator('.map-stage.pilot-map')).toHaveAttribute('data-level', 'nasional');
    await expect(page.locator('[data-region-count-id]')).toHaveCount(overviewCount);
    await settled(page);
    const initial = await session(page);
    const steps = Math.min(4, Math.round((initial.zoom - 3) / 0.5));
    for (let attempt = 0; attempt < steps; attempt++) await zoomOut(page);
    const zoomed = await session(page);
    // Zoom awal mobile dapat fraksional (misalnya 3,25); langkah terakhir
    // berhenti pada minZoom lama 3, bukan melampauinya menjadi 2,75.
    expect(zoomed.zoom).toBe(Math.max(3, initial.zoom - steps * 0.5));
    if (initial.zoom > 3) expect(zoomed.zoom).toBeLessThan(initial.zoom);
    await expect(page.getByTitle('Perkecil peta', { exact: true })).toHaveAttribute('aria-disabled', zoomed.zoom === 3 ? 'true' : 'false');
    await expect(page.locator('.map-stage')).toHaveAttribute('data-level', 'nasional');
    expect(new URL(page.url()).search).toBe('');
    await page.reload();
    await expect(page.locator('[data-region-count-id]')).toHaveCount(overviewCount);
    await settled(page);
    const restored = await session(page);
    expect(restored.zoom).toBe(zoomed.zoom);
    restored.center.forEach((value, index) => expect(value).toBeCloseTo(zoomed.center[index]!, 6));
    await assertPositions(page);
    for (let zoom = restored.zoom; zoom > 3; zoom -= 0.5) await zoomOut(page);
    expect((await session(page)).zoom).toBe(3);
    await expect(page.locator('.map-stage')).toHaveAttribute('data-level', 'nasional');
    await expect(page.locator('[data-region-count-id]')).toHaveCount(overviewCount);
    await assertPositions(page);
    // Overlap pada zoom dunia diperbolehkan. Keyboard dan dropdown tetap
    // menyediakan pemilihan ID wilayah tanpa menggeser posisi badge.
    await page.screenshot({ path: `.local/qa/overview-free-zoom-${width}.png` });
    // Keyboard menyediakan pilihan ID yang tepat juga saat dua provinsi sangat dekat.
    await page.locator('[data-region-count-id="36"]').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.map-stage')).toHaveAttribute('data-level', 'provinsi');
    expect(new URL(page.url()).searchParams.get('provinsi')).toBe('36');
    await settled(page);
    expect((await session(page)).zoom).toBeGreaterThan(restored.zoom);
    await expect(page.locator('[data-region-count-id]')).toHaveCount(8);
    await assertPositions(page);
    expect(errors).toEqual([]);
  });
}

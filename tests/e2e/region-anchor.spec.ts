import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import type { MapSession, ReferenceData, SnapshotData } from '../../src/types/domain';
import { useFixtureTiles } from './tileFixture';

const references = JSON.parse(readFileSync('public/data/datasets/pilot/references.json', 'utf8')) as ReferenceData;
const snapshot = JSON.parse(readFileSync('public/data/datasets/pilot/snapshot.json', 'utf8')) as SnapshotData;
const view = (page: Page) => page.evaluate(() => JSON.parse(sessionStorage.getItem('jikn-map-session-v1') ?? '{}') as MapSession);

async function settled(page: Page) {
  await expect(page.locator('[data-zoom-moving="true"]')).toHaveCount(0);
  await expect(page.locator('.map-canvas.leaflet-pan-anim')).toHaveCount(0);
  await expect.poll(async () => {
    const before = await view(page);
    const transform = await page.locator('.leaflet-map-pane').evaluate((element) => getComputedStyle(element).transform);
    await page.waitForTimeout(100);
    return JSON.stringify(before) === JSON.stringify(await view(page))
      && transform === await page.locator('.leaflet-map-pane').evaluate((element) => getComputedStyle(element).transform);
  }).toBe(true);
}

/** Ukur pusat lingkaran DOM terhadap proyeksi sumber, bukan posisi marker internal Leaflet. */
async function anchorErrors(page: Page, source = references) {
  const session = await view(page);
  const bounds = (await page.locator('.map-canvas').boundingBox())!;
  const project = ([lat, lng]: readonly number[]) => {
    const scale = 256 * 2 ** session.zoom, sin = Math.sin(lat! * Math.PI / 180);
    return { x: scale * (lng! + 180) / 360,
      y: scale * (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) };
  };
  const center = project(session.center);
  return page.locator('[data-region-count-id]').evaluateAll((elements) => elements.map((element) => {
    const box = element.querySelector('.region-count-circle')!.getBoundingClientRect();
    return { id: element.getAttribute('data-region-count-id')!, x: box.x + box.width / 2, y: box.y + box.height / 2 };
  })).then((positions) => positions.map(({ id, x, y }) => {
    const region = [...source.provinces, ...source.kabKota].find((item) => item.id === id)!;
    const point = project(region.labelPosition!);
    return { id, name: region.name, distancePx: Math.hypot(
      x - (bounds.x + bounds.width / 2 + point.x - center.x),
      y - (bounds.y + bounds.height / 2 + point.y - center.y)) };
  }));
}
async function anchored(page: Page, source = references) {
  for (const { name, distancePx } of await anchorErrors(page, source))
    expect(distancePx, `${name}: pusat badge harus tepat pada labelPosition`).toBeLessThan(1.6);
}
async function zoomTo(page: Page, target: number) {
  await page.locator('.map-canvas').focus();
  while (Math.abs((await view(page)).zoom - target) > 0.01) {
    const previous = (await view(page)).zoom;
    await page.keyboard.press(previous < target ? '+' : '-');
    await expect.poll(async () => (await view(page)).zoom).toBe(previous + (previous < target ? 0.5 : -0.5));
    await settled(page);
  }
}

const errors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  await useFixtureTiles(page);
  errors.set(page, []);
  page.on('pageerror', (error) => errors.get(page)!.push(error.message));
});
test.afterEach(({ page }) => expect(errors.get(page)).toEqual([]));

for (const size of [{ width: 1440, height: 900 }, { width: 1280, height: 800 },
  { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
  test(`${size.width}: anchor geografis tepat pada zoom dunia, nasional, pulau, pan dan resize`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize(size);
    await page.addInitScript(() => sessionStorage.setItem('jikn-map-session-v1', JSON.stringify({
      datasetKind: 'pilot', query: '', center: [-3, 113], zoom: 3, listOpen: false, listScroll: 0,
    })));
    await page.goto('/simpul-jaringan');
    await expect(page.locator('[data-region-count-id]')).toHaveCount(38);
    await settled(page);
    await page.screenshot({ path: `.local/qa/region-anchor-20261020/${process.env.REGION_BADGE_PHASE ?? 'after'}-${size.width}.png` });
    await anchored(page);
    await expect(page.getByTitle('Perkecil peta', { exact: true })).toHaveAttribute('aria-disabled', 'true');
    const icons = await page.locator('[data-region-count-id]').evaluateAll((elements) => elements.map((element) => ({
      id: element.getAttribute('data-region-count-id')!, html: element.innerHTML,
    })));
    for (const zoom of [5, 7, 5, 3]) {
      await zoomTo(page, zoom);
      await anchored(page);
      expect(await page.locator('[data-region-count-id]').evaluateAll((elements) => elements.map((element) => ({
        id: element.getAttribute('data-region-count-id')!, html: element.innerHTML,
      })))).toEqual(icons);
    }
    const box = (await page.locator('.map-canvas').boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.7);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.7 + 60, box.y + box.height * 0.7 + 40, { steps: 10 });
    await page.mouse.up();
    await settled(page);
    await anchored(page);
    await page.setViewportSize({ width: size.width + 30, height: size.height + 20 });
    await settled(page);
    await anchored(page);
    await page.reload();
    await settled(page);
    await anchored(page);
  });
}

test('38 provinsi snapshot Excel memakai anchor sama tanpa displacement mode non-pilot', async ({ page }) => {
  const source = JSON.parse(readFileSync('public/data/references.json', 'utf8')) as ReferenceData;
  await page.addInitScript(() => sessionStorage.setItem('jikn-map-session-v1', JSON.stringify({
    datasetKind: 'excel', query: '?data=excel', center: [-3, 113], zoom: 3, listOpen: false, listScroll: 0,
  })));
  await page.goto('/simpul-jaringan?data=excel');
  await expect(page.locator('[data-region-count-id]').first()).toBeVisible();
  await settled(page);
  await anchored(page, source);
  await expect(page.locator('.region-count-leader')).toHaveCount(0);
});

test('38 provinsi pilot: anchor kab/kota dan alternatif dropdown saat badge overlap', async ({ page }) => {
  test.setTimeout(90000);
  await page.goto('/simpul-jaringan');
  await expect(page.locator('[data-region-count-id]')).toHaveCount(38);
  for (const province of references.provinces) {
    await page.locator('#desktop-province').selectOption(province.id);
    await expect(page.locator('.map-stage')).toHaveAttribute('data-level', 'provinsi');
    await settled(page);
    await anchored(page);
    const count = new Set(snapshot.instansi.filter((item) => item.provinceId === province.id && item.kabKotaId).map((item) => item.kabKotaId)).size;
    await expect(page.locator('[data-region-count-id]')).toHaveCount(count);
  }
  await page.locator('#desktop-province').selectOption('36');
  await page.locator('#desktop-kabkota').selectOption('36.73');
  await expect(page.locator('.map-stage')).toHaveAttribute('data-level', 'instansi');
  await expect(page.locator('[data-region-count-id]')).toHaveCount(0);
  await expect(page.locator('#desktop-jenis')).toHaveValue('');
  await page.getByRole('button', { name: 'Kembali ke Provinsi', exact: true }).click();
  await settled(page);
  await anchored(page);
});

test('browser Back memulihkan filter, viewport dan daftar; kembali provinsi tetap memakai anchor sumber', async ({ page }) => {
  const record = snapshot.instansi.find((item) => item.kabKotaId === '33.20')!;
  await page.goto('/simpul-jaringan?provinsi=33&kabKota=33.20');
  await expect(page.locator('.map-stage')).toHaveAttribute('data-level', 'instansi');
  await settled(page);
  await page.locator('#desktop-jenis').selectOption(record.jenisId!);
  await page.getByTitle('Perbesar peta', { exact: true }).click();
  await settled(page);
  await page.getByRole('button', { name: 'Daftar', exact: true }).click();
  const row = page.locator(`[data-result-instansi-id="${record.id}"]`);
  await row.getByRole('link', { name: record.name, exact: true }).focus();
  const saved = await view(page);
  await page.keyboard.press('Enter');
  await expect(page.locator('.profile-identity h1')).toHaveText(record.name);
  await page.goBack();
  await expect(page.locator('.map-stage')).toHaveAttribute('data-level', 'instansi');
  await expect(page.locator('#desktop-province')).toHaveValue('33');
  await expect(page.locator('#desktop-kabkota')).toHaveValue('33.20');
  await expect(page.locator('#desktop-jenis')).toHaveValue(record.jenisId!);
  await expect(page.locator('.results-panel')).toBeVisible();
  await settled(page);
  const restored = await view(page);
  expect(restored.zoom).toBe(saved.zoom);
  restored.center.forEach((value, index) => expect(value).toBeCloseTo(saved.center[index]!, 6));
  await page.getByRole('button', { name: 'Kembali ke Provinsi', exact: true }).click();
  await settled(page);
  await anchored(page);
});

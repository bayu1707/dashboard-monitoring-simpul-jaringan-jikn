import { useFixtureTiles } from './tileFixture';
import { expect, test, type Locator, type Page } from '@playwright/test';
test.beforeEach(async ({ page }) => useFixtureTiles(page));
import { readFileSync } from 'node:fs';
import type { SnapshotData } from '../../src/types/domain';

const serangUrl = '/simpul-jaringan?provinsi=36&kabKota=36.73&demo=1';
const markerFor = (page: Page, id: string) =>
  page.locator(`[data-instansi-id="${id}"]`);
const popup = (page: Page) => page.locator('.leaflet-popup .instansi-popup');
const runtimeErrors = new WeakMap<Page, string[]>();

test.beforeEach(({ page }) => {
  const errors: string[] = [];
  runtimeErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    // Kegagalan jaringan tile/fixture logo ditangani UI dan diuji tersendiri.
    if (message.type() === 'error' && !message.text().includes('Failed to load resource'))
      errors.push(message.text());
  });
});
test.afterEach(({ page }) => expect(runtimeErrors.get(page)).toEqual([]));

async function waitForMapMotion(page: Page) {
  await expect(page.locator('[data-zoom-moving="true"]')).toHaveCount(0);
  await expect(page.locator('.map-canvas.leaflet-zoom-anim, .map-canvas .leaflet-pan-anim'))
    .toHaveCount(0);
  await expect.poll(async () => {
    const pane = page.locator('.leaflet-map-pane');
    const before = await pane.evaluate((el) => getComputedStyle(el).transform);
    await page.waitForTimeout(100);
    return before === await pane.evaluate((el) => getComputedStyle(el).transform);
  }).toBe(true);
}

async function openSerang(page: Page) {
  await page.goto(serangUrl);
  await expect(page.locator('.map-stage')).toHaveAttribute('data-level', 'instansi');
  await waitForMapMotion(page);
}

async function unfoldAandB(page: Page) {
  for (let attempt = 0; attempt < 8; attempt++) {
    if (await markerFor(page, 'demo-a').count()) break;
    await page.locator('.instansi-cluster').first().click();
    await waitForMapMotion(page);
  }
  await expect(markerFor(page, 'demo-a')).toBeVisible();
  await expect(markerFor(page, 'demo-b')).toBeVisible();
  const a = await markerFor(page, 'demo-a').boundingBox();
  const b = await markerFor(page, 'demo-b').boundingBox();
  expect(Math.abs(a!.x - b!.x) + Math.abs(a!.y - b!.y),
    'Dua koordinat identik telah diuraikan menjadi marker visual berbeda').toBeGreaterThan(10);
}

async function expectAnchor(page: Page, id: string) {
  // Bandingkan DOM yang benar-benar digambar, termasuk posisi hasil spiderfy.
  await expect.poll(async () => {
    const marker = await markerFor(page, id).boundingBox();
    const tip = await page.locator('.leaflet-popup-tip-container').boundingBox();
    if (!marker || !tip) return Number.POSITIVE_INFINITY;
    return Math.max(
      Math.abs(tip.x + tip.width / 2 - marker.x - marker.width / 2),
      Math.abs(tip.y + tip.height - marker.y),
    );
  }, { message: `Panah harus menuju marker aktif ${id}, bukan koordinat sebelum spiderfy` })
    .toBeLessThanOrEqual(2);
}

async function openMarker(page: Page, id: string) {
  await markerFor(page, id).hover();
  await expect(popup(page).getByRole('link', { name: 'Lihat detail' }))
    .toHaveAttribute('href', new RegExp(`/simpul-jaringan/${id}\\?`));
  await waitForMapMotion(page);
}

async function requireBox(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

test('hover stabil; lintasan lambat marker → panah → Lihat detail tetap interaktif', async ({ page }, testInfo) => {
  await openSerang(page);
  await expect(page.locator('#desktop-jenis')).toHaveValue('');
  await unfoldAandB(page);
  await openMarker(page, 'demo-a');
  const monitor = await page.locator('.leaflet-popup').evaluateHandle((node) => {
    const state = { removals: 0, observer: new MutationObserver(() => {}) };
    state.observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const removed of record.removedNodes) {
          if (removed === node || removed.contains(node)) state.removals++;
        }
      }
    });
    state.observer.observe(document.body, { childList: true, subtree: true });
    return state;
  });

  // Jendela observasi lebih panjang dari close delay: pointer diam tidak memicu buka/tutup.
  await page.waitForTimeout(650);
  await expect(popup(page)).toBeVisible();
  const tip = await requireBox(page.locator('.leaflet-popup-tip-container'));
  await page.mouse.move(tip.x + tip.width / 2, tip.y + Math.min(7, tip.height / 2), { steps: 12 });
  // Sengaja berhenti di area panah yang dahulu tidak memiliki event pembatalan timer.
  await page.waitForTimeout(350);
  await expect(popup(page)).toBeVisible();
  const link = popup(page).getByRole('link', { name: 'Lihat detail' });
  const linkBox = await requireBox(link);
  const start = { x: tip.x + tip.width / 2, y: tip.y + Math.min(7, tip.height / 2) };
  for (let step = 1; step <= 12; step++) {
    await page.mouse.move(
      start.x + (linkBox.x + linkBox.width / 2 - start.x) * step / 12,
      start.y + (linkBox.y + linkBox.height / 2 - start.y) * step / 12,
    );
    await page.waitForTimeout(30);
  }
  await page.waitForTimeout(300);
  await expect(link).toBeVisible();
  expect(await monitor.evaluate((state) => state.removals), 'Popup tidak dilepas selama lintasan hover').toBe(0);
  await monitor.evaluate((state) => state.observer.disconnect());
  await expectAnchor(page, 'demo-a');
  await page.screenshot({ path: testInfo.outputPath('popup-stabil-spiderfy-desktop.png') });
  await link.click();
  await expect(page).toHaveURL(/\/simpul-jaringan\/demo-a\?/);
  await page.getByRole('link', { name: 'Kembali ke Peta', exact: true }).click();
  await expect(page.locator('.map-stage')).toHaveAttribute('data-level', 'instansi');
  await expect(page.locator('#desktop-jenis')).toHaveValue('');
});

test('pergantian cepat A/B memakai marker terakhir; timer lama dan fokus keyboard aman', async ({ page }) => {
  await openSerang(page);
  await unfoldAandB(page);
  for (let attempt = 0; attempt < 4; attempt++) {
    await openMarker(page, 'demo-a');
    await expectAnchor(page, 'demo-a');
    // Berpindah lebih cepat dari close delay A; timer A tidak boleh menutup B.
    await openMarker(page, 'demo-b');
    await page.waitForTimeout(280);
    await expect(popup(page).getByRole('heading')).toHaveText('Instansi Demo B');
    await expectAnchor(page, 'demo-b');
  }
  await expect(popup(page).locator('.popup-metrics dd')).toHaveText(['0', '0', 'Belum tersedia']);
  const link = popup(page).getByRole('link', { name: 'Lihat detail' });
  await link.focus();
  await expect(link).toBeFocused();
  await page.mouse.move(20, 20);
  await page.waitForTimeout(300);
  await expect(link).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(popup(page)).toHaveCount(0);
  await expect(markerFor(page, 'demo-b')).toBeFocused();
  await openMarker(page, 'demo-a');
  await page.mouse.move(20, 20);
  await expect(popup(page)).toHaveCount(0);
  await openMarker(page, 'demo-b');
  await page.getByRole('button', { name: 'Kembali ke Provinsi' }).click();
  await expect(page.locator('.map-stage')).toHaveAttribute('data-level', 'provinsi');
  await expect(popup(page)).toHaveCount(0);
  await expect(markerFor(page, 'demo-b')).toHaveCount(0);
});

test('popup nama panjang setelah kembali tetap terbuka ketika langsung berpindah dari marker ke tombol', async ({ page }) => {
  // Memakai instansi sintetis yang sudah ada; tidak menambah data atau mengubah sumber produksi.
  const fixture = JSON.parse(readFileSync('public/demo/snapshot.json', 'utf8')) as SnapshotData;
  for (const item of fixture.instansi.filter((item) => ['demo-a', 'demo-b'].includes(item.id)))
    item.name = `${item.name} dengan Nama Panjang untuk Regresi Perpindahan Pointer`;
  await page.route('**/demo/snapshot.json', (route) => route.fulfill({ json: fixture }));
  await openSerang(page);
  for (const id of ['demo-a', 'demo-b']) {
    await unfoldAandB(page);
    await openMarker(page, id);
    const link = popup(page).getByRole('link', { name: 'Lihat detail' });
    await link.hover();
    await page.waitForTimeout(350);
    await expect(popup(page)).toBeVisible();
    await expectAnchor(page, id);
    await link.click();
    await expect(page.locator('.profile-identity h1')).toHaveText(fixture.instansi.find((item) => item.id === id)!.name);
    await page.getByRole('link', { name: 'Kembali ke Peta', exact: true }).click();
    await waitForMapMotion(page);
  }
});

async function dragMapBy(page: Page, dx: number, dy: number) {
  const map = await requireBox(page.locator('.map-canvas'));
  // Drag memakai pointer sungguhan; tidak mengubah instance/koordinat Leaflet.
  const point = await page.locator('.map-canvas').evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    for (const fraction of [0.5, 0.65, 0.35, 0.75]) {
      const x = bounds.x + bounds.width * fraction;
      const y = bounds.y + bounds.height * 0.6;
      const hit = document.elementFromPoint(x, y);
      if (hit && element.contains(hit) && !hit.closest('.leaflet-marker-icon, .leaflet-popup, .leaflet-control'))
        return { x, y };
    }
    return null;
  });
  expect(point, 'Tersedia bidang peta kosong untuk drag').not.toBeNull();
  const stepX = Math.max(-map.width * 0.18, Math.min(map.width * 0.18, dx));
  const stepY = Math.max(-map.height * 0.18, Math.min(map.height * 0.18, dy));
  await page.mouse.move(point!.x, point!.y);
  await page.mouse.down();
  await page.mouse.move(point!.x + stepX, point!.y + stepY, { steps: 12 });
  // Diam sebelum melepas mencegah inertia membuat target sisi viewport tidak deterministik.
  await page.waitForTimeout(120);
  await page.mouse.up();
  await waitForMapMotion(page);
}

async function placeMarker(page: Page, id: string, x: number, y: number) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const marker = await requireBox(markerFor(page, id));
    const dx = x - (marker.x + marker.width / 2);
    const dy = y - (marker.y + marker.height / 2);
    if (Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
    await dragMapBy(page, dx, dy);
  }
  throw new Error('Drag belum menempatkan marker pada sisi viewport yang diuji.');
}

test('pan, zoom, empat tepi viewport: popup terlihat dan panah tetap menuju marker aktif', async ({ page }, testInfo) => {
  test.setTimeout(60000);
  await openSerang(page);
  // Fixture F tunggal setelah filter; tanpa data tambahan dan tanpa koordinat buatan.
  await page.locator('#desktop-jenis').selectOption('demo-lainnya');
  await expect(markerFor(page, 'demo-f')).toBeVisible();
  for (const title of ['Perbesar peta', 'Perkecil peta']) {
    await page.getByTitle(title, { exact: true }).click();
    await waitForMapMotion(page);
    await openMarker(page, 'demo-f');
    await expectAnchor(page, 'demo-f');
    await page.keyboard.press('Escape');
  }
  const map = await requireBox(page.locator('.map-canvas'));
  const sides = [
    { name: 'kiri', x: map.x + 38, y: map.y + map.height * 0.6 },
    { name: 'kanan', x: map.x + map.width - 38, y: map.y + map.height * 0.6 },
    { name: 'atas', x: map.x + map.width * 0.55, y: map.y + 140 },
    { name: 'bawah', x: map.x + map.width * 0.55, y: map.y + map.height - 100 },
  ];
  for (const side of sides) {
    await placeMarker(page, 'demo-f', side.x, side.y);
    await openMarker(page, 'demo-f');
    await expectAnchor(page, 'demo-f');
    const bounds = await requireBox(page.locator('.leaflet-popup'));
    expect(bounds.x, side.name).toBeGreaterThanOrEqual(map.x);
    expect(bounds.x + bounds.width, side.name).toBeLessThanOrEqual(map.x + map.width);
    expect(bounds.y, side.name).toBeGreaterThanOrEqual(map.y);
    expect(bounds.y + bounds.height, side.name).toBeLessThanOrEqual(map.y + map.height);
    await page.screenshot({ path: testInfo.outputPath(`popup-tepi-${side.name}.png`) });
    await page.keyboard.press('Escape');
  }
});

test('mobile 390: tap hasil spiderfy membuka sheet yang stabil, detail dan kembali bekerja', async ({ browser }, testInfo) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openSerang(page);
  await unfoldAandB(page);
  await markerFor(page, 'demo-a').tap();
  const sheet = page.locator('.mobile-popup');
  await expect(sheet.getByRole('heading')).toHaveText('Instansi Demo A');
  await page.waitForTimeout(350);
  await expect(sheet).toBeVisible();
  await expect(page.locator('.leaflet-popup')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('popup-sentuh-390.png') });
  await sheet.getByRole('button', { name: 'Tutup popup' }).tap();
  await expect(sheet).toHaveCount(0);
  await markerFor(page, 'demo-a').tap();
  await expect(sheet.getByRole('heading')).toHaveText('Instansi Demo A');
  await sheet.getByRole('link', { name: 'Lihat detail' }).tap();
  await expect(page).toHaveURL(/\/simpul-jaringan\/demo-a\?/);
  await page.getByRole('link', { name: 'Kembali ke Peta', exact: true }).tap();
  await expect(page.locator('.map-stage')).toHaveAttribute('data-level', 'instansi');
  expect(errors).toEqual([]);
  await context.close();
});

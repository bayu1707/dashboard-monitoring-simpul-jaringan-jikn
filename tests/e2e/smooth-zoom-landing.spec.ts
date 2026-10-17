import { expect, test, type Page } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import type { MapSession, SnapshotData } from '../../src/types/domain';

const session = (page: Page) => page.evaluate(() =>
  JSON.parse(sessionStorage.getItem('jikn-map-session-v1') ?? '{}') as MapSession);
async function settled(page: Page) {
  await expect(page.locator('[data-zoom-moving="true"]')).toHaveCount(0);
  await expect(page.locator('.map-stage')).toBeVisible();
}
const errors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
  const messages: string[] = [];
  errors.set(page, messages);
  page.on('pageerror', (error) => messages.push(error.message));
});
test.afterEach(({ page }) => expect(errors.get(page)).toEqual([]));

for (const [level, query] of [
  ['nasional', '?demo=1'],
  ['provinsi', '?provinsi=36&demo=1'],
  ['instansi', '?provinsi=36&kabKota=36.73&demo=1'],
]) {
  test(`zoom ${level}: animasi nyata, langkah tombol/keyboard setengah, wheel tidak melompat banyak level`, async ({ page }) => {
    await page.goto(`/simpul-jaringan${query}`);
    await expect(page.locator('.map-stage')).toHaveAttribute('data-level', level!);
    const before = await session(page);
    const url = page.url();
    const animation = page.evaluate(() => new Promise<number>((resolve) => {
      const transforms = new Set<string>();
      const until = performance.now() + 650;
      const sample = () => {
        const tile = document.querySelector('.leaflet-tile-container');
        if (tile) transforms.add(getComputedStyle(tile).transform);
        if (performance.now() < until) requestAnimationFrame(sample);
        else resolve(transforms.size);
      };
      requestAnimationFrame(sample);
    }));
    await page.getByTitle('Perbesar peta', { exact: true }).click();
    await expect.poll(async () => (await session(page)).zoom).toBe(before.zoom + 0.5);
    await settled(page);
    expect(await animation, 'Tile harus melalui beberapa transform peralihan, bukan berubah mendadak').toBeGreaterThan(2);
    await page.getByTitle('Perkecil peta', { exact: true }).click();
    await expect.poll(async () => (await session(page)).zoom).toBe(before.zoom);
    await page.locator('.map-canvas').focus();
    await page.keyboard.press('+');
    await expect.poll(async () => (await session(page)).zoom).toBe(before.zoom + 0.5);
    const map = (await page.locator('.map-canvas').boundingBox())!;
    await page.mouse.move(map.x + map.width / 2, map.y + map.height * 0.7);
    await page.mouse.wheel(0, -1200);
    await expect.poll(async () => (await session(page)).zoom).toBe(before.zoom + 1);
    await settled(page);
    await page.locator('.map-canvas').focus();
    await page.keyboard.press('+');
    await page.keyboard.press('-');
    await settled(page);
    await expect.poll(async () => (await session(page)).zoom).toBe(before.zoom + 1);
    expect(page.url()).toBe(url);
    await expect(page.locator('.map-stage')).toHaveAttribute('data-level', level!);
  });
}

test('reduced motion meniadakan animasi sambil menjaga langkah zoom dan state', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/simpul-jaringan?demo=1');
  await expect(page.locator('.map-stage')).toHaveAttribute('data-level', 'nasional');
  const before = await session(page);
  await page.getByTitle('Perbesar peta', { exact: true }).click();
  await expect.poll(async () => (await session(page)).zoom).toBe(before.zoom + 0.5);
  await expect(page.locator('[data-zoom-moving]')).toHaveCount(0);
});

const snapshot: SnapshotData | null = existsSync('.local/pilot/snapshot.json')
  ? JSON.parse(readFileSync('.local/pilot/snapshot.json', 'utf8')) as SnapshotData : null;
const anri = snapshot?.instansi.find((item) => item.name === 'Arsip Nasional RI');

test('ANRI: hanya pemilik mapping aktif; hover → Landing Page tab baru → detail dan kembali', async ({ page, context }) => {
  test.skip(!anri?.landingPageUrl || anri.landingPageVerificationStatus !== 'verified', 'Mapping privat ANRI belum tersedia.');
  const query = `?provinsi=${anri!.provinceId}&kabKota=${anri!.kabKotaId}`;
  await page.addInitScript(({ query, center }) => sessionStorage.setItem('jikn-map-session-v1', JSON.stringify({
    query, center, zoom: 19, datasetKind: 'pilot', listScroll: 0, listOpen: false,
  })), { query, center: anri!.coordinates });
  // Fixture halaman tujuan hanya menguji href/window baru; bukan bukti isi situs JIKN dapat diakses.
  await context.route(anri!.landingPageUrl!, (route) => route.fulfill({ contentType: 'text/html', body: '<h1>Fixture navigasi eksternal</h1>' }));
  await page.goto(`/simpul-jaringan${query}`);
  const marker = page.locator(`[data-instansi-id="${anri!.id}"]`);
  await expect(marker).toBeInViewport();
  await marker.hover();
  const popup = page.locator('.instansi-leaflet-popup .instansi-popup');
  await expect(popup.getByRole('heading')).toHaveText(anri!.name);
  await expect(popup.locator('.popup-metrics dd').last()).toHaveText('2015');
  const link = popup.getByRole('link', { name: 'Landing Page', exact: true });
  await expect(link).toHaveAttribute('href', anri!.landingPageUrl!);
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  await link.hover();
  await page.waitForTimeout(240);
  await expect(popup).toBeVisible();
  await page.screenshot({ path: '.local/qa/anri-landing-popup-desktop.png' });
  const opened = page.waitForEvent('popup');
  await link.click();
  const external = await opened;
  await expect(external).toHaveURL(anri!.landingPageUrl!);
  await expect(external.getByRole('heading')).toHaveText('Fixture navigasi eksternal');
  await external.close();
  await marker.hover();
  await popup.getByRole('link', { name: 'Lihat detail', exact: true }).click();
  await expect(page.locator('.profile-identity h1')).toHaveText(anri!.name);
  await page.getByRole('link', { name: 'Kembali ke Peta', exact: true }).click();
  await expect(page.locator('#desktop-kabkota')).toHaveValue(anri!.kabKotaId!);
  expect(snapshot!.instansi.filter((item) => item.landingPageVerificationStatus === 'verified')).toHaveLength(1);
  const other = snapshot!.instansi.find((item) => item.id !== anri!.id && item.coordinates)!;
  await page.goto(`/simpul-jaringan/${other.id}`);
  // Mapping tidak disalin ke instansi lain; nilai sumber tetap kosong.
  expect(other.landingPageUrl).toBeNull();
});

test('ANRI mobile: tombol Landing Page aktif pada sheet 390 px tanpa overflow', async ({ browser }) => {
  test.skip(!anri?.landingPageUrl, 'Mapping privat ANRI belum tersedia.');
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const messages: string[] = [];
  page.on('pageerror', (error) => messages.push(error.message));
  const query = `?provinsi=${anri!.provinceId}&kabKota=${anri!.kabKotaId}`;
  await page.addInitScript(({ query, center }) => sessionStorage.setItem('jikn-map-session-v1', JSON.stringify({
    query, center, zoom: 19, datasetKind: 'pilot', listScroll: 0, listOpen: false,
  })), { query, center: anri!.coordinates });
  await page.goto(`/simpul-jaringan${query}`);
  await page.locator(`[data-instansi-id="${anri!.id}"]`).tap();
  const sheet = page.locator('.mobile-popup');
  await expect(sheet.getByRole('heading')).toHaveText(anri!.name);
  await expect(sheet.getByRole('link', { name: 'Landing Page', exact: true })).toHaveAttribute('href', anri!.landingPageUrl!);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.local/qa/anri-landing-popup-mobile.png' });
  expect(messages).toEqual([]);
  await context.close();
});

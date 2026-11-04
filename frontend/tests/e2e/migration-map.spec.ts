import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { MapSession, ReferenceData } from '../../app/types/domain';
import {
  openFixtureMap,
  unfoldDemoMarkers,
  useApiFixture,
  waitForMapMotion,
} from './apiFixture';

test.beforeEach(async ({ page }) => {
  await useApiFixture(page);
});
const runtimeErrors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
  const errors: string[] = [];
  runtimeErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
});
test.afterEach(({ page }) => {
  expect(runtimeErrors.get(page)).toEqual([]);
});
const marker = (page: Page, id: string) =>
  page.locator(`[data-instansi-id="${id}"]`);
const popup = (page: Page) => page.locator('.leaflet-popup .instansi-popup');
async function expectAnchor(page: Page, id: string) {
  await expect
    .poll(async () => {
      const target = await marker(page, id).boundingBox();
      const tip = await page
        .locator('.leaflet-popup-tip-container')
        .boundingBox();
      if (!target || !tip) return Infinity;
      return Math.max(
        Math.abs(tip.x + tip.width / 2 - target.x - target.width / 2),
        Math.abs(tip.y + tip.height - target.y),
      );
    })
    .toBeLessThanOrEqual(2);
}

test('Nuxt: provinsi → kab/kota → instansi; dropdown sinkron, cluster, hover dan kembali detail', async ({
  page,
}, info) => {
  await openFixtureMap(page);
  await expect(page.locator('.map-stage')).toHaveAttribute(
    'data-level',
    'nasional',
  );
  await page.locator('[data-region-id="36"]').focus();
  await page.keyboard.press('Enter');
  await waitForMapMotion(page);
  await expect(page.locator('.map-stage')).toHaveAttribute(
    'data-level',
    'provinsi',
  );
  await expect(page.locator('#desktop-province')).toHaveValue('36');
  await expect(page.locator('[data-region-count-id="36"]')).toHaveCount(0);
  await page.locator('[data-region-id="36.73"]').focus();
  await page.keyboard.press('Enter');
  await waitForMapMotion(page);
  await expect(page.locator('.map-stage')).toHaveAttribute(
    'data-level',
    'instansi',
  );
  await expect(page.locator('#desktop-kabkota')).toHaveValue('36.73');
  await expect(page.locator('#desktop-jenis')).toHaveValue('');
  await expect(page.locator('.map-navigation')).toContainText(
    '7 hasil · 6 terpetakan · 1 tanpa koordinat',
  );
  await expect(page.locator('.instansi-cluster').first()).toBeVisible();
  await unfoldDemoMarkers(page);
  const a = await marker(page, 'demo-a').boundingBox();
  const b = await marker(page, 'demo-b').boundingBox();
  expect(Math.abs(a!.x - b!.x) + Math.abs(a!.y - b!.y)).toBeGreaterThan(10);
  await marker(page, 'demo-a').hover();
  await expect(popup(page).getByRole('heading')).toHaveText('Instansi Demo A');
  await waitForMapMotion(page);
  await expectAnchor(page, 'demo-a');
  const node = await popup(page).evaluateHandle((element) => element);
  const tip = await page.locator('.leaflet-popup-tip-container').boundingBox();
  await page.mouse.move(tip!.x + tip!.width / 2, tip!.y + 5, { steps: 12 });
  await page.waitForTimeout(350);
  const link = popup(page).getByRole('link', { name: 'Lihat detail' });
  await link.hover();
  await page.waitForTimeout(350);
  expect(await node.evaluate((element) => element.isConnected)).toBe(true);
  await expectAnchor(page, 'demo-a');
  await page.screenshot({ path: info.outputPath('nuxt-popup-desktop.png') });
  await link.click();
  await expect(page).toHaveURL(/\/simpul-jaringan\/demo-a\?/);
  await expect(page.locator('.profile-identity h1')).toHaveText(
    'Instansi Demo A',
  );
  await page
    .getByRole('link', { name: 'Kembali ke Peta', exact: true })
    .click();
  await expect(page.locator('.map-stage')).toHaveAttribute(
    'data-level',
    'instansi',
  );
  await expect(page.locator('#desktop-jenis')).toHaveValue('');
  await page.getByRole('button', { name: 'Kembali ke Provinsi' }).click();
  await expect(page.locator('.map-stage')).toHaveAttribute(
    'data-level',
    'provinsi',
  );
  await expect(page.locator('.instansi-marker')).toHaveCount(0);
  await expect(popup(page)).toHaveCount(0);
});

test('Nuxt: hover cepat marker A/B, nol/null, fokus keyboard dan popup tutup saat cakupan berubah', async ({
  page,
}) => {
  await openFixtureMap(
    page,
    '/simpul-jaringan?provinsi=36&kabKota=36.73&demo=1',
  );
  await unfoldDemoMarkers(page);
  for (let attempt = 0; attempt < 3; attempt++) {
    await marker(page, 'demo-a').hover();
    await expect(popup(page).getByRole('heading')).toHaveText(
      'Instansi Demo A',
    );
    await expectAnchor(page, 'demo-a');
    await marker(page, 'demo-b').hover();
    await page.waitForTimeout(280);
    await expect(popup(page).getByRole('heading')).toHaveText(
      'Instansi Demo B',
    );
    await expectAnchor(page, 'demo-b');
  }
  await expect(popup(page).locator('.popup-metrics dd')).toHaveText([
    '0',
    '0',
    'Belum tersedia',
  ]);
  await expect(
    popup(page).getByRole('button', { name: 'Landing Page' }),
  ).toBeDisabled();
  const link = popup(page).getByRole('link', { name: 'Lihat detail' });
  await link.focus();
  await page.mouse.move(20, 20);
  await page.waitForTimeout(350);
  await expect(link).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(popup(page)).toHaveCount(0);
  await expect(marker(page, 'demo-b')).toBeFocused();
  await marker(page, 'demo-a').hover();
  await expect(popup(page)).toBeVisible();
  await page.locator('#desktop-kabkota').selectOption('');
  await expect(page.locator('.map-stage')).toHaveAttribute(
    'data-level',
    'provinsi',
  );
  await expect(popup(page)).toHaveCount(0);
});

async function expectGeographicAnchors(page: Page) {
  const source = JSON.parse(
    readFileSync('../public/data/datasets/pilot/references.json', 'utf8'),
  ) as ReferenceData;
  const session = await page.evaluate(
    () =>
      JSON.parse(
        sessionStorage.getItem('jikn-map-session-v1') ?? '{}',
      ) as MapSession,
  );
  const box = (await page.locator('.map-canvas').boundingBox())!;
  const project = ([lat, lng]: [number, number]) => {
    const scale = 256 * 2 ** session.zoom;
    const sin = Math.sin((lat * Math.PI) / 180);
    return {
      x: (scale * (lng + 180)) / 360,
      y: scale * (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)),
    };
  };
  const center = project(session.center);
  const positions = await page
    .locator('[data-region-count-id]')
    .evaluateAll((elements) =>
      elements.map((element) => {
        const circle = element
          .querySelector('.region-count-circle')!
          .getBoundingClientRect();
        return {
          id: element.getAttribute('data-region-count-id'),
          x: circle.x + circle.width / 2,
          y: circle.y + circle.height / 2,
        };
      }),
    );
  for (const actual of positions) {
    const region = source.provinces.find((item) => item.id === actual.id)!;
    const expected = project(region.labelPosition!);
    expect(
      Math.hypot(
        actual.x - box.x - box.width / 2 - expected.x + center.x,
        actual.y - box.y - box.height / 2 - expected.y + center.y,
      ),
      region.name,
    ).toBeLessThan(1.6);
  }
}

test('Nuxt: badge geografis tidak dipindahkan saat zoom out sampai dunia', async ({
  page,
}) => {
  await openFixtureMap(page, '/simpul-jaringan');
  const badge = page.locator('[data-region-count-id="36"]');
  await expect(badge).toBeVisible();
  await expectGeographicAnchors(page);
  const initial = await badge.getAttribute('style');
  const zoomOut = page.getByTitle('Perkecil peta', { exact: true });
  for (let index = 0; index < 15; index++) {
    if (await zoomOut.getAttribute('aria-disabled') === 'true') break;
    await zoomOut.click();
    await waitForMapMotion(page);
  }
  await waitForMapMotion(page);
  await expect(
    page.getByTitle('Perkecil peta', { exact: true }),
  ).toHaveAttribute('aria-disabled', 'true');
  await expect(badge).toBeAttached();
  await expectGeographicAnchors(page);
  expect(await badge.getAttribute('style')).not.toBe(initial);
  expect(
    await badge.evaluate((element) => ({
      marginLeft: element.style.marginLeft,
      marginTop: element.style.marginTop,
    })),
  ).toEqual({ marginLeft: '-24px', marginTop: '-24px' });
  await expect(page.locator('.region-count-leader')).toHaveCount(0);
  await badge.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.map-stage')).toHaveAttribute(
    'data-level',
    'provinsi',
  );
});

test('Nuxt mobile 390: tap spiderfy → sheet → detail → peta dan tanpa scroll horizontal', async ({
  browser,
}, info) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await useApiFixture(page);
  await openFixtureMap(
    page,
    '/simpul-jaringan?provinsi=36&kabKota=36.73&demo=1',
  );
  await unfoldDemoMarkers(page);
  await marker(page, 'demo-a').tap();
  const sheet = page.locator('.mobile-popup');
  await expect(sheet.getByRole('heading')).toHaveText('Instansi Demo A');
  await page.waitForTimeout(350);
  await expect(sheet).toBeVisible();
  await expect(page.locator('.leaflet-popup')).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: info.outputPath('nuxt-popup-mobile-390.png') });
  await sheet.getByRole('link', { name: 'Lihat detail' }).tap();
  await expect(page).toHaveURL(/\/simpul-jaringan\/demo-a\?/);
  await page.getByRole('link', { name: 'Kembali ke Peta', exact: true }).tap();
  await expect(page.locator('.map-stage')).toHaveAttribute(
    'data-level',
    'instansi',
  );
  expect(errors).toEqual([]);
  await context.close();
});

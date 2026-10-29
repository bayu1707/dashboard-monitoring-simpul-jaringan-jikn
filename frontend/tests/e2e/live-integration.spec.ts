import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { SnapshotData } from '../../app/types/domain';
import { useFixtureTiles } from './tileFixture';
const api = process.env.LARAVEL_TEST_URL ?? 'http://127.0.0.1:8000/api/v1';
const pilot = JSON.parse(
  readFileSync('../public/data/datasets/pilot/snapshot.json', 'utf8'),
) as SnapshotData;
const anri = pilot.instansi.find((item) => item.name === 'Arsip Nasional RI')!;

test('Laravel hidup: pagination semua mode, record asli dan geometri tidak hilang', async ({
  request,
}) => {
  for (const [mode, total, pins] of [
    ['pilot', 643, 627],
    ['excel', 643, 0],
    ['demo', 7, 6],
  ] as const) {
    const response = await request.get(
      `${api}/institutions?mode=${mode}&per_page=250`,
    );
    expect(response.status()).toBe(200);
    const first = await response.json();
    const items = [...first.data];
    for (let page = 2; page <= first.meta.lastPage; page++) {
      const response = await request.get(
        `${api}/institutions?mode=${mode}&per_page=250&page=${page}`,
      );
      expect(response.status()).toBe(200);
      items.push(...(await response.json()).data);
    }
    expect(items).toHaveLength(total);
    expect(new Set(items.map((item) => item.id)).size).toBe(total);
    expect(items.filter((item) => item.coordinates !== null)).toHaveLength(
      pins,
    );
    if (mode === 'pilot') expect(items).toEqual(pilot.instansi);
  }
  const refs = await request.get(`${api}/reference-data?mode=pilot`);
  expect((await refs.json()).data.provinces).toHaveLength(38);
  const shape = await request.get(`${api}/geometry/36?mode=pilot`);
  expect((await shape.json()).features).toHaveLength(8);
  expect((await request.get(`${api}/institutions/no-such-id`)).status()).toBe(
    404,
  );
  expect(
    (
      await request.get(`${api}/institutions?provinceId=31&kabKotaId=36.73`)
    ).status(),
  ).toBe(422);
});

test('Nuxt → Laravel hidup: pilot dan detail ANRI, Landing Page, kembali dan mode Excel', async ({
  page,
}) => {
  await useFixtureTiles(page);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/simpul-jaringan?provinsi=31&kabKota=31.74');
  await expect(page.locator('.map-canvas.leaflet-container')).toBeVisible();
  await expect(page.locator('.map-stage')).toHaveAttribute(
    'data-level',
    'instansi',
  );
  await expect(page.locator('.map-footer')).toContainText('643 instansi');
  await page.getByRole('button', { name: 'Daftar', exact: true }).click();
  const row = page.locator(`[data-result-instansi-id="${anri.id}"]`);
  await row.getByRole('button', { name: /Pratinjau/ }).click();
  const preview = page.locator('.list-profile-popup');
  await expect(preview).toContainText('2015');
  await expect(
    preview.getByRole('link', { name: /Landing Page/ }),
  ).toHaveAttribute('href', anri.landingPageUrl!);
  await expect(
    preview.getByRole('link', { name: /Landing Page/ }),
  ).toHaveAttribute('rel', 'noopener noreferrer');
  await preview.getByRole('link', { name: 'Lihat detail' }).click();
  await expect(page.locator('.profile-identity h1')).toHaveText(anri.name);
  await expect(page.locator('.profile-fields')).toContainText('2015');
  await expect(page.locator('.detail-snapshot-label')).toContainText(
    'DATA SIMULASI',
  );
  await page
    .getByRole('link', { name: 'Kembali ke Peta', exact: true })
    .click();
  await expect(page.locator('#desktop-province')).toHaveValue('31');
  await expect(page.locator('#desktop-kabkota')).toHaveValue('31.74');
  await expect(page.locator('.results-panel')).toBeVisible();
  await page.goto('/simpul-jaringan?data=excel&daftar=instansi');
  await expect(page.locator('.results-description').first()).toContainText(
    '643 hasil · 0 terpetakan',
  );
  await expect(page.locator('.instansi-marker')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('Nuxt → Laravel hidup: desktop38provinsi/514kab, dropdown dan geometri Banten/Sumatra', async ({
  page,
}) => {
  await useFixtureTiles(page);
  await page.goto('/simpul-jaringan');
  await expect(page.locator('.map-canvas.leaflet-container')).toBeVisible();
  await expect(page.locator('[data-region-count-id]')).toHaveCount(38);
  for (const [province, city] of [
    ['36', '36.73'],
    ['11', '11.71'],
    ['33', '33.20'],
  ]) {
    await page.locator('#desktop-province').selectOption(province!);
    await expect(page.locator('.map-stage')).toHaveAttribute(
      'data-level',
      'provinsi',
    );
    await expect(
      page.locator(`[data-region-id="${city}"]`).first(),
    ).toBeAttached();
    await page.locator('#desktop-kabkota').selectOption(city!);
    await expect(page.locator('.map-stage')).toHaveAttribute(
      'data-level',
      'instansi',
    );
    await expect(page.locator('#desktop-jenis')).toHaveValue('');
  }
});

test('Nuxt → Laravel hidup: 390filter draft batal/terapkan/reset, detailnotfound', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await useFixtureTiles(page);
  await page.goto('/simpul-jaringan');
  await expect(page.locator('.map-canvas.leaflet-container')).toBeVisible();
  await page.getByRole('button', { name: 'Filter', exact: true }).tap();
  await page.locator('#mobile-province').selectOption('36');
  await page.getByRole('button', { name: 'Batal', exact: true }).tap();
  await expect(page.locator('.map-stage')).toHaveAttribute(
    'data-level',
    'nasional',
  );
  await page.getByRole('button', { name: 'Filter', exact: true }).tap();
  await expect(page.locator('#mobile-province')).toHaveValue('');
  await page.locator('#mobile-province').selectOption('36');
  await page.locator('#mobile-kabkota').selectOption('36.73');
  await page.getByRole('button', { name: 'Terapkan', exact: true }).tap();
  await expect(page.locator('.map-stage')).toHaveAttribute(
    'data-level',
    'instansi',
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole('button', { name: 'Reset seluruh filter', exact: true })
    .tap();
  await expect(page.locator('.map-stage')).toHaveAttribute(
    'data-level',
    'nasional',
  );
  await page.goto('/simpul-jaringan/tidak-ada');
  await expect(
    page.getByText('Simpul tidak ditemukan', { exact: true }),
  ).toBeVisible();
  await context.close();
});

test('Nuxt → Laravel hidup: tile gagal tetap menyediakan daftar serta profil tanpa pin', async ({
  page,
}) => {
  await page.route('**tile.openstreetmap.org/**', (route) => route.abort());
  await page.goto('/simpul-jaringan?data=excel&provinsi=36&kabKota=36.71');
  await expect(page.locator('.tile-error')).toContainText(
    'Peta dasar belum dapat dimuat',
  );
  await page.getByRole('button', { name: 'Daftar', exact: true }).click();
  await expect(page.locator('.results-description').first()).toContainText(
    '0 terpetakan',
  );
  await page
    .locator('[data-result-instansi-id]')
    .first()
    .getByRole('link')
    .click();
  await expect(page.locator('.profile-identity h1')).toBeVisible();
  await expect(page.locator('.statistic-item strong').first()).toContainText(
    'Belum tersedia',
  );
});

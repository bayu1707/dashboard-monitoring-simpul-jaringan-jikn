import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
const emptySnapshot = readFileSync(new URL('../../public/data/snapshot.json', import.meta.url), 'utf8');
const demoUrl = '/simpul-jaringan?demo=1';
const runtimeErrors = new WeakMap<Page, string[]>();
function trackRuntime(page: Page) {
  const errors: string[] = [];
  runtimeErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (
      message.type() === 'error' &&
      !message.text().includes('Failed to load resource')
    )
      errors.push(message.text());
  });
  return errors;
}
test.beforeEach(({ page }) => {
  trackRuntime(page);
});
test.afterEach(({ page }) => {
  expect(runtimeErrors.get(page)).toEqual([]);
});

async function openDemo(page: Page) {
  await page.goto(demoUrl);
  await expect(page.locator('.map-stage')).toHaveAttribute(
    'data-level',
    'nasional',
  );
}
async function chooseSerang(page: Page) {
  await page.locator('#desktop-province').selectOption('36');
  await page.locator('#desktop-kabkota').selectOption('36.73');
  await expect(page.locator('.map-stage')).toHaveAttribute(
    'data-level',
    'instansi',
  );
}
async function waitForMapMotion(page: Page) {
  // Marker dapat ada sebelum animasi zoom/pan Leaflet selesai.
  await expect(
    page.locator('.map-canvas.leaflet-zoom-anim, .map-canvas.leaflet-pan-anim'),
  ).toHaveCount(0);
}
async function unfoldClusters(page: Page) {
  for (let i = 0; i < 8; i++) {
    if (await page.locator('[data-instansi-id="demo-a"]').count()) break;
    const cluster = page.locator('.instansi-cluster').first();
    if (!(await cluster.count())) break;
    await cluster.click();
    await waitForMapMotion(page);
  }
  await waitForMapMotion(page);
  await expect(page.locator('[data-instansi-id="demo-a"]')).toBeVisible();
}
test('klik geometri Banten → Kota Serang → hover Semua Jenis → detail → kembali', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await openDemo(page);
  await page.locator('[data-region-id="36"]').click();
  await expect(page.locator('.map-stage')).toHaveAttribute(
    'data-level',
    'provinsi',
  );
  await expect(page.locator('#desktop-province')).toHaveValue('36');
  await expect(page.locator('[data-region-id="36.73"]')).toBeVisible();
  await page.locator('[data-region-id="36.73"]').click();
  await expect(page.locator('.map-stage')).toHaveAttribute(
    'data-level',
    'instansi',
  );
  await expect(page.locator('#desktop-kabkota')).toHaveValue('36.73');
  await expect(page.locator('#desktop-jenis')).toHaveValue('');
  await expect(page.locator('.map-navigation')).toContainText(
    '7 hasil · 6 terpetakan · 1 tanpa koordinat',
  );
  const beforeLayer = await page
    .locator('.map-stage')
    .getAttribute('data-level');
  await unfoldClusters(page);
  await expect(page.locator('.map-stage')).toHaveAttribute(
    'data-level',
    beforeLayer!,
  );
  await page.locator('[data-instansi-id="demo-a"]').hover();
  await expect(page.locator('.instansi-popup')).toContainText(
    'Instansi Demo A',
  );
  await expect(page.locator('.instansi-popup')).toContainText('DATA DEMO');
  await waitForMapMotion(page);
  await page.locator('.instansi-popup a').hover();
  await page.waitForTimeout(260);
  await expect(page.locator('.instansi-popup')).toBeVisible();
  await page.getByRole('link', { name: 'Lihat detail' }).click();
  const savedBefore = JSON.parse(
    await page.evaluate(
      () => sessionStorage.getItem('jikn-map-session-v1') ?? '{}',
    ),
  ) as { center: number[]; zoom: number };
  await expect(page).toHaveURL(/\/demo-a\?/);
  await expect(
    page.getByRole('heading', { name: 'Informasi Instansi' }),
  ).toBeVisible();
  await expect(page.getByRole('tab')).toHaveCount(0);
  await page
    .getByRole('link', { name: 'Kembali ke Peta', exact: true })
    .click();
  await expect(page.locator('.map-stage')).toHaveAttribute(
    'data-level',
    'instansi',
  );
  await expect(page.locator('#desktop-jenis')).toHaveValue('');
  const savedAfter = JSON.parse(
    await page.evaluate(
      () => sessionStorage.getItem('jikn-map-session-v1') ?? '{}',
    ),
  ) as { center: number[]; zoom: number };
  expect(savedAfter.zoom).toBe(savedBefore.zoom);
  savedAfter.center.forEach((n, i) =>
    expect(n).toBeCloseTo(savedBefore.center[i]!, 7),
  );
  await unfoldClusters(page);
  await page.screenshot({ path: 'tmp/qa/map-desktop.png' });
  expect(errors).toEqual([]);
});
test('scope change closes popup, daftar nullable, back satu tingkat dan browser back', async ({
  page,
}) => {
  await openDemo(page);
  await chooseSerang(page);
  await unfoldClusters(page);
  await page.locator('[data-instansi-id="demo-a"]').hover();
  await expect(page.locator('.instansi-popup')).toBeVisible();
  await page.getByRole('button', { name: 'Kembali ke Provinsi' }).click();
  await expect(page.locator('.map-stage')).toHaveAttribute(
    'data-level',
    'provinsi',
  );
  await expect(page.locator('.instansi-popup')).toHaveCount(0);
  await page.locator('#desktop-kabkota').selectOption('36.73');
  await page.getByRole('button', { name: 'Daftar', exact: true }).click();
  await expect(page.locator('.results-panel')).toContainText(
    '7 hasil · 6 terpetakan · 1 belum memiliki koordinat',
  );
  const row = page
    .locator('.result-item')
    .filter({ hasText: 'Instansi Demo C' });
  await row.getByRole('button', { name: 'Pratinjau profil' }).click();
  await expect(page.locator('.instansi-popup')).toContainText('Belum tersedia');
  await page.keyboard.press('Escape');
  await expect(page.locator('.instansi-popup')).toHaveCount(0);
  await row.getByRole('link').click();
  await expect(page).toHaveURL(/\/demo-c\?/);
  await expect(
    page.getByRole('heading', { name: 'Instansi Demo C' }),
  ).toBeVisible();
  await expect(page.locator('.statistic-item strong')).toContainText([
    'Belum tersedia',
    'Belum tersedia',
    'Belum tersedia',
  ]);
  await page.goBack();
  await expect(page.locator('.results-panel')).toBeVisible();
});
test('dataset bawaan kosong, ID asing, query invalid, JSON rusak dan retry sumber sama', async ({
  page,
}) => {
  let broken = false;
  // Skenario kosong harus tetap dapat diuji saat server lokal sedang mereview Excel.
  await page.route(/\/(?:data|local-data)\/snapshot\.json$/, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: broken ? '{rusak' : emptySnapshot,
  }));
  await page.goto('/simpul-jaringan?data=excel');
  await expect(
    page.getByRole('heading', { name: 'Data simpul belum dimuat' }),
  ).toBeVisible();
  await expect(page.locator('.instansi-marker')).toHaveCount(0);
  await page.goto('/simpul-jaringan/id-tidak-ada?demo=1');
  await expect(
    page.getByRole('heading', { name: 'Simpul tidak ditemukan' }),
  ).toBeVisible();
  await page.goto(
    '/simpul-jaringan?data=excel&provinsi=tidak-sah&kabKota=36.73&jenis=asing',
  );
  await expect(page.locator('.map-stage')).toHaveAttribute(
    'data-level',
    'nasional',
  );
  broken = true;
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Data belum dapat dimuat' }),
  ).toBeVisible();
  broken = false;
  await page.getByRole('button', { name: 'Coba lagi', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Data simpul belum dimuat' }),
  ).toBeVisible();
});
test('tile gagal tidak menghapus layer atau daftar', async ({ page }) => {
  await page.route('https://tile.openstreetmap.org/**', (route) =>
    route.abort(),
  );
  await openDemo(page);
  await chooseSerang(page);
  await expect(page.locator('.tile-error')).toContainText(
    'Peta dasar belum dapat dimuat',
  );
  await page.getByRole('button', { name: 'Daftar', exact: true }).click();
  await expect(page.locator('.results-panel')).toContainText('Instansi Demo C');
  await expect(page.locator('.map-navigation')).toContainText('6 terpetakan');
});
test('mobile 390 filter draft, tap wilayah, tap marker popup dan detail', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const mobileErrors = trackRuntime(page);
  await openDemo(page);
  await page.getByRole('button', { name: 'Filter', exact: true }).tap();
  await page.locator('#mobile-province').selectOption('36');
  await page.getByRole('button', { name: 'Batal', exact: true }).tap();
  await expect(page.locator('.map-stage')).toHaveAttribute(
    'data-level',
    'nasional',
  );
  await page.getByRole('button', { name: 'Filter', exact: true }).tap();
  await page.locator('#mobile-province').selectOption('36');
  await page.getByRole('button', { name: 'Terapkan', exact: true }).tap();
  await expect(page.locator('.map-stage')).toHaveAttribute(
    'data-level',
    'provinsi',
  );
  await page.locator('[data-region-id="36.73"]').tap();
  await expect(page.locator('.map-stage')).toHaveAttribute(
    'data-level',
    'instansi',
  );
  await unfoldClusters(page);
  await page.locator('[data-instansi-id="demo-a"]').tap();
  await expect(page.locator('.mobile-popup')).toContainText('Instansi Demo A');
  await page.screenshot({ path: 'tmp/qa/map-mobile.png' });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole('link', { name: 'Lihat detail' }).tap();
  await expect(page).toHaveURL(/\/demo-a\?/);
  await expect(page.locator('.detail-page')).toBeVisible();
  await expect(page.locator('.profile-identity h1')).toHaveText(
    'Instansi Demo A',
  );
  await page.screenshot({ path: 'tmp/qa/detail-mobile.png', fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole('link', { name: 'Kembali ke Peta', exact: true }).tap();
  await expect(page.locator('.map-stage')).toHaveAttribute(
    'data-level',
    'instansi',
  );
  await page.getByRole('button', { name: 'Filter', exact: true }).tap();
  await page.locator('#mobile-province').selectOption('11');
  await expect(page.locator('#mobile-kabkota')).toHaveValue('');
  await page.getByRole('button', { name: 'Reset', exact: true }).last().tap();
  await expect(page.locator('.map-stage')).toHaveAttribute(
    'data-level',
    'nasional',
  );
  expect(mobileErrors).toEqual([]);
  await context.close();
});
test('detail desktop, zero sah, 200 persen tanpa horizontal overflow', async ({
  page,
}) => {
  await page.goto('/simpul-jaringan/demo-b?demo=1');
  await expect(
    page.getByRole('heading', { name: 'Instansi Demo B' }),
  ).toBeVisible();
  await expect(page.locator('.statistic-item strong')).toContainText([
    '0',
    '0',
    '0',
  ]);
  await page.goto('/simpul-jaringan/demo-a?demo=1');
  await expect(
    page.getByRole('heading', { name: 'Instansi Demo A' }),
  ).toBeVisible();
  await page.screenshot({ path: 'tmp/qa/detail-desktop.png', fullPage: true });
  // Lebar CSS dibagi dua untuk menguji reflow setara zoom 200% pada layar 1440.
  await page.setViewportSize({ width: 720, height: 450 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.goto('/simpul-jaringan?demo=1&provinsi=36&kabKota=36.73');
  await expect(page.locator('.map-stage')).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
});

test('klik marker desktop, filter AND, hasil kosong, dan fallback batas wilayah', async ({
  page,
}) => {
  await openDemo(page);
  await chooseSerang(page);
  await unfoldClusters(page);
  await page.locator('[data-instansi-id="demo-b"]').click();
  await expect(page).toHaveURL(/\/demo-b\?/);
  await expect(page.locator('.profile-identity h1')).toHaveText(
    'Instansi Demo B',
  );
  await page
    .getByRole('link', { name: 'Kembali ke Peta', exact: true })
    .click();
  await page.locator('#desktop-jenis').selectOption('demo-pendidikan');
  await expect(page.locator('.map-stage')).toHaveAttribute(
    'data-level',
    'instansi',
  );
  await page.getByRole('button', { name: 'Daftar', exact: true }).click();
  await expect(page.locator('.results-panel')).toContainText('Instansi Demo B');
  await expect(page.locator('.results-panel')).not.toContainText(
    'Instansi Demo A',
  );
  await page.locator('#desktop-kabkota').selectOption('36.74');
  await expect(page.locator('#desktop-jenis')).toHaveValue('');
  await expect(
    page.getByRole('heading', { name: 'Hasil filter kosong' }),
  ).toBeVisible();
  await page.locator('#desktop-province').selectOption('11');
  await expect(page.locator('.map-stage')).toHaveAttribute(
    'data-level',
    'provinsi',
  );
  await expect(page.locator('.map-viewport-note')).toContainText(
    'Posisi peta dipertahankan',
  );
  await expect(page.locator('#desktop-kabkota')).toHaveValue('');
});

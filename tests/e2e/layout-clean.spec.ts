import { useFixtureTiles } from './tileFixture';
import { test, expect, type Locator, type Page } from '@playwright/test';
test.beforeEach(async ({ page }) => useFixtureTiles(page));

async function verifyTarget(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box, 'Kontrol harus terlihat dan memiliki area klik').not.toBeNull();
  expect(box!.width, 'Lebar target minimal 44 px').toBeGreaterThanOrEqual(44);
  expect(box!.height, 'Tinggi target minimal 44 px').toBeGreaterThanOrEqual(44);
  expect(
    await locator.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      const hit = document.elementFromPoint(
        bounds.x + bounds.width / 2,
        bounds.y + bounds.height / 2,
      );
      return hit !== null && (hit === element || element.contains(hit));
    }),
    'Pusat kontrol tidak boleh tertutup elemen lain',
  ).toBe(true);
}
async function verifyNoOverflow(page: Page) {
  expect(
    await page.evaluate(() => ({
      page: document.documentElement.scrollWidth <= window.innerWidth,
      header: (() => {
        const header = document.querySelector<HTMLElement>('.site-header');
        return !!header && header.scrollWidth <= header.clientWidth;
      })(),
    })),
  ).toEqual({ page: true, header: true });
}
async function openNational(page: Page) {
  await page.goto('/simpul-jaringan?demo=1');
  await expect(page.locator('.map-stage')).toHaveAttribute(
    'data-level',
    'nasional',
  );
}
async function captureMap(page: Page, path: string) {
  // Tile publik dapat lambat; batas tunggu hanya untuk gambar QA, bukan syarat kelulusan interaksi.
  await page
    .waitForFunction(
      () => {
        const tiles = [
          ...document.querySelectorAll<HTMLImageElement>('.leaflet-tile'),
        ];
        return (
          tiles.length > 0 &&
          tiles.every(
            (tile) => tile.complete && getComputedStyle(tile).opacity === '1',
          )
        );
      },
      undefined,
      { timeout: 6000 },
    )
    .catch(() => {});
  await page.screenshot({ path });
}

// Ukuran dan interaksi browser melindungi ruang peta, bukan struktur CSS tertentu.
test('desktop 1440: toolbar satu baris ringkas, label aksesibel, dan daftar bekerja melalui keyboard', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openNational(page);
  const toolbar = page.locator('.map-toolbar');
  const toolbarBounds = await toolbar.boundingBox();
  expect(
    toolbarBounds!.height,
    'Toolbar tidak menjadi kartu besar di atas peta',
  ).toBeLessThanOrEqual(56);
  const fields = [
    page.getByRole('combobox', { name: 'Provinsi', exact: true }),
    page.getByRole('combobox', { name: 'Kabupaten / Kota', exact: true }),
    page.getByRole('combobox', { name: 'Jenis Instansi', exact: true }),
  ];
  const bounds = await Promise.all(fields.map((field) => field.boundingBox()));
  expect(bounds).not.toContain(null);
  expect(
    Math.max(...bounds.map((box) => box!.y)) -
      Math.min(...bounds.map((box) => box!.y)),
    'Tiga dropdown tetap sebaris',
  ).toBeLessThanOrEqual(1);
  for (let index = 0; index < fields.length; index++) {
    await verifyTarget(fields[index]!);
    if (index > 0)
      expect(bounds[index]!.x).toBeGreaterThanOrEqual(
        bounds[index - 1]!.x + bounds[index - 1]!.width,
      );
  }
  const navigation = page.locator('.map-navigation');
  if (await navigation.isVisible()) {
    const navigationBounds = await navigation.boundingBox();
    expect(
      navigationBounds!.height,
      'Petunjuk nasional tetap ringkas',
    ).toBeLessThanOrEqual(56);
    expect(navigationBounds!.y).toBeGreaterThanOrEqual(
      toolbarBounds!.y + toolbarBounds!.height,
    );
  }
  await verifyNoOverflow(page);
  await verifyTarget(
    page.getByRole('button', { name: 'Reset seluruh filter' }),
  );
  const listButton = page.getByRole('button', { name: 'Daftar', exact: true });
  await verifyTarget(listButton);
  await captureMap(page, 'tmp/qa/ui-clean-desktop.png');

  await fields[0]!.selectOption('36');
  await fields[1]!.selectOption('36.73');
  await expect(fields[2]!).toHaveValue('');
  await expect(page.locator('.map-stage')).toHaveAttribute(
    'data-level',
    'instansi',
  );
  await listButton.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(listButton).toBeFocused();
  expect(
    await listButton.evaluate((element) =>
      parseFloat(getComputedStyle(element).outlineWidth),
    ),
    'Fokus keyboard tetap terlihat',
  ).toBeGreaterThanOrEqual(2);
  await page.keyboard.press('Enter');
  const list = page.getByRole('complementary', { name: 'Daftar instansi' });
  await expect(list).toContainText(
    '7 hasil · 6 terpetakan · 1 belum memiliki koordinat',
  );
  const detailLink = list.getByRole('link', {
    name: 'Instansi Demo C',
    exact: true,
  });
  await detailLink.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/simpul-jaringan\/demo-c\?/);
  await expect(
    page.getByRole('heading', { name: 'Instansi Demo C', exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test('mobile 390: header dan kontrol tidak meluber, filter berurutan dapat diterapkan dan daftar tetap terjangkau', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await openNational(page);
    await verifyNoOverflow(page);
    await expect(page.getByRole('combobox')).toHaveCount(0);
    const filterButton = page.getByRole('button', {
      name: 'Filter',
      exact: true,
    });
    const listButton = page.getByRole('button', {
      name: 'Daftar',
      exact: true,
    });
    for (const control of [
      filterButton,
      listButton,
      page.getByRole('button', { name: 'Reset seluruh filter' }),
    ])
      await verifyTarget(control);
    await filterButton.tap();
    const sheet = page.getByRole('dialog', { name: 'Filter wilayah' });
    const province = sheet.getByRole('combobox', {
      name: 'Provinsi',
      exact: true,
    });
    const kabKota = sheet.getByRole('combobox', {
      name: 'Kabupaten / Kota',
      exact: true,
    });
    const jenis = sheet.getByRole('combobox', {
      name: 'Jenis Instansi',
      exact: true,
    });
    await expect(kabKota).toBeDisabled();
    await expect(jenis).toBeDisabled();
    await province.selectOption('36');
    await kabKota.selectOption('36.73');
    await expect(jenis).toHaveValue('');
    const boxes = await Promise.all(
      [province, kabKota, jenis].map((field) => field.boundingBox()),
    );
    expect(boxes[1]!.y).toBeGreaterThanOrEqual(boxes[0]!.y + boxes[0]!.height);
    expect(boxes[2]!.y).toBeGreaterThanOrEqual(boxes[1]!.y + boxes[1]!.height);
    await verifyTarget(
      sheet.getByRole('button', { name: 'Terapkan', exact: true }),
    );
    await sheet.getByRole('button', { name: 'Terapkan', exact: true }).tap();
    await expect(sheet).not.toBeVisible();
    await expect(page.locator('.map-stage')).toHaveAttribute(
      'data-level',
      'instansi',
    );
    await verifyNoOverflow(page);
    await verifyTarget(listButton);
    await captureMap(page, 'tmp/qa/ui-clean-mobile.png');
    await listButton.tap();
    const list = page.getByRole('complementary', { name: 'Daftar instansi' });
    await expect(list).toContainText('Instansi Demo C');
    await verifyNoOverflow(page);
    await verifyTarget(list.getByRole('button', { name: 'Tutup daftar' }));
    await list.getByRole('button', { name: 'Tutup daftar' }).tap();
    await verifyTarget(
      page.getByRole('button', { name: 'Kembali ke Provinsi', exact: true }),
    );
    await page
      .getByRole('button', { name: 'Kembali ke Provinsi', exact: true })
      .tap();
    await expect(page.locator('.map-stage')).toHaveAttribute(
      'data-level',
      'provinsi',
    );
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

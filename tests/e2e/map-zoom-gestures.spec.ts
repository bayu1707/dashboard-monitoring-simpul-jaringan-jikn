import { expect, test, type Page } from '@playwright/test';

const readZoom = (page: Page) => page.evaluate(() =>
  (JSON.parse(sessionStorage.getItem('jikn-map-session-v1') ?? '{}') as { zoom: number }).zoom);
const pageSize = (page: Page) => page.evaluate(() => ({
  width: innerWidth, dpr: devicePixelRatio, scale: visualViewport?.scale ?? 1,
}));
const errors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
  const list: string[] = [];
  errors.set(page, list);
  page.on('pageerror', (error) => list.push(error.message));
});
test.afterEach(({ page }) => expect(errors.get(page)).toEqual([]));

for (const [level, query] of [
  ['nasional', '?demo=1'],
  ['provinsi', '?provinsi=36&demo=1'],
  ['instansi', '?provinsi=36&kabKota=36.73&demo=1'],
]) {
  test(`event pinch ${level}: default browser dibatalkan dan peta yang membesar`, async ({ page }) => {
    await page.goto(`/simpul-jaringan${query}`);
    await expect(page.locator('.map-stage')).toHaveAttribute('data-level', level!);
    const before = await readZoom(page);
    const size = await pageSize(page);
    const prevented = await page.locator('.map-canvas').evaluate((canvas) => {
      const box = canvas.getBoundingClientRect();
      const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, ctrlKey: true,
        deltaY: -240, clientX: box.x + box.width / 2, clientY: box.y + box.height * 0.6 });
      canvas.dispatchEvent(event);
      return event.defaultPrevented;
    });
    expect(prevented).toBe(true);
    await expect.poll(() => readZoom(page)).toBe(before + 0.5);
    expect(await pageSize(page)).toEqual(size);
    await expect(page.locator('.map-stage')).toHaveAttribute('data-level', level!);
  });
}

test('Ctrl+wheel lewat input browser di peta mengubah zoom peta, ukuran halaman tetap', async ({ page }, testInfo) => {
  await page.goto('/simpul-jaringan?demo=1');
  await expect(page.locator('.map-stage')).toBeVisible();
  const before = await readZoom(page);
  const size = await pageSize(page);
  const map = (await page.locator('.map-canvas').boundingBox())!;
  await page.mouse.move(map.x + map.width * 0.6, map.y + map.height * 0.7);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -240);
  await page.keyboard.up('Control');
  await expect.poll(() => readZoom(page)).toBe(before + 0.5);
  expect(await pageSize(page)).toEqual(size);
  await page.screenshot({ path: testInfo.outputPath('pinch-peta-desktop.png') });
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, 240);
  await page.keyboard.up('Control');
  await expect.poll(() => readZoom(page)).toBe(before);
  expect(await pageSize(page)).toEqual(size);
});

test('Cmd/Ctrl +/- saat fokus peta ditangani peta; shortcut di luar peta tidak dicegat', async ({ page }) => {
  await page.goto('/simpul-jaringan?demo=1');
  await expect(page.locator('.map-stage')).toBeVisible();
  const before = await readZoom(page);
  const size = await pageSize(page);
  for (const modifier of ['Meta', 'Control']) {
    await page.locator('.map-canvas').focus();
    await page.keyboard.press(`${modifier}+=`);
    await expect.poll(() => readZoom(page)).toBe(before + 0.5);
    await page.keyboard.press(`${modifier}+-`);
    await expect.poll(() => readZoom(page)).toBe(before);
    expect(await pageSize(page)).toEqual(size);
  }
  const intercepted = await page.locator('.site-header').evaluate((header) => {
    const event = new KeyboardEvent('keydown', { key: '+', ctrlKey: true, bubbles: true, cancelable: true });
    header.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(intercepted).toBe(false);
  expect(await readZoom(page)).toBe(before);
});

test('pinch di kontrol peta dibatalkan sebelum kontrol menghentikan bubbling', async ({ page }) => {
  await page.goto('/simpul-jaringan?demo=1');
  await expect(page.locator('.map-stage')).toBeVisible();
  const before = await readZoom(page);
  const prevented = await page.getByTitle('Perbesar peta', { exact: true }).evaluate((button) => {
    const box = button.getBoundingClientRect();
    const event = new WheelEvent('wheel', { ctrlKey: true, deltaY: -240, clientX: box.x, clientY: box.y,
      bubbles: true, cancelable: true });
    button.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(prevented).toBe(true);
  await expect.poll(() => readZoom(page)).toBe(before + 0.5);
});

test('konten popup masih dapat discroll; pinch di popup ditangani peta', async ({ page }) => {
  await page.goto('/simpul-jaringan?demo=1&provinsi=36&kabKota=36.73');
  await page.locator('#desktop-jenis').selectOption('demo-lainnya');
  await page.locator('[data-instansi-id="demo-f"]').hover();
  const popup = page.locator('.leaflet-popup .instansi-popup');
  await expect(popup).toBeVisible();
  await popup.hover();
  const before = await readZoom(page);
  const result = await popup.evaluate((element) => [false, true].map((ctrlKey) => {
    const box = element.getBoundingClientRect();
    const event = new WheelEvent('wheel', { ctrlKey, deltaY: -240, clientX: box.x + box.width / 2,
      clientY: box.y + box.height / 2, bubbles: true, cancelable: true });
    element.dispatchEvent(event);
    return event.defaultPrevented;
  }));
  expect(result).toEqual([false, true]);
  await expect.poll(() => readZoom(page)).toBe(before + 0.5);
});

test('mobile 390: pinch dua jari tetap memakai TouchZoom Leaflet dan tidak memperbesar halaman', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const mobileErrors: string[] = [];
  page.on('pageerror', (error) => mobileErrors.push(error.message));
  try {
    await page.goto('/simpul-jaringan?demo=1');
    await expect(page.locator('.map-stage')).toBeVisible();
    const before = await readZoom(page);
    const size = await pageSize(page);
    const box = (await page.locator('.map-canvas').boundingBox())!;
    const center = { x: box.x + box.width / 2, y: box.y + box.height * 0.65 };
    const input = await context.newCDPSession(page);
    const fingers = (distance: number) => [
      { x: center.x - distance, y: center.y, id: 1 },
      { x: center.x + distance, y: center.y, id: 2 },
    ];
    await input.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: fingers(30) });
    for (let step = 1; step <= 8; step++) {
      await input.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: fingers(30 + step * 7) });
      await page.waitForTimeout(20);
    }
    await input.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(() => readZoom(page)).toBeGreaterThan(before);
    expect(await pageSize(page)).toEqual(size);
    await page.screenshot({ path: testInfo.outputPath('pinch-peta-mobile-390.png') });
    expect(mobileErrors).toEqual([]);
  } finally {
    await context.close();
  }
});

test('gesture Safari ditangani secara lokal; handler tidak tersisa setelah membuka detail', async ({ page }) => {
  await page.goto('/simpul-jaringan?demo=1&provinsi=36&kabKota=36.73');
  await expect(page.locator('.map-stage')).toHaveAttribute('data-level', 'instansi');
  const before = await readZoom(page);
  const size = await pageSize(page);
  // Chromium tidak mengeluarkan GestureEvent WebKit asli; uji kontrak handler menggunakan event sintetis.
  const prevented = await page.locator('.map-canvas').evaluate((canvas) => ['gesturestart', 'gesturechange', 'gestureend'].map((type) => {
    const box = canvas.getBoundingClientRect();
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.assign(event, { scale: type === 'gesturestart' ? 1 : 2, clientX: box.x + box.width / 2,
      clientY: box.y + box.height / 2 });
    canvas.dispatchEvent(event);
    return event.defaultPrevented;
  }));
  expect(prevented).toEqual([true, true, true]);
  await expect.poll(() => readZoom(page)).toBe(before + 0.5);
  expect(await pageSize(page)).toEqual(size);
  await page.getByRole('button', { name: 'Daftar', exact: true }).click();
  await page.locator('.result-item').first().getByRole('link').click();
  await expect(page.locator('.profile-identity h1')).toBeVisible();
  const detailPrevented = await page.locator('main').evaluate((main) => {
    const event = new Event('gesturestart', { bubbles: true, cancelable: true });
    main.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(detailPrevented).toBe(false);
});

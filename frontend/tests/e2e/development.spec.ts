import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { SnapshotData } from '../../app/types/domain';
import { useFixtureTiles } from './tileFixture';
import { waitForMapMotion } from './apiFixture';

test.skip(process.env.JIKN_DEV_E2E !== '1', 'Memerlukan PostgreSQL development lokal.');
const source = JSON.parse(readFileSync('../public/data/datasets/pilot/snapshot.json', 'utf8')) as SnapshotData;
const office = source.instansi.find(r => r.kabKotaId === '36.73' && r.coordinates)!;
const stamp = Date.now().toString(36);
const name = `Simpul Uji Serang ${stamp}`;
type Row = { id: string; name: string; external_id: string; version: number };

async function openEditor(page: Page) {
  await page.goto('/pengujian?data=dev');
  await expect(page.locator('[name="externalId"]')).toBeVisible();
}
async function fill(page: Page, id: string, title: string, city = '36.73', withCoordinates = true) {
  await page.locator('[name="externalSource"]').fill('browser-test');
  await page.locator('[name="externalId"]').fill(id);
  await page.locator('[name="name"]').fill(title);
  await page.locator('[name="provinceId"]').selectOption('36');
  await page.locator('[name="kabKotaId"]').selectOption(city);
  await page.locator('[name="address"]').fill('Alamat publik simulasi di Serang, Banten. DATA UJI, bukan kantor instansi baru.');
  await page.locator('[name="email"]').fill('office@example.invalid');
  await page.locator('[name="phone"]').fill('0215550100');
  await page.locator('[name="joinedYear"]').fill('2020');
  if (withCoordinates) {
    await page.locator('[name="latitude"]').fill(String(office.coordinates![0]));
    await page.locator('[name="longitude"]').fill(String(office.coordinates![1]));
    await page.locator('[name="coordinateSource"]').fill(office.coordinateSource!);
    await page.locator('[name="coordinateConfirmed"]').check();
  }
}
function payload(row: Row, title: string) {
  return { externalSource: 'browser-test', externalId: row.external_id, name: title, provinceId: '36', kabKotaId: '36.73',
    address: 'Alamat publik simulasi di Serang. DATA UJI.', latitude: office.coordinates![0] + 0.0001, longitude: office.coordinates![1] + 0.0001,
    joinedYear: 2020, email: 'updated@example.invalid', phone: '+62 (21) 555-0101', landingPageUrl: null, landingVerified: false, coordinateSource: office.coordinateSource!, coordinateConfirmed: true, tryGeocoding: false, version: row.version };
}

test('Data uji PostgreSQL: tambah → marker/popup → edit otomatis → persist refresh → duplikat/sync', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await useFixtureTiles(page);
  await openEditor(page);
  await fill(page, `serang-${stamp}`, name);
  await page.getByRole('button', { name: 'Simpan instansi uji', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Instansi uji tersimpan.');
  const response = await page.request.get('/api/development/institutions');
  const records = await response.json() as { data: Row[] };
  const row = records.data.find(r => r.name === name)!;
  expect(row).toBeTruthy();
  await page.goto('/simpul-jaringan?data=dev&provinsi=36&kabKota=36.73');
  const search = page.getByRole('combobox', { name: 'Cari instansi seluruh wilayah' });
  await search.fill(name);
  await expect(page.locator('.global-search').getByRole('option').filter({ hasText: name })).toHaveCount(1);
  await search.press('Enter');
  await expect(page.locator(`[data-instansi-id="dev-${row.id}"]`)).toBeVisible();
  await waitForMapMotion(page);
  await page.locator(`[data-instansi-id="dev-${row.id}"]`).hover();
  const popup = page.locator('.leaflet-popup .instansi-popup');
  await expect(popup.getByRole('heading')).toHaveText(name);
  await expect(popup).toContainText('2020');
  await expect(popup).toContainText('Belum tersedia');
  const changed = name + ' Diperbarui';
  const edit = await page.request.put(`/api/development/institutions/${row.id}`, { headers: { Origin: 'http://127.0.0.1:3000' }, data: payload(row, changed) });
  expect(edit.status()).toBe(200);
  // Tidak menavigasi atau me-refresh: polling revisi harus mengganti data popup.
  await expect(popup.getByRole('heading')).toHaveText(changed, { timeout: 15000 });
  await page.screenshot({ path: info.outputPath('marker-data-uji-diperbarui.png') });
  await popup.getByRole('link', { name: 'Lihat detail' }).click();
  await expect(page.locator('.profile-identity h1')).toHaveText(changed);
  await page.reload();
  await expect(page.locator('.profile-identity h1')).toHaveText(changed);
  await expect(page.locator('.profile-fields')).toContainText('2020');
  await expect(page.locator('.profile-fields').getByRole('link', { name: 'updated@example.invalid' })).toHaveAttribute('href', 'mailto:updated%40example.invalid');
  await expect(page.locator('.profile-fields').getByRole('link', { name: '+62 (21) 555-0101' })).toHaveAttribute('href', 'tel:+62215550101');
  await expect(page.locator('.contact-source')).toContainText('DATA UJI');
  await page.screenshot({ path: info.outputPath('detail-kontak-data-uji.png') });
  const duplicate = await page.request.post('/api/development/institutions', { headers: { Origin: 'http://127.0.0.1:3000' }, data: payload(row, changed) });
  expect(duplicate.status()).toBe(409);
  const sync = await page.request.post('/api/development/institutions/sync', { headers: { Origin: 'http://127.0.0.1:3000' }, data: payload(row, changed) });
  expect(sync.status()).toBe(200);
  expect((await sync.json() as { data: Row }).data.id).toBe(row.id);
  expect(errors).toEqual([]);
});

test('Wilayah uji baru tanpa polygon: instansi berkoordinat dan instansi tanpa pin tetap dapat dicari', async ({ page }) => {
  await useFixtureTiles(page);
  await openEditor(page);
  await page.locator('[name="regionProvince"]').selectOption('36');
  await page.locator('[name="regionId"]').fill('36.99');
  await page.locator('[name="regionName"]').fill('Kabupaten Pengujian Lokal');
  const exists = await page.request.get('/api/development/regions');
  const known = await exists.json() as { data: Array<{ id: string }> };
  if (!known.data.some(r => r.id === '36.99')) {
    await page.getByRole('button', { name: 'Simpan wilayah uji', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Wilayah uji tersimpan');
  }
  await fill(page, `new-region-${stamp}`, `Simpul Uji Wilayah Baru ${stamp}`, '36.99');
  await page.getByRole('button', { name: 'Simpan instansi uji', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Instansi uji tersimpan.');
  await page.getByRole('button', { name: 'Form baru', exact: true }).click();
  await fill(page, `no-pin-${stamp}`, `Simpul Uji Tanpa Pin ${stamp}`, '36.99', false);
  await page.locator('[name="tryGeocoding"]').check();
  await page.getByRole('button', { name: 'Simpan instansi uji', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Instansi uji tersimpan.');
  await page.goto('/simpul-jaringan?data=dev&provinsi=36&kabKota=36.99');
  await expect(page.locator('#desktop-kabkota')).toHaveValue('36.99');
  await expect(page.locator('.map-navigation')).toContainText('tanpa koordinat');
  const search = page.getByRole('combobox', { name: 'Cari instansi seluruh wilayah' });
  await search.fill(`Simpul Uji Tanpa Pin ${stamp}`);
  await expect(page.locator('.global-search').getByRole('option')).toHaveCount(1);
  await search.press('Enter');
  // Alur existing membuka detail langsung ketika koordinat tidak tersedia.
  await expect(page.locator('.profile-identity h1')).toHaveText(`Simpul Uji Tanpa Pin ${stamp}`);
});

test('Pengamanan proxy, token privat dan manager development hanya untuk localhost', async ({ page, request }) => {
  const denied = await request.post('/api/development/regions', { data: { id: '97', name: 'Tidak boleh tersimpan', level: 'province' } });
  expect(denied.status()).toBe(403);
  const direct = await request.post('http://127.0.0.1:8000/api/v1/development/regions', { data: { id: '97', name: 'Tidak boleh tersimpan', level: 'province' } });
  expect(direct.status()).toBe(403);
  await openEditor(page);
  const html = await page.content();
  expect(html.includes('apiToken')).toBe(false);
  expect(html.includes('credentialFile')).toBe(false);
});

test('Form pengujian 390px tidak melebar keluar layar dan tetap dapat digunakan', async ({ browser }, info) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await openEditor(page);
  await expect(page.locator('[name="name"]')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('form-data-uji-mobile.png') });
  await context.close();
});

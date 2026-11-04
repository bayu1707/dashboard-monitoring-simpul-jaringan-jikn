import { expect, test } from '@playwright/test';
import type { InstansiDetail } from '../../app/types/domain';
import { useFixtureTiles } from './tileFixture';
import { waitForMapMotion } from './apiFixture';

// Opt-in: CI/clone tidak membutuhkan salinan database privat atau SSD pengguna.
test.skip(process.env.SIKN_LOCAL_TEST !== '1', 'Memerlukan salinan SIKN lokal baca-saja.');
const id = 'casefile-94a1000a341b5162a0f21d7a';

test('SIKN nyata → Laravel → Nuxt: pencarian, popup, detail dan kembali mempertahankan sumber', async ({ page, request }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const response = await request.get(`http://127.0.0.1:8000/api/v1/institutions/${id}?mode=sikn`);
  expect(response.ok()).toBe(true);
  const { data: detail } = await response.json() as { data: InstansiDetail };
  expect(detail.metadata.datasetKind).toBe('database');
  expect(detail.statistik.jumlahArsip.value).toBeGreaterThan(0);
  expect(detail.trenInput).toBeNull();
  await useFixtureTiles(page);
  await page.goto('/simpul-jaringan?data=sikn');
  await expect(page.locator('.map-canvas.leaflet-container')).toBeVisible();
  await expect(page.getByText('UJI DATABASE LOKAL', { exact: true })).toBeVisible();
  await expect(page.locator('.snapshot-note')).toContainText('Database SIKN Maret 2026');
  const input = page.getByRole('combobox', { name: 'Cari instansi seluruh wilayah' });
  await input.fill('Arsip Nasional RI');
  await expect(page.getByRole('option').filter({ hasText: 'Arsip Nasional RI' })).toHaveCount(1);
  await input.press('Enter');
  const popup = page.locator('.leaflet-popup .instansi-popup');
  await expect(popup.getByRole('heading')).toHaveText('Arsip Nasional RI');
  await waitForMapMotion(page);
  await expect(popup).toContainText(new Intl.NumberFormat('id-ID').format(detail.statistik.jumlahArsip.value!));
  await expect(popup).toContainText('2015');
  const marker = page.locator(`[data-instansi-id="${id}"]`);
  // Re-hover memakai marker yang sesungguhnya, tanpa mock API.
  await marker.hover();
  await popup.getByRole('link', { name: 'Lihat detail' }).hover();
  await expect(popup).toBeVisible();
  await expect(popup.getByRole('link', { name: /Landing Page/ })).toHaveAttribute('href', detail.instansi.landingPageUrl!);
  await page.screenshot({ path: info.outputPath('sikn-database-popup.png') });
  await popup.getByRole('link', { name: 'Lihat detail' }).click();
  await expect(page).toHaveURL(/data=sikn/);
  await expect(page.locator('.profile-identity h1')).toHaveText('Arsip Nasional RI');
  await expect(page.locator('.contact-source')).toContainText('Maret 2026');
  await expect(page.locator('.contact-source')).toContainText('Belum dikonfirmasi');
  for (const field of ['email', 'phone'] as const) {
    const value = detail.instansi[field];
    const row = page.locator('.profile-fields > div').filter({ hasText: field === 'email' ? 'Email instansi' : 'Telepon instansi' });
    if (value !== null) {
      await expect(row).toContainText(value);
      const link = row.getByRole('link');
      await expect(link).toHaveAttribute('href', field === 'email' ? `mailto:${encodeURIComponent(value)}` : `tel:${value.replace(/[\s().-]/g, '')}`);
      await link.focus();
      await expect(link).toBeFocused();
    } else {
      await expect(row).toContainText('Belum tersedia');
      await expect(row.getByRole('link')).toHaveCount(0);
    }
  }
  await page.screenshot({ path: '../.local/qa/contacts/detail-kontak-sikn.png' });
  await expect(page.locator('.statistic-item strong').first()).toHaveText(new Intl.NumberFormat('id-ID').format(detail.statistik.jumlahArsip.value!));
  await expect(page.locator('.detail-snapshot-label')).toContainText('DATABASE SIKN MARET 2026');
  await page.getByRole('link', { name: 'Kembali ke Peta', exact: true }).click();
  await expect(page).toHaveURL(/data=sikn/);
  await expect(page.locator('#desktop-province')).toHaveValue('31');
  await expect(page.locator('#desktop-kabkota')).toHaveValue('31.74');
  await page.getByRole('button', { name: 'Reset seluruh filter', exact: true }).click();
  await expect(page).toHaveURL(/data=sikn/);
  await expect(page.locator('.map-stage')).toHaveAttribute('data-level', 'nasional');
  expect(errors).toEqual([]);
});

test('SIKN nyata: detail mobile 390px tetap menampilkan nilai database dan kembali ke sumber yang sama', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await useFixtureTiles(page);
  await page.goto(`/simpul-jaringan/${id}?data=sikn`);
  await expect(page.locator('.profile-identity h1')).toHaveText('Arsip Nasional RI');
  await expect(page.locator('.statistic-item strong').first()).not.toContainText('Belum tersedia');
  await expect(page.locator('.contact-source')).toContainText('Maret 2026');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('link', { name: 'Kembali ke Peta', exact: true }).tap();
  await expect(page).toHaveURL(/data=sikn/);
  await expect(page.locator('.map-canvas.leaflet-container')).toBeVisible();
  await context.close();
});

test('Kontak SIKN nyata: email dan telepon sesuai record detail, dapat difokuskan, serta berlabel belum diverifikasi publik', async ({ page, request }) => {
  const contactId = 'casefile-002685f875ec6bbaa876b2d4';
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const response = await request.get(`http://127.0.0.1:8000/api/v1/institutions/${contactId}?mode=sikn`);
  expect(response.ok()).toBe(true);
  const { data: detail } = await response.json() as { data: InstansiDetail };
  expect(detail.instansi.email).not.toBeNull();
  expect(detail.instansi.phone).not.toBeNull();
  await page.goto(`/simpul-jaringan/${contactId}?data=sikn`);
  await expect(page.locator('.profile-identity h1')).toHaveText(detail.instansi.name);
  const profile = page.locator('.profile-fields');
  const email = profile.getByRole('link', { name: detail.instansi.email!, exact: true });
  const phone = profile.getByRole('link', { name: detail.instansi.phone!, exact: true });
  await expect(email).toHaveAttribute('href', `mailto:${encodeURIComponent(detail.instansi.email!)}`);
  await expect(phone).toHaveAttribute('href', `tel:${detail.instansi.phone!.replace(/[\s().-]/g, '')}`);
  await email.focus(); await expect(email).toBeFocused();
  await phone.focus(); await expect(phone).toBeFocused();
  await expect(page.locator('.contact-source')).toContainText('Belum dikonfirmasi sebagai kontak publik');
  await page.screenshot({ path: '../.local/qa/contacts/detail-kontak-sikn.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(email).toBeVisible(); await expect(phone).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

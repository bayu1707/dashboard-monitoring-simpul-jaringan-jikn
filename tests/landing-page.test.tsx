import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { InstansiPopup } from '../src/components/map/InstansiPopup';
import { ProfileCard } from '../src/components/instansi/ProfileCard';
import { applyLandingPageMappings, safeLandingPageUrl, verifiedLandingPageUrl } from '../src/services/landingPage';
import type { InstansiDetail } from '../src/types/domain';
import { makeFixture } from './fixtures/data';

// UUID berikut hanya fixture sintetik, tidak pernah dimasukkan ke data publik.
const url = 'https://jikn.anri.go.id/deskripsi-arsip/sj/00000000-0000-4000-8000-000000000001';
const now = new Date('2026-10-14T10:00:00+07:00');
function fixtureMapping() {
  const { snapshot } = makeFixture();
  const instansi = snapshot.instansi[0]!;
  const mapping = {
    instansiId: instansi.id,
    expectedName: instansi.name,
    landingPageUrl: url,
    landingPageSource: 'Fixture sintetis untuk pengujian, bukan URL ANRI terverifikasi',
    landingPageVerificationStatus: 'verified' as const,
    landingPageVerifiedAt: '2026-10-14T09:00:00+07:00',
  };
  return { snapshot, instansi, mapping };
}
function detailFixture(): InstansiDetail {
  const { snapshot, instansi } = fixtureMapping();
  const statistics = snapshot.statistics.find((item) => item.instansiId === instansi.id)!;
  return { ...statistics, instansi, metadata: snapshot.metadata };
}
afterEach(cleanup);

describe('Pemetaan Landing Page berdasarkan ID stabil', () => {
  it('menggabungkan hasil verifikasi tanpa mengubah snapshot sumber atau tahun Excel', () => {
    const { snapshot, instansi, mapping } = fixtureMapping();
    const result = applyLandingPageMappings(snapshot, [mapping], now);
    expect(verifiedLandingPageUrl(result.instansi[0]!)).toBe(url);
    expect(instansi.landingPageUrl).toBeUndefined();
    expect(result.instansi[0]!.joinedYear).toBe(instansi.joinedYear);
    expect(result.statistics).toEqual(snapshot.statistics);
    const reordered = { ...snapshot, instansi: [...snapshot.instansi].reverse() };
    const resultReordered = applyLandingPageMappings(reordered, [mapping], now);
    expect(resultReordered.instansi.find((item) => item.id === instansi.id)?.landingPageUrl).toBe(url);
  });

  it.each([
    ['ID asing', { instansiId: 'tidak-ditemukan' }],
    ['nama berbeda', { expectedName: 'Instansi Demo Salah' }],
    ['sumber kosong', { landingPageSource: '' }],
    ['belum diverifikasi', { landingPageVerificationStatus: 'needs-review' }],
    ['tanpa zona waktu', { landingPageVerifiedAt: '2026-10-14T08:00:00' }],
    ['tanggal tak sah', { landingPageVerifiedAt: '2026-02-30T08:00:00+07:00' }],
    ['waktu masa depan', { landingPageVerifiedAt: '2027-10-14T08:00:00+07:00' }],
  ])('menolak %s', (_description, override) => {
    const { snapshot, mapping } = fixtureMapping();
    expect(() => applyLandingPageMappings(snapshot, [{ ...mapping, ...override }], now)).toThrow();
  });

  it('menolak ID duplikat dan URL yang disalin ke instansi lain, termasuk URL sebelumnya', () => {
    const { snapshot, mapping } = fixtureMapping();
    expect(() => applyLandingPageMappings(snapshot, [mapping, mapping], now)).toThrow(/duplikasi ID/);
    const second = { ...mapping, instansiId: snapshot.instansi[1]!.id, expectedName: snapshot.instansi[1]!.name };
    expect(() => applyLandingPageMappings(snapshot, [mapping, second], now)).toThrow(/URL yang sama/);
    const mapped = applyLandingPageMappings(snapshot, [mapping], now);
    expect(() => applyLandingPageMappings(mapped, [second], now)).toThrow(/URL yang sama/);
  });

  it.each([
    url.replace('https:', 'http:'),
    url.replace('jikn.anri.go.id', 'jikn.anri.go.id.example.com'),
    url.replace('jikn.anri.go.id', 'user:password@jikn.anri.go.id'),
    url.replace('jikn.anri.go.id', 'jikn.anri.go.id:8443'),
    `${url}?redirect=evil`, `${url}#fragment`, `${url}/`, ` ${url}`,
    url.replace('00000000-0000-4000-8000-000000000001', '31025-1'),
    'javascript:alert(1)', 'https://jikn.anri.go.id/deskripsi-arsip/sj/%30',
  ])('menolak URL di luar aturan: %s', (value) => {
    expect(safeLandingPageUrl(value)).toBeNull();
  });
});

describe('Aksi Landing Page pada popup', () => {
  function renderPopup(detail: InstansiDetail) {
    const onDetail = vi.fn();
    render(<MemoryRouter><InstansiPopup detail={detail} demo search="?demo=1" onClose={vi.fn()} onDetail={onDetail} onEnter={vi.fn()} onLeave={vi.fn()} /></MemoryRouter>);
    return onDetail;
  }

  it('tautan belum tersedia tetap terlihat disabled dan detail internal tetap bekerja', async () => {
    const detail = detailFixture();
    detail.statistik.jumlahArsip.value = 0;
    detail.statistik.penciptaArsip.value = null;
    const onDetail = renderPopup(detail);
    expect(screen.getByRole('button', { name: 'Landing Page' })).toBeDisabled();
    expect(screen.getByText('Tautan belum tersedia')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('Belum tersedia')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'Lihat detail' }));
    expect(onDetail).toHaveBeenCalledOnce();
  });

  it('URL verified memiliki tab baru, rel aman, serta dapat difokuskan lewat keyboard', async () => {
    const detail = detailFixture();
    const { mapping } = fixtureMapping();
    detail.instansi = { ...detail.instansi, ...mapping };
    renderPopup(detail);
    const link = screen.getByRole('link', { name: 'Landing Page' });
    expect(link).toHaveAttribute('href', url);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.queryByText('Tautan belum tersedia')).not.toBeInTheDocument();
    screen.getByRole('link', { name: 'Lihat detail' }).focus();
    await userEvent.tab();
    expect(link).toHaveFocus();
  });

  it('URL berbentuk benar tetap disabled jika belum diverifikasi atau sumber tidak lengkap', () => {
    const detail = detailFixture();
    detail.instansi.landingPageUrl = url;
    detail.instansi.landingPageVerificationStatus = 'verified';
    renderPopup(detail);
    expect(screen.getByRole('button', { name: 'Landing Page' })).toBeDisabled();
  });

  it('popup snapshot Excel menampilkan tahun asli dan label sumber; profil tanpa wilayah memiliki empty state', () => {
    const detail = detailFixture();
    detail.metadata.datasetKind = 'excel';
    detail.instansi.joinedYear = 2018;
    detail.instansi.provinceName = null;
    detail.instansi.kabKotaName = null;
    renderPopup(detail);
    expect(screen.getByText('2018')).toBeInTheDocument();
    expect(screen.getByText('Snapshot Excel · Data Pengelolaan Casefile')).toBeInTheDocument();
    cleanup();
    render(<ProfileCard instansi={detail.instansi} jenisName={null} />);
    expect(screen.getAllByText('Belum terverifikasi')).toHaveLength(2);
  });
});

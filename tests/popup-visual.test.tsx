import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { InstansiPopup } from '../src/components/map/InstansiPopup';
import type { InstansiDetail } from '../src/types/domain';
import { makeFixture } from './fixtures/data';

function makeDetail(): InstansiDetail {
  const { snapshot } = makeFixture();
  const instansi = snapshot.instansi[0]!;
  const statistics = snapshot.statistics.find((record) => record.instansiId === instansi.id)!;
  return { ...statistics, instansi, metadata: snapshot.metadata };
}
function showPopup(detail: InstansiDetail, jenisName?: string | null) {
  const onEnter = vi.fn();
  const onLeave = vi.fn();
  render(
    <MemoryRouter>
      <InstansiPopup detail={detail} jenisName={jenisName} demo search="?demo=1"
        onClose={vi.fn()} onDetail={vi.fn()} onEnter={onEnter} onLeave={onLeave} />
      <button type="button">Di luar popup</button>
    </MemoryRouter>,
  );
  return { onEnter, onLeave };
}
afterEach(cleanup);

describe('Identitas dan interaksi popup instansi', () => {
  it('menjelaskan lokasi unit layanan tanpa mengganti identitas instansi', () => {
    const detail = makeDetail();
    detail.instansi.coordinateLocationLabel = 'Depo arsip fixture';
    showPopup(detail);
    expect(screen.getByText('Lokasi: Depo arsip fixture')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: detail.instansi.name })).toBeInTheDocument();
  });

  it('badge menggunakan taksonomi yang diberikan dan identitas tetap berasal dari record aktif', () => {
    const detail = makeDetail();
    showPopup(detail, 'Kategori Demo untuk Pengujian');
    const popup = screen.getByRole('region', { name: `Pratinjau ${detail.instansi.name}` });
    expect(within(popup).getByRole('heading', { name: detail.instansi.name })).toBeInTheDocument();
    expect(within(popup).getByText('Kategori Demo untuk Pengujian')).toBeInTheDocument();
    expect(within(popup).getByText('DATA DEMO')).toBeInTheDocument();
    expect(within(popup).getByText(String(detail.instansi.joinedYear))).toBeInTheDocument();
    expect(within(popup).getByRole('link', { name: 'Lihat detail' })).toHaveAttribute(
      'href', `/simpul-jaringan/${encodeURIComponent(detail.instansi.id)}?demo=1`,
    );
  });

  it('kategori yang tidak diketahui tidak dibuat dari nama; nol dan tahun yang tidak diketahui tetap dibedakan', () => {
    const detail = makeDetail();
    detail.instansi.joinedYear = null;
    detail.statistik.jumlahArsip.value = 0;
    detail.statistik.penciptaArsip.value = null;
    showPopup(detail);
    expect(document.querySelector('.popup-jenis-badge')).toBeNull();
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getAllByText('Belum tersedia')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Landing Page' })).toBeDisabled();
  });

  it('perpindahan fokus antartombol popup mempertahankan pratinjau; keluar popup meminta penutupan', async () => {
    const detail = makeDetail();
    detail.instansi.landingPageUrl = 'https://jikn.anri.go.id/deskripsi-arsip/sj/00000000-0000-4000-8000-000000000001';
    detail.instansi.landingPageVerificationStatus = 'verified';
    detail.instansi.landingPageSource = 'Fixture sintetis, bukan tautan data ANRI';
    detail.instansi.landingPageVerifiedAt = '2026-10-14T09:00:00+07:00';
    const { onEnter, onLeave } = showPopup(detail);
    screen.getByRole('link', { name: 'Lihat detail' }).focus();
    expect(onEnter).toHaveBeenCalled();
    await userEvent.tab();
    expect(screen.getByRole('link', { name: 'Landing Page' })).toHaveFocus();
    expect(onLeave).not.toHaveBeenCalled();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Di luar popup' })).toHaveFocus();
    expect(onLeave).toHaveBeenCalledOnce();
  });
});

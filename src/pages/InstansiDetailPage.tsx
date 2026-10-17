import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  Database,
  Info,
  RefreshCw,
} from 'lucide-react';
import type {
  InstansiDetail,
  InstansiRepository,
  ReferenceData,
} from '../types/domain';
import { DataState } from '../components/layout/DataState';
import { ProfileCard } from '../components/instansi/ProfileCard';
import { StatisticCards } from '../components/instansi/StatisticCards';
import { TrendCard } from '../components/charts/TrendCard';
import { DistributionCard } from '../components/charts/DistributionCard';
import { CreatorsCard } from '../components/charts/CreatorsCard';
import { calculateContribution, formatMetric } from '../services/metrics';
import { getReturnMapUrl } from '../services/session';
import '../styles/detail.css';
import '../styles/landing-page.css';

const dateFormatter = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'long',
  timeZone: 'Asia/Jakarta',
});
const timeFormatter = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: 'Asia/Jakarta',
});
function sourceLink(source: string) {
  try {
    const url = new URL(source);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

export function InstansiDetailPage({
  repository,
  demo,
}: {
  repository: InstansiRepository;
  demo: boolean;
}) {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const [attempt, setAttempt] = useState(0);
  const [resource, setResource] = useState<{
    repository: InstansiRepository;
    id: string | undefined;
    attempt: number;
    data: { detail: InstansiDetail | null; references: ReferenceData } | null;
    error: string | null;
  } | null>(null);
  useEffect(() => {
    let active = true;
    void Promise.all([
      repository.getInstansiDetail(id ?? ''),
      repository.getReferenceData(),
    ])
      .then(([detail, references]) => {
        if (active)
          setResource({
            repository,
            id,
            attempt,
            data: { detail, references },
            error: null,
          });
      })
      .catch((reason: unknown) => {
        if (active)
          setResource({
            repository,
            id,
            attempt,
            data: null,
            error:
              reason instanceof Error
                ? reason.message
                : 'Sumber JSON tidak dapat dibaca.',
          });
      });
    return () => {
      active = false;
    };
  }, [repository, id, attempt]);
  const isCurrent =
    resource !== null &&
    resource.repository === repository &&
    resource.id === id &&
    resource.attempt === attempt;
  const loading = !isCurrent;
  const data = isCurrent ? resource.data : null;
  const error = isCurrent ? resource.error : null;
  const retry = () => {
    setAttempt((value) => value + 1);
  };
  const detail = data?.detail;
  const returnUrl = getReturnMapUrl(searchParams.toString(), detail?.instansi);
  if (loading)
    return (
      <main id="konten" tabIndex={-1} className="detail-page">
        <Link className="back-to-map" to={returnUrl}>
          <ArrowLeft size={18} aria-hidden="true" />
          Kembali ke Peta
        </Link>
        <DataState
          title="Memuat profil simpul…"
          description="Membaca snapshot lokal."
        />
      </main>
    );
  if (error !== null)
    return (
      <main id="konten" tabIndex={-1} className="detail-page">
        <Link className="back-to-map" to={returnUrl}>
          <ArrowLeft size={18} aria-hidden="true" />
          Kembali ke Peta
        </Link>
        <DataState
          title="Data belum dapat dimuat"
          description={error}
          onRetry={retry}
        />
      </main>
    );
  if (!detail || !data)
    return (
      <main id="konten" tabIndex={-1} className="detail-page">
        <Link className="back-to-map" to={returnUrl}>
          <ArrowLeft size={18} aria-hidden="true" />
          Kembali ke Peta
        </Link>
        {demo && (
          <p className="detail-demo-label">
            DATA DEMO · Instansi sintetis untuk latihan
          </p>
        )}
        <DataState
          title="Simpul tidak ditemukan"
          description="ID instansi tidak terdapat dalam snapshot yang dimuat. Kembali ke peta untuk memilih simpul lain."
        />
      </main>
    );
  const { instansi, metadata, statistik } = detail;
  const simulation = metadata.datasetKind === 'pilot';
  const coordinateLink = sourceLink(instansi.coordinateSource ?? '');
  const jenisName =
    data.references.jenisInstansi.find((jenis) => jenis.id === instansi.jenisId)
      ?.name ?? null;
  const sampleTotal = metadata.sampleTotal?.value ?? null;
  const contribution = simulation
    ? sampleTotal !== null && sampleTotal > 0 && statistik.jumlahArsip.value !== null
      ? statistik.jumlahArsip.value / sampleTotal * 100 : null
    : calculateContribution(statistik.jumlahArsip, metadata);
  const monthlyAdded =
    detail.monthlyAdded !== null &&
    detail.monthlyAdded.yearMonth === metadata.referenceDate.slice(0, 7)
      ? detail.monthlyAdded
      : null;
  return (
    <main id="konten" tabIndex={-1} className="detail-page">
      <nav className="detail-breadcrumb" aria-label="Breadcrumb">
        <Link to={returnUrl}>Simpul Jaringan</Link>
        <span aria-hidden="true">/</span>
        <span>{instansi.provinceName ?? 'Provinsi belum terverifikasi'}</span>
        <span aria-hidden="true">/</span>
        <span>{instansi.kabKotaName ?? 'Kabupaten/kota belum terverifikasi'}</span>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{instansi.name}</span>
      </nav>
      <Link className="back-to-map" to={returnUrl}>
        <ArrowLeft size={18} aria-hidden="true" />
        Kembali ke Peta
      </Link>
      {demo && (
        <p className="detail-demo-label">
          DATA DEMO · Instansi dan statistik sintetis untuk latihan, bukan data
          ANRI.
        </p>
      )}
      {metadata.datasetKind === 'excel' && (
        <p className="detail-snapshot-label">
          Snapshot Excel · Data Pengelolaan Casefile. Tahun bergabung berasal dari Excel;
          data ini bukan sinkronisasi API SIKN.
        </p>
      )}
      {simulation && (
        <p className="detail-snapshot-label">
          <strong>DATA SIMULASI</strong> · Nama dan tahun bergabung dari Excel.
          {instansi.coordinates ? ' Pin kantor dicocokkan dengan sumber publik yang dicatat per instansi.' : ' Pin kantor belum dapat dipastikan; instansi tersedia melalui daftar.'}
          Statistik dan grafik adalah contoh, bukan data resmi JIKN.
        </p>
      )}
      <div className="detail-columns">
        <div className="detail-left">
          <ProfileCard instansi={instansi} jenisName={jenisName} compact={simulation} />
          <StatisticCards statistik={statistik} simulation={simulation} />
          <section
            className="detail-card contribution-card"
            aria-labelledby="contribution-title"
          >
            <h2 id="contribution-title" className="detail-section-title">
              <Database size={20} aria-hidden="true" />
              {simulation ? 'Kontribusi pada percontohan' : 'Kontribusi terhadap JIKN'}
              {simulation && <span className="simulation-label">SIMULASI</span>}
            </h2>
            {contribution === null ? (
              <>
                <strong className="empty-metric">Belum tersedia</strong>
                <p className="detail-note">
                  Persentase memerlukan total nasional dengan definisi, cakupan,
                  tanggal acuan, dan snapshot yang cocok. Sampel parsial tidak
                  digunakan sebagai total nasional.
                </p>
              </>
            ) : (
              <>
                <div className="contribution-value">
                  <strong>
                    {new Intl.NumberFormat('id-ID', {
                      maximumFractionDigits: 2,
                    }).format(contribution)}
                    %
                  </strong>
                  <span>{simulation ? 'dari total arsip simulasi pada sampel ini' : 'dari total arsip JIKN pada snapshot ini'}</span>
                </div>
                <div className="contribution-track" aria-hidden="true">
                  <span style={{ width: `${Math.min(contribution, 100)}%` }} />
                </div>
                <p className="detail-note">
                  {formatMetric(statistik.jumlahArsip.value)} dari{' '}
                  {formatMetric(simulation ? sampleTotal : metadata.nationalTotal?.value ?? null)} arsip{simulation ? ' simulasi' : ''}.
                  Tanggal acuan:{' '}
                  {dateFormatter.format(new Date(metadata.referenceDate))}.
                </p>
              </>
            )}
          </section>
          <section className="detail-card" aria-labelledby="update-title">
            <h2 id="update-title" className="detail-section-title">
              <RefreshCw size={20} aria-hidden="true" />
              Pembaruan Data
              {simulation && <span className="simulation-label">PERCONTOHAN</span>}
            </h2>
            <dl className="update-fields">
              <div>
                <dt>
                  <CalendarDays size={17} aria-hidden="true" />
                  Pembaruan sumber
                </dt>
                <dd>
                  {instansi.sourceUpdatedAt === null
                    ? 'Belum tersedia'
                    : dateFormatter.format(new Date(instansi.sourceUpdatedAt))}
                </dd>
              </div>
              <div>
                <dt>
                  <Database size={17} aria-hidden="true" />
                  Snapshot diambil
                </dt>
                <dd>
                  {timeFormatter.format(new Date(metadata.capturedAt))} WIB
                </dd>
              </div>
              {monthlyAdded !== null && (
                <div>
                  <dt>
                    <CalendarDays size={17} aria-hidden="true" />
                    Record ditambahkan bulan acuan
                  </dt>
                  <dd>
                    {formatMetric(monthlyAdded.count)} ·{' '}
                    {monthlyAdded.yearMonth}
                  </dd>
                </div>
              )}
            </dl>
            <p className="detail-note">
              Informasi berasal dari snapshot dan bukan pemantauan real time.
            </p>
          </section>
        </div>
        <div className="detail-right">
          <TrendCard
            key={`tren-${instansi.id}`}
            series={detail.trenInput}
            referenceDate={metadata.referenceDate}
            simulation={simulation}
          />
          <DistributionCard
            series={detail.distribusiArsip}
            totalArsip={statistik.jumlahArsip.value}
            simulation={simulation}
          />
          <CreatorsCard
            key={`pencipta-${instansi.id}`}
            creators={detail.penciptaArsip}
            multiCreator={detail.multiCreator}
            simulation={simulation}
          />
          <section
            className="detail-card source-card"
            aria-labelledby="source-title"
          >
            <h2 id="source-title" className="detail-section-title">
              <Info size={20} aria-hidden="true" />
              Catatan Sumber
            </h2>
            <p>
              {metadata.coverageDescription ?? (metadata.coverage === 'full'
                ? 'Cakupan snapshot: penuh menurut deklarasi sumber.'
                : 'Cakupan snapshot: parsial. Data ini tidak mewakili total seluruh simpul JIKN.')}
            </p>
            {instansi.joinedYearSource && (
              <p>Sumber tahun bergabung: {instansi.joinedYearSource}.</p>
            )}
            {instansi.locationVerificationNotes && (
              <p>Verifikasi lokasi: {instansi.locationVerificationNotes}</p>
            )}
            {coordinateLink && (
              <p>Lokasi kantor: <a href={coordinateLink} target="_blank" rel="noopener noreferrer">{simulation && (!instansi.coordinatesVerificationMethod || instansi.coordinatesVerificationMethod === 'google-maps-place') ? 'Lihat pin Google Maps' : 'Sumber koordinat'}</a>.
                {instansi.coordinatesVerifiedAt && Number.isFinite(Date.parse(instansi.coordinatesVerifiedAt)) && ` Diperiksa ${timeFormatter.format(new Date(instansi.coordinatesVerifiedAt))} WIB.`}
                {!simulation && instansi.coordinatesVerificationNotes && ` ${instansi.coordinatesVerificationNotes}`}</p>
            )}
            {instansi.coordinateLocationLabel && <p>Titik yang ditampilkan: {instansi.coordinateLocationLabel}.</p>}
            <details open={simulation ? undefined : true}>
            <summary>Referensi dan catatan verifikasi</summary>
            <ul className="source-list">
              {metadata.sources.map((source) => {
                const href = sourceLink(source);
                return (
                  <li key={source}>
                    {href ? (
                      <a href={href} target="_blank" rel="noreferrer">
                        {source}
                      </a>
                    ) : (
                      source
                    )}
                  </li>
                );
              })}
            </ul>
            {metadata.verificationNotes.length > 0 && (
              <ul className="verification-notes">
                {metadata.verificationNotes.map((note, index) => (
                  <li key={`${index}-${note}`}>{note}</li>
                ))}
              </ul>
            )}
            </details>
            <p className="detail-note">
              Snapshot {metadata.id} · diambil{' '}
              {timeFormatter.format(new Date(metadata.capturedAt))} WIB. Nilai
              yang belum diketahui tetap ditampilkan sebagai Belum tersedia.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}

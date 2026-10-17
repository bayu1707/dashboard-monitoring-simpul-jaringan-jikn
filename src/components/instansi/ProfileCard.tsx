import {
  Building2,
  CalendarDays,
  Hash,
  Mail,
  MapPin,
  Phone,
} from 'lucide-react';
import type { Instansi } from '../../types/domain';
import { InstitutionLogo } from './InstitutionLogo';
import { validEmail, validPhone } from '../../services/metrics';

export function ProfileCard({
  instansi,
  jenisName,
  compact = false,
}: {
  instansi: Instansi;
  jenisName: string | null;
  compact?: boolean;
}) {
  const emailIsValid = validEmail(instansi.email);
  const phoneIsValid = validPhone(instansi.phone);
  const unavailable = 'Belum tersedia';
  return (
    <section
      className="detail-card profile-card"
      aria-labelledby="profile-title"
    >
      <div className="profile-identity">
        <InstitutionLogo name={instansi.name} url={instansi.logoUrl} />
        <div>
          <p className="eyebrow">Simpul jaringan</p>
          <h1 id="profile-title">{instansi.name}</h1>
          {instansi.status !== null && (
            <span className="status-badge">
              <span aria-hidden="true" className="status-dot" />
              {instansi.status}
            </span>
          )}
        </div>
      </div>
      <h2 className="detail-section-title">Informasi Instansi</h2>
      <dl className="profile-fields">
        <div>
          <dt>
            <Hash size={17} aria-hidden="true" />
            Kode
          </dt>
          <dd>{instansi.kode ?? unavailable}</dd>
        </div>
        <div>
          <dt>
            <Building2 size={17} aria-hidden="true" />
            Jenis instansi
          </dt>
          <dd>{jenisName ?? unavailable}</dd>
        </div>
        {(!compact || instansi.email !== null) && <div>
          <dt>
            <Mail size={17} aria-hidden="true" />
            Email publik
          </dt>
          <dd>
            {emailIsValid ? (
              <a href={`mailto:${instansi.email}`}>{instansi.email}</a>
            ) : (
              (instansi.email ?? unavailable)
            )}
          </dd>
        </div>}
        {(!compact || instansi.phone !== null) && <div>
          <dt>
            <Phone size={17} aria-hidden="true" />
            Telepon publik
          </dt>
          <dd>
            {phoneIsValid ? (
              <a href={`tel:${instansi.phone?.replace(/[\s().-]/g, '')}`}>
                {instansi.phone}
              </a>
            ) : (
              (instansi.phone ?? unavailable)
            )}
          </dd>
        </div>}
        <div>
          <dt>
            <MapPin size={17} aria-hidden="true" />
            Provinsi
          </dt>
          <dd>{instansi.provinceName ?? 'Belum terverifikasi'}</dd>
        </div>
        <div>
          <dt>
            <MapPin size={17} aria-hidden="true" />
            Kabupaten/Kota
          </dt>
          <dd>{instansi.kabKotaName ?? 'Belum terverifikasi'}</dd>
        </div>
        <div>
          <dt>
            <CalendarDays size={17} aria-hidden="true" />
            Tahun bergabung
          </dt>
          <dd>{instansi.joinedYear ?? unavailable}</dd>
        </div>
        {(!compact || instansi.status !== null) && <div>
          <dt>
            <Building2 size={17} aria-hidden="true" />
            Status simpul
          </dt>
          <dd>{instansi.status ?? unavailable}</dd>
        </div>}
      </dl>
    </section>
  );
}

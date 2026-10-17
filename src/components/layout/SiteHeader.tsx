import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { useState } from 'react';
export function SiteHeader({ demo, pilot = false, mapSearch = demo ? '?demo=1' : '' }: { demo: boolean; pilot?: boolean; mapSearch?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <>
      <a className="skip-link" href="#konten">
        Lewati ke konten
      </a>
      <header className="site-header">
        <div className="identity-row">
          <Link
            to={`/simpul-jaringan${mapSearch}`}
            className="brand"
            aria-label="JIKN, kembali ke peta nasional"
          >
            {!failed ? (
              <img
                className="anri-logo"
                src="/assets/logo-anri-symbol.png"
                alt="ANRI"
                onError={() => setFailed(true)}
              />
            ) : (
              <span className="anri-text">ANRI</span>
            )}
            <span className="brand-name">
              JARINGAN INFORMASI
              <br className="mobile-break" /> KEARSIPAN NASIONAL
            </span>
          </Link>
          <div className="header-utility">
            {demo && <span className="demo-badge">DATA DEMO</span>}
            {pilot && <span className="demo-badge">DATA SIMULASI</span>}
            <span className="language" aria-label="Bahasa antarmuka: Indonesia">
              <span className="country-flag" aria-hidden="true" />
              Indonesia
            </span>
            <a
              href="https://www.anri.go.id/layanan-publik/sikn-dan-jikn"
              target="_blank"
              rel="noreferrer"
            >
              Tentang JIKN
              <ExternalLink size={13} />
            </a>
          </div>
        </div>
        <nav aria-label="Menu publik" className="public-nav">
          <span>Beranda</span>
          <span>Deskripsi Arsip</span>
          <span>Pameran Virtual</span>
          <Link
            aria-current="page"
            className="active"
            to={`/simpul-jaringan${mapSearch}`}
          >
            Simpul Jaringan
          </Link>
          <span>Peta Kartografi</span>
          <span>Layanan Akses</span>
          <span>FAQ</span>
        </nav>
      </header>
    </>
  );
}

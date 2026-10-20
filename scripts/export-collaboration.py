"""Ekspor snapshot yang telah diizinkan tanpa mengubah sumber asli."""
import argparse
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FIELDS = set('id name kode jenisId provinceId kabKotaId provinceName kabKotaName email phone joinedYear status logoUrl coordinates coordinateSource coordinatesVerifiedAt coordinatesVerificationNotes coordinatesVerificationMethod coordinateLocationLabel sourceUpdatedAt source locationVerificationStatus locationVerificationNotes joinedYearSource landingPageUrl landingPageSource landingPageVerificationStatus landingPageVerifiedAt'.split())


def sanitize(value):
    if isinstance(value, dict):
        return {key: sanitize(item) for key, item in value.items()}
    if isinstance(value, list):
        return [sanitize(item) for item in value]
    if isinstance(value, str):
        return re.sub(r'\.local/[^\s,;)\]]+', 'bukti-review-lokal-tidak-disertakan', value)
    return value


def main():
    parser = argparse.ArgumentParser(description='Ekspor snapshot kolaborasi setelah izin pemilik data dikonfirmasi.')
    parser.add_argument('--approved', action='store_true', help='Konfirmasi izin berbagi data yang telah ditinjau.')
    parser.add_argument('--approved-at', required=True, help='Tanggal persetujuan berbagi YYYY-MM-DD')
    parser.add_argument('--release', required=True, help='Versi paket, misalnya kolaborasi-2026-10-19')
    parser.add_argument('--excel-source', default='.local/casefile/snapshot.json', help='Snapshot Excel terstruktur yang sudah direview; tidak membaca workbook mentah.')
    parser.add_argument('--pilot-source', default='.local/pilot', help='Folder snapshot/references pilot hasil review; sumber lama tidak ditimpa.')
    args = parser.parse_args()
    pilot_source = Path(args.pilot_source)
    if not pilot_source.is_absolute():
        pilot_source = ROOT / pilot_source
    if not pilot_source.resolve().is_relative_to((ROOT / '.local').resolve()):
        parser.error('Sumber pilot hasil review harus berada di dalam .local.')
    if not args.approved:
        parser.error('Ekspor memerlukan persetujuan atas dataset yang akan dibagikan.')
    output = ROOT / 'public/data/datasets'
    staged = {}
    catalog = {}
    for mode, source, references in [
        ('pilot', pilot_source / 'snapshot.json', pilot_source / 'references.json'),
        ('excel', args.excel_source, 'public/data/references.json'),
    ]:
        original = json.loads((ROOT / source).read_text(encoding='utf-8'))
        data = sanitize(original)
        for item in data['instansi']:
            if set(item) - FIELDS or item['email'] is not None or item['phone'] is not None:
                raise ValueError('Field tambahan/kontak memerlukan review baru sebelum ekspor.')
        for before, after in zip(original['instansi'], data['instansi']):
            for key in ['id', 'name', 'kode', 'jenisId', 'joinedYear', 'coordinates', 'landingPageUrl']:
                if before.get(key) != after.get(key):
                    raise ValueError('Ekspor tidak boleh mengubah identitas, tahun, pin atau URL.')
        if original['statistics'] != data['statistics']:
            raise ValueError('Statistik sumber harus dipertahankan.')
        snapshot_path = output / mode / 'snapshot.json'
        staged[snapshot_path] = data
        if mode == 'pilot':
            reference_path = output / mode / 'references.json'
            staged[reference_path] = sanitize(json.loads((ROOT / references).read_text(encoding='utf-8')))
        else:
            reference_path = ROOT / references
        catalog[mode] = {
            'snapshot': '/' + snapshot_path.relative_to(ROOT / 'public').as_posix(),
            'references': '/' + reference_path.relative_to(ROOT / 'public').as_posix(),
            'datasetKind': mode,
            'records': len(data['instansi']),
            'pins': sum(item['coordinates'] is not None for item in data['instansi']),
            'years': sum(item['joinedYear'] is not None for item in data['instansi']),
            'verifiedLandingPages': sum(item.get('landingPageVerificationStatus') == 'verified' for item in data['instansi']),
        }
    # Review/validasi seluruh input diselesaikan sebelum menulis keluaran.
    for path, data in staged.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
    dependencies = set(staged) | {ROOT / 'public/data/references.json'}
    dependencies.update(path for path in (ROOT / 'public/data/geometry').rglob('*') if path.is_file())
    hashes = {'/' + path.relative_to(ROOT / 'public').as_posix(): hashlib.sha256(path.read_bytes()).hexdigest() for path in sorted(dependencies)}
    manifest = {
        'formatVersion': 1, 'release': args.release, 'defaultDataset': 'pilot',
        'sharingApproval': {
            'confirmedAt': args.approved_at,
            'basis': 'Pengguna mengonfirmasi telah memperoleh izin berbagi seluruh dataset yang diaudit.',
            'scope': 'Snapshot turunan pilot wilayah yang direview dan Excel penuh beserta sumber koordinat/tahun dan mapping yang disertakan; bukan workbook, kredensial, atau dokumen internal.',
        },
        'datasets': catalog, 'sha256': hashes,
    }
    (output / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
    print(json.dumps(catalog, ensure_ascii=False))


if __name__ == '__main__':
    main()

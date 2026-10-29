<?php

namespace App\Repositories;

use App\Exceptions\SiknUnavailable;
use App\Services\DatasetValidator;
use App\Services\InstitutionContacts;
use App\Services\SiknLocalConfig;
use App\Services\SiknSource;
use Normalizer;
use Throwable;

/** Mode DB opt-in: katalog/ID/koordinat tetap; statistik dan kontak detail memakai pasangan identitas objektif. */
final class DashboardRepository implements InstansiRepository
{
    private ?array $databaseSnapshot = null;

    private array $matches = [];

    public function __construct(private JsonSnapshotRepository $json, private SiknLocalConfig $config, private SiknSource $source, private DatasetValidator $validator, private DevelopmentRepository $development) {}

    private function normalized(string $name): string
    {
        $name = class_exists(Normalizer::class) ? Normalizer::normalize($name, Normalizer::FORM_KC) : $name;

        return trim(preg_replace('/[^\p{L}\p{N}_]+/u', ' ', mb_strtolower($name)));
    }

    public function snapshot(string $mode): array
    {
        if ($mode === 'dev') {
            return $this->development->snapshot($mode);
        }
        if ($mode !== 'sikn') {
            return $this->json->snapshot($mode);
        }
        if ($this->databaseSnapshot !== null) {
            return $this->databaseSnapshot;
        }
        try {
            $config = $this->config->read();
            $mapping = json_decode(file_get_contents($config['crosswalkPath']), true, 512, JSON_THROW_ON_ERROR);
            $base = $this->json->snapshot('pilot');
            $identities = $this->source->identities();
            // Satu UUID bisa memiliki beberapa terjemahan/baris: ambigu tidak dipasangkan.
            $byUuid = [];
            foreach ($identities as $row) {
                $byUuid[$row['uuid']][] = $row;
            }
            $localIds = array_column($base['instansi'], 'id');
            $targets = array_column($mapping['mappings'], 'siknUuid');
            if (count($targets) !== count(array_unique($targets))
                || count(array_column($mapping['mappings'], 'localId')) !== count(array_unique(array_column($mapping['mappings'], 'localId')))
                || array_diff(array_column($mapping['mappings'], 'localId'), $localIds)) {
                throw new SiknUnavailable;
            }
            $crosswalk = array_column($mapping['mappings'], null, 'localId');
            foreach ($base['instansi'] as &$item) {
                $match = $crosswalk[$item['id']] ?? null;
                $rows = $match ? ($byUuid[$match['siknUuid']] ?? []) : [];
                if ($match && count($rows) === 1) {
                    $row = $rows[0];
                    $strict = $match['matchBasis'] === 'kode-dan-nama-sama'
                        && $item['kode'] !== null && trim($row['code'] ?? '') === trim($item['kode'])
                        && $this->normalized($row['name']) === $this->normalized($item['name']);
                    $explicit = $match['matchBasis'] === 'tautan-anri-dikonfirmasi-pengguna'
                        && $match['siknUuid'] === '3bcfbe8a-34bc-4f7c-a997-01b961e085b9'
                        && ($item['landingPageVerificationStatus'] ?? '') === 'verified'
                        && ($item['landingPageUrl'] ?? '') === 'https://jikn.anri.go.id/deskripsi-arsip/sj/'.$match['siknUuid']
                        && $this->normalized($row['name']) === 'arsip nasional republik indonesia';
                    if ($strict || $explicit) {
                        $this->matches[$item['id']] = ['id' => (int) $row['id'], 'uuid' => $row['uuid']];
                    }
                }
                $matched = isset($this->matches[$item['id']]);
                $item['source'] = 'Identitas/tahun: snapshot Excel; lokasi: sumber publik per record. '.($matched ? 'Statistik/kontak detail: salinan database SIKN lokal, identitas dicocokkan.' : 'Identitas database belum cocok; statistik dan kontak tidak tersedia.');
                // Tidak mengubah data sumber atau mengangkat kontak simulasi menjadi resmi.
                $item['email'] = $item['phone'] = $item['status'] = null;
                $item['sourceUpdatedAt'] = null;
            }
            unset($item);
            $base['statistics'] = [];
            $id = $config['sourceId'].'-'.substr(hash('sha256', $base['metadata']['id'].json_encode($this->matches)), 0, 12);
            $base['metadata'] = [
                'id' => $id, 'datasetKind' => 'database', 'coverage' => 'partial',
                'capturedAt' => $config['capturedAt'], 'referenceDate' => $config['referenceDate'],
                'sources' => ['Salinan database SIKN lokal — data Maret 2026', 'Indonesia.xlsx — sheet pengelolaan casefile', 'Koordinat dan referensi wilayah: katalog pilot; sumber per instansi'],
                'metricDefinitions' => [
                    'jumlahArsip' => 'Jumlah ID deskripsi arsip unik nondeleted pada semua level, dengan relasi instansi nondeleted; tanpa filter status publikasi. Bukan total arsip publik.',
                    'penciptaArsip' => 'Jumlah ID entitas terkait unik nondeleted pada relasi deskripsi terhitung; peran pencipta belum dikonfirmasi.',
                    'kopiDigital' => 'Jumlah ID metadata objek digital unik nondeleted pada deskripsi terhitung; bukan jumlah arsip yang memiliki berkas atau bukti file dapat diakses.',
                ],
                'nationalTotal' => null,
                'coverageDescription' => count($base['instansi']).' instansi katalog Excel; '.count($this->matches).' identitas cocok untuk uji statistik database. UJI LOKAL, bukan API vendor atau data real time.',
                'verificationNotes' => [
                    'Statistik dihitung baca-saja dari salinan terisolasi. Definisi publikasi/pencipta perlu disepakati dengan vendor sebelum penggunaan publik.',
                    'Tahun bergabung tetap dari Excel, bukan created_at database. ID lokal, pin publik dan referensi 38 provinsi dipertahankan; koordinat database belum menggantikan hasil kurasi.',
                    'Pencocokan harus unik berdasarkan kode dan nama; alias ANRI berdasarkan tautan yang dikonfirmasi pengguna. Kode duplikat saja atau nama mirip tidak cukup.',
                    'Instansi belum cocok tetap tersedia; nilai statistik null. Tren, distribusi, kontribusi nasional dan rincian pencipta belum tersedia, bukan simulasi.',
                    'Email/telepon hanya dibaca saat membuka detail instansi yang cocok, dari satu kontak utama atau satu baris kontak aktif yang unik. Tidak mengambil PIC/pengguna dan belum merupakan verifikasi kontak publik.',
                ],
            ];

            $this->validator->snapshot($base, $this->json->references('pilot'), 'database');

            return $this->databaseSnapshot = $base;
        } catch (Throwable) {
            throw new SiknUnavailable;
        }
    }

    public function references(string $mode): array
    {
        if ($mode === 'dev') {
            return $this->development->references($mode);
        }
        if ($mode !== 'sikn') {
            return $this->json->references($mode);
        }
        $metadata = $this->snapshot($mode)['metadata'];
        $references = $this->json->references('pilot');
        $references['metadata'] = $metadata;

        return $references;
    }

    public function geometry(string $mode, string $provinceId): array
    {
        if ($mode === 'dev') {
            return $this->development->geometry($mode, $provinceId);
        }
        if ($mode === 'sikn') {
            $this->snapshot($mode);
        }

        return $this->json->geometry($mode === 'sikn' ? 'pilot' : $mode, $provinceId);
    }

    public function detailStatistics(string $mode, string $id): ?array
    {
        if ($mode === 'dev') {
            return null;
        }
        if ($mode !== 'sikn') {
            return $this->json->detailStatistics($mode, $id);
        }
        $metadata = $this->snapshot($mode)['metadata'];
        if (! isset($this->matches[$id])) {
            return null;
        }
        $values = $this->source->metrics($this->matches[$id]['id']);
        $stats = [];
        foreach ($metadata['metricDefinitions'] as $key => $definition) {
            $stats[$key] = ['value' => $values[$key], 'definition' => $definition, 'scope' => 'instansi',
                'snapshotId' => $metadata['id'], 'referenceDate' => $metadata['referenceDate']];
        }

        return ['statistik' => $stats, 'trenInput' => null, 'distribusiArsip' => null, 'penciptaArsip' => null, 'multiCreator' => null, 'monthlyAdded' => null];
    }

    public function detailContacts(string $mode, string $id): ?array
    {
        if ($mode !== 'sikn') {
            return null;
        }
        $this->snapshot($mode);
        if (! isset($this->matches[$id])) {
            return InstitutionContacts::unavailable('Identitas database belum cocok secara unik; kontak tidak dipasangkan.');
        }

        return InstitutionContacts::select($this->source->contacts($this->matches[$id]['id']));
    }
}

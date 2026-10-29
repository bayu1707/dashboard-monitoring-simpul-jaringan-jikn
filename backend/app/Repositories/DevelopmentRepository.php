<?php

namespace App\Repositories;

use App\Exceptions\DevelopmentUnavailable;
use App\Services\DatasetValidator;
use App\Services\DevelopmentDatabase;
use App\Services\DevelopmentLocation;
use App\Services\InstitutionContacts;
use Illuminate\Support\Carbon;
use Throwable;

final class DevelopmentRepository implements InstansiRepository
{
    private ?array $data = null;

    public function __construct(private DevelopmentDatabase $database, private JsonSnapshotRepository $json, private DevelopmentLocation $location, private DatasetValidator $validator) {}

    private function read(): array
    {
        if ($this->data !== null) {
            return $this->data;
        }
        try {
            return $this->data = $this->database->connection()->transaction(function ($db) {
                if ($db->transactionLevel() === 1) {
                    $db->statement('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
                }
                $meta = $db->table('dev_meta')->where('id', 1)->first();
                $metadata = ['id' => 'development-v'.$meta->revision, 'datasetKind' => 'development', 'coverage' => 'partial',
                    'capturedAt' => Carbon::parse($meta->updated_at)->toISOString(), 'referenceDate' => now()->toDateString(),
                    'sources' => ['PostgreSQL development — DATA UJI', 'public/data/datasets/pilot/references.json — referensi administratif'],
                    'metricDefinitions' => ['jumlahArsip' => 'Belum tersedia pada data uji.', 'penciptaArsip' => 'Belum tersedia pada data uji.', 'kopiDigital' => 'Belum tersedia pada data uji.'],
                    'nationalTotal' => null, 'coverageDescription' => 'DATA UJI terpisah; bukan simpul resmi dan bukan salinan data SIKN.',
                    'verificationNotes' => ['Instansi dan wilayah tambahan merupakan pengujian lokal. Tahun bergabung diisi terpisah dan boleh belum diketahui.',
                        'Marker memerlukan konfirmasi koordinat penguji dan pemeriksaan polygon yang tersedia. Hasil geocoding tidak otomatis disahkan sebagai kantor.',
                        'Wilayah uji tanpa geometri tetap tersedia melalui dropdown/daftar; tidak dibuat polygon atau titik kantor dari pusat wilayah.']];
                $base = $this->json->references('pilot');
                $known = array_column([...$base['provinces'], ...$base['kabKota']], null, 'id');
                $refs = [...$base, 'provinces' => [], 'kabKota' => [], 'metadata' => $metadata];
                $regions = $db->table('dev_regions')->orderBy('id')->get();
                $names = [];
                foreach ($regions as $r) {
                    $names[$r->id] = $r->name;
                    $region = ($r->origin === 'reference' ? ($known[$r->id] ?? null) : null)
                        ?? ['id' => $r->id, 'level' => $r->level, 'provinceId' => $r->province_id, 'geometry' => null, 'bounds' => null,
                            'labelPosition' => null, 'source' => 'Wilayah pengujian development; bukan wilayah administratif resmi', 'sourceId' => null];
                    $region['name'] = $r->name;
                    $refs[$r->level === 'province' ? 'provinces' : 'kabKota'][] = $region;
                }
                $items = [];
                foreach ($db->table('dev_institutions')->whereNull('deleted_at')->orderBy('created_at')->orderBy('id')->get() as $r) {
                    $check = $r->latitude !== null && $r->longitude !== null
                        ? $this->location->check($r->province_id, $r->regency_id, (float) $r->latitude, (float) $r->longitude) : ['valid' => false];
                    $published = $r->coordinate_status === 'verified' && $check['valid']
                        && filter_var($r->coordinate_source, FILTER_VALIDATE_URL) && str_starts_with($r->coordinate_source, 'https://');
                    $updated = Carbon::parse($r->updated_at)->toISOString();
                    $item = ['id' => 'dev-'.$r->id, 'name' => $r->name, 'kode' => $r->external_id, 'jenisId' => null,
                        'provinceId' => $r->province_id, 'kabKotaId' => $r->regency_id, 'provinceName' => $names[$r->province_id],
                        'kabKotaName' => $r->regency_id ? $names[$r->regency_id] : null,
                        'email' => InstitutionContacts::email($r->email), 'phone' => InstitutionContacts::phone($r->phone),
                        'contactSource' => 'Input kontak development — DATA UJI', 'contactVerificationStatus' => 'needs-review',
                        'contactNotes' => 'Kontak masukan penguji; bukan kontak resmi hasil sinkronisasi SIKN.',
                        'joinedYear' => $r->joined_year, 'status' => 'DATA UJI', 'logoUrl' => null,
                        'coordinates' => $published ? [(float) $r->latitude, (float) $r->longitude] : null,
                        'coordinateSource' => $r->coordinate_source, 'coordinatesVerifiedAt' => $published ? Carbon::parse($r->coordinate_verified_at)->toISOString() : null,
                        'coordinatesVerificationNotes' => $r->location_note, 'locationVerificationStatus' => $published ? 'verified' : 'needs-review',
                        'locationVerificationNotes' => $r->location_note, 'joinedYearSource' => 'Input pengujian development; bukan created_at atau API SIKN',
                        'sourceUpdatedAt' => $updated, 'source' => 'PostgreSQL development — DATA UJI',
                        'address' => $r->address, 'landingPageUrl' => $r->landing_page_url,
                        'landingPageVerificationStatus' => $r->landing_page_url ? ($r->landing_verified ? 'verified' : 'needs-review') : 'unavailable',
                        'landingPageSource' => $r->landing_verified ? 'Tautan dikonfirmasi manual oleh penguji; bukan sinkronisasi API' : null,
                        'landingPageVerifiedAt' => $r->landing_verified ? $updated : null];
                    foreach (['coordinateSource', 'coordinatesVerifiedAt'] as $optional) {
                        if ($item[$optional] === null) {
                            unset($item[$optional]);
                        }
                    }
                    $items[] = $item;
                }
                $snapshot = ['metadata' => $metadata, 'instansi' => $items, 'statistics' => []];
                $this->validator->references($refs);
                $this->validator->snapshot($snapshot, $refs, 'development');

                return ['references' => $refs, 'snapshot' => $snapshot];
            });
        } catch (Throwable) {
            throw new DevelopmentUnavailable;
        }
    }

    public function references(string $mode): array
    {
        return $this->read()['references'];
    }

    public function snapshot(string $mode): array
    {
        return $this->read()['snapshot'];
    }

    public function detailStatistics(string $mode, string $id): ?array
    {
        return null;
    }

    public function detailContacts(string $mode, string $id): ?array
    {
        return null;
    }

    public function geometry(string $mode, string $provinceId): array
    {
        if (collect($this->json->references('pilot')['provinces'])->contains('id', $provinceId)) {
            return $this->json->geometry('pilot', $provinceId);
        }

        return ['type' => 'FeatureCollection', 'features' => []];
    }
}

<?php

namespace App\Services;

use App\Repositories\JsonSnapshotRepository;

/** Geometri administratif hanya dibaca dari referensi yang sudah tersedia. */
final class DevelopmentLocation
{
    public function __construct(private JsonSnapshotRepository $references) {}

    private function ring(array $ring, float $lat, float $lon): bool
    {
        $inside = false;
        for ($i = 0, $j = count($ring) - 1; $i < count($ring); $j = $i++) {
            [$x, $y] = $ring[$i];
            [$a, $b] = $ring[$j];
            if (($y > $lat) !== ($b > $lat) && $lon < ($a - $x) * ($lat - $y) / ($b - $y) + $x) {
                $inside = ! $inside;
            }
        }

        return $inside;
    }

    private function contains(array $geometry, float $lat, float $lon): bool
    {
        $polygons = $geometry['type'] === 'Polygon' ? [$geometry['coordinates']] : ($geometry['type'] === 'MultiPolygon' ? $geometry['coordinates'] : []);
        foreach ($polygons as $rings) {
            if (! $this->ring($rings[0], $lat, $lon)) {
                continue;
            }
            $hole = false;
            foreach (array_slice($rings, 1) as $ring) {
                $hole = $hole || $this->ring($ring, $lat, $lon);
            }
            if (! $hole) {
                return true;
            }
        }

        return false;
    }

    public function check(string $province, ?string $regency, float $lat, float $lon): array
    {
        $refs = $this->references->references('pilot');
        $parent = collect($refs['provinces'])->firstWhere('id', $province);
        if (! $parent || ! $parent['geometry']) {
            return ['valid' => false, 'note' => 'Geometri provinsi pengujian belum tersedia; lokasi perlu ditinjau.'];
        }
        if (! $this->contains($parent['geometry'], $lat, $lon)) {
            return ['valid' => false, 'note' => 'Titik berada di luar polygon provinsi yang dipilih.'];
        }
        if ($regency && collect($refs['kabKota'])->contains('id', $regency)) {
            $features = $this->references->geometry('pilot', $province)['features'];
            $feature = collect($features)->first(fn ($f) => (string) $f['properties']['id'] === $regency);
            if (! $feature || ! $feature['geometry'] || ! $this->contains($feature['geometry'], $lat, $lon)) {
                return ['valid' => false, 'note' => 'Titik belum lolos pemeriksaan polygon kabupaten/kota.'];
            }

            return ['valid' => true, 'note' => 'Titik berada dalam polygon provinsi dan kabupaten/kota; posisi kantor dikonfirmasi penguji.'];
        }

        return ['valid' => true, 'note' => 'Titik berada dalam provinsi. Kabupaten/kota uji belum memiliki polygon; konfirmasi manual penguji, bukan pengesahan wilayah resmi.'];
    }
}

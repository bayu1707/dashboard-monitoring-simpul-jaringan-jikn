<?php

namespace App\Services;

use App\Exceptions\InvalidDataset;

/** Memeriksa kontrak domain existing tanpa mengubah atau menebak nilai sumber. */
final class DatasetValidator
{
    private function check(bool $condition, string $reason): void
    {
        if (! $condition) {
            throw new InvalidDataset($reason);
        }
    }

    private function text(mixed $v): bool
    {
        return is_string($v) && trim($v) !== '';
    }

    private function nullableText(mixed $v): bool
    {
        return $v === null || $this->text($v);
    }

    private function nonnegative(mixed $v): bool
    {
        return $v === null || (is_int($v) && $v >= 0);
    }

    private function date(mixed $v): bool
    {
        if (! is_string($v) || ! preg_match('/^\d{4}-\d{2}-\d{2}$/D', $v)) {
            return false;
        }
        $parts = explode('-', $v);

        return checkdate((int) $parts[1], (int) $parts[2], (int) $parts[0]);
    }

    private function timestamp(mixed $v): bool
    {
        return is_string($v) && preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/D', $v)
            && $this->date(substr($v, 0, 10)) && strtotime($v) !== false;
    }

    private function coordinates(mixed $v): bool
    {
        return is_array($v) && array_is_list($v) && count($v) === 2 && is_numeric($v[0]) && ! is_string($v[0])
            && is_numeric($v[1]) && ! is_string($v[1]) && is_finite((float) $v[0]) && is_finite((float) $v[1])
            && abs($v[0]) <= 90 && abs($v[1]) <= 180;
    }

    private function list(mixed $v, string $reason): array
    {
        $this->check(is_array($v) && array_is_list($v), $reason);

        return $v;
    }

    private function unique(array $values, string $key): void
    {
        $seen = [];
        foreach ($values as $value) {
            $this->check(is_array($value) && isset($value[$key]) && (is_string($value[$key]) || is_int($value[$key])), 'invalid-id');
            $id = (string) $value[$key];
            $this->check(! isset($seen[$id]), 'duplicate-id');
            $seen[$id] = true;
        }
    }

    private function metric(mixed $metric, array $metadata, string $scope, ?string $definition = null): void
    {
        $this->check(is_array($metric), 'metric-object');
        $this->check(array_key_exists('value', $metric) && $this->nonnegative($metric['value']), 'metric-value');
        foreach (['definition', 'scope', 'snapshotId'] as $key) {
            $this->check($this->text($metric[$key] ?? null), 'metric-text');
        }
        $this->check($metric['scope'] === $scope && $metric['snapshotId'] === $metadata['id'] && ($metric['referenceDate'] ?? null) === $metadata['referenceDate'], 'metric-snapshot');
        if ($definition !== null) {
            $this->check($metric['definition'] === $definition, 'metric-definition');
        }
    }

    private function metadata(mixed $metadata): void
    {
        $this->check(is_array($metadata), 'metadata-object');
        $this->check($this->text($metadata['id'] ?? null), 'metadata-id');
        foreach (['sources', 'verificationNotes'] as $key) {
            $values = $this->list($metadata[$key] ?? null, 'metadata-list');
            $this->check(count($values) > 0, 'metadata-empty');
            foreach ($values as $value) {
                $this->check($this->text($value), 'metadata-text');
            }
        }
        $this->check($this->timestamp($metadata['capturedAt'] ?? null) && $this->date($metadata['referenceDate'] ?? null), 'metadata-date');
        $this->check(in_array($metadata['coverage'] ?? null, ['full', 'partial'], true), 'metadata-coverage');
        $this->check(in_array($metadata['datasetKind'] ?? null, ['verified', 'empty', 'demo', 'excel', 'pilot', 'database', 'development'], true), 'metadata-kind');
        $this->check(is_array($metadata['metricDefinitions'] ?? null), 'metadata-definitions');
        foreach ($metadata['metricDefinitions'] as $definition) {
            $this->check($this->text($definition), 'metadata-definition');
        }
        $this->check(array_key_exists('nationalTotal', $metadata), 'metadata-total');
        if ($metadata['nationalTotal'] !== null) {
            $this->metric($metadata['nationalTotal'], $metadata, 'nasional', $metadata['metricDefinitions']['jumlahArsip'] ?? null);
        }
        if (($metadata['sampleTotal'] ?? null) !== null) {
            $this->check($metadata['datasetKind'] === 'pilot', 'sample-mode');
            $this->metric($metadata['sampleTotal'], $metadata, 'percontohan', $metadata['metricDefinitions']['jumlahArsip'] ?? null);
        }
        if (in_array($metadata['datasetKind'], ['pilot', 'excel', 'database'], true)) {
            $this->check($metadata['nationalTotal'] === null, 'invalid-national-total');
        }
        if ($metadata['datasetKind'] === 'pilot') {
            foreach ($metadata['metricDefinitions'] as $definition) {
                $this->check(str_contains(strtoupper($definition), 'SIMULASI'), 'simulation-label');
            }
        }
    }

    private function geometry(mixed $geometry): void
    {
        if ($geometry === null) {
            return;
        }
        $this->check(is_array($geometry), 'geometry-object');
        $type = $geometry['type'] ?? null;
        $this->check(in_array($type, ['Polygon', 'MultiPolygon', 'Point', 'MultiPoint', 'LineString', 'MultiLineString', 'GeometryCollection'], true), 'geometry-type');
        if ($type === 'GeometryCollection') {
            foreach ($this->list($geometry['geometries'] ?? null, 'geometry-collection') as $entry) {
                $this->geometry($entry);
            }

            return;
        }
        $walk = function ($value) use (&$walk): bool {
            if (! is_array($value) || ! $value || ! array_is_list($value)) {
                return false;
            }
            if (is_int($value[0]) || is_float($value[0])) {
                return count($value) >= 2 && $this->coordinates([$value[1], $value[0]]);
            }
            foreach ($value as $entry) {
                if (! $walk($entry)) {
                    return false;
                }
            }

            return true;
        };
        $this->check($walk($geometry['coordinates'] ?? null), 'geometry-coordinates');
    }

    public function references(array $data): void
    {
        $this->metadata($data['metadata'] ?? null);
        $provinces = $this->list($data['provinces'] ?? null, 'provinces');
        $cities = $this->list($data['kabKota'] ?? null, 'regencies');
        $this->unique([...$provinces, ...$cities], 'id');
        $provinceIds = array_column($provinces, 'id');
        foreach (['province' => $provinces, 'kabKota' => $cities] as $level => $regions) {
            foreach ($regions as $region) {
                foreach (['id', 'name', 'source'] as $key) {
                    $this->check($this->text($region[$key] ?? null), 'region-text');
                }
                $this->check(array_key_exists('sourceId', $region) && $this->nullableText($region['sourceId']), 'region-source');
                $this->check(($region['level'] ?? null) === $level, 'region-level');
                $this->check($level === 'province' ? array_key_exists('provinceId', $region) && $region['provinceId'] === null : in_array($region['provinceId'] ?? null, $provinceIds, true), 'region-relation');
                $this->check(array_key_exists('labelPosition', $region) && ($region['labelPosition'] === null || $this->coordinates($region['labelPosition'])), 'region-label');
                $this->check(array_key_exists('bounds', $region), 'region-bounds');
                if ($region['bounds'] !== null) {
                    $bounds = $region['bounds'];
                    $this->check(is_array($bounds) && count($bounds) === 2 && $this->coordinates($bounds[0]) && $this->coordinates($bounds[1]) && $bounds[0][0] <= $bounds[1][0] && $bounds[0][1] <= $bounds[1][1], 'region-bounds');
                }
                if (isset($region['geometryUrl'])) {
                    $this->check((bool) preg_match('#^/data/geometry/kab-kota/\d{2}\.json$#D', $region['geometryUrl']), 'geometry-url');
                }
                $this->check(array_key_exists('geometry', $region), 'geometry-required');
                $this->geometry($region['geometry']);
            }
        }
        foreach (['jenisInstansi', 'archiveCategories'] as $key) {
            $items = $this->list($data[$key] ?? null, 'taxonomy-list');
            $this->unique($items, 'id');
            foreach ($items as $item) {
                $this->check($this->text($item['id']) && $this->text($item['name'] ?? null), 'taxonomy-text');
            }
        }
    }

    public function snapshot(array $data, array $references, string $mode): void
    {
        $this->metadata($data['metadata'] ?? null);
        $metadata = $data['metadata'];
        $this->check($metadata['datasetKind'] === $mode, 'dataset-mode');
        $institutions = $this->list($data['instansi'] ?? null, 'institutions');
        $statistics = $this->list($data['statistics'] ?? null, 'statistics');
        $this->unique($institutions, 'id');
        $this->unique($statistics, 'instansiId');
        $provinces = array_column($references['provinces'], null, 'id');
        $cities = array_column($references['kabKota'], null, 'id');
        $kinds = array_column($references['jenisInstansi'], 'id');
        $categories = array_column($references['archiveCategories'], 'name', 'id');
        $ids = array_column($institutions, 'id');
        $landingOwners = [];
        foreach ($institutions as $item) {
            foreach (['id', 'name', 'source'] as $key) {
                $this->check($this->text($item[$key] ?? null), 'institution-text');
            }
            foreach (['kode', 'jenisId', 'email', 'phone', 'status', 'logoUrl', 'provinceId', 'kabKotaId', 'provinceName', 'kabKotaName'] as $key) {
                $this->check(array_key_exists($key, $item) && $this->nullableText($item[$key]), 'institution-nullable');
            }
            $province = $provinces[$item['provinceId'] ?? ''] ?? null;
            $city = $cities[$item['kabKotaId'] ?? ''] ?? null;
            $this->check($item['provinceId'] === null || $province !== null, 'institution-province');
            $this->check($item['kabKotaId'] === null || ($city !== null && $city['provinceId'] === $item['provinceId']), 'institution-regency');
            $this->check($province ? $item['provinceName'] === $province['name'] : $item['provinceName'] === null, 'institution-province-name');
            $this->check($city ? $item['kabKotaName'] === $city['name'] : $item['kabKotaName'] === null, 'institution-regency-name');
            $this->check($item['jenisId'] === null || in_array($item['jenisId'], $kinds, true), 'institution-kind');
            $this->check(array_key_exists('coordinates', $item) && ($item['coordinates'] === null || $this->coordinates($item['coordinates'])), 'institution-coordinates');
            $this->check(array_key_exists('joinedYear', $item) && ($item['joinedYear'] === null || (is_int($item['joinedYear']) && $item['joinedYear'] > 0 && $item['joinedYear'] <= (int) substr($metadata['referenceDate'], 0, 4))), 'institution-year');
            $this->check(array_key_exists('sourceUpdatedAt', $item) && ($item['sourceUpdatedAt'] === null || $this->date($item['sourceUpdatedAt']) || $this->timestamp($item['sourceUpdatedAt'])), 'institution-date');
            if (isset($item['locationVerificationStatus'])) {
                $this->check(in_array($item['locationVerificationStatus'], ['verified', 'needs-review', 'unresolved'], true), 'location-status');
            }
            if (($item['locationVerificationStatus'] ?? null) === 'verified') {
                $this->check($province !== null, 'verified-province');
            }
            if (in_array($mode, ['pilot', 'excel'], true)) {
                foreach (['joinedYearSource', 'locationVerificationNotes'] as $key) {
                    $this->check($this->text($item[$key] ?? null), 'institution-provenance');
                }
                $this->check(isset($item['locationVerificationStatus']), 'location-status-required');
            }
            if ($mode === 'pilot' && $item['coordinates'] !== null) {
                $this->check($city !== null && $item['locationVerificationStatus'] === 'verified', 'pin-region');
                $this->check($this->timestamp($item['coordinatesVerifiedAt'] ?? null) && $this->text($item['coordinatesVerificationNotes'] ?? null), 'pin-provenance');
                $this->check($this->safeCoordinateSource($item['coordinateSource'] ?? null, $item['coordinatesVerificationMethod'] ?? null), 'pin-source');
            }
            if (isset($item['coordinateLocationLabel'])) {
                $this->check($this->text($item['coordinateLocationLabel']) && $item['coordinates'] !== null, 'pin-label');
            }
            $url = $item['landingPageUrl'] ?? null;
            if ($url !== null) {
                $this->check($this->landingUrl($url), 'landing-url');
                $normalized = strtolower(rtrim($url, '/'));
                $this->check(! isset($landingOwners[$normalized]), 'landing-duplicate');
                $landingOwners[$normalized] = true;
            }
            if (isset($item['landingPageVerificationStatus'])) {
                $this->check(in_array($item['landingPageVerificationStatus'], ['verified', 'needs-review', 'unavailable'], true), 'landing-status');
            }
            if (($item['landingPageVerificationStatus'] ?? null) === 'verified') {
                $this->check($url !== null && $this->text($item['landingPageSource'] ?? null) && $this->timestamp($item['landingPageVerifiedAt'] ?? null) && strtotime($item['landingPageVerifiedAt']) <= time(), 'landing-provenance');
            }
        }
        foreach ($statistics as $record) {
            $this->check(in_array($record['instansiId'], $ids, true), 'statistics-relation');
            $this->check(is_array($record['statistik'] ?? null), 'statistics-object');
            foreach (['jumlahArsip', 'penciptaArsip', 'kopiDigital'] as $key) {
                $this->metric($record['statistik'][$key] ?? null, $metadata, 'instansi', $metadata['metricDefinitions'][$key] ?? null);
            }
            $numerator = $record['statistik']['jumlahArsip']['value'];
            if ($metadata['coverage'] === 'full' && $metadata['nationalTotal'] !== null && $numerator !== null && $metadata['nationalTotal']['value'] !== null) {
                $this->check($numerator <= $metadata['nationalTotal']['value'], 'national-denominator');
            }
            $this->check(array_key_exists('multiCreator', $record) && ($record['multiCreator'] === null || is_bool($record['multiCreator'])), 'multicreator');
            foreach (['trenInput', 'distribusiArsip', 'penciptaArsip'] as $key) {
                $this->check(array_key_exists($key, $record), 'series-required');
                if ($record[$key] === null) {
                    continue;
                }
                $values = $this->list($record[$key], 'series-list');
                $idKey = match ($key) {
                    'trenInput' => 'year', 'distribusiArsip' => 'categoryId', default => 'id'
                };
                $this->unique($values, $idKey);
                foreach ($values as $value) {
                    $this->check(array_key_exists('count', $value) && $this->nonnegative($value['count']), 'series-count');
                    if ($key === 'trenInput') {
                        $this->check(is_int($value['year']) && $value['year'] > 0 && $value['year'] <= (int) substr($metadata['referenceDate'], 0, 4), 'series-year');
                    }
                    if ($key === 'distribusiArsip') {
                        $this->check(isset($categories[$value['categoryId']]) && ($value['label'] ?? null) === $categories[$value['categoryId']], 'distribution-category');
                    }
                    if ($key === 'penciptaArsip') {
                        $this->check($this->text($value['id']) && $this->text($value['name'] ?? null), 'creator-text');
                    }
                }
            }
            $this->check(array_key_exists('monthlyAdded', $record), 'monthly-required');
            if ($record['monthlyAdded'] !== null) {
                $entry = $record['monthlyAdded'];
                $this->check(is_array($entry) && ($entry['yearMonth'] ?? null) === substr($metadata['referenceDate'], 0, 7) && is_int($entry['count'] ?? null) && $entry['count'] >= 0, 'monthly-value');
            }
        }
    }

    private function safeCoordinateSource(mixed $source, mixed $method): bool
    {
        if (! is_string($source) || ! filter_var($source, FILTER_VALIDATE_URL)) {
            return false;
        }
        $url = parse_url($source);
        if (($url['scheme'] ?? null) !== 'https' || isset($url['user']) || isset($url['pass']) || isset($url['port'])) {
            return false;
        }
        $host = strtolower($url['host'] ?? '');
        if ($method === 'google-maps-place') {
            return in_array($host, ['www.google.com', 'google.com', 'maps.google.com', 'google.co.id', 'www.google.co.id', 'maps.google.co.id'], true) && str_starts_with($url['path'] ?? '', '/maps/');
        }

        return in_array($method, ['official-map-embed', 'official-published-coordinates'], true) && (str_ends_with($host, '.go.id') || str_ends_with($host, '.ac.id') || str_ends_with($host, '.sch.id') || str_ends_with($host, '.mil.id'));
    }

    private function landingUrl(mixed $url): bool
    {
        if (! is_string($url)) {
            return false;
        }
        $parsed = parse_url($url);

        return is_array($parsed) && ($parsed['scheme'] ?? null) === 'https' && ($parsed['host'] ?? null) === 'jikn.anri.go.id' && ! isset($parsed['user']) && ! isset($parsed['pass']) && ! isset($parsed['port']) && ! isset($parsed['query']) && ! isset($parsed['fragment'])
            && (bool) preg_match('#^/deskripsi-arsip/sj/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$#iD', $parsed['path'] ?? '');
    }

    public function collection(array $collection, array $regionIds, bool $requireComplete = false): void
    {
        $this->check(($collection['type'] ?? null) === 'FeatureCollection', 'collection-type');
        $features = $this->list($collection['features'] ?? null, 'collection-features');
        $seen = [];
        foreach ($features as $feature) {
            $this->check(is_array($feature), 'collection-feature-object');
            $id = $feature['properties']['id'] ?? null;
            $this->check(($feature['type'] ?? null) === 'Feature' && is_string($id) && in_array($id, $regionIds, true) && ! isset($seen[$id]), 'collection-region');
            $seen[$id] = true;
            $this->check(array_key_exists('geometry', $feature) && $feature['geometry'] !== null, 'collection-geometry');
            $this->geometry($feature['geometry']);
        }
        if ($requireComplete) {
            $this->check(count($seen) === count($regionIds), 'collection-incomplete');
        }
    }
}

<?php

namespace App\Repositories;

use App\Exceptions\InvalidDataset;
use App\Services\DatasetValidator;
use JsonException;

/** Adapter read-only. Kontrak resmi SIKN nanti mengganti adapter, bukan controller/UI. */
final class JsonSnapshotRepository implements InstansiRepository
{
    private array $references = [];

    private array $snapshots = [];

    public function __construct(private DatasetValidator $validator) {}

    private function paths(string $mode): array
    {
        return match ($mode) {
            'pilot' => ['data/datasets/pilot/references.json', 'data/datasets/pilot/snapshot.json'],
            'excel' => ['data/references.json', 'data/datasets/excel/snapshot.json'],
            'demo' => ['demo/references.json', 'demo/snapshot.json'],
            default => throw new InvalidDataset('mode'),
        };
    }

    private function read(string $relative): array
    {
        $root = realpath(config('dashboard.data_root'));
        $file = $root ? realpath($root.DIRECTORY_SEPARATOR.$relative) : false;
        if (! $root || ! $file || ! str_starts_with($file, $root.DIRECTORY_SEPARATOR) || ! is_readable($file)) {
            throw new InvalidDataset('missing-source');
        }
        try {
            $value = json_decode(file_get_contents($file), true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException $e) {
            throw new InvalidDataset('malformed-json');
        }
        if (! is_array($value)) {
            throw new InvalidDataset('json-object');
        }

        return $value;
    }

    public function references(string $mode): array
    {
        if (! isset($this->references[$mode])) {
            $value = $this->read($this->paths($mode)[0]);
            $this->validator->references($value);
            $this->references[$mode] = $value;
        }

        return $this->references[$mode];
    }

    public function snapshot(string $mode): array
    {
        if (! isset($this->snapshots[$mode])) {
            $value = $this->read($this->paths($mode)[1]);
            $this->validator->snapshot($value, $this->references($mode), $mode);
            $this->snapshots[$mode] = $value;
        }

        return $this->snapshots[$mode];
    }

    public function geometry(string $mode, string $provinceId): array
    {
        $regions = array_values(array_filter($this->references($mode)['kabKota'], fn ($r) => $r['provinceId'] === $provinceId));
        $path = collect($regions)->pluck('geometryUrl')->filter()->first();
        if ($path) {
            if ($path !== '/data/geometry/kab-kota/'.$provinceId.'.json') {
                throw new InvalidDataset('geometry-path');
            }
            $collection = $this->read(ltrim($path, '/'));
        } else {
            $collection = ['type' => 'FeatureCollection', 'features' => array_values(array_map(fn ($r) => [
                'type' => 'Feature', 'properties' => ['id' => $r['id'], 'name' => $r['name']], 'geometry' => $r['geometry'],
            ], array_filter($regions, fn ($r) => $r['geometry'] !== null)))];
        }
        $this->validator->collection($collection, array_column($regions, 'id'), $path !== null);

        return $collection;
    }

    public function detailStatistics(string $mode, string $id): ?array
    {
        return collect($this->snapshot($mode)['statistics'])->firstWhere('instansiId', $id);
    }

    public function detailContacts(string $mode, string $id): ?array
    {
        return null;
    }
}

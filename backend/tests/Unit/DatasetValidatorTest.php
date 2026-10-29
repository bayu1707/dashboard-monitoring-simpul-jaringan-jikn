<?php

namespace Tests\Unit;

use App\Exceptions\InvalidDataset;
use App\Services\DatasetValidator;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class DatasetValidatorTest extends TestCase
{
    private static function source(string $file): array
    {
        return json_decode(file_get_contents(__DIR__.'/../../../public/'.$file), true, 512, JSON_THROW_ON_ERROR);
    }

    public function test_all_approved_snapshot_modes_pass_without_normalization(): void
    {
        $validator = new DatasetValidator;
        foreach (['pilot' => ['data/datasets/pilot/references.json', 'data/datasets/pilot/snapshot.json'], 'excel' => ['data/references.json', 'data/datasets/excel/snapshot.json'], 'demo' => ['demo/references.json', 'demo/snapshot.json']] as $mode => [$ref, $snapshot]) {
            $references = self::source($ref);
            $data = self::source($snapshot);
            $before = json_encode($data);
            $validator->references($references);
            $validator->snapshot($data, $references, $mode);
            $this->assertSame($before, json_encode($data));
        }
    }

    #[DataProvider('invalidSnapshotProvider')]
    public function test_invalid_sources_are_rejected(string $change): void
    {
        $data = self::source('demo/snapshot.json');
        $references = self::source('demo/references.json');
        switch ($change) {
            case 'duplicate': $data['instansi'][] = $data['instansi'][0];
                break;
            case 'relationship': $data['instansi'][0]['provinceId'] = '11';
                break;
            case 'coordinate': $data['instansi'][0]['coordinates'] = [91, 106];
                break;
            case 'coordinate-string': $data['instansi'][0]['coordinates'] = ['-6.12', 106];
                break;
            case 'year': $data['instansi'][0]['joinedYear'] = 2027;
                break;
            case 'date': $data['metadata']['referenceDate'] = '2026-02-30';
                break;
            case 'negative': $data['statistics'][0]['statistik']['jumlahArsip']['value'] = -1;
                break;
            case 'snapshot': $data['statistics'][0]['statistik']['jumlahArsip']['snapshotId'] = 'other-snapshot';
                break;
            case 'denominator': $data['statistics'][0]['statistik']['jumlahArsip']['value'] = 99999999;
                break;
            case 'category': $data['statistics'][0]['distribusiArsip'][0]['categoryId'] = 'unknown';
                break;
            case 'landing': $data['instansi'][0]['landingPageUrl'] = 'https://evil.example/';
                break;
            case 'monthly': $data['statistics'][0]['monthlyAdded']['yearMonth'] = '2026-01';
                break;
        }
        $this->expectException(InvalidDataset::class);
        (new DatasetValidator)->snapshot($data, $references, 'demo');
    }

    public static function invalidSnapshotProvider(): array
    {
        return array_map(fn ($v) => [$v], ['duplicate', 'relationship', 'coordinate', 'coordinate-string', 'year', 'date', 'negative', 'snapshot', 'denominator', 'category', 'landing', 'monthly']);
    }

    public function test_duplicate_reference_ids_and_geometry_foreign_ids_are_rejected(): void
    {
        $refs = self::source('demo/references.json');
        $refs['provinces'][] = $refs['provinces'][0];
        $this->expectException(InvalidDataset::class);
        (new DatasetValidator)->references($refs);
    }

    public function test_missing_geometry_is_not_silently_treated_as_complete(): void
    {
        $geometry = self::source('data/geometry/kab-kota/36.json');
        $ids = array_column(array_column($geometry['features'], 'properties'), 'id');
        array_pop($geometry['features']);
        $this->expectException(InvalidDataset::class);
        (new DatasetValidator)->collection($geometry, $ids, true);
    }

    public function test_foreign_geometry_ids_are_rejected(): void
    {
        $geometry = self::source('data/geometry/kab-kota/36.json');
        $geometry['features'][0]['properties']['id'] = '11.71';
        $this->expectException(InvalidDataset::class);
        (new DatasetValidator)->collection($geometry, ['36.73']);
    }
}

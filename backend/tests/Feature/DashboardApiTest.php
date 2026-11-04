<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\File;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

final class DashboardApiTest extends TestCase
{
    private function source(string $path): array
    {
        return json_decode(file_get_contents(base_path('../public/'.$path)), true, 512, JSON_THROW_ON_ERROR);
    }

    public function test_pilot_records_and_pins_are_preserved_across_pagination(): void
    {
        $source = $this->source('data/datasets/pilot/snapshot.json');
        $first = $this->getJson('/api/v1/institutions')->assertOk()->assertJsonPath('meta.total', 643)->assertJsonPath('meta.lastPage', 3)->json();
        $records = $first['data'];
        for ($page = 2; $page <= $first['meta']['lastPage']; $page++) {
            $records = [...$records, ...$this->getJson('/api/v1/institutions?page='.$page)->assertOk()->json('data')];
        }
        $this->assertSame($source['instansi'], $records);
        $this->assertCount(643, array_unique(array_column($records, 'id')));
        $this->assertCount(627, array_filter($records, fn ($r) => $r['coordinates'] !== null));
        $this->assertSame($source['metadata'], $first['metadata']);
        $this->getJson('/api/v1/institutions?page=4')->assertOk()->assertJsonCount(0, 'data')->assertJsonPath('meta.total', 643);
    }

    public function test_excel_and_demo_modes_remain_separate(): void
    {
        $this->getJson('/api/v1/institutions?mode=excel')->assertOk()->assertJsonPath('meta.total', 643)->assertJsonPath('metadata.datasetKind', 'excel');
        $demo = $this->getJson('/api/v1/institutions?mode=demo')->assertOk()->assertJsonPath('meta.total', 7)->assertJsonPath('metadata.datasetKind', 'demo');
        $this->assertSame('demo-a', $demo->json('data.0.id'));
        $this->getJson('/api/v1/dashboard/statistics')->assertOk()->assertJsonPath('data.institutions', 643)->assertJsonPath('data.mapped', 627)->assertJsonPath('data.unmapped', 16);
    }

    public function test_reference_hierarchy_geometry_and_filter_match_source(): void
    {
        $refs = $this->getJson('/api/v1/reference-data')->assertOk()->assertJsonCount(38, 'data.provinces')->assertJsonCount(514, 'data.kabKota')->json('data');
        $this->assertSame($this->source('data/datasets/pilot/references.json'), $refs);
        $this->getJson('/api/v1/provinces/36/regencies')->assertOk()->assertJsonCount(8, 'data');
        $geometry = $this->getJson('/api/v1/geometry/36')->assertOk()->assertJsonPath('type', 'FeatureCollection')->assertJsonCount(8, 'features')->json();
        $this->assertSame($this->source('data/geometry/kab-kota/36.json'), $geometry);
        $items = $this->getJson('/api/v1/institutions?provinceId=36&kabKotaId=36.73')->assertOk()->json('data');
        $this->assertNotEmpty($items);
        foreach ($items as $item) {
            $this->assertSame('36', $item['provinceId']);
            $this->assertSame('36.73', $item['kabKotaId']);
        }
        $kind = $items[0]['jenisId'];
        $this->getJson('/api/v1/institutions?provinceId=36&kabKotaId=36.73&jenisId='.$kind)->assertOk();
    }

    public function test_search_matches_name_or_reference_code_and_preserves_nullable_values(): void
    {
        $records = $this->source('data/datasets/pilot/snapshot.json')['instansi'];
        $institution = $records[0];
        $result = $this->getJson('/api/v1/institutions?search='.urlencode($institution['kode']))->assertOk()->json('data');
        $this->assertContains($institution['id'], array_column($result, 'id'));
        $this->getJson('/api/v1/institutions?search=nonsense-search-with-no-match')->assertOk()->assertJsonPath('meta.total', 0)->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/institutions/demo-a?mode=demo')->assertOk()->assertJsonPath('data.statistik.jumlahArsip.value', 120)->assertJsonPath('data.instansi.id', 'demo-a');
        $demo = $this->source('demo/snapshot.json');
        foreach ($demo['statistics'] as $record) {
            $detail = $this->getJson('/api/v1/institutions/'.$record['instansiId'].'?mode=demo')->assertOk();
            $this->assertSame($record['statistik'], $detail->json('data.statistik'));
        }
    }

    public function test_kalimantan_sulawesi_regions_pins_and_review_exceptions_are_accessible(): void
    {
        foreach (['61' => 14, '62' => 14, '63' => 13, '64' => 10, '65' => 5, '71' => 15, '72' => 13, '73' => 24, '74' => 17, '75' => 6, '76' => 6] as $province => $count) {
            $this->getJson('/api/v1/provinces/'.$province.'/regencies')->assertOk()->assertJsonCount($count, 'data');
            $this->getJson('/api/v1/geometry/'.$province)->assertOk()->assertJsonCount($count, 'features');
            $response = $this->getJson('/api/v1/institutions?provinceId='.$province)->assertOk();
            $this->assertNotEmpty($response->json('data'));
        }
        foreach (['casefile-e155d6b135b6848523b25714', 'casefile-bf1032193988af5c61840d5b', 'casefile-4d38343a923ea5817d9ae016'] as $id) {
            $this->getJson('/api/v1/institutions/'.$id)->assertOk()
                ->assertJsonPath('data.instansi.coordinates', null)
                ->assertJsonPath('data.instansi.locationVerificationStatus', 'needs-review');
        }
        $this->getJson('/api/v1/institutions?provinceId=61&kabKotaId=73.71')->assertUnprocessable();
    }

    public function test_excel_detail_uses_unknown_metrics_without_synthesizing_statistics(): void
    {
        $source = $this->source('data/datasets/excel/snapshot.json');
        $institution = $source['instansi'][0];
        $this->getJson('/api/v1/institutions/'.$institution['id'].'?mode=excel')->assertOk()
            ->assertJsonPath('data.instansi', $institution)->assertJsonPath('data.statistik.jumlahArsip.value', null)
            ->assertJsonPath('data.trenInput', null)->assertJsonPath('data.metadata.datasetKind', 'excel');
        $this->getJson('/api/v1/institutions/nonexistent')->assertNotFound();
    }

    #[DataProvider('invalidQueryProvider')]
    public function test_invalid_modes_and_incompatible_filters_are_rejected(string $query): void
    {
        $this->getJson('/api/v1/institutions?'.$query)->assertUnprocessable();
    }

    public static function invalidQueryProvider(): array
    {
        return array_map(fn ($q) => [$q], ['mode=unknown', 'mode=../../secret', 'provinceId=99', 'provinceId=00', 'kabKotaId=36.73', 'provinceId=11&kabKotaId=36.73', 'jenisId=invalid', 'page=0', 'page[]=1', 'per_page=251', 'search[]=secret']);
    }

    public function test_empty_metric_definitions_serialize_as_json_object_not_list(): void
    {
        $response = $this->getJson('/api/v1/reference-data')->assertOk();
        $decoded = json_decode($response->getContent());
        $this->assertInstanceOf(\stdClass::class, $decoded->data->metadata->metricDefinitions);
        $this->assertIsArray($decoded->data->archiveCategories);
        $this->assertIsArray($decoded->data->kabKota);
    }

    public function test_duplicate_reference_codes_do_not_merge_institutions(): void
    {
        $source = $this->source('data/datasets/excel/snapshot.json');
        foreach (['31025-1', '25316-5'] as $code) {
            $expected = array_values(array_filter($source['instansi'], fn ($r) => $r['kode'] === $code));
            $this->assertGreaterThan(1, count($expected));
            $response = $this->getJson('/api/v1/institutions?mode=excel&search='.$code)->assertOk()->json('data');
            $this->assertSame($expected, $response);
            $this->assertCount(count($expected), array_unique(array_column($response, 'id')));
        }
    }

    public function test_cors_allows_only_configured_local_frontend_origins(): void
    {
        $this->withHeaders(['Origin' => 'http://127.0.0.1:3000'])->getJson('/api/v1/provinces')->assertOk()->assertHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:3000');
        $this->withHeaders(['Origin' => 'https://untrusted.example'])->getJson('/api/v1/provinces')->assertOk()->assertHeaderMissing('Access-Control-Allow-Origin');
    }

    public function test_missing_or_corrupt_sources_fail_safely_without_exposing_paths(): void
    {
        config(['dashboard.data_root' => '/not-a-real-private-folder']);
        $body = $this->getJson('/api/v1/institutions')->assertServiceUnavailable()->assertJsonPath('code', 'DATASET_UNAVAILABLE')->json();
        $this->assertStringNotContainsString('/not-a-real', json_encode($body));
    }

    public function test_corrupt_source_retries_after_file_repair(): void
    {
        $root = sys_get_temp_dir().'/jikn-api-test-'.bin2hex(random_bytes(6));
        File::makeDirectory($root.'/data/datasets/excel', 0755, true);
        File::copy(base_path('../public/data/references.json'), $root.'/data/references.json');
        File::put($root.'/data/datasets/excel/snapshot.json', '{invalid');
        config(['dashboard.data_root' => $root]);
        try {
            $this->getJson('/api/v1/institutions?mode=excel')->assertServiceUnavailable();
            File::copy(base_path('../public/data/datasets/excel/snapshot.json'), $root.'/data/datasets/excel/snapshot.json');
            $this->getJson('/api/v1/institutions?mode=excel')->assertOk()->assertJsonPath('meta.total', 643);
        } finally {
            File::deleteDirectory($root);
        }
    }
}

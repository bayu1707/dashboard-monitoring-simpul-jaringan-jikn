<?php

namespace Tests\Feature;

use App\Exceptions\SiknUnavailable;
use App\Services\SiknSource;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

final class SiknPocTest extends TestCase
{
    private ?string $directory = null;

    private array $institution;

    private SiknSource $fake;

    private function configure(): void
    {
        $this->directory = base_path('../.local/sikn-poc/test-'.bin2hex(random_bytes(5)));
        File::makeDirectory($this->directory, 0700, true);
        $snapshot = json_decode(file_get_contents(base_path('../public/data/datasets/pilot/snapshot.json')), true);
        $this->institution = $snapshot['instansi'][0];
        $uuid = '11111111-1111-4111-8111-111111111111';
        File::put($this->directory.'/config.json', json_encode([
            'enabled' => true, 'host' => '127.0.0.1', 'port' => 55439, 'database' => 'fixture', 'username' => 'fixture_readonly',
            'sourceId' => 'fixture-local', 'capturedAt' => '2026-10-23T00:00:00Z', 'referenceDate' => '2026-03-09',
        ]));
        File::put($this->directory.'/crosswalk.json', json_encode(['mappings' => [[
            'localId' => $this->institution['id'], 'siknUuid' => $uuid, 'matchBasis' => 'kode-dan-nama-sama',
        ]]]));
        config(['dashboard.sikn_poc_config' => $this->directory.'/config.json']);
        $this->fake = new class($this->institution, $uuid) implements SiknSource
        {
            public int $metricCalls = 0;

            public int $contactCalls = 0;

            public bool $fail = false;

            public array $rows;

            public function __construct(array $institution, string $uuid)
            {
                $this->rows = [['id' => 17, 'uuid' => $uuid, 'code' => $institution['kode'], 'name' => $institution['name']]];
            }

            public function identities(): array
            {
                if ($this->fail) {
                    throw new SiknUnavailable;
                }

                return $this->rows;
            }

            public function metrics(int $repositoryId): array
            {
                $this->metricCalls++;

                return ['jumlahArsip' => 0, 'penciptaArsip' => 0, 'kopiDigital' => 0];
            }

            public function contacts(int $repositoryId): array
            {
                $this->contactCalls++;

                return [['is_primary' => 1, 'email' => 'office@example.invalid', 'phone' => '0215550100']];
            }
        };
        $this->app->instance(SiknSource::class, $this->fake);
    }

    protected function tearDown(): void
    {
        if ($this->directory) {
            File::deleteDirectory($this->directory);
        }
        parent::tearDown();
    }

    public function test_mode_preserves_catalogue_geometry_and_excel_years_but_never_simulated_metrics(): void
    {
        $this->configure();
        $response = $this->getJson('/api/v1/institutions?mode=sikn')->assertOk()
            ->assertJsonPath('meta.total', 643)->assertJsonPath('metadata.datasetKind', 'database');
        $this->assertSame(0, $this->fake->metricCalls, 'List tidak menjalankan agregasi arsip besar.');
        $this->assertSame(0, $this->fake->contactCalls, 'Daftar tidak mengekspor kontak secara massal.');
        $first = $response->json('data.0');
        foreach (['id', 'kode', 'name', 'coordinates', 'provinceId', 'kabKotaId', 'joinedYear', 'joinedYearSource', 'landingPageUrl'] as $key) {
            $this->assertSame($this->institution[$key], $first[$key]);
        }
        $this->getJson('/api/v1/reference-data?mode=sikn')->assertOk()->assertJsonCount(38, 'data.provinces')->assertJsonCount(514, 'data.kabKota');
        $this->getJson('/api/v1/geometry/36?mode=sikn')->assertOk()->assertJsonCount(8, 'features');
        $this->getJson('/api/v1/institutions/'.$first['id'].'?mode=sikn')->assertOk()
            ->assertJsonPath('data.statistik.jumlahArsip.value', 0)->assertJsonPath('data.trenInput', null)
            ->assertJsonPath('data.metadata.nationalTotal', null)->assertJsonPath('data.distribusiArsip', null);
        $this->assertSame(1, $this->fake->metricCalls);
        $this->assertSame(1, $this->fake->contactCalls);
        $this->assertStringNotContainsString('credentialFile', $response->getContent());
        $this->assertStringNotContainsString('fixture_readonly', $response->getContent());
    }

    public function test_matching_requires_code_and_name_and_unmatched_values_stay_null(): void
    {
        $this->configure();
        $this->fake->rows[0]['name'] = 'Instansi berbeda dengan kode yang sama';
        $this->getJson('/api/v1/institutions/'.$this->institution['id'].'?mode=sikn')->assertOk()
            ->assertJsonPath('data.statistik.jumlahArsip.value', null)->assertJsonPath('data.trenInput', null)
            ->assertJsonPath('data.instansi.email', null)->assertJsonPath('data.instansi.phone', null)
            ->assertJsonPath('data.instansi.contactVerificationStatus', 'unavailable');
        $this->assertSame(0, $this->fake->metricCalls);
        $this->assertSame(0, $this->fake->contactCalls);
    }

    public function test_contacts_are_detail_only_from_a_verified_identity_and_not_publicly_certified(): void
    {
        $this->configure();
        $this->getJson('/api/v1/institutions?mode=sikn')->assertOk()->assertJsonPath('data.0.email', null);
        $response = $this->getJson('/api/v1/institutions/'.$this->institution['id'].'?mode=sikn')->assertOk()
            ->assertJsonPath('data.instansi.email', 'office@example.invalid')
            ->assertJsonPath('data.instansi.phone', '0215550100')
            ->assertJsonPath('data.instansi.contactVerificationStatus', 'needs-review');
        $this->assertStringNotContainsString('contact_person', $response->getContent());
        $this->getJson('/api/v1/institutions/'.$this->institution['id'].'?mode=excel')->assertOk()
            ->assertJsonPath('data.instansi.email', null)->assertJsonPath('data.instansi.phone', null);
    }

    public function test_ambiguous_translation_rows_do_not_attach_counts_to_an_institution(): void
    {
        $this->configure();
        $this->fake->rows[] = $this->fake->rows[0];
        $this->getJson('/api/v1/institutions/'.$this->institution['id'].'?mode=sikn')->assertOk()
            ->assertJsonPath('data.statistik.jumlahArsip.value', null);
        $this->assertSame(0, $this->fake->metricCalls);
    }

    public function test_duplicate_crosswalk_targets_fail_closed(): void
    {
        $this->configure();
        $value = json_decode(File::get($this->directory.'/crosswalk.json'), true);
        $value['mappings'][] = $value['mappings'][0];
        File::put($this->directory.'/crosswalk.json', json_encode($value));
        $this->getJson('/api/v1/institutions?mode=sikn')->assertServiceUnavailable()->assertJsonPath('code', 'SIKN_LOCAL_UNAVAILABLE');
    }

    public function test_database_failure_does_not_silently_switch_to_pilot_or_leak_driver_errors(): void
    {
        $this->configure();
        $this->fake->fail = true;
        $response = $this->getJson('/api/v1/institutions?mode=sikn')->assertServiceUnavailable()->assertJsonPath('code', 'SIKN_LOCAL_UNAVAILABLE');
        $this->assertStringNotContainsString('.local', $response->getContent());
        $this->assertStringNotContainsString('SQLSTATE', $response->getContent());
        $this->getJson('/api/v1/institutions?mode=pilot')->assertOk()->assertJsonPath('metadata.datasetKind', 'pilot');
    }

    public function test_database_mode_is_forbidden_outside_loopback(): void
    {
        $this->configure();
        $this->withServerVariables(['REMOTE_ADDR' => '192.0.2.7'])->getJson('/api/v1/institutions?mode=sikn')->assertForbidden();
    }

    public function test_missing_private_configuration_is_unavailable_without_affecting_demo(): void
    {
        config(['dashboard.sikn_poc_config' => '/not-an-allowed-private-config']);
        $this->getJson('/api/v1/institutions?mode=sikn')->assertServiceUnavailable()->assertJsonPath('code', 'SIKN_LOCAL_UNAVAILABLE');
        $this->getJson('/api/v1/institutions?mode=demo')->assertOk()->assertJsonPath('meta.total', 7);
    }
}

<?php

namespace Tests\Feature;

use App\Repositories\DevelopmentRepository;
use App\Services\DevelopmentDatabase;
use App\Services\DevelopmentService;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;
use Tests\TestCase;

/** Tes PostgreSQL opt-in pada database _test; semua perubahan data di-rollback. */
final class DevelopmentPostgresTest extends TestCase
{
    private ?DevelopmentDatabase $db = null;

    private ?string $temporary = null;

    private array $settings;

    private array $point;

    protected function setUp(): void
    {
        parent::setUp();
        if (getenv('JIKN_DEV_PG_TEST') !== '1') {
            $this->markTestSkipped('Memerlukan database PostgreSQL development _test.');
        }
        $file = base_path('../.local/development/test-connection.json');
        if (! is_file($file)) {
            $this->markTestSkipped('Jalankan setup-development.py --test-db.');
        }
        $this->settings = json_decode(file_get_contents($file), true);
        $this->assertSame('jikn_dashboard_dev_test', $this->settings['database']);
        $this->settings['geocoder'] = ['enabled' => ! str_contains($this->name(), 'disabled'),
            'endpoint' => 'https://fixture-'.bin2hex(random_bytes(5)).'.invalid/search', 'userAgent' => 'JIKN automated-test'];
        $this->temporary = dirname($file).'/test-'.bin2hex(random_bytes(6)).'.json';
        file_put_contents($this->temporary, json_encode($this->settings));
        chmod($this->temporary, 0600);
        config(['dashboard.development_config' => $this->temporary]);
        $this->db = app(DevelopmentDatabase::class);
        $this->db->connection()->beginTransaction();
        $source = json_decode(file_get_contents(base_path('../public/data/datasets/pilot/snapshot.json')), true);
        $this->point = collect($source['instansi'])->first(fn ($i) => $i['kabKotaId'] === '36.73' && $i['coordinates'] !== null);
        Http::preventStrayRequests();
    }

    protected function tearDown(): void
    {
        if ($this->db) {
            while ($this->db->connection()->transactionLevel() > 0) {
                $this->db->connection()->rollBack();
            }
        }
        if ($this->temporary) {
            unlink($this->temporary);
        }
        parent::tearDown();
    }

    private function input(array $changes = []): array
    {
        return [...['externalSource' => 'automated-test', 'externalId' => 'stable-001', 'name' => 'Simpul Uji Serang',
            'provinceId' => '36', 'kabKotaId' => '36.73', 'address' => 'Alamat publik untuk simulasi Serang, Banten',
            'latitude' => $this->point['coordinates'][0], 'longitude' => $this->point['coordinates'][1], 'joinedYear' => 2020,
            'landingPageUrl' => null, 'landingVerified' => false, 'coordinateSource' => $this->point['coordinateSource'],
            'coordinateConfirmed' => true, 'tryGeocoding' => false], ...$changes];
    }

    public function test_manual_verified_coordinates_flow_to_catalogue_without_simulated_statistics(): void
    {
        $saved = app(DevelopmentService::class)->saveInstitution($this->input());
        $this->assertSame('verified', $saved['coordinateStatus']);
        $repo = app(DevelopmentRepository::class);
        $snapshot = $repo->snapshot('dev');
        $record = collect($snapshot['instansi'])->firstWhere('id', 'dev-'.$saved['id']);
        $this->assertSame($this->point['coordinates'], $record['coordinates']);
        $this->assertSame(2020, $record['joinedYear']);
        $this->assertSame('development', $snapshot['metadata']['datasetKind']);
        $this->assertSame([], $snapshot['statistics']);
        $this->assertNotEmpty($this->db->connection()->table('dev_audit_events')->where('institution_id', $saved['id'])->get());
    }

    public function test_contacts_persist_and_sync_without_optional_fields_preserves_them(): void
    {
        $service = app(DevelopmentService::class);
        $saved = $service->saveInstitution($this->input(['email' => 'office@example.invalid', 'phone' => '0215550100']));
        $service->saveInstitution($this->input(['name' => 'Sinkron ulang tanpa field kontak']), sync: true);
        $snapshot = app(DevelopmentRepository::class)->snapshot('dev');
        $row = collect($snapshot['instansi'])->firstWhere('id', 'dev-'.$saved['id']);
        $this->assertSame('office@example.invalid', $row['email']);
        $this->assertSame('0215550100', $row['phone']);
        $this->assertSame('needs-review', $row['contactVerificationStatus']);
        $service->saveInstitution($this->input(['email' => null, 'phone' => null]), sync: true);
        $raw = $this->db->connection()->table('dev_institutions')->where('id', $saved['id'])->first();
        $this->assertNull($raw->email);
        $this->assertNull($raw->phone);
        $this->assertSame(1, $this->db->connection()->table('dev_institutions')->count());
    }

    public function test_invalid_contact_input_does_not_write_a_record(): void
    {
        foreach ([['email' => 'not-an-email'], ['email' => 'null@mail.com'], ['phone' => "0215550100\n123"], ['phone' => '0'], ['phone' => '0000000000']] as $changes) {
            try {
                app(DevelopmentService::class)->saveInstitution($this->input($changes));
                $this->fail('Kontak tidak valid harus ditolak.');
            } catch (ValidationException $e) {
                $this->assertArrayHasKey(array_key_first($changes), $e->errors());
            }
        }
        $this->assertSame(0, $this->db->connection()->table('dev_institutions')->count());
    }

    public function test_new_testing_regions_have_no_fabricated_geometry_and_preserve_hierarchy(): void
    {
        $service = app(DevelopmentService::class);
        $service->createRegion(['id' => '36.99', 'name' => 'Kabupaten Uji', 'level' => 'kabKota', 'provinceId' => '36']);
        $service->createRegion(['id' => '99', 'name' => 'Provinsi Uji', 'level' => 'province', 'provinceId' => null]);
        $service->createRegion(['id' => '99.01', 'name' => 'Kota Uji', 'level' => 'kabKota', 'provinceId' => '99']);
        $one = $service->saveInstitution($this->input(['kabKotaId' => '36.99']));
        $this->assertSame('verified', $one['coordinateStatus']);
        $two = $service->saveInstitution($this->input(['externalId' => 'test-province', 'provinceId' => '99', 'kabKotaId' => '99.01']));
        $this->assertSame('needs-review', $two['coordinateStatus']);
        $refs = app(DevelopmentRepository::class)->references('dev');
        $city = collect($refs['kabKota'])->firstWhere('id', '36.99');
        $this->assertNull($city['geometry']);
        $this->assertSame('36', $city['provinceId']);
        $this->assertCount(39, $refs['provinces']);
    }

    public function test_duplicates_are_rejected_and_repeated_sync_preserves_uuid(): void
    {
        $service = app(DevelopmentService::class);
        $first = $service->saveInstitution($this->input());
        $sync = $service->saveInstitution($this->input(['name' => 'Nama Uji Diperbarui']), sync: true);
        $this->assertSame($first['id'], $sync['id']);
        $this->assertSame(1, $this->db->connection()->table('dev_institutions')->count());
        $this->expectException(ConflictHttpException::class);
        $service->saveInstitution($this->input());
    }

    public function test_stale_edits_do_not_overwrite_newer_changes(): void
    {
        $service = app(DevelopmentService::class);
        $first = $service->saveInstitution($this->input());
        $service->saveInstitution($this->input(['version' => 1, 'name' => 'Perubahan pertama']), $first['id']);
        $this->expectException(ConflictHttpException::class);
        $service->saveInstitution($this->input(['version' => 1, 'name' => 'Perubahan basi']), $first['id']);
    }

    public function test_outside_region_coordinates_are_never_published_and_unknown_year_stays_null(): void
    {
        app(DevelopmentService::class)->saveInstitution($this->input(['latitude' => 0, 'longitude' => 0, 'joinedYear' => null]));
        $record = app(DevelopmentRepository::class)->snapshot('dev')['instansi'][0];
        $this->assertNull($record['coordinates']);
        $this->assertNull($record['joinedYear']);
        $this->assertSame('needs-review', $record['locationVerificationStatus']);
    }

    public function test_disabled_geocoder_saves_record_without_any_external_request(): void
    {
        $saved = app(DevelopmentService::class)->saveInstitution($this->input(['latitude' => null, 'longitude' => null, 'coordinateConfirmed' => false, 'tryGeocoding' => true]));
        $this->assertSame('not-configured', $saved['geocodeStatus']);
        $this->assertSame('needs-review', $saved['coordinateStatus']);
        Http::assertNothingSent();
    }

    public function test_geocoding_candidates_are_cached_but_never_automatically_published(): void
    {
        Http::fake([$this->settings['geocoder']['endpoint'].'*' => Http::response([['lat' => $this->point['coordinates'][0], 'lon' => $this->point['coordinates'][1], 'display_name' => 'Kandidat kantor Serang']])]);
        $service = app(DevelopmentService::class);
        $input = $this->input(['latitude' => null, 'longitude' => null, 'coordinateConfirmed' => false, 'tryGeocoding' => true]);
        $first = $service->saveInstitution($input);
        $second = $service->saveInstitution([...$input, 'externalId' => 'stable-002']);
        $this->assertSame('candidate', $first['geocodeStatus']);
        $this->assertSame('candidate', $second['geocodeStatus']);
        Http::assertSentCount(1);
        foreach (app(DevelopmentRepository::class)->snapshot('dev')['instansi'] as $record) {
            $this->assertNull($record['coordinates']);
        }
    }

    public function test_ambiguous_geocoding_does_not_create_a_marker(): void
    {
        $candidate = ['lat' => $this->point['coordinates'][0], 'lon' => $this->point['coordinates'][1], 'display_name' => 'Nama kantor ambigu'];
        Http::fake([$this->settings['geocoder']['endpoint'].'*' => Http::response([$candidate, $candidate])]);
        $saved = app(DevelopmentService::class)->saveInstitution($this->input(['latitude' => null, 'longitude' => null, 'coordinateConfirmed' => false, 'tryGeocoding' => true]));
        $this->assertSame('ambiguous', $saved['geocodeStatus']);
        $this->assertNull(app(DevelopmentRepository::class)->snapshot('dev')['instansi'][0]['coordinates']);
    }

    public function test_geocoding_failure_is_not_data_loss(): void
    {
        Http::fake([$this->settings['geocoder']['endpoint'].'*' => Http::response([], 503)]);
        $saved = app(DevelopmentService::class)->saveInstitution($this->input(['latitude' => null, 'longitude' => null, 'coordinateConfirmed' => false, 'tryGeocoding' => true]));
        $this->assertSame('failed', $saved['geocodeStatus']);
        $this->assertSame(1, $this->db->connection()->table('dev_institutions')->count());
    }

    public function test_write_api_requires_private_token_and_loopback(): void
    {
        $this->postJson('/api/v1/development/institutions', $this->input())->assertForbidden();
        $this->withHeaders(['X-Dev-Token' => $this->settings['apiToken']])->postJson('/api/v1/development/institutions', $this->input())->assertOk();
        $this->withServerVariables(['REMOTE_ADDR' => '192.0.2.9'])->withHeaders(['X-Dev-Token' => $this->settings['apiToken']])->postJson('/api/v1/development/institutions', $this->input())->assertForbidden();
    }

    public function test_no_geocoding_result_keeps_the_institution_without_a_pin(): void
    {
        Http::fake([$this->settings['geocoder']['endpoint'].'*' => Http::response([])]);
        $saved = app(DevelopmentService::class)->saveInstitution($this->input(['latitude' => null, 'longitude' => null, 'coordinateConfirmed' => false, 'tryGeocoding' => true]));
        $this->assertSame('not-found', $saved['geocodeStatus']);
        $this->assertNull(app(DevelopmentRepository::class)->snapshot('dev')['instansi'][0]['coordinates']);
    }

    public function test_rate_limit_does_not_issue_a_second_request_or_discard_records(): void
    {
        Http::fake([$this->settings['geocoder']['endpoint'].'*' => Http::response([])]);
        $service = app(DevelopmentService::class);
        $input = $this->input(['latitude' => null, 'longitude' => null, 'coordinateConfirmed' => false, 'tryGeocoding' => true]);
        $service->saveInstitution($input);
        $second = $service->saveInstitution([...$input, 'name' => 'Alamat pencarian berbeda', 'externalId' => 'rate-002']);
        $this->assertSame('rate-limited', $second['geocodeStatus']);
        Http::assertSentCount(1);
        $this->assertSame(2, $this->db->connection()->table('dev_institutions')->count());
    }

    public function test_direct_sql_update_bumps_revision_version_and_requires_location_reconfirmation(): void
    {
        $saved = app(DevelopmentService::class)->saveInstitution($this->input());
        $before = $this->db->connection()->table('dev_meta')->value('revision');
        $this->db->connection()->table('dev_institutions')->where('id', $saved['id'])->update(['latitude' => $this->point['coordinates'][0] + 0.0001]);
        $row = $this->db->connection()->table('dev_institutions')->where('id', $saved['id'])->first();
        $this->assertSame(2, $row->version);
        $this->assertSame('needs-review', $row->coordinate_status);
        $this->assertGreaterThan($before, $this->db->connection()->table('dev_meta')->value('revision'));
        $this->assertNull(app(DevelopmentRepository::class)->snapshot('dev')['instansi'][0]['coordinates']);
    }
}

<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Throwable;

/** Adapter Nominatim-compatible untuk provider yang dipilih dan diizinkan tim. Tidak ada provider publik default. */
final class DevelopmentGeocoder
{
    public function __construct(private DevelopmentDatabase $database, private DevelopmentLocation $location) {}

    public function lookup(array $input): array
    {
        $settings = $this->database->settings()['geocoder'] ?? [];
        $empty = ['candidates' => [], 'status' => 'not-configured', 'note' => 'Layanan geocoding belum dikonfigurasi. Isi koordinat tervalidasi atau tunggu provider yang diizinkan.'];
        if (($settings['enabled'] ?? false) !== true || empty($settings['endpoint']) || empty($settings['userAgent'])) {
            return $empty;
        }
        $endpoint = $settings['endpoint'];
        if (! str_starts_with($endpoint, 'https://') && ! preg_match('#^http://127\.0\.0\.1:\d+/#', $endpoint)) {
            return $empty;
        }
        // Penggunaan layanan publik OSM memerlukan keputusan sadar tim atas kebijakan penggunaannya.
        if (parse_url($endpoint, PHP_URL_HOST) === 'nominatim.openstreetmap.org' && ($settings['publicPolicyAccepted'] ?? false) !== true) {
            return $empty;
        }
        $key = hash('sha256', $endpoint.json_encode([$input['name'], $input['address'], $input['provinceId'], $input['kabKotaId']]));
        $db = $this->database->connection();
        $cached = $db->table('dev_geocode_cache')->where('cache_key', $key)->where('expires_at', '>', now())->first();
        if ($cached) {
            return json_decode($cached->result, true);
        }
        // Lock lintas request/proses pada satu mesin; tanpa tidur/retry tersembunyi.
        $provider = hash('sha256', parse_url($endpoint, PHP_URL_HOST).':'.parse_url($endpoint, PHP_URL_PORT));
        $lock = Cache::store('file')->lock('jikn-development-geocoder-'.$provider, 20);
        if (! $lock->get()) {
            return ['candidates' => [], 'status' => 'rate-limited', 'note' => 'Geocoding sedang dipakai; coba lagi setelah jeda.'];
        }
        try {
            if (! Cache::store('file')->add('jikn-development-geocoder-rate-'.$provider, true, 2)) {
                return ['candidates' => [], 'status' => 'rate-limited', 'note' => 'Batas laju layanan tercapai; coba lagi setelah jeda.'];
            }
            $response = Http::timeout(6)->connectTimeout(3)->withHeaders(['User-Agent' => $settings['userAgent']])->get($endpoint, [
                'q' => $input['name'].', '.$input['address'].', Indonesia', 'format' => 'jsonv2', 'countrycodes' => 'id',
                'addressdetails' => 1, 'limit' => 3,
            ]);
            if (! $response->successful() || ! is_array($response->json())) {
                return ['candidates' => [], 'status' => 'failed', 'note' => 'Layanan geocoding gagal. Tidak ada koordinat yang dikarang.'];
            }
            $candidates = [];
            foreach (array_slice($response->json(), 0, 3) as $row) {
                if (! is_numeric($row['lat'] ?? null) || ! is_numeric($row['lon'] ?? null)) {
                    continue;
                }
                $lat = (float) $row['lat'];
                $lon = (float) $row['lon'];
                if (! is_finite($lat) || ! is_finite($lon) || abs($lat) > 90 || abs($lon) > 180) {
                    continue;
                }
                $check = $this->location->check($input['provinceId'], $input['kabKotaId'], $lat, $lon);
                $candidates[] = ['latitude' => $lat, 'longitude' => $lon, 'label' => mb_substr((string) ($row['display_name'] ?? ''), 0, 500),
                    'withinRegion' => $check['valid'], 'note' => $check['note'], 'source' => $endpoint, 'checkedAt' => now()->toISOString()];
            }
            $valid = array_values(array_filter($candidates, fn ($c) => $c['withinRegion']));
            $result = ['candidates' => $candidates, 'status' => count($valid) === 1 && count($candidates) === 1 ? 'candidate' : (count($candidates) ? 'ambiguous' : 'not-found'),
                'note' => 'Hasil geocoding adalah kandidat, bukan bukti posisi kantor. Tinjau nama, alamat dan koordinat sebelum mengonfirmasi marker.'];
            $db->table('dev_geocode_cache')->upsert([['cache_key' => $key, 'result' => json_encode($result), 'expires_at' => now()->addDays(30)]], ['cache_key'], ['result', 'expires_at']);

            return $result;
        } catch (Throwable) {
            return ['candidates' => [], 'status' => 'failed', 'note' => 'Geocoding tidak tersedia; instansi tetap tersimpan tanpa marker.'];
        } finally {
            $lock->release();
        }
    }
}

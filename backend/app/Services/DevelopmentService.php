<?php

namespace App\Services;

use App\Exceptions\DevelopmentUnavailable;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Throwable;

final class DevelopmentService
{
    public function __construct(private DevelopmentDatabase $database, private DevelopmentLocation $location, private DevelopmentGeocoder $geocoder) {}

    public function status(): array
    {
        try {
            $db = $this->database->connection();
            $meta = $db->table('dev_meta')->where('id', 1)->first();

            return ['revision' => 'development-v'.$meta->revision, 'label' => 'DATA UJI — PostgreSQL development terpisah',
                'institutions' => $db->table('dev_institutions')->whereNull('deleted_at')->count(),
                'geocoderConfigured' => ($this->database->settings()['geocoder']['enabled'] ?? false) === true];
        } catch (Throwable) {
            throw new DevelopmentUnavailable;
        }
    }

    public function regions(): array
    {
        return $this->database->connection()->table('dev_regions')->orderBy('id')->get()->all();
    }

    public function institutions(): array
    {
        return $this->database->connection()->table('dev_institutions')->whereNull('deleted_at')->orderBy('created_at')->get()->all();
    }

    public function createRegion(array $input): array
    {
        $v = Validator::make($input, ['id' => ['required', 'string', 'regex:/^\d{2}(\.\d{2})?$/D'],
            'name' => ['required', 'string', 'max:255'], 'level' => ['required', 'in:province,kabKota'],
            'provinceId' => ['nullable', 'string', 'regex:/^\d{2}$/D']])->validate();
        $db = $this->database->connection();
        if (($v['level'] === 'province' && (strlen($v['id']) !== 2 || ! empty($v['provinceId'])))
            || ($v['level'] === 'kabKota' && (strlen($v['id']) !== 5 || substr($v['id'], 0, 2) !== ($v['provinceId'] ?? '')
                || ! $db->table('dev_regions')->where('id', $v['provinceId'] ?? '')->where('level', 'province')->exists()))) {
            throw ValidationException::withMessages(['provinceId' => 'Kode/level wilayah harus sesuai dengan provinsi induk.']);
        }
        try {
            $db->table('dev_regions')->insert(['id' => $v['id'], 'name' => trim($v['name']), 'level' => $v['level'], 'province_id' => $v['provinceId'] ?? null, 'origin' => 'testing']);
        } catch (QueryException $e) {
            if ($e->getCode() === '23505') {
                throw new ConflictHttpException('Kode wilayah sudah tersedia; data existing tidak ditimpa.');
            }
            throw new DevelopmentUnavailable;
        }

        return ['id' => $v['id'], 'message' => 'Wilayah uji tersimpan tanpa polygon buatan. Gunakan dropdown/daftar untuk memilihnya.'];
    }

    private function validateInstitution(array $input): array
    {
        foreach (['email', 'phone'] as $field) {
            if (isset($input[$field]) && is_string($input[$field])) {
                $trimmed = trim($input[$field]);
                $input[$field] = $trimmed === '' ? null : $trimmed;
            }
        }
        $v = Validator::make($input, [
            'externalSource' => ['required', 'string', 'regex:/^[a-z0-9_-]{1,40}$/D'],
            'externalId' => ['required', 'string', 'max:120'], 'name' => ['required', 'string', 'max:255'],
            'provinceId' => ['required', 'string', 'regex:/^\d{2}$/D'], 'kabKotaId' => ['nullable', 'string', 'regex:/^\d{2}\.\d{2}$/D'],
            'address' => ['required', 'string', 'max:1000'], 'latitude' => ['nullable', 'numeric', 'between:-90,90', 'required_with:longitude'],
            'email' => ['sometimes', 'nullable', 'string', 'max:254'], 'phone' => ['sometimes', 'nullable', 'string', 'max:40'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180', 'required_with:latitude'],
            'joinedYear' => ['nullable', 'integer', 'between:1800,'.now()->year],
            'landingPageUrl' => ['nullable', 'string', 'max:500', 'regex:#^https://jikn\.anri\.go\.id/deskripsi-arsip/sj/[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$#D'],
            'landingVerified' => ['required', 'boolean'], 'coordinateConfirmed' => ['required', 'boolean'],
            'coordinateSource' => ['nullable', 'url:https', 'max:1000', 'required_if:coordinateConfirmed,true'],
            'tryGeocoding' => ['required', 'boolean'], 'version' => ['nullable', 'integer', 'min:1'],
        ])->validate();
        foreach (['email', 'phone'] as $field) {
            if (isset($v[$field]) && InstitutionContacts::{$field}($v[$field]) === null) {
                throw ValidationException::withMessages([$field => $field === 'email' ? 'Isi satu alamat email yang valid.' : 'Isi satu nomor telepon yang valid, minimal 6 digit.']);
            }
        }
        foreach (['externalId', 'name', 'address'] as $field) {
            $v[$field] = trim($v[$field]);
            if ($v[$field] === '') {
                throw ValidationException::withMessages([$field => 'Nilai tidak boleh hanya spasi.']);
            }
        }
        $db = $this->database->connection();
        if (! $db->table('dev_regions')->where('id', $v['provinceId'])->where('level', 'province')->exists()
            || (! empty($v['kabKotaId']) && ! $db->table('dev_regions')->where('id', $v['kabKotaId'])->where('province_id', $v['provinceId'])->where('level', 'kabKota')->exists())) {
            throw ValidationException::withMessages(['kabKotaId' => 'Provinsi dan kabupaten/kota harus tersedia dan sesuai.']);
        }
        if ($v['landingVerified'] && empty($v['landingPageUrl'])) {
            throw ValidationException::withMessages(['landingPageUrl' => 'Isi tautan yang sudah Anda verifikasi terlebih dahulu.']);
        }

        return $v;
    }

    public function saveInstitution(array $input, ?string $id = null, bool $sync = false): array
    {
        $v = $this->validateInstitution($input);
        $db = $this->database->connection();
        $geo = ['status' => 'not-requested', 'candidates' => [], 'note' => 'Koordinat belum tersedia; tidak dibuat titik perkiraan.'];
        $lat = $v['latitude'] ?? null;
        $lon = $v['longitude'] ?? null;
        $status = $lat === null ? 'missing' : 'needs-review';
        $note = 'Koordinat masukan belum dikonfirmasi penguji.';
        if ($lat !== null && $lon !== null) {
            $check = $this->location->check($v['provinceId'], $v['kabKotaId'] ?? null, (float) $lat, (float) $lon);
            $note = $check['note'];
            if ($check['valid'] && $v['coordinateConfirmed']) {
                $status = 'verified';
            }
        } elseif ($v['tryGeocoding']) {
            $geo = $this->geocoder->lookup([...$v, 'kabKotaId' => $v['kabKotaId'] ?? null]);
            $note = $geo['note'];
            $status = 'needs-review';
        } else {
            $note = $geo['note'];
        }
        $payload = ['external_source' => $v['externalSource'], 'external_id' => $v['externalId'], 'name' => $v['name'],
            'province_id' => $v['provinceId'], 'regency_id' => $v['kabKotaId'] ?? null, 'address' => $v['address'],
            'latitude' => $lat, 'longitude' => $lon, 'joined_year' => $v['joinedYear'] ?? null,
            'landing_page_url' => $v['landingPageUrl'] ?? null, 'landing_verified' => $v['landingVerified'],
            'coordinate_status' => $status, 'coordinate_source' => $v['coordinateSource'] ?? null,
            'coordinate_verified_at' => $status === 'verified' ? now() : null,
            'geocode_status' => $geo['status'], 'geocode_candidates' => json_encode($geo['candidates']),
            'location_note' => $note, 'updated_at' => now()];
        // Payload klien lama tanpa field kontak tidak menghapus kontak saat edit/sinkron ulang.
        foreach (['email', 'phone'] as $field) {
            if (array_key_exists($field, $v)) {
                $payload[$field] = $v[$field];
            }
        }
        try {
            return $db->transaction(function () use ($db, $payload, $id, $v, $sync) {
                $existing = $id ? $db->table('dev_institutions')->where('id', $id)->whereNull('deleted_at')->lockForUpdate()->first() : null;
                if ($id && ! $existing) {
                    throw new NotFoundHttpException('Instansi uji tidak ditemukan.');
                }
                $duplicate = $db->table('dev_institutions')->whereRaw('lower(external_source)=? AND lower(external_id)=?', [strtolower($v['externalSource']), strtolower($v['externalId'])])->lockForUpdate()->first();
                if ($sync && ! $existing) {
                    $existing = $duplicate;
                }
                if ($duplicate && $duplicate->id !== ($existing->id ?? null)) {
                    throw new ConflictHttpException('Identifier sumber sudah digunakan. Gunakan edit atau sinkronisasi idempoten.');
                }
                if ($existing && ! $sync && ($v['version'] ?? null) !== $existing->version) {
                    throw new ConflictHttpException('Record telah berubah. Muat ulang sebelum menyimpan agar perubahan lain tidak tertimpa.');
                }
                if ($existing && $existing->deleted_at !== null) {
                    throw new ConflictHttpException('Identifier sudah dinonaktifkan; jangan membuat ulang identitas yang sama.');
                }
                $recordId = $existing->id ?? (string) Str::uuid();
                if ($existing) {
                    $db->table('dev_institutions')->where('id', $recordId)->update([...$payload, 'version' => $existing->version + 1]);
                } else {
                    $db->table('dev_institutions')->insert([...$payload, 'id' => $recordId]);
                }

                return ['id' => $recordId, 'coordinateStatus' => $payload['coordinate_status'], 'note' => $payload['location_note'],
                    'geocodeStatus' => $payload['geocode_status'], 'message' => $existing ? 'Data uji diperbarui dengan ID yang sama.' : 'Instansi uji tersimpan.'];
            });
        } catch (QueryException $e) {
            if ($e->getCode() === '23505') {
                throw new ConflictHttpException('Identifier sumber sudah tersedia; record tidak digandakan.');
            }
            throw new DevelopmentUnavailable;
        }
    }
}

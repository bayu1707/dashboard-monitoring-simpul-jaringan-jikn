<?php

namespace App\Services;

use App\Repositories\InstansiRepository;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

final class DashboardService
{
    public function __construct(private InstansiRepository $repository) {}

    public function references(string $mode): array
    {
        return $this->repository->references($mode);
    }

    public function validateFilters(string $mode, array $filters): array
    {
        $refs = $this->references($mode);
        $errors = [];
        $province = $filters['provinceId'] ?? null;
        $city = $filters['kabKotaId'] ?? null;
        $kind = $filters['jenisId'] ?? null;
        if ($province !== null && ! in_array($province, array_column($refs['provinces'], 'id'), true)) {
            $errors['provinceId'] = 'Provinsi tidak tersedia pada mode ini.';
        }
        if ($city !== null) {
            $region = collect($refs['kabKota'])->firstWhere('id', $city);
            if (! $province || ! $region || $region['provinceId'] !== $province) {
                $errors['kabKotaId'] = 'Kabupaten/kota harus sesuai provinsi yang dipilih.';
            }
        }
        if ($kind !== null && ! in_array($kind, array_column($refs['jenisInstansi'], 'id'), true)) {
            $errors['jenisId'] = 'Jenis instansi tidak tersedia.';
        }
        if ($errors) {
            throw ValidationException::withMessages($errors);
        }

        return $filters;
    }

    public function list(string $mode, array $filters): array
    {
        $filters = $this->validateFilters($mode, $filters);
        $snapshot = $this->repository->snapshot($mode);
        $items = array_values(array_filter($snapshot['instansi'], function ($item) use ($filters) {
            foreach (['provinceId', 'kabKotaId', 'jenisId'] as $key) {
                if (isset($filters[$key]) && $item[$key] !== $filters[$key]) {
                    return false;
                }
            }
            $search = trim($filters['search'] ?? '');

            return $search === '' || mb_stripos($item['name'].' '.($item['kode'] ?? ''), $search) !== false;
        }));
        $page = (int) ($filters['page'] ?? 1);
        $perPage = (int) ($filters['per_page'] ?? 250);
        $total = count($items);

        return ['data' => array_slice($items, ($page - 1) * $perPage, $perPage), 'metadata' => $snapshot['metadata'],
            'meta' => ['total' => $total, 'page' => $page, 'perPage' => $perPage, 'lastPage' => max(1, (int) ceil($total / $perPage))]];
    }

    public function detail(string $mode, string $id): array
    {
        $snapshot = $this->repository->snapshot($mode);
        $institution = collect($snapshot['instansi'])->firstWhere('id', $id);
        if (! $institution) {
            throw new NotFoundHttpException('Instansi tidak ditemukan.');
        }
        $contacts = $this->repository->detailContacts($mode, $id);
        if ($contacts !== null) {
            $institution = [...$institution, ...$contacts];
        }
        $stats = $this->repository->detailStatistics($mode, $id);
        if ($stats === null) {
            $stats = ['statistik' => [], 'trenInput' => null, 'distribusiArsip' => null, 'penciptaArsip' => null, 'multiCreator' => null, 'monthlyAdded' => null];
            foreach (['jumlahArsip', 'penciptaArsip', 'kopiDigital'] as $key) {
                $stats['statistik'][$key] = [
                    'value' => null, 'definition' => $snapshot['metadata']['metricDefinitions'][$key] ?? 'Definisi belum tersedia',
                    'scope' => 'instansi', 'snapshotId' => $snapshot['metadata']['id'], 'referenceDate' => $snapshot['metadata']['referenceDate'],
                ];
            }
        }
        unset($stats['instansiId']);

        return [...$stats, 'instansi' => $institution, 'metadata' => $snapshot['metadata']];
    }

    public function geometry(string $mode, string $provinceId): array
    {
        $this->validateFilters($mode, ['provinceId' => $provinceId]);

        return $this->repository->geometry($mode, $provinceId);
    }

    public function statistics(string $mode): array
    {
        $source = $this->repository->snapshot($mode);
        $mapped = count(array_filter($source['instansi'], fn ($i) => $i['coordinates'] !== null));

        return ['institutions' => count($source['instansi']), 'mapped' => $mapped, 'unmapped' => count($source['instansi']) - $mapped, 'metadata' => $source['metadata']];
    }
}

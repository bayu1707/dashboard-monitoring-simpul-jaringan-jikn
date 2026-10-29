<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\DashboardRequest;
use App\Services\DashboardService;
use Illuminate\Http\JsonResponse;

final class DashboardController extends Controller
{
    public function __construct(private DashboardService $service) {}

    public function references(DashboardRequest $request): JsonResponse
    {
        return $this->response(['data' => $this->service->references($request->mode())]);
    }

    public function institutions(DashboardRequest $request): JsonResponse
    {
        return $this->response($this->service->list($request->mode(), $request->validated()));
    }

    public function detail(DashboardRequest $request, string $id): JsonResponse
    {
        return $this->response(['data' => $this->service->detail($request->mode(), $id)]);
    }

    public function geometry(DashboardRequest $request, string $provinceId): JsonResponse
    {
        return $this->response($this->service->geometry($request->mode(), $provinceId));
    }

    public function provinces(DashboardRequest $request): JsonResponse
    {
        return $this->response(['data' => $this->service->references($request->mode())['provinces']]);
    }

    public function regencies(DashboardRequest $request, string $provinceId): JsonResponse
    {
        $this->service->validateFilters($request->mode(), ['provinceId' => $provinceId]);

        return $this->response(['data' => array_values(array_filter($this->service->references($request->mode())['kabKota'], fn ($r) => $r['provinceId'] === $provinceId))]);
    }

    public function statistics(DashboardRequest $request): JsonResponse
    {
        return $this->response(['data' => $this->service->statistics($request->mode())]);
    }

    private function response(array $data): JsonResponse
    {
        // PHP array kosong ber-JSON [] sementara kontrak Record<string,string> wajib {}.
        // Hanya field objek yang diketahui dikonversi; array daftar dan koordinat tidak diubah.
        if (isset($data['metadata']['metricDefinitions'])) {
            $data['metadata']['metricDefinitions'] = (object) $data['metadata']['metricDefinitions'];
        }
        if (isset($data['data']['metadata']['metricDefinitions'])) {
            $data['data']['metadata']['metricDefinitions'] = (object) $data['data']['metadata']['metricDefinitions'];
        }

        return response()->json($data)->header('Cache-Control', 'no-store');
    }
}

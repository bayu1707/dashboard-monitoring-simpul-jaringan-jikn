<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\DevelopmentUnavailable;
use App\Http\Controllers\Controller;
use App\Services\DevelopmentDatabase;
use App\Services\DevelopmentService;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

final class DevelopmentController extends Controller
{
    public function dispatch(Request $request, DevelopmentDatabase $database, DevelopmentService $service, string $path = '')
    {
        abort_unless(app()->environment(['local', 'testing']) && in_array($request->ip(), ['127.0.0.1', '::1'], true), 403);
        abort_unless(hash_equals($database->settings()['apiToken'], (string) $request->header('X-Dev-Token')), 403);
        try {
            $method = $request->method();
            $result = match (true) {
                $method === 'GET' && $path === 'status' => $service->status(),
                $method === 'GET' && $path === 'regions' => $service->regions(),
                $method === 'GET' && $path === 'institutions' => $service->institutions(),
                $method === 'POST' && $path === 'regions' => $service->createRegion($request->all()),
                $method === 'POST' && $path === 'institutions' => $service->saveInstitution($request->all()),
                $method === 'POST' && $path === 'institutions/sync' => $service->saveInstitution($request->all(), sync: true),
                $method === 'PUT' && preg_match('#^institutions/([0-9a-f-]{36})$#D', $path, $m) => $service->saveInstitution($request->all(), $m[1]),
                default => abort(404),
            };

            return response()->json(['data' => $result])->header('Cache-Control', 'no-store');
        } catch (HttpExceptionInterface|ValidationException $e) {
            throw $e;
        } catch (Throwable) {
            throw new DevelopmentUnavailable;
        }
    }
}

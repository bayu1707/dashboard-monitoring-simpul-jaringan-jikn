<?php

use App\Exceptions\DevelopmentUnavailable;
use App\Exceptions\InvalidDataset;
use App\Exceptions\SiknUnavailable;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(api: __DIR__.'/../routes/api.php', commands: __DIR__.'/../routes/console.php', health: '/up')
    ->withMiddleware(function (Middleware $middleware): void {})
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(fn (Request $request) => $request->is('api/*') || $request->expectsJson());
        // Jangan mencatat pesan driver, DSN, SQL, atau kredensial database privat.
        $exceptions->dontReport([SiknUnavailable::class, DevelopmentUnavailable::class]);
        $exceptions->render(fn (DevelopmentUnavailable $exception) => response()->json([
            'message' => $exception->getMessage(), 'code' => 'DEVELOPMENT_UNAVAILABLE',
        ], 503)->header('Cache-Control', 'no-store'));
        $exceptions->render(fn (SiknUnavailable $exception) => response()->json([
            'message' => $exception->getMessage(), 'code' => 'SIKN_LOCAL_UNAVAILABLE',
        ], 503)->header('Cache-Control', 'no-store'));
        $exceptions->render(function (InvalidDataset $exception, Request $request) {
            Log::warning('Pembacaan dataset dashboard gagal.', ['reason' => $exception->reason]);

            return response()->json(['message' => $exception->getMessage(), 'code' => 'DATASET_UNAVAILABLE'], 503)->header('Cache-Control', 'no-store');
        });
    })->create();

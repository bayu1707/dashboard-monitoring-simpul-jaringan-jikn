<?php

use App\Http\Controllers\Api\V1\DashboardController;
use App\Http\Controllers\Api\V1\DevelopmentController;
use Illuminate\Support\Facades\Route;

Route::match(['GET', 'POST', 'PUT'], '/v1/development/{path}', [DevelopmentController::class, 'dispatch'])->where('path', '.*');

Route::prefix('v1')->controller(DashboardController::class)->group(function () {
    Route::get('/reference-data', 'references');
    Route::get('/institutions', 'institutions');
    Route::get('/institutions/{id}', 'detail')->where('id', '[A-Za-z0-9_-]+');
    Route::get('/geometry/{provinceId}', 'geometry')->where('provinceId', '\d{2}');
    Route::get('/provinces', 'provinces');
    Route::get('/provinces/{provinceId}/regencies', 'regencies')->where('provinceId', '\d{2}');
    Route::get('/dashboard/statistics', 'statistics');
});

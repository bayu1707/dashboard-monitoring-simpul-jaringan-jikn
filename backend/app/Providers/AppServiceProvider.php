<?php

namespace App\Providers;

use App\Repositories\DashboardRepository;
use App\Repositories\InstansiRepository;
use App\Services\DevelopmentDatabase;
use App\Services\PostgresSiknSource;
use App\Services\SiknSource;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Request-scoped cache: data korup tidak tersimpan lintas request; retry membaca sumber sama.
        $this->app->scoped(InstansiRepository::class, DashboardRepository::class);
        $this->app->scoped(SiknSource::class, PostgresSiknSource::class);
        $this->app->scoped(DevelopmentDatabase::class);
    }

    public function boot(): void {}
}

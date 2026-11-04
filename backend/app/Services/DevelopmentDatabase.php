<?php

namespace App\Services;

use App\Exceptions\DevelopmentUnavailable;
use Illuminate\Database\Connection;
use Illuminate\Support\Facades\DB;
use Throwable;

final class DevelopmentDatabase
{
    private ?Connection $connection = null;

    private ?array $settings = null;

    public function settings(): array
    {
        if ($this->settings !== null) {
            return $this->settings;
        }
        try {
            $file = realpath(config('dashboard.development_config'));
            $root = realpath(base_path('../.local/development'));
            if (! app()->environment(['local', 'testing']) || ! $file || ! $root || ! str_starts_with($file, $root.DIRECTORY_SEPARATOR)) {
                throw new DevelopmentUnavailable;
            }
            $value = json_decode(file_get_contents($file), true, 512, JSON_THROW_ON_ERROR);
            if ($value['host'] !== '127.0.0.1' || ! in_array($value['database'], ['jikn_dashboard_dev', 'jikn_dashboard_dev_test'], true)
                || $value['username'] !== 'jikn_dev_app' || ! is_int($value['port']) || $value['port'] < 1024 || $value['port'] === 55439) {
                throw new DevelopmentUnavailable;
            }

            return $this->settings = $value;
        } catch (Throwable) {
            throw new DevelopmentUnavailable;
        }
    }

    public function connection(): Connection
    {
        if ($this->connection !== null) {
            return $this->connection;
        }
        try {
            $c = $this->settings();

            return $this->connection = DB::build([
                'driver' => 'pgsql', 'host' => $c['host'], 'port' => $c['port'], 'database' => $c['database'],
                'username' => $c['username'], 'password' => $c['password'], 'charset' => 'utf8',
                'prefix' => '', 'search_path' => 'public', 'sslmode' => 'prefer',
                'options' => [\PDO::ATTR_TIMEOUT => 3],
            ]);
        } catch (Throwable) {
            throw new DevelopmentUnavailable;
        }
    }
}

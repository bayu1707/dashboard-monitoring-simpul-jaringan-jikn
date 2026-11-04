<?php

namespace App\Services;

use App\Exceptions\SiknUnavailable;
use Throwable;

/** Konfigurasi privat di luar public; tidak dibaca pada mode pilot/excel/demo. */
final class SiknLocalConfig
{
    private ?array $value = null;

    public function read(): array
    {
        if ($this->value !== null) {
            return $this->value;
        }
        try {
            if (! app()->environment(['local', 'testing'])) {
                throw new SiknUnavailable;
            }
            $path = realpath(config('dashboard.sikn_poc_config'));
            $private = realpath(base_path('../.local/sikn-poc'));
            if (! $path || ! $private || ! str_starts_with($path, $private.DIRECTORY_SEPARATOR)) {
                throw new SiknUnavailable;
            }
            $value = json_decode(file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
            if (($value['enabled'] ?? false) !== true || ($value['host'] ?? '') !== '127.0.0.1'
                || ! is_int($value['port'] ?? null) || $value['port'] < 1024 || $value['port'] > 65535
                || ! preg_match('/^[a-zA-Z0-9_]+$/D', $value['database'] ?? '')
                || ! preg_match('/^[a-zA-Z0-9_]+$/D', $value['username'] ?? '')
                || ! preg_match('/^[a-zA-Z0-9_-]+$/D', $value['sourceId'] ?? '')
                || ! preg_match('/^\d{4}-\d{2}-\d{2}$/D', $value['referenceDate'] ?? '')) {
                throw new SiknUnavailable;
            }
            $value['crosswalkPath'] = dirname($path).'/crosswalk.json';

            return $this->value = $value;
        } catch (Throwable) {
            throw new SiknUnavailable;
        }
    }
}

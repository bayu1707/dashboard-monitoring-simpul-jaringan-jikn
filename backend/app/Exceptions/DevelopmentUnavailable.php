<?php

namespace App\Exceptions;

use RuntimeException;

final class DevelopmentUnavailable extends RuntimeException
{
    public function __construct()
    {
        parent::__construct('Database pengujian belum tersedia. Jalankan penyiapan PostgreSQL development lokal.');
    }
}

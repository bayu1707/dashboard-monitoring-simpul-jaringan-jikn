<?php

namespace App\Exceptions;

use RuntimeException;

final class SiknUnavailable extends RuntimeException
{
    public function __construct()
    {
        parent::__construct('Mode uji database SIKN belum tersedia. Periksa salinan database lokal; mode pilot tetap dapat digunakan.');
    }
}

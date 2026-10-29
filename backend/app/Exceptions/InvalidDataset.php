<?php

namespace App\Exceptions;

use RuntimeException;

final class InvalidDataset extends RuntimeException
{
    public function __construct(public readonly string $reason = 'validation')
    {
        parent::__construct('Dataset belum dapat dimuat atau tidak valid.');
    }
}

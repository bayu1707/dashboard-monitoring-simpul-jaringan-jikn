<?php

namespace App\Repositories;

interface InstansiRepository
{
    public function references(string $mode): array;

    public function snapshot(string $mode): array;

    public function detailStatistics(string $mode, string $id): ?array;

    public function detailContacts(string $mode, string $id): ?array;

    public function geometry(string $mode, string $provinceId): array;
}

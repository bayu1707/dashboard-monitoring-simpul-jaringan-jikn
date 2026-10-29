<?php

namespace App\Services;

interface SiknSource
{
    /** Hanya identitas instansi; bukan kontak, HTML, pengguna, atau isi arsip. */
    public function identities(): array;

    public function metrics(int $repositoryId): array;

    /** Hanya email/telepon kontak instansi aktif; tanpa nama PIC atau kontak pengguna. */
    public function contacts(int $repositoryId): array;
}

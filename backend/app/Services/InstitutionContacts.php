<?php

namespace App\Services;

/** Kontak instansi tidak boleh dirangkai dari beberapa baris atau dianggap terverifikasi publik. */
final class InstitutionContacts
{
    public static function email(mixed $value): ?string
    {
        if (! is_string($value) || preg_match('/[\x00-\x1f\x7f]/', $value)) {
            return null;
        }
        $value = trim($value);
        $local = mb_strtolower(explode('@', $value, 2)[0]);
        if (in_array($local, ['null', 'none', 'undefined', 'unknown', '-', '0'], true)) {
            return null;
        }

        return strlen($value) <= 254 && filter_var($value, FILTER_VALIDATE_EMAIL) ? $value : null;
    }

    public static function phone(mixed $value): ?string
    {
        if (! is_string($value) || preg_match('/[\x00-\x1f\x7f]/', $value)) {
            return null;
        }
        $value = trim($value);
        $number = preg_replace('/\D/', '', $value);
        $digits = strlen($number);

        return preg_match('/^\+?[0-9 ().-]{6,40}$/D', $value) && $digits >= 6 && $digits <= 20 && trim($number, '0') !== '' ? $value : null;
    }

    public static function unavailable(string $note): array
    {
        return ['email' => null, 'phone' => null, 'contactSource' => 'Salinan database SIKN — Maret 2026',
            'contactVerificationStatus' => 'unavailable', 'contactNotes' => $note];
    }

    public static function select(array $rows): array
    {
        $primary = array_values(array_filter($rows, fn ($row) => (int) ($row['is_primary'] ?? 0) === 1));
        $candidates = $primary ?: $rows;
        if (count($candidates) !== 1) {
            $result = self::unavailable($rows ? 'Beberapa kontak tanpa pilihan utama yang unik; perlu peninjauan manual.' : 'Kontak instansi belum tersedia dalam salinan database.');
            $result['contactVerificationStatus'] = $rows ? 'needs-review' : 'unavailable';

            return $result;
        }
        $row = reset($candidates);
        $email = self::email($row['email'] ?? null);
        $phone = self::phone($row['phone'] ?? null);
        $invalid = (($row['email'] ?? '') !== '' && $row['email'] !== null && $email === null)
            || (($row['phone'] ?? '') !== '' && $row['phone'] !== null && $phone === null);

        return ['email' => $email, 'phone' => $phone, 'contactSource' => 'Salinan database SIKN — Maret 2026',
            'contactVerificationStatus' => $email !== null || $phone !== null || $invalid ? 'needs-review' : 'unavailable',
            'contactNotes' => ($primary ? 'Kontak utama instansi.' : 'Satu kontak instansi yang tersedia.').
                ' Belum dikonfirmasi sebagai kontak publik atau kontak terbaru.'.($invalid ? ' Isian placeholder atau format tidak valid tidak ditampilkan.' : '')];
    }
}

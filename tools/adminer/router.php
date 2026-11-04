<?php

/** Server khusus localhost. Vendor, password dan konfigurasi berada di luar document root. */
declare(strict_types=1);

$host = $_SERVER['HTTP_HOST'] ?? '';
$origin = $_SERVER['HTTP_ORIGIN'] ?? null;
if (! in_array($_SERVER['REMOTE_ADDR'] ?? '', ['127.0.0.1', '::1'], true)
    || ! in_array($host, ['127.0.0.1:8081', 'localhost:8081'], true)
    || (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST' && $origin !== 'http://'.$host)) {
    http_response_code(403);
    exit('Akses hanya melalui database manager localhost.');
}
header('X-Frame-Options: DENY');
header('Content-Security-Policy: frame-ancestors \'none\'');
header('Referrer-Policy: no-referrer');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex, nofollow');
ini_set('display_errors', '0');
ini_set('session.cookie_httponly', '1');
ini_set('session.cookie_samesite', 'Strict');
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if ($path === '/') {
    echo '<!doctype html><html lang="id"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Database lokal JIKN</title><style>body{font:16px system-ui;background:#f5f8fc;color:#173355;max-width:850px;margin:70px auto;padding:24px}main{background:white;padding:30px;border:1px solid #dce4ef;border-radius:14px}a{display:block;padding:20px;margin:18px 0;border:1px solid #cdd9ed;border-radius:9px;color:#2456b9}small{display:block;color:#526a82;margin-top:7px}</style><main><h1>Database manager lokal</h1><p>Pilih profil. Password database tetap di server dan tidak ditampilkan.</p><a href="/sikn.php">SIKN — analisis baca-saja<small>Salinan inspeksi, akun sikn_analisis. Isi tabel sesuai izin SELECT; tidak dapat mengubah data.</small></a><a href="/dev.php">Development — data pengujian<small>PostgreSQL terpisah. Tambah/ubah record uji; tanpa hak superuser atau DROP tabel.</small></a><p>Untuk validasi koordinat dan pembaruan peta, gunakan <a href="http://127.0.0.1:3000/pengujian?data=dev">Form pengujian dashboard</a>. SQL manual tidak menggantikan aturan publikasi marker.</p></main></html>';
    return true;
}
if (! in_array($path, ['/sikn.php', '/dev.php'], true)) {
    http_response_code(404);
    exit('Tidak ditemukan.');
}
$root = dirname(__DIR__, 2);
try {
    if ($path === '/sikn.php') {
        $c = json_decode(file_get_contents($root.'/.local/sikn-poc/config.json'), true, 512, JSON_THROW_ON_ERROR);
        $secret = json_decode(file_get_contents($c['credentialFile']), true, 512, JSON_THROW_ON_ERROR);
        $c['password'] = $secret['password'];
        $label = 'SIKN — BACA SAJA';
    } else {
        $c = json_decode(file_get_contents($root.'/.local/development/editor.json'), true, 512, JSON_THROW_ON_ERROR);
        $label = 'DEVELOPMENT — DATA UJI';
    }
    if ($c['host'] !== '127.0.0.1' || ! in_array($c['username'], ['sikn_analisis', 'jikn_dev_editor'], true)) {
        throw new RuntimeException;
    }
} catch (Throwable) {
    http_response_code(503);
    exit('Profil belum tersedia. Aktifkan server/salinan database lokal.');
}
$cookie = $_COOKIE['jikn_adminer_local'] ?? '';
if (! preg_match('/^[a-f0-9]{64}$/D', $cookie)) {
    $cookie = bin2hex(random_bytes(32));
    setcookie('jikn_adminer_local', $cookie, ['path' => '/', 'httponly' => true, 'samesite' => 'Strict']);
}
$GLOBALS['jikn_adminer_profile'] = $c;
$GLOBALS['jikn_adminer_label'] = $label;
$GLOBALS['jikn_adminer_nonce'] = $cookie;
function adminer_object()
{
    return new class extends \Adminer\Adminer
    {
        public function name() { return htmlspecialchars($GLOBALS['jikn_adminer_label']); }
        public function credentials() { $c = $GLOBALS['jikn_adminer_profile']; return [$c['host'].':'.$c['port'], $c['username'], $c['password']]; }
        public function database() { return $GLOBALS['jikn_adminer_profile']['database']; }
        public function login($login, $password) { return $login === $GLOBALS['jikn_adminer_profile']['username'] && hash_equals($GLOBALS['jikn_adminer_nonce'], $password); }
        public function verifyVersion() { return false; }
        public function loginForm() {
            $c = $GLOBALS['jikn_adminer_profile'];
            echo '<p>Profil lokal: '.htmlspecialchars($GLOBALS['jikn_adminer_label']).'. Kredensial database disimpan privat di server.</p>';
            foreach (['driver' => 'pgsql', 'server' => $c['host'].':'.$c['port'], 'username' => $c['username'], 'db' => $c['database'], 'password' => $GLOBALS['jikn_adminer_nonce']] as $key => $value) {
                echo '<input type="hidden" name="auth['.$key.']" value="'.htmlspecialchars((string) $value, ENT_QUOTES).'">';
            }
            echo '<p><button type="submit">Buka profil lokal</button></p>';
        }
    };
}
require $root.'/.local/tools/adminer/adminer.php';
return true;

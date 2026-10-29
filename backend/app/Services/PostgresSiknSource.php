<?php

namespace App\Services;

use App\Exceptions\SiknUnavailable;
use PDO;
use Throwable;

final class PostgresSiknSource implements SiknSource
{
    public const string CONTACTS_SQL = <<<'SQL'
        SELECT c.is_primary, c.email, c.phone
        FROM contacts c JOIN repositories r ON r.id = c.repository_id
        WHERE c.repository_id = :repository_id AND c.deleted_at IS NULL AND r.deleted_at IS NULL
        SQL;

    public const string METRICS_SQL = <<<'SQL'
            WITH descriptions AS MATERIALIZED (
                SELECT DISTINCT d.id FROM archive_description d
                JOIN archive_description_repositories r ON r.archive_description_id = d.id
                JOIN repositories repo ON repo.id = r.repository_id
                WHERE r.repository_id = :repository_id
                  AND repo.deleted_at IS NULL AND r.deleted_at IS NULL AND d.deleted_at IS NULL
            )
            SELECT
              (SELECT count(*) FROM descriptions) AS jumlahArsip,
              (SELECT count(DISTINCT a.id) FROM actors a
               JOIN archive_description_actors r ON r.actor_id = a.id
               JOIN descriptions d ON d.id = r.archive_description_id
               WHERE a.deleted_at IS NULL AND r.deleted_at IS NULL) AS penciptaArsip,
              (SELECT count(DISTINCT o.id) FROM digital_objects o
               JOIN descriptions d ON d.id = o.archive_description_id
               WHERE o.deleted_at IS NULL) AS kopiDigital
            SQL;

    private ?PDO $connection = null;

    public function __construct(private SiknLocalConfig $config) {}

    private function connection(): PDO
    {
        if ($this->connection !== null) {
            return $this->connection;
        }
        $config = $this->config->read();
        $credentials = json_decode(file_get_contents($config['credentialFile']), true, 512, JSON_THROW_ON_ERROR);
        $pdo = new PDO(sprintf('pgsql:host=127.0.0.1;port=%d;dbname=%s;connect_timeout=3', $config['port'], $config['database']),
            $config['username'], $credentials['password'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_EMULATE_PREPARES => false]);
        $settings = $pdo->query("SELECT current_setting('is_superuser') AS superuser, current_setting('default_transaction_read_only') AS readonly")->fetch(PDO::FETCH_ASSOC);
        if ($settings['superuser'] !== 'off' || $settings['readonly'] !== 'on') {
            throw new SiknUnavailable;
        }

        return $this->connection = $pdo;
    }

    private function query(string $sql, array $parameters = []): array
    {
        $pdo = null;
        try {
            $pdo = $this->connection();
            $pdo->beginTransaction();
            $pdo->exec('SET TRANSACTION READ ONLY');
            $pdo->exec("SET LOCAL statement_timeout = '8000ms'");
            $query = $pdo->prepare($sql);
            $query->execute($parameters);
            $rows = $query->fetchAll(PDO::FETCH_ASSOC);
            $pdo->rollBack();

            return $rows;
        } catch (Throwable) {
            try {
                if ($pdo?->inTransaction()) {
                    $pdo->rollBack();
                }
            } catch (Throwable) {
                // Koneksi yang sudah putus juga tidak boleh membocorkan pesan driver.
            }
            // Sengaja tanpa previous exception: pesan PDO bisa memuat detail privat.
            throw new SiknUnavailable;
        }
    }

    public function identities(): array
    {
        return $this->query(<<<'SQL'
            SELECT r.id, CAST(r.uniq_id AS text) AS uuid, r.identifier AS code, i.name
            FROM repositories r JOIN repository_i18n i ON i.repository_id = r.id
            JOIN cultures c ON c.id = i.culture_id AND c.code = 'id-ID'
            WHERE r.deleted_at IS NULL AND i.deleted_at IS NULL AND r.type_id <> 13
            SQL);
    }

    /** Semua level deskripsi nondeleted. Bukan filter publikasi atau hitungan lembar arsip. */
    public function metrics(int $repositoryId): array
    {
        $rows = $this->query(self::METRICS_SQL, ['repository_id' => $repositoryId]);

        // PostgreSQL melipat alias tanpa kutip menjadi lowercase.
        return ['jumlahArsip' => (int) $rows[0]['jumlaharsip'], 'penciptaArsip' => (int) $rows[0]['penciptaarsip'], 'kopiDigital' => (int) $rows[0]['kopidigital']];
    }

    public function contacts(int $repositoryId): array
    {
        return $this->query(self::CONTACTS_SQL, ['repository_id' => $repositoryId]);
    }
}

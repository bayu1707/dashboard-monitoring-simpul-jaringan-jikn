<?php

namespace Tests\Unit;

use App\Services\PostgresSiknSource;
use PDO;
use PHPUnit\Framework\TestCase;

final class SiknMetricQueryTest extends TestCase
{
    public function test_distinct_relations_soft_deletes_and_institution_isolation(): void
    {
        // SQLite fixture menjalankan SQL agregat yang sama; tidak menyentuh DB pengguna.
        $pdo = new PDO('sqlite::memory:');
        foreach ([
            'repositories' => 'id INTEGER, deleted_at TEXT',
            'archive_description' => 'id INTEGER, deleted_at TEXT',
            'archive_description_repositories' => 'repository_id INTEGER, archive_description_id INTEGER, deleted_at TEXT',
            'actors' => 'id INTEGER, deleted_at TEXT',
            'archive_description_actors' => 'actor_id INTEGER, archive_description_id INTEGER, deleted_at TEXT',
            'digital_objects' => 'id INTEGER, archive_description_id INTEGER, deleted_at TEXT',
        ] as $table => $columns) {
            $pdo->exec("CREATE TABLE $table ($columns)");
        }
        $pdo->exec("INSERT INTO repositories VALUES (1,NULL),(2,NULL),(3,'deleted')");
        $pdo->exec("INSERT INTO archive_description VALUES (1,NULL),(2,NULL),(3,'deleted'),(4,NULL),(5,NULL)");
        $pdo->exec("INSERT INTO archive_description_repositories VALUES (1,1,NULL),(1,1,NULL),(1,2,NULL),(1,3,NULL),(1,4,'deleted'),(2,5,NULL),(3,5,NULL)");
        $pdo->exec("INSERT INTO actors VALUES (1,NULL),(2,'deleted'),(3,NULL),(4,NULL)");
        $pdo->exec("INSERT INTO archive_description_actors VALUES (1,1,NULL),(1,2,NULL),(2,1,NULL),(3,2,'deleted'),(4,3,NULL)");
        $pdo->exec("INSERT INTO digital_objects VALUES (1,1,NULL),(2,1,NULL),(3,2,'deleted'),(4,3,NULL),(5,4,NULL),(6,5,NULL)");
        $query = $pdo->prepare(PostgresSiknSource::METRICS_SQL);
        $query->execute(['repository_id' => 1]);
        $this->assertSame(['jumlahArsip' => 2, 'penciptaArsip' => 1, 'kopiDigital' => 2], $query->fetch(PDO::FETCH_ASSOC));
        $query->execute(['repository_id' => 99]);
        $this->assertSame(['jumlahArsip' => 0, 'penciptaArsip' => 0, 'kopiDigital' => 0], $query->fetch(PDO::FETCH_ASSOC));
        $query->execute(['repository_id' => 3]);
        $this->assertSame(['jumlahArsip' => 0, 'penciptaArsip' => 0, 'kopiDigital' => 0], $query->fetch(PDO::FETCH_ASSOC));
    }
}

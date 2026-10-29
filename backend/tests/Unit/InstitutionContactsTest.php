<?php

namespace Tests\Unit;

use App\Services\InstitutionContacts;
use App\Services\PostgresSiknSource;
use PDO;
use PHPUnit\Framework\TestCase;

final class InstitutionContactsTest extends TestCase
{
    public function test_primary_contact_is_selected_without_mixing_other_rows_or_personal_fields(): void
    {
        $result = InstitutionContacts::select([
            ['is_primary' => 0, 'email' => 'secondary@example.invalid', 'phone' => '0215550101'],
            ['is_primary' => '1', 'email' => 'office@example.invalid', 'phone' => '0215550100', 'contact_person' => 'Tidak diekspor'],
        ]);
        $this->assertSame('office@example.invalid', $result['email']);
        $this->assertSame('0215550100', $result['phone']);
        $this->assertSame('needs-review', $result['contactVerificationStatus']);
        $this->assertArrayNotHasKey('contact_person', $result);
    }

    public function test_one_non_primary_row_is_allowed_but_multiple_or_duplicate_primaries_are_ambiguous(): void
    {
        $row = ['is_primary' => 0, 'email' => 'office@example.invalid', 'phone' => null];
        $this->assertSame($row['email'], InstitutionContacts::select([$row])['email']);
        foreach ([[$row, $row], [[...$row, 'is_primary' => 1], [...$row, 'is_primary' => 1]]] as $rows) {
            $result = InstitutionContacts::select($rows);
            $this->assertNull($result['email']);
            $this->assertSame('needs-review', $result['contactVerificationStatus']);
        }
    }

    public function test_empty_primary_does_not_borrow_a_secondary_contact(): void
    {
        $result = InstitutionContacts::select([
            ['is_primary' => 1, 'email' => null, 'phone' => ''],
            ['is_primary' => 0, 'email' => 'secondary@example.invalid', 'phone' => '0215550101'],
        ]);
        $this->assertNull($result['email']);
        $this->assertNull($result['phone']);
        $this->assertSame('unavailable', $result['contactVerificationStatus']);
        $this->assertSame('unavailable', InstitutionContacts::select([])['contactVerificationStatus']);
    }

    public function test_invalid_contacts_are_not_linked_or_replaced_with_fabricated_values(): void
    {
        foreach (['not-email', "office@example.invalid\r\nBcc:other@example.invalid", 'a@example.invalid,b@example.invalid', 'javascript:alert(1)', 'null@mail.com', 'UNKNOWN@example.invalid'] as $email) {
            $this->assertNull(InstitutionContacts::email($email));
        }
        foreach (['0', '0000000000', 'unknown', '0215550100 / 0215550101', "0215550100\n123", '<script>123456</script>'] as $phone) {
            $this->assertNull(InstitutionContacts::phone($phone));
        }
        $this->assertSame('+62 (21) 555-0100', InstitutionContacts::phone(' +62 (21) 555-0100 '));
        $this->assertSame('Office@example.invalid', InstitutionContacts::email(' Office@example.invalid '));
    }

    public function test_query_isolates_institution_and_filters_deleted_contacts_and_repositories(): void
    {
        $pdo = new PDO('sqlite::memory:');
        $pdo->exec('CREATE TABLE repositories(id INTEGER, deleted_at TEXT)');
        $pdo->exec('CREATE TABLE contacts(repository_id INTEGER, is_primary INTEGER, email TEXT, phone TEXT, contact_person TEXT, deleted_at TEXT)');
        $pdo->exec("INSERT INTO repositories VALUES (1,NULL),(2,NULL),(3,'deleted')");
        $pdo->exec("INSERT INTO contacts VALUES (1,1,'office@example.invalid','0215550100','private',NULL),(1,0,'secondary@example.invalid',NULL,'private',NULL),(1,1,'deleted@example.invalid',NULL,NULL,'deleted'),(2,1,'other@example.invalid',NULL,NULL,NULL),(3,1,'deleted-repo@example.invalid',NULL,NULL,NULL)");
        $query = $pdo->prepare(PostgresSiknSource::CONTACTS_SQL);
        $query->execute(['repository_id' => 1]);
        $rows = $query->fetchAll(PDO::FETCH_ASSOC);
        $this->assertCount(2, $rows);
        $this->assertSame(['is_primary', 'email', 'phone'], array_keys($rows[0]));
        $this->assertSame('office@example.invalid', InstitutionContacts::select($rows)['email']);
        foreach ([3, 99] as $id) {
            $query->execute(['repository_id' => $id]);
            $this->assertSame([], $query->fetchAll(PDO::FETCH_ASSOC));
        }
    }
}

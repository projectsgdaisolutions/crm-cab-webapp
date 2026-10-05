<?php

require_once __DIR__ . '/../../config/database.php';

$columns = [
    'alternate_phone' => 'VARCHAR(20) NULL',
    'pickup_location' => 'TEXT NULL',
    'drop_location' => 'TEXT NULL',
    'updated_at' => 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
];

try {
    $columnCheck = $pdo->prepare(
        'SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table AND COLUMN_NAME = :column'
    );
    $addedUpdatedAt = false;
    foreach ($columns as $column => $definition) {
        $columnCheck->execute(['table' => 'customers', 'column' => $column]);
        if ((int) $columnCheck->fetchColumn() === 0) {
            $pdo->exec("ALTER TABLE customers ADD COLUMN `$column` $definition");
            if ($column === 'updated_at') $addedUpdatedAt = true;
        }
    }

    if ($addedUpdatedAt) {
        $pdo->exec('UPDATE customers SET updated_at = created_at');
    }

    echo "Customer details migration is current.\n";
} catch (Throwable $error) {
    error_log('Customer details migration failed: ' . $error->getMessage());
    fwrite(STDERR, "Customer details migration failed.\n");
    exit(1);
}
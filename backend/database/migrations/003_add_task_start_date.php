<?php

require_once __DIR__ . '/../../config/database.php';

try {
    $columnCheck = $pdo->prepare(
        'SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table AND COLUMN_NAME = :column'
    );
    $columnCheck->execute(['table' => 'tasks', 'column' => 'start_date']);

    if ((int) $columnCheck->fetchColumn() === 0) {
        $pdo->exec('ALTER TABLE `tasks` ADD COLUMN `start_date` DATETIME NULL AFTER `due_date`');
    }

    echo "Task start_date migration is current.\n";
} catch (Throwable $error) {
    error_log('Task start_date migration failed: ' . $error->getMessage());
    fwrite(STDERR, "Task start_date migration failed.\n");
    exit(1);
}

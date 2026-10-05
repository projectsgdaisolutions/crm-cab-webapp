<?php

require_once __DIR__ . '/../../config/database.php';

try {
    $columnCheck = $pdo->prepare(
        'SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table AND COLUMN_NAME = :column'
    );

    $columnCheck->execute(['table' => 'notifications', 'column' => 'type']);
    if ((int) $columnCheck->fetchColumn() === 0) {
        $pdo->exec('ALTER TABLE `notifications` ADD COLUMN `type` VARCHAR(30) NOT NULL DEFAULT "general" AFTER `user_id`');
    }

    $columnCheck->execute(['table' => 'notifications', 'column' => 'related_type']);
    if ((int) $columnCheck->fetchColumn() === 0) {
        $pdo->exec('ALTER TABLE `notifications` ADD COLUMN `related_type` VARCHAR(30) NULL AFTER `message`');
    }

    $columnCheck->execute(['table' => 'notifications', 'column' => 'related_id']);
    if ((int) $columnCheck->fetchColumn() === 0) {
        $pdo->exec('ALTER TABLE `notifications` ADD COLUMN `related_id` INT NULL AFTER `related_type`');
    }

    $indexCheck = $pdo->prepare(
        'SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table AND INDEX_NAME = :index'
    );

    $indexCheck->execute(['table' => 'notifications', 'index' => 'idx_notifications_user_type']);
    if ((int) $indexCheck->fetchColumn() === 0) {
        $pdo->exec('CREATE INDEX idx_notifications_user_type ON notifications (user_id, type, created_at)');
    }

    $indexCheck->execute(['table' => 'notifications', 'index' => 'idx_notifications_related']);
    if ((int) $indexCheck->fetchColumn() === 0) {
        $pdo->exec('CREATE INDEX idx_notifications_related ON notifications (related_type, related_id)');
    }

    echo "Notification schema migration is current.\n";
} catch (Throwable $error) {
    error_log('Notification schema migration failed: ' . $error->getMessage());
    fwrite(STDERR, "Notification schema migration failed.\n");
    exit(1);
}
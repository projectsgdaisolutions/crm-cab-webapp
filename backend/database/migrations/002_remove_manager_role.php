<?php

require_once __DIR__ . '/../../config/database.php';

try {
    $pdo->beginTransaction();

    $pdo->exec("UPDATE users SET role = 'executive' WHERE role = 'manager'");
    $pdo->exec("ALTER TABLE users MODIFY role ENUM('admin', 'executive') NOT NULL DEFAULT 'executive'");

    $pdo->commit();
    echo "Manager role cleanup migration complete.\n";
} catch (Throwable $error) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    error_log('Manager role cleanup migration failed: ' . $error->getMessage());
    fwrite(STDERR, "Manager role cleanup migration failed.\n");
    exit(1);
}

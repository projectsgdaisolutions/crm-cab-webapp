<?php
require_once __DIR__ . '/../../config/database.php';
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS crm_notes (id INT AUTO_INCREMENT PRIMARY KEY, entity_type VARCHAR(30) NOT NULL, entity_id INT NOT NULL, note_text TEXT NOT NULL, created_by INT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX idx_crm_notes_entity (entity_type, entity_id, created_at), FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $check=$pdo->prepare('SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME="calls" AND COLUMN_NAME="client_sync_id"'); $check->execute();
    if ((int)$check->fetchColumn()===0) $pdo->exec('ALTER TABLE calls ADD COLUMN client_sync_id VARCHAR(100) NULL AFTER follow_up_id');
    $idx=$pdo->prepare('SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME="calls" AND INDEX_NAME="uq_calls_exec_sync"'); $idx->execute();
    if ((int)$idx->fetchColumn()===0) $pdo->exec('CREATE UNIQUE INDEX uq_calls_exec_sync ON calls (executive_id, client_sync_id)');
    echo "Notes and call-sync migration is current.\n";
} catch (Throwable $error) { error_log('Notes/call-sync migration failed: '.$error->getMessage()); fwrite(STDERR,"Notes/call-sync migration failed.\n"); exit(1); }

<?php

require_once __DIR__ . '/../../config/database.php';

$columns = [
    'customers' => [
        'assigned_to' => 'INT NULL',
        'city' => "VARCHAR(100) NOT NULL DEFAULT ''",
        'status' => "VARCHAR(30) NOT NULL DEFAULT 'Active'",
        'tags' => 'LONGTEXT NULL',
    ],
    'leads' => [
        'lead_code' => 'VARCHAR(24) NULL',
        'interested_service' => "VARCHAR(100) NOT NULL DEFAULT ''",
        'pickup_location' => 'TEXT NULL',
        'drop_location' => 'TEXT NULL',
        'travel_at' => 'DATETIME NULL',
        'estimated_value' => 'DECIMAL(10,2) NOT NULL DEFAULT 0',
        'location' => "VARCHAR(150) NOT NULL DEFAULT ''",
        'next_follow_up' => 'DATETIME NULL',
        'created_by' => 'INT NULL',
        'converted_customer_id' => 'INT NULL',
        'converted_at' => 'DATETIME NULL',
    ],
    'follow_ups' => [
        'priority' => "VARCHAR(30) NOT NULL DEFAULT 'Medium'",
        'channel' => "VARCHAR(30) NOT NULL DEFAULT 'Phone'",
        'reminder_sent' => 'TINYINT(1) NOT NULL DEFAULT 0',
        'completed_at' => 'DATETIME NULL',
    ],
    'bookings' => [
        'booking_code' => 'VARCHAR(40) NULL',
        'assigned_to' => 'INT NULL',
        'payment_status' => "VARCHAR(30) NOT NULL DEFAULT 'Unpaid'",
        'mobile_number' => "VARCHAR(20) NOT NULL DEFAULT ''",
        'passenger_count' => 'INT NOT NULL DEFAULT 1',
        'driver_vehicle_details' => 'TEXT NULL',
    ],
    'recordings' => [
        'status' => "VARCHAR(30) NOT NULL DEFAULT 'Available'",
        'transcript' => 'TEXT NULL',
        'access_level' => "VARCHAR(30) NOT NULL DEFAULT 'Admin'",
    ],
    'calls' => [
        'follow_up_id' => 'INT NULL',
    ],
    'tasks' => [
        'related_type' => 'VARCHAR(30) NULL',
        'related_id' => 'INT NULL',
        'completed_at' => 'DATETIME NULL',
    ],
    'users' => [
        'last_login_at' => 'TIMESTAMP NULL',
        'timezone' => "VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata'",
        'bio' => 'TEXT NULL',
        'preferences' => 'LONGTEXT NULL',
        'auth_version' => 'INT UNSIGNED NOT NULL DEFAULT 0',
    ],
];

$indexes = [
    'customers' => [
        'idx_customers_assigned_to' => ['columns' => '`assigned_to`', 'unique' => false],
    ],
    'leads' => [
        'uq_leads_code' => ['columns' => '`lead_code`', 'unique' => true],
        'idx_leads_assigned_status' => ['columns' => '`assigned_to`, `status`', 'unique' => false],
        'idx_leads_conversion_customer' => ['columns' => '`converted_customer_id`', 'unique' => false],
    ],
    'follow_ups' => [
        'idx_followups_assigned_schedule' => ['columns' => '`assigned_to`, `scheduled_at`', 'unique' => false],
    ],
    'bookings' => [
        'uq_bookings_code' => ['columns' => '`booking_code`', 'unique' => true],
        'idx_bookings_customer_date' => ['columns' => '`customer_id`, `booking_date`', 'unique' => false],
        'idx_bookings_assigned_date' => ['columns' => '`assigned_to`, `booking_date`', 'unique' => false],
    ],
    'calls' => [
        'idx_calls_followup' => ['columns' => '`follow_up_id`', 'unique' => false],
    ],
    'tasks' => [
        'idx_tasks_assigned_due' => ['columns' => '`assigned_to`, `due_date`', 'unique' => false],
    ],
    'activities' => [
        'idx_activities_entity' => ['columns' => '`entity_type`, `entity_id`, `created_at`', 'unique' => false],
        'idx_activities_user_date' => ['columns' => '`user_id`, `created_at`', 'unique' => false],
    ],
];

try {
    $columnCheck = $pdo->prepare(
        'SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table AND COLUMN_NAME = :column'
    );
    foreach ($columns as $table => $tableColumns) {
        foreach ($tableColumns as $column => $definition) {
            $columnCheck->execute(['table' => $table, 'column' => $column]);
            if ((int) $columnCheck->fetchColumn() === 0) {
                $pdo->exec("ALTER TABLE `$table` ADD COLUMN `$column` $definition");
            }
        }
    }

    $pdo->exec("CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id INT NULL,
        token_hash CHAR(64) NULL,
        request_ip_hash CHAR(64) NOT NULL,
        expires_at DATETIME NULL,
        used_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_password_reset_token_hash (token_hash),
        INDEX idx_password_reset_ip_created (request_ip_hash, created_at),
        INDEX idx_password_reset_user_created (user_id, created_at),
        CONSTRAINT fk_password_reset_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("UPDATE bookings SET status = CASE LOWER(status)
        WHEN 'pending' THEN 'Enquiry'
        WHEN 'enquiry' THEN 'Enquiry'
        WHEN 'confirmed' THEN 'Confirmed'
        WHEN 'assigned' THEN 'Assigned'
        WHEN 'in progress' THEN 'Assigned'
        WHEN 'completed' THEN 'Completed'
        WHEN 'cancelled' THEN 'Cancelled'
        ELSE status END
        WHERE LOWER(status) IN ('pending', 'enquiry', 'confirmed', 'assigned', 'in progress', 'completed', 'cancelled')");

    $pdo->exec("UPDATE leads SET lead_code = CONCAT('LD-', LPAD(id, 6, '0')) WHERE lead_code IS NULL OR lead_code = ''");

    $indexCheck = $pdo->prepare(
        'SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table AND INDEX_NAME = :index'
    );
    foreach ($indexes as $table => $tableIndexes) {
        foreach ($tableIndexes as $index => $definition) {
            $indexCheck->execute(['table' => $table, 'index' => $index]);
            if ((int) $indexCheck->fetchColumn() === 0) {
                $unique = $definition['unique'] ? 'UNIQUE ' : '';
                $pdo->exec("ALTER TABLE `$table` ADD {$unique}INDEX `$index` ({$definition['columns']})");
            }
        }
    }

    $foreignKeyCheck = $pdo->prepare(
        'SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = :table AND CONSTRAINT_NAME = :constraint AND CONSTRAINT_TYPE = \'FOREIGN KEY\''
    );
    $foreignKeyCheck->execute(['table' => 'leads', 'constraint' => 'fk_leads_converted_customer']);
    if ((int) $foreignKeyCheck->fetchColumn() === 0) {
        $pdo->exec('ALTER TABLE leads ADD CONSTRAINT fk_leads_converted_customer FOREIGN KEY (converted_customer_id) REFERENCES customers(id) ON DELETE SET NULL');
    }

    echo "CRM workflow migration is current.\n";
} catch (Throwable $error) {
    error_log('CRM migration failed: ' . $error->getMessage());
    fwrite(STDERR, "CRM workflow migration failed.\n");
    exit(1);
}
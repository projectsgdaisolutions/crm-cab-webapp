CREATE DATABASE IF NOT EXISTS gd_ai_cab_crm
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE gd_ai_cab_crm;

-- USERS
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    phone VARCHAR(20),
    password VARCHAR(255) NOT NULL,
    role ENUM('admin', 'executive') NOT NULL DEFAULT 'executive',
    status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
    last_login_at TIMESTAMP NULL,
    timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata',
    bio TEXT NULL,
    preferences LONGTEXT NULL,
    auth_version INT UNSIGNED NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE password_reset_tokens (
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
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- CUSTOMERS
CREATE TABLE customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    alternate_phone VARCHAR(20) NULL,
    email VARCHAR(150),
    address TEXT,
    pickup_location TEXT NULL,
    drop_location TEXT NULL,
    customer_type VARCHAR(50),
    notes TEXT,
    created_by INT,
    assigned_to INT,
    city VARCHAR(100) NOT NULL DEFAULT '',
    status VARCHAR(30) NOT NULL DEFAULT 'Active',
    tags LONGTEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_customers_assigned_to (assigned_to),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
);

-- LEADS
CREATE TABLE leads (
    id INT AUTO_INCREMENT PRIMARY KEY,
    lead_code VARCHAR(24) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(150),
    source VARCHAR(100),
    status VARCHAR(50) NOT NULL DEFAULT 'New',
    priority VARCHAR(30) NOT NULL DEFAULT 'Medium',
    interested_service VARCHAR(100) NOT NULL DEFAULT '',
    pickup_location TEXT NULL,
    drop_location TEXT NULL,
    travel_at DATETIME NULL,
    estimated_value DECIMAL(10,2) NOT NULL DEFAULT 0,
    location VARCHAR(150) NOT NULL DEFAULT '',
    next_follow_up DATETIME NULL,
    assigned_to INT,
    created_by INT,
    converted_customer_id INT NULL,
    converted_at DATETIME NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_leads_assigned_status (assigned_to, status),
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (converted_customer_id) REFERENCES customers(id) ON DELETE SET NULL
);

-- FOLLOW UPS
CREATE TABLE follow_ups (
    id INT AUTO_INCREMENT PRIMARY KEY,
    lead_id INT,
    customer_id INT,
    assigned_to INT,
    scheduled_at DATETIME NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    priority VARCHAR(30) NOT NULL DEFAULT 'Medium',
    channel VARCHAR(30) NOT NULL DEFAULT 'Phone',
    reminder_sent TINYINT(1) NOT NULL DEFAULT 0,
    completed_at DATETIME NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_followups_assigned_schedule (assigned_to, scheduled_at),
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
);

-- DRIVER / VEHICLE / MOBILE / PERMISSIONS
CREATE TABLE drivers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    license_number VARCHAR(80) NOT NULL UNIQUE,
    status ENUM('active','inactive') NOT NULL DEFAULT 'active',
    address TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_drivers_status_name (status, name)
);

CREATE TABLE vehicles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    registration_number VARCHAR(30) NOT NULL UNIQUE,
    vehicle_type VARCHAR(100) NOT NULL,
    make_model VARCHAR(120) NULL,
    capacity INT NOT NULL DEFAULT 1,
    status ENUM('active','inactive','maintenance') NOT NULL DEFAULT 'active',
    driver_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_vehicles_status_type (status, vehicle_type),
    FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL
);

CREATE TABLE mobile_devices (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    device_token VARCHAR(512) NOT NULL,
    platform ENUM('android','ios','web','unknown') NOT NULL DEFAULT 'unknown',
    app_version VARCHAR(50) NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    last_seen_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_mobile_device_token (device_token),
    INDEX idx_mobile_devices_user_active (user_id, active),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE role_permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    role VARCHAR(50) NOT NULL,
    permission_key VARCHAR(120) NOT NULL,
    allowed BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_role_permission (role, permission_key)
);


-- BOOKINGS
CREATE TABLE bookings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT,
    lead_id INT,
    booking_date DATETIME NOT NULL,
    booking_code VARCHAR(40) UNIQUE,
    assigned_to INT,
    pickup_location TEXT,
    drop_location TEXT,
    vehicle_type VARCHAR(100),
    status VARCHAR(50) NOT NULL DEFAULT 'Enquiry',
    payment_status VARCHAR(30) NOT NULL DEFAULT 'Unpaid',
    fare DECIMAL(10,2) DEFAULT 0,
    mobile_number VARCHAR(20) NOT NULL DEFAULT '',
    passenger_count INT NOT NULL DEFAULT 1,
    driver_vehicle_details TEXT,
    driver_id INT NULL,
    vehicle_id INT NULL,
    notes TEXT,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_bookings_customer_date (customer_id, booking_date),
    INDEX idx_bookings_assigned_date (assigned_to, booking_date),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL
);

-- CALLS
CREATE TABLE calls (
    id INT AUTO_INCREMENT PRIMARY KEY,
    lead_id INT,
    customer_id INT,
    executive_id INT,
    phone_number VARCHAR(20),
    call_type VARCHAR(30),
    call_status VARCHAR(50),
    duration_seconds INT DEFAULT 0,
    call_time DATETIME,
    notes TEXT,
    follow_up_id INT NULL,
    client_sync_id VARCHAR(100) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_calls_followup (follow_up_id),
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
    FOREIGN KEY (executive_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (follow_up_id) REFERENCES follow_ups(id) ON DELETE SET NULL,
    UNIQUE KEY uq_calls_exec_sync (executive_id, client_sync_id)
);

-- RECORDINGS
CREATE TABLE recordings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    call_id INT NOT NULL,
    file_path TEXT,
    duration_seconds INT DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'Available',
    transcript TEXT NULL,
    access_level VARCHAR(30) NOT NULL DEFAULT 'Admin',
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (call_id) REFERENCES calls(id) ON DELETE CASCADE
);

-- CRM NOTES
CREATE TABLE crm_notes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    entity_type VARCHAR(30) NOT NULL,
    entity_id INT NOT NULL,
    note_text TEXT NOT NULL,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_crm_notes_entity (entity_type, entity_id, created_at),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- TASKS
CREATE TABLE tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    assigned_to INT,
    start_date DATETIME NULL,
    due_date DATETIME,
    priority VARCHAR(30) DEFAULT 'medium',
    status VARCHAR(50) DEFAULT 'pending',
    related_type VARCHAR(30) NULL,
    related_id INT NULL,
    completed_at DATETIME NULL,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tasks_assigned_due (assigned_to, due_date),
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- NOTIFICATIONS
CREATE TABLE notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    type VARCHAR(30) NOT NULL DEFAULT 'general',
    title VARCHAR(200) NOT NULL,
    message TEXT,
    related_type VARCHAR(30) NULL,
    related_id INT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_notifications_user_type (user_id, type, created_at),
    INDEX idx_notifications_related (related_type, related_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);


-- ACTIVITY LOG
CREATE TABLE activities (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    entity_type VARCHAR(50),
    entity_id INT,
    action VARCHAR(100),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_activities_entity (entity_type, entity_id, created_at),
    INDEX idx_activities_user_date (user_id, created_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
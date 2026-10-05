<?php
try {
    $pdo = new PDO(
        "mysql:host=127.0.0.1;port=3306;dbname=gd_ai_cab_crm;charset=utf8mb4",
        "root",
        ""
    );

    echo "DATABASE CONNECTED SUCCESSFULLY";
} catch (PDOException $e) {
    echo "DATABASE ERROR: " . $e->getMessage();
}
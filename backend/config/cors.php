<?php

$configuredOrigins = getenv('CORS_ALLOWED_ORIGINS') ?: 'http://localhost:5173,http://127.0.0.1:5173';
$allowedOrigins = array_filter(array_map('trim', explode(',', $configuredOrigins)));
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

header('Vary: Origin');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Requested-With, X-Client, X-CSRF-Token');

if ($origin !== '') {
    if (!in_array($origin, $allowedOrigins, true)) {
        http_response_code(403);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['success' => false, 'message' => 'Origin is not allowed.']);
        exit;
    }

    header('Access-Control-Allow-Origin: ' . $origin);
}

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}
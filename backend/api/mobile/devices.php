<?php

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../middleware/auth.php';

$actor = requireAuth($pdo);
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'POST' || $method === 'DELETE') {
    requireCsrfToken();
}

if (!in_array($method, ['GET', 'POST', 'DELETE'], true)) {
    sendError('Method not allowed.', 405);
}

if ($method === 'GET') {
    $statement = $pdo->prepare(
        'SELECT id, device_token AS deviceToken, platform, app_version AS appVersion, active, last_seen_at AS lastSeenAt
         FROM mobile_devices
         WHERE user_id = :user_id
         ORDER BY updated_at DESC'
    );
    $statement->execute(['user_id' => $actor['id']]);
    sendResponse(['success' => true, 'data' => $statement->fetchAll()]);
}

$body = json_decode(file_get_contents('php://input'), true) ?: [];
$token = trim((string) ($body['deviceToken'] ?? ''));

if ($token === '' || strlen($token) > 512) {
    sendError('deviceToken is required.', 422);
}

if ($method === 'DELETE') {
    $statement = $pdo->prepare('UPDATE mobile_devices SET active = 0 WHERE user_id = :user_id AND device_token = :token');
    $statement->execute([
        'user_id' => $actor['id'],
        'token' => $token,
    ]);
    sendResponse(['success' => true]);
}

$platform = $body['platform'] ?? 'unknown';
if (!in_array($platform, ['android', 'ios', 'web', 'unknown'], true)) {
    $platform = 'unknown';
}

$version = trim((string) ($body['appVersion'] ?? ''));
$statement = $pdo->prepare(
    'INSERT INTO mobile_devices (user_id, device_token, platform, app_version, active, last_seen_at)
     VALUES (:user_id, :token, :platform, :version, 1, NOW())
     ON DUPLICATE KEY UPDATE
        user_id = VALUES(user_id),
        platform = VALUES(platform),
        app_version = VALUES(app_version),
        active = 1,
        last_seen_at = NOW()'
);
$statement->execute([
    'user_id' => $actor['id'],
    'token' => $token,
    'platform' => $platform,
    'version' => $version,
]);

sendResponse(['success' => true, 'data' => ['registered' => true]]);

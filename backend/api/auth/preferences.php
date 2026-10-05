<?php
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

$user = requireAuth($pdo);
$method = $_SERVER['REQUEST_METHOD'];
if (!in_array($method, ['GET', 'PUT'], true)) {
    header('Allow: GET, PUT, OPTIONS');
    sendError('Method not allowed.', 405);
}

if ($method === 'GET') {
    $statement = $pdo->prepare('SELECT preferences FROM users WHERE id = :id LIMIT 1');
    $statement->execute(['id' => $user['id']]);
    $preferences = json_decode((string) $statement->fetchColumn(), true);
    sendResponse(['success' => true, 'data' => is_array($preferences) ? $preferences : []]);
}

requireCsrfToken();
$body = json_decode(file_get_contents('php://input'), true);
if (!is_array($body) || strlen(json_encode($body)) > 10000) sendError('Preferences must be a JSON object under 10 KB.', 422);
$statement = $pdo->prepare('UPDATE users SET preferences = :preferences WHERE id = :id');
$statement->execute(['preferences' => json_encode($body, JSON_THROW_ON_ERROR), 'id' => $user['id']]);
sendResponse(['success' => true, 'data' => $body]);

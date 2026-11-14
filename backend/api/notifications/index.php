<?php

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

// Authenticate user
$user = requireAuth($pdo);

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if (!in_array($method, ['GET', 'PATCH'], true)) {
    header('Allow: GET, PATCH, OPTIONS');
    sendError('Method not allowed.', 405);
}

// GET: Fetch notifications
if ($method === 'GET') {

    $statement = $pdo->prepare(
        'SELECT
            id,
            type,
            title,
            message AS description,
            related_type AS relatedType,
            related_id AS relatedId,
            created_at AS `timestamp`,
            is_read AS `read`
         FROM notifications
         WHERE user_id = :user_id
         ORDER BY created_at DESC
         LIMIT 100'
    );

    $statement->execute([
        'user_id' => $user['id']
    ]);

    $rows = $statement->fetchAll();

    foreach ($rows as &$row) {
        $row['id'] = (string) $row['id'];

        if (isset($row['relatedId'])) {
            $row['relatedId'] = (string) $row['relatedId'];
        }

        $row['read'] = (bool) $row['read'];
    }

    unset($row);

    // Get unread notification count
    $unreadCount = $pdo->prepare(
        'SELECT COUNT(*)
         FROM notifications
         WHERE user_id = :user_id AND is_read = 0'
    );

    $unreadCount->execute([
        'user_id' => $user['id']
    ]);

    sendResponse([
        'success' => true,
        'data' => $rows,
        'unreadCount' => (int) $unreadCount->fetchColumn()
    ]);
}

// PATCH: Mark notifications as read
requireCsrfToken();

$body = json_decode(file_get_contents('php://input'), true);

if (!is_array($body)) {
    sendError('Request body must be a JSON object.', 400);
}

if (!empty($body['readAll'])) {

    $statement = $pdo->prepare(
        'UPDATE notifications
         SET is_read = 1
         WHERE user_id = :user_id'
    );

    $statement->execute([
        'user_id' => $user['id']
    ]);

} else {

    $id = filter_var(
        $_GET['id'] ?? null,
        FILTER_VALIDATE_INT,
        ['options' => ['min_range' => 1]]
    );

    if (!$id) {
        sendError('A valid notification ID is required.', 400);
    }

    // Update only the authenticated user's notification
    $statement = $pdo->prepare(
        'UPDATE notifications
         SET is_read = 1
         WHERE id = :id AND user_id = :user_id'
    );

    $statement->execute([
        'id' => $id,
        'user_id' => $user['id']
    ]);

    // Check existence separately, because rowCount()
    // can be zero when the notification is already read.
    $check = $pdo->prepare(
        'SELECT id FROM notifications
         WHERE id = :id AND user_id = :user_id'
    );

    $check->execute([
        'id' => $id,
        'user_id' => $user['id']
    ]);

    if (!$check->fetch()) {
        sendError('Notification not found.', 404);
    }
}

sendResponse([
    'success' => true
]);

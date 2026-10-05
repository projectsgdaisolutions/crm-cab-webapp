<?php

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST, OPTIONS');
    sendError('Only POST method is allowed.', 405);
}

$body = json_decode(file_get_contents('php://input'), true);
if (!is_array($body)) {
    sendError('Request body must be a JSON object.', 400);
}

$token = $body['token'] ?? '';
$newPassword = $body['newPassword'] ?? '';
if (!is_string($token) || !preg_match('/^[a-f0-9]{64}$/', $token)) {
    sendError('This reset link is invalid or expired. Request a new link.', 400);
}
if (!is_string($newPassword) || strlen($newPassword) < 12 || strlen($newPassword) > 4096) {
    sendError('Choose a password of at least 12 characters.', 422);
}

try {
    $pdo->beginTransaction();
    $tokenQuery = $pdo->prepare(
        "SELECT r.id, r.user_id
         FROM password_reset_tokens r
         INNER JOIN users u ON u.id = r.user_id
         WHERE r.token_hash = :token_hash
           AND r.used_at IS NULL
           AND r.expires_at > CURRENT_TIMESTAMP
           AND u.status = 'active'
           AND u.role IN ('admin', 'executive')
         LIMIT 1
         FOR UPDATE"
    );
    $tokenQuery->execute(['token_hash' => hash('sha256', $token)]);
    $reset = $tokenQuery->fetch();
    if (!$reset) {
        $pdo->rollBack();
        sendError('This reset link is invalid or expired. Request a new link.', 400);
    }

    $updateUser = $pdo->prepare(
        'UPDATE users SET password = :password, auth_version = auth_version + 1 WHERE id = :id'
    );
    $updateUser->execute([
        'password' => password_hash($newPassword, PASSWORD_DEFAULT),
        'id' => $reset['user_id'],
    ]);
    $consumeTokens = $pdo->prepare(
        'UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP
         WHERE user_id = :user_id AND token_hash IS NOT NULL AND used_at IS NULL'
    );
    $consumeTokens->execute(['user_id' => $reset['user_id']]);
    $activity = $pdo->prepare(
        "INSERT INTO activities (user_id, entity_type, entity_id, action, description)
         VALUES (:user_id, 'user', :entity_id, 'password_reset', 'Reset account password')"
    );
    $activity->execute(['user_id' => $reset['user_id'], 'entity_id' => $reset['user_id']]);
    $pdo->commit();
} catch (Throwable $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('Password reset could not be completed.');
    sendError('Unable to reset the password right now. Request a new link or try again.', 500);
}

sendResponse([
    'success' => true,
    'message' => 'Your password has been reset. You may now sign in.',
]);

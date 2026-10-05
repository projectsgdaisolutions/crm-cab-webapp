<?php
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

$user = requireAuth($pdo);
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST, OPTIONS');
    sendError('Only POST method is allowed.', 405);
}
requireCsrfToken();
$body = json_decode(file_get_contents('php://input'), true);
if (!is_array($body)) sendError('Request body must be a JSON object.', 400);
$currentPassword = $body['currentPassword'] ?? '';
$newPassword = $body['newPassword'] ?? '';
if (!is_string($currentPassword) || $currentPassword === '' || !is_string($newPassword) || strlen($newPassword) < 12 || strlen($newPassword) > 4096) {
    sendError('Enter your current password and a new password of at least 12 characters.', 422);
}

$statement = $pdo->prepare('SELECT password FROM users WHERE id = :id LIMIT 1');
$statement->execute(['id' => $user['id']]);
$currentHash = $statement->fetchColumn();
if (!is_string($currentHash) || !password_verify($currentPassword, $currentHash)) {
    sendError('Current password is incorrect.', 401);
}
if (password_verify($newPassword, $currentHash)) {
    sendError('Choose a password different from your current password.', 422);
}

try {
    $pdo->beginTransaction();
    $update = $pdo->prepare('UPDATE users SET password = :password, auth_version = auth_version + 1 WHERE id = :id');
    $update->execute(['password' => password_hash($newPassword, PASSWORD_DEFAULT), 'id' => $user['id']]);
    $invalidateTokens = $pdo->prepare('UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE user_id = :id AND token_hash IS NOT NULL AND used_at IS NULL');
    $invalidateTokens->execute(['id' => $user['id']]);
    $versionQuery = $pdo->prepare('SELECT auth_version FROM users WHERE id = :id LIMIT 1');
    $versionQuery->execute(['id' => $user['id']]);
    $newAuthVersion = (int) $versionQuery->fetchColumn();
    $activity = $pdo->prepare("INSERT INTO activities (user_id, entity_type, entity_id, action, description) VALUES (:user_id, 'user', :entity_id, 'password_changed', 'Changed account password')");
    $activity->execute(['user_id' => $user['id'], 'entity_id' => $user['id']]);
    $pdo->commit();
} catch (PDOException $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('Password update failed: ' . $error->getMessage());
    sendError('Unable to update your password.', 500);
}

session_regenerate_id(true);
$_SESSION['auth_version'] = $newAuthVersion;
sendResponse(['success' => true, 'message' => 'Password updated.']);

<?php
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

$actor = requireRole($pdo, ['admin']);
if ($_SERVER['REQUEST_METHOD'] !== 'PUT') {
    header('Allow: PUT, OPTIONS');
    sendError('Only PUT method is allowed.', 405);
}
requireCsrfToken();
$body = json_decode(file_get_contents('php://input'), true);
if (!is_array($body)) sendError('Request body must be a JSON object.', 400);

$name = trim((string) ($body['name'] ?? ''));
$email = strtolower(trim((string) ($body['email'] ?? '')));
$phone = trim((string) ($body['phone'] ?? ''));
$timezone = trim((string) ($body['timezone'] ?? 'Asia/Kolkata'));
$bio = trim((string) ($body['bio'] ?? ''));
if ($name === '' || mb_strlen($name) > 150) sendError('Name is required and must be at most 150 characters.', 422);
if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 150) sendError('Enter a valid email address.', 422);
if (strlen($phone) > 20) sendError('Phone must be at most 20 characters.', 422);
if (!in_array($timezone, DateTimeZone::listIdentifiers(), true)) sendError('Timezone is invalid.', 422);
if (mb_strlen($bio) > 2000) sendError('Bio must be at most 2000 characters.', 422);

try {
    $pdo->beginTransaction();
    $update = $pdo->prepare('UPDATE users SET name = :name, email = :email, phone = :phone, timezone = :timezone, bio = :bio WHERE id = :id');
    $update->execute(['name' => $name, 'email' => $email, 'phone' => $phone, 'timezone' => $timezone, 'bio' => $bio, 'id' => $actor['id']]);
    $activity = $pdo->prepare("INSERT INTO activities (user_id, entity_type, entity_id, action, description) VALUES (:user_id, 'user', :entity_id, 'profile_updated', 'Updated account profile')");
    $activity->execute(['user_id' => $actor['id'], 'entity_id' => $actor['id']]);
    $pdo->commit();
} catch (PDOException $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    if ($error->getCode() === '23000') sendError('That email address is already in use.', 409);
    error_log('Profile update failed: ' . $error->getMessage());
    sendError('Unable to update your profile.', 500);
}

$statement = $pdo->prepare('SELECT id, name, email, phone, role, timezone, bio FROM users WHERE id = :id LIMIT 1');
$statement->execute(['id' => $actor['id']]);
$user = $statement->fetch();
$user['id'] = (string) $user['id'];
sendResponse(['success' => true, 'user' => $user]);

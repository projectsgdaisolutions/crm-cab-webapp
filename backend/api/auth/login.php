<?php
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../config/session.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST, OPTIONS');
    sendError('Only POST method is allowed.', 405);
}

$data = json_decode(file_get_contents('php://input'), true);

if (!is_array($data)) {
    sendError('Request body must be a JSON object.', 400);
}

$identifier = trim((string) ($data['identifier'] ?? $data['email'] ?? $data['phone'] ?? ''));
$password = $data['password'] ?? '';

if ($identifier === '' || strlen($identifier) > 254 || !is_string($password) || $password === '' || strlen($password) > 4096) {
    sendError('Enter your email or mobile number and password.', 400);
}

$normalizedPhone = str_contains($identifier, '@') ? '' : preg_replace('/\D+/', '', $identifier);
$statement = $pdo->prepare(
    "SELECT id, name, email, phone, password, role, status, timezone, bio, auth_version
     FROM users
     WHERE email = :identifier_email
        OR phone = :identifier_phone
        OR (:normalized_phone_check <> '' AND
            REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(phone, ''), ' ', ''), '-', ''), '+', ''), '(', ''), ')', '') = :normalized_phone)
     LIMIT 20"
);
$statement->execute([
    'identifier_email' => $identifier,
    'identifier_phone' => $identifier,
    'normalized_phone_check' => $normalizedPhone,
    'normalized_phone' => $normalizedPhone,
]);

$matches = $statement->fetchAll();
$user = null;
$credentialsValid = false;

foreach ($matches as $match) {
    if (password_verify($password, $match['password'])) {
        $user = $match;
        $credentialsValid = true;
        break;
    }
}

if (!$credentialsValid) {
    sendError('Invalid email/mobile number or password.', 401);
}

if ($user['status'] !== 'active' || !in_array($user['role'], ['admin', 'executive'], true)) {
    sendError('This account is inactive or does not have access to this application.', 403);
}

$lastLogin = $pdo->prepare('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = :id');
$lastLogin->execute(['id' => $user['id']]);

session_regenerate_id(true);

$_SESSION['user_id'] = (int) $user['id'];
$_SESSION['user_role'] = $user['role'];
$_SESSION['auth_version'] = (int) $user['auth_version'];
$_SESSION['auth_expires_at'] = time() + 28800;
$csrfToken = issueCsrfToken();

unset($user['password'], $user['status'], $user['auth_version']);

sendResponse([
    'success' => true,
    'message' => 'Login successful.',
    'user' => $user,
    'csrfToken' => $csrfToken,
]);
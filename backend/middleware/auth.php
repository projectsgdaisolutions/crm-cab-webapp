<?php

require_once __DIR__ . '/../config/session.php';
require_once __DIR__ . '/../helpers/response.php';

function destroyAuthSession(): void
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        return;
    }

    $_SESSION = [];
    $cookie = session_get_cookie_params();
    setcookie(session_name(), '', [
        'expires' => time() - 42000,
        'path' => $cookie['path'] ?: '/',
        'domain' => $cookie['domain'],
        'secure' => $cookie['secure'],
        'httponly' => $cookie['httponly'],
        'samesite' => $cookie['samesite'] ?? 'Lax',
    ]);
    session_destroy();
}

function currentAuthenticatedUser(PDO $pdo): ?array
{
    $userId = $_SESSION['user_id'] ?? null;
    $expiresAt = $_SESSION['auth_expires_at'] ?? 0;

    if (!$userId || !is_numeric($userId) || time() >= (int) $expiresAt) {
        destroyAuthSession();
        return null;
    }

    $statement = $pdo->prepare(
        'SELECT id, name, email, phone, role, status, timezone, bio, auth_version FROM users WHERE id = :id LIMIT 1'
    );
    $statement->execute(['id' => $userId]);
    $user = $statement->fetch();

    if (!$user || $user['status'] !== 'active' || !in_array($user['role'], ['admin', 'executive'], true)) {
        destroyAuthSession();
        return null;
    }

    if (($user['role'] ?? null) !== ($_SESSION['user_role'] ?? null)) {
        destroyAuthSession();
        return null;
    }

    if ((int) ($user['auth_version'] ?? -1) !== (int) ($_SESSION['auth_version'] ?? -2)) {
        destroyAuthSession();
        return null;
    }

    return $user;
}

function requireAuth(PDO $pdo): array
{
    $user = currentAuthenticatedUser($pdo);

    if (!$user) {
        sendError('Your session has expired. Please sign in again.', 401);
    }

    return $user;
}

function requireRole(PDO $pdo, array $allowedRoles): array
{
    $user = requireAuth($pdo);

    if (!in_array($user['role'], $allowedRoles, true)) {
        sendError('You do not have permission to access this resource.', 403);
    }

    return $user;
}

function issueCsrfToken(): string
{
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }

    return $_SESSION['csrf_token'];
}

function requireCsrfToken(): void
{
    $providedToken = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    $sessionToken = $_SESSION['csrf_token'] ?? '';

    if (!is_string($providedToken) || !is_string($sessionToken) || $sessionToken === '' || !hash_equals($sessionToken, $providedToken)) {
        sendError('Your security token is invalid or expired. Refresh and try again.', 419);
    }
}
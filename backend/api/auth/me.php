<?php

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../config/session.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    header('Allow: GET, OPTIONS');
    sendError('Only GET method is allowed.', 405);
}

$user = requireAuth($pdo);
unset($user['status'], $user['auth_version']);

sendResponse([
    'success' => true,
    'user' => $user,
    'csrfToken' => issueCsrfToken(),
]);
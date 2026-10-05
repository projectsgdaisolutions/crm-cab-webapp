<?php

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../config/session.php';
require_once __DIR__ . '/../../middleware/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST, OPTIONS');
    sendError('Only POST method is allowed.', 405);
}

requireCsrfToken();
destroyAuthSession();
sendResponse([
    'success' => true,
    'message' => 'Logout successful.',
]);
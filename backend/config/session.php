<?php

$sessionLifetime = 28800;
$forceSecureCookie = filter_var(getenv('SESSION_SECURE') ?: 'false', FILTER_VALIDATE_BOOLEAN);
$isSecureRequest = $forceSecureCookie || (!empty($_SERVER['HTTPS']) && strtolower((string) $_SERVER['HTTPS']) !== 'off');
$sameSite = getenv('SESSION_SAME_SITE') ?: 'Lax';

if (!in_array($sameSite, ['Lax', 'Strict', 'None'], true)) {
    $sameSite = 'Lax';
}

if ($sameSite === 'None' && !$isSecureRequest) {
    $sameSite = 'Lax';
}

ini_set('session.use_strict_mode', '1');
ini_set('session.use_only_cookies', '1');
ini_set('session.gc_maxlifetime', (string) $sessionLifetime);

if (session_status() === PHP_SESSION_NONE) {
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'domain' => getenv('SESSION_COOKIE_DOMAIN') ?: '',
        'secure' => $isSecureRequest,
        'httponly' => true,
        'samesite' => $sameSite,
    ]);

    session_start();
}
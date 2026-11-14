<?php

$sessionLifetime = 28800;
$forceSecureCookie = filter_var(getenv('SESSION_SECURE') ?: 'false', FILTER_VALIDATE_BOOLEAN);
$https = strtolower((string) ($_SERVER['HTTPS'] ?? ''));
$forwardedProto = strtolower(trim(explode(',', (string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? ''))[0]));
$requestHost = strtolower((string) ($_SERVER['HTTP_HOST'] ?? ''));
$requestHost = preg_replace('/:\d+$/', '', $requestHost) ?? $requestHost;
$isProductionHost = $requestHost === 'vehicocrm.gdaisolutions.com';
$isSecureRequest = $forceSecureCookie
    || ($https !== '' && $https !== 'off')
    || $forwardedProto === 'https'
    || $isProductionHost;
$configuredSameSite = getenv('SESSION_SAME_SITE');
$sameSite = is_string($configuredSameSite) && $configuredSameSite !== ''
    ? $configuredSameSite
    : ($isSecureRequest ? 'None' : 'Lax');

if (!in_array($sameSite, ['Lax', 'Strict', 'None'], true)) {
    $sameSite = $isSecureRequest ? 'None' : 'Lax';
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
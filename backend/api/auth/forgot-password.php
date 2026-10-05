<?php

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../config/database.php';

use PHPMailer\PHPMailer\PHPMailer;

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST, OPTIONS');
    sendError('Only POST method is allowed.', 405);
}

$autoload = dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'vendor' . DIRECTORY_SEPARATOR . 'autoload.php';
$frontendResetUrl = trim((string) (getenv('FRONTEND_RESET_URL') ?: ''));
$smtpHost = trim((string) (getenv('SMTP_HOST') ?: ''));
$smtpPort = filter_var(getenv('SMTP_PORT') ?: null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 65535]]);
$smtpUsername = (string) (getenv('SMTP_USERNAME') ?: '');
$smtpPassword = (string) (getenv('SMTP_PASSWORD') ?: '');
$smtpEncryption = strtolower(trim((string) (getenv('SMTP_ENCRYPTION') ?: '')));
$smtpFromEmail = trim((string) (getenv('SMTP_FROM_EMAIL') ?: ''));
$smtpFromName = trim((string) (getenv('SMTP_FROM_NAME') ?: 'CAB CRM'));
$rateKey = (string) (getenv('PASSWORD_RESET_RATE_KEY') ?: '');
$urlParts = parse_url($frontendResetUrl);
$localResetHost = is_array($urlParts)
    && in_array(strtolower((string) ($urlParts['host'] ?? '')), ['localhost', '127.0.0.1'], true);
$validResetUrl = is_array($urlParts)
    && in_array(strtolower((string) ($urlParts['scheme'] ?? '')), $localResetHost ? ['http', 'https'] : ['https'], true)
    && !isset($urlParts['user'])
    && !isset($urlParts['pass'])
    && !isset($urlParts['query'])
    && !isset($urlParts['fragment'])
    && filter_var($frontendResetUrl, FILTER_VALIDATE_URL);

if (!is_file($autoload)) {
    sendError('Password reset mailer dependency is missing. Run composer install --working-dir=backend.', 503);
}
require_once $autoload;
if (!class_exists(PHPMailer::class)) {
    sendError('Password reset mailer dependency is missing. Run composer install --working-dir=backend.', 503);
}

$body = json_decode(file_get_contents('php://input'), true);
if (!is_array($body)) {
    sendError('Request body must be a JSON object.', 400);
}

$email = strtolower(trim((string) ($body['email'] ?? '')));
if ($email === '' || strlen($email) > 150 || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    sendError('Enter a valid registered email address.', 422);
}

if (!$smtpHost
    || !$smtpPort
    || !$smtpUsername
    || !$smtpPassword
    || !in_array($smtpEncryption, ['tls', 'ssl'], true)
    || !filter_var($smtpFromEmail, FILTER_VALIDATE_EMAIL)
    || !$validResetUrl
    || strlen($rateKey) < 32
) {
    sendError('Password reset email is not configured. Contact your administrator.', 503);
}

$mailer = new PHPMailer(true);
$mailer->isSMTP();
$mailer->Host = $smtpHost;
$mailer->Port = (int) $smtpPort;
$mailer->SMTPAuth = true;
$mailer->Username = $smtpUsername;
$mailer->Password = $smtpPassword;
$mailer->SMTPSecure = $smtpEncryption === 'ssl'
    ? PHPMailer::ENCRYPTION_SMTPS
    : PHPMailer::ENCRYPTION_STARTTLS;
$mailer->Timeout = 10;
$mailer->CharSet = 'UTF-8';
try {
    $mailer->smtpConnect();
    $mailer->smtpClose();
} catch (Throwable $error) {
    error_log('Password reset SMTP preflight failed: ' . get_class($error) . ' - ' . $error->getMessage());
    sendError('Password reset email service is temporarily unavailable.', 503);
}

$ipAddress = (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
$ipHash = hash_hmac('sha256', $ipAddress, $rateKey);
$resetToken = null;
$tokenHash = null;
$user = null;

try {
    $pdo->beginTransaction();
    $ipLimit = $pdo->prepare(
        'SELECT COUNT(*) FROM password_reset_tokens
         WHERE request_ip_hash = :ip_hash AND created_at >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 15 MINUTE)'
    );
    $ipLimit->execute(['ip_hash' => $ipHash]);
    if ((int) $ipLimit->fetchColumn() >= 5) {
        $pdo->commit();
        sendResponse([
            'success' => true,
            'message' => 'If an account exists for this email, a password reset link has been sent.',
        ]);
    }

    $userQuery = $pdo->prepare(
        "SELECT id, name, email FROM users
         WHERE email = :email AND status = 'active' AND role IN ('admin', 'executive')
         LIMIT 1"
    );
    $userQuery->execute(['email' => $email]);
    $user = $userQuery->fetch() ?: null;

    if ($user) {
        $userLimit = $pdo->prepare(
            'SELECT COUNT(*) FROM password_reset_tokens
             WHERE user_id = :user_id AND created_at >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 1 HOUR)'
        );
        $userLimit->execute(['user_id' => $user['id']]);
        if ((int) $userLimit->fetchColumn() < 3) {
            $invalidateOld = $pdo->prepare(
                'UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP
                 WHERE user_id = :user_id AND token_hash IS NOT NULL AND used_at IS NULL'
            );
            $invalidateOld->execute(['user_id' => $user['id']]);
            $resetToken = bin2hex(random_bytes(32));
            $tokenHash = hash('sha256', $resetToken);
            $insert = $pdo->prepare(
                'INSERT INTO password_reset_tokens (user_id, token_hash, request_ip_hash, expires_at)
                 VALUES (:user_id, :token_hash, :ip_hash, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 1 HOUR))'
            );
            $insert->execute(['user_id' => $user['id'], 'token_hash' => $tokenHash, 'ip_hash' => $ipHash]);
        } else {
            $user = null;
        }
    }

    if (!$user) {
        $recordAttempt = $pdo->prepare(
            'INSERT INTO password_reset_tokens (user_id, token_hash, request_ip_hash, expires_at)
             VALUES (NULL, NULL, :ip_hash, NULL)'
        );
        $recordAttempt->execute(['ip_hash' => $ipHash]);
    }
    $pdo->commit();
} catch (Throwable $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('Password reset request could not be recorded.');
    sendError('Unable to process the password reset request right now.', 500);
}

if ($user && $resetToken !== null && $tokenHash !== null) {
    try {
        $resetLink = rtrim($frontendResetUrl, '/') . '#token=' . rawurlencode($resetToken);
        $safeName = htmlspecialchars((string) $user['name'], ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $safeLink = htmlspecialchars($resetLink, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $mailer->setFrom($smtpFromEmail, $smtpFromName);
        $mailer->addAddress((string) $user['email'], (string) $user['name']);
        $mailer->isHTML(true);
        $mailer->Subject = 'Reset your CAB CRM password';
        $mailer->Body = "<p>Hello {$safeName},</p><p>Use the link below to reset your CAB CRM password. It expires in one hour and can only be used once.</p><p><a href=\"{$safeLink}\">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>";
        $mailer->AltBody = "Hello {$user['name']},\n\nReset your CAB CRM password using this link (expires in one hour):\n{$resetLink}\n\nIf you did not request this, ignore this email.";
        $mailer->send();
    } catch (Throwable $error) {
        try {
            $invalidateFailedDelivery = $pdo->prepare(
                'UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE token_hash = :token_hash AND used_at IS NULL'
            );
            $invalidateFailedDelivery->execute(['token_hash' => $tokenHash]);
        } catch (Throwable $invalidateError) {
            error_log('Failed to invalidate undelivered password reset token: ' . get_class($invalidateError) . ' - ' . $invalidateError->getMessage());
        }
        error_log('Password reset email delivery failed: ' . get_class($error) . ' - ' . $error->getMessage());
        sendError('Password reset email service is temporarily unavailable.', 503);
    }
}

sendResponse([
    'success' => true,
    'message' => 'If an account exists for this email, a password reset link has been sent.',
]);

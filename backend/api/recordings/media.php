<?php

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

requireRole($pdo, ['admin', 'executive']);
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    header('Allow: GET, OPTIONS');
    sendError('Only GET method is allowed.', 405);
}

$id = filter_var($_GET['id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
if (!$id) sendError('A valid recording ID is required.', 400);

$statement = $pdo->prepare('SELECT r.file_path, x.executive_id FROM recordings r JOIN calls x ON x.id = r.call_id WHERE r.id = :id LIMIT 1');
$statement->execute(['id' => $id]);
$recording = $statement->fetch();
if (!$recording) sendError('Recording file not found.', 404);
if ($actor['role'] !== 'admin' && (int) $recording['executive_id'] !== (int) $actor['id']) sendError('You do not have access to this recording.', 403);
$storedPath = $recording['file_path'];
if (!is_string($storedPath) || $storedPath === '') sendError('Recording file not found.', 404);

$storageRoot = getenv('RECORDINGS_DIRECTORY') ?: dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'storage' . DIRECTORY_SEPARATOR . 'recordings';
$root = realpath($storageRoot);
$candidate = str_starts_with($storedPath, DIRECTORY_SEPARATOR) || preg_match('/^[A-Za-z]:[\\\\\/]/', $storedPath)
    ? $storedPath
    : $storageRoot . DIRECTORY_SEPARATOR . $storedPath;
$file = realpath($candidate);

if (!$root || !$file || !is_file($file) || !str_starts_with($file, $root . DIRECTORY_SEPARATOR)) {
    sendError('Recording file is unavailable.', 404);
}

$size = filesize($file);
$start = 0;
$end = $size - 1;
$status = 200;
$range = $_SERVER['HTTP_RANGE'] ?? '';
if ($range !== '') {
    if (!preg_match('/bytes=(\d*)-(\d*)/', $range, $matches)) {
        http_response_code(416);
        header("Content-Range: bytes */$size");
        exit;
    }
    if ($matches[1] === '') {
        $length = (int) $matches[2];
        $start = max(0, $size - $length);
    } else {
        $start = (int) $matches[1];
        if ($matches[2] !== '') $end = min($end, (int) $matches[2]);
    }
    if ($start > $end || $start >= $size) {
        http_response_code(416);
        header("Content-Range: bytes */$size");
        exit;
    }
    $status = 206;
}

$finfo = new finfo(FILEINFO_MIME_TYPE);
$mimeType = $finfo->file($file) ?: 'application/octet-stream';
$fileName = preg_replace('/[^A-Za-z0-9._-]/', '_', basename($file));
$disposition = isset($_GET['download']) ? 'attachment' : 'inline';
http_response_code($status);
header('Content-Type: ' . $mimeType);
header('X-Content-Type-Options: nosniff');
header('Accept-Ranges: bytes');
header("Content-Disposition: $disposition; filename=\"$fileName\"");
header('Cache-Control: private, no-store');
header('Content-Length: ' . ($end - $start + 1));
if ($status === 206) header("Content-Range: bytes $start-$end/$size");

$handle = fopen($file, 'rb');
if ($handle === false) sendError('Recording file could not be opened.', 500);
fseek($handle, $start);
$remaining = $end - $start + 1;
while ($remaining > 0 && !feof($handle)) {
    $chunk = fread($handle, min(8192, $remaining));
    if ($chunk === false) break;
    echo $chunk;
    $remaining -= strlen($chunk);
}
fclose($handle);
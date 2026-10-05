<?php

function sendResponse(mixed $data, int $statusCode = 200): never
{
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function sendError(string $message, int $statusCode = 400): never
{
    sendResponse([
        'success' => false,
        'message' => $message,
    ], $statusCode);
}
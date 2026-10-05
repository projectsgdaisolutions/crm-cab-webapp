<?php

$requestPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
$decodedPath = is_string($requestPath) ? rawurldecode($requestPath) : '/';

foreach (explode('/', $decodedPath) as $segment) {
    if (str_starts_with($segment, '.')) {
        http_response_code(404);
        exit;
    }
}

return false;
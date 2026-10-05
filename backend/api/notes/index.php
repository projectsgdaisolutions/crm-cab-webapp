<?php
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_once __DIR__ . '/../../helpers/response.php';
$actor = requireRole($pdo, ['admin', 'executive']);
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$entityTypes = ['Customer', 'Lead', 'Call', 'Booking', 'FollowUp', 'Task'];
function noteEntity(PDO $pdo, string $type, int $id, array $actor): void {
    $queries = [
        'Customer' => 'SELECT id, COALESCE(assigned_to, created_by) AS owner_id FROM customers WHERE id = :id LIMIT 1',
        'Lead' => 'SELECT id, assigned_to AS owner_id FROM leads WHERE id = :id LIMIT 1',
        'Call' => 'SELECT id, executive_id AS owner_id FROM calls WHERE id = :id LIMIT 1',
        'Booking' => 'SELECT id, COALESCE(assigned_to, created_by) AS owner_id FROM bookings WHERE id = :id LIMIT 1',
        'FollowUp' => 'SELECT id, assigned_to AS owner_id FROM follow_ups WHERE id = :id LIMIT 1',
        'Task' => 'SELECT id, assigned_to AS owner_id FROM tasks WHERE id = :id LIMIT 1',
    ];
    $stmt = $pdo->prepare($queries[$type]); $stmt->execute(['id' => $id]); $row = $stmt->fetch();
    if (!$row) sendError('Related record not found.', 404);
    if ($actor['role'] !== 'admin' && (int) ($row['owner_id'] ?? 0) !== (int) $actor['id']) sendError('You do not have access to this record.', 403);
}
function noteRows(PDO $pdo, string $type, int $id): array {
    $stmt = $pdo->prepare('SELECT n.id, n.entity_type AS entityType, n.entity_id AS entityId, n.note_text AS text, n.created_by AS authorId, COALESCE(u.name, "Unknown") AS authorName, n.created_at AS createdAt FROM crm_notes n LEFT JOIN users u ON u.id = n.created_by WHERE n.entity_type = :type AND n.entity_id = :id ORDER BY n.created_at DESC, n.id DESC');
    $stmt->execute(['type' => $type, 'id' => $id]); $rows = $stmt->fetchAll();
    foreach ($rows as &$row) { $row['id'] = (string) $row['id']; $row['entityId'] = (string) $row['entityId']; $row['authorId'] = (string) $row['authorId']; }
    return $rows;
}
if ($method === 'GET') {
    $type = (string) ($_GET['entityType'] ?? ''); $id = filter_var($_GET['entityId'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    if (!in_array($type, $entityTypes, true)) sendError('entityType is invalid.', 422);
    if (!$id) sendError('entityId is invalid.', 422); noteEntity($pdo, $type, (int) $id, $actor);
    sendResponse(['success' => true, 'data' => noteRows($pdo, $type, (int) $id)]);
}
if ($method !== 'POST') { header('Allow: GET, POST, OPTIONS'); sendError('Only GET and POST methods are allowed.', 405); }
requireCsrfToken(); $body = json_decode(file_get_contents('php://input'), true); if (!is_array($body)) sendError('Request body must be a JSON object.', 400);
$type = (string) ($body['entityType'] ?? ''); $id = filter_var($body['entityId'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]); $text = trim((string) ($body['text'] ?? ''));
if (!in_array($type, $entityTypes, true)) sendError('entityType is invalid.', 422); if (!$id) sendError('entityId is invalid.', 422); if ($text === '' || mb_strlen($text) > 5000) sendError('Note text is required and must be at most 5000 characters.', 422);
noteEntity($pdo, $type, (int) $id, $actor); $stmt = $pdo->prepare('INSERT INTO crm_notes (entity_type, entity_id, note_text, created_by) VALUES (:type, :id, :text, :user_id)'); $stmt->execute(['type' => $type, 'id' => $id, 'text' => $text, 'user_id' => $actor['id']]);
$rows = noteRows($pdo, $type, (int) $id); sendResponse(['success' => true, 'data' => $rows[0]], 201);

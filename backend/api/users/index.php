<?php

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

$actor = requireAuth($pdo);
$method = $_SERVER['REQUEST_METHOD'];

if (!in_array($method, ['GET', 'POST', 'PUT', 'DELETE'], true)) {
    header('Allow: GET, POST, PUT, DELETE, OPTIONS');
    sendError('Method not allowed.', 405);
}

if ($method !== 'GET') {
    requireCsrfToken();
}

function userResponse(array $row): array
{
    $roleMap = ['admin' => 'Admin', 'executive' => 'Calling Executive'];
    $joinedOn = strtotime((string) ($row['created_at'] ?? 'now'));
    $lastActive = strtotime((string) ($row['last_login_at'] ?? ''));
    $leads = (int) ($row['lead_count'] ?? 0);
    $calls = (int) ($row['call_count'] ?? 0);
    $converted = (int) ($row['converted_count'] ?? 0);

    return [
        'id' => (string) $row['id'],
        'name' => $row['name'],
        'email' => $row['email'],
        'phone' => $row['phone'] ?? '',
        'role' => $roleMap[$row['role']] ?? 'Calling Executive',
        'active' => $row['status'] === 'active',
        'leadCount' => $leads,
        'callCount' => $calls,
        'conversionRate' => $leads > 0 ? (int) round(($converted / $leads) * 100) : 0,
        'joinedOn' => $joinedOn ? date('Y-m-d', $joinedOn) : '',
        'lastActive' => $lastActive ? date(DATE_ATOM, $lastActive) : 'Not signed in',
    ];
}

function readJsonBody(): array
{
    $body = json_decode(file_get_contents('php://input'), true);
    if (!is_array($body)) {
        sendError('Request body must be a JSON object.', 400);
    }

    return $body;
}

if ($method === 'GET') {
    if ($actor['role'] !== 'admin') {
        sendResponse(['success' => true, 'data' => [userResponse([
            'id' => $actor['id'], 'name' => $actor['name'], 'email' => $actor['email'],
            'phone' => $actor['phone'], 'role' => $actor['role'], 'status' => $actor['status'],
            'created_at' => '', 'updated_at' => '',
        ])]]);
    }
    if (filter_var($_GET['activeExecutives'] ?? false, FILTER_VALIDATE_BOOLEAN)) {
        $statement = $pdo->query(
            "SELECT id, name, email, phone, role, status, created_at, last_login_at
             FROM users WHERE role = 'executive' AND status = 'active'
             ORDER BY name, id"
        );
        sendResponse(['success' => true, 'data' => array_map('userResponse', $statement->fetchAll())]);
    }
    $statement = $pdo->query(
        "SELECT u.id, u.name, u.email, u.phone, u.role, u.status, u.created_at, u.last_login_at,
                (SELECT COUNT(*) FROM leads l WHERE l.assigned_to = u.id) AS lead_count,
                (SELECT COUNT(*) FROM calls c WHERE c.executive_id = u.id) AS call_count,
                (SELECT COUNT(*) FROM leads l WHERE l.assigned_to = u.id AND LOWER(l.status) = 'converted') AS converted_count
         FROM users u
         WHERE u.role IN ('admin', 'executive')
         ORDER BY u.created_at DESC, u.id DESC"
    );
    sendResponse(['success' => true, 'data' => array_map('userResponse', $statement->fetchAll())]);
}

if ($actor['role'] !== 'admin') {
    sendError('You do not have permission to manage users.', 403);
}

$body = readJsonBody();
$name = trim((string) ($body['name'] ?? ''));
$email = strtolower(trim((string) ($body['email'] ?? '')));
$phone = trim((string) ($body['phone'] ?? ''));
$password = $body['password'] ?? '';

if ($name === '' || mb_strlen($name) > 150) {
    sendError('Enter a name up to 150 characters.', 422);
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 150) {
    sendError('Enter a valid email address.', 422);
}
if ($phone === '' || strlen($phone) > 20) {
    sendError('Enter a phone number up to 20 characters.', 422);
}

if ($method === 'POST') {
    if (($body['role'] ?? 'Calling Executive') !== 'Calling Executive') {
        sendError('Only Calling Executive accounts can be created here.', 422);
    }
    if (!is_string($password) || strlen($password) < 12 || strlen($password) > 4096) {
        sendError('Set an initial password of at least 12 characters.', 422);
    }

    try {
        $pdo->beginTransaction();
        $statement = $pdo->prepare(
            "INSERT INTO users (name, email, phone, password, role, status)
             VALUES (:name, :email, :phone, :password, 'executive', 'active')"
        );
        $statement->execute([
            'name' => $name,
            'email' => $email,
            'phone' => $phone,
            'password' => password_hash($password, PASSWORD_DEFAULT),
        ]);
        $id = (int) $pdo->lastInsertId();
        $activity = $pdo->prepare(
            "INSERT INTO activities (user_id, entity_type, entity_id, action, description)
             VALUES (:actor_id, 'user', :entity_id, 'created', :description)"
        );
        $activity->execute([
            'actor_id' => $actor['id'],
            'entity_id' => $id,
            'description' => 'Created Calling Executive ' . $name,
        ]);
        $pdo->commit();

        $created = $pdo->prepare(
            "SELECT id, name, email, phone, role, status, created_at, last_login_at
             FROM users WHERE id = :id LIMIT 1"
        );
        $created->execute(['id' => $id]);
        sendResponse(['success' => true, 'data' => userResponse($created->fetch())], 201);
    } catch (PDOException $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        if ($error->getCode() === '23000') {
            sendError('An account already uses this email or phone number.', 409);
        }
        error_log('User creation failed: ' . $error->getMessage());
        sendError('Unable to create this user.', 500);
    }
}

$id = filter_var($_GET['id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
if (!$id) {
    sendError('A valid user ID is required.', 400);
}

$existingQuery = $pdo->prepare("SELECT id, role FROM users WHERE id = :id LIMIT 1");
$existingQuery->execute(['id' => $id]);
$existing = $existingQuery->fetch();
if (!$existing || $existing['role'] !== 'executive') {
    sendError('Calling Executive account not found.', 404);
}

try {
    $pdo->beginTransaction();

    if ($method === 'PUT') {
        $status = ($body['active'] ?? true) ? 'active' : 'inactive';
        $parameters = ['id' => $id, 'name' => $name, 'email' => $email, 'phone' => $phone, 'status' => $status];
        $passwordSql = '';
        if ($password !== '') {
            if (!is_string($password) || strlen($password) < 12 || strlen($password) > 4096) {
                $pdo->rollBack();
                sendError('A reset password must be at least 12 characters.', 422);
            }
            $passwordSql = ', password = :password, auth_version = auth_version + 1';
            $parameters['password'] = password_hash($password, PASSWORD_DEFAULT);
        }

        $statement = $pdo->prepare(
            "UPDATE users SET name = :name, email = :email, phone = :phone, status = :status$passwordSql
             WHERE id = :id AND role = 'executive'"
        );
        $statement->execute($parameters);
        if ($password !== '') {
            $invalidateTokens = $pdo->prepare(
                'UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP
                 WHERE user_id = :id AND token_hash IS NOT NULL AND used_at IS NULL'
            );
            $invalidateTokens->execute(['id' => $id]);
        }
        $action = 'updated';
        $description = 'Updated Calling Executive ' . $name;
    } else {
        $statement = $pdo->prepare("UPDATE users SET status = 'inactive' WHERE id = :id AND role = 'executive'");
        $statement->execute(['id' => $id]);
        $action = 'deactivated';
        $description = 'Deactivated Calling Executive ' . $id;
    }

    $activity = $pdo->prepare(
        "INSERT INTO activities (user_id, entity_type, entity_id, action, description)
         VALUES (:actor_id, 'user', :entity_id, :action, :description)"
    );
    $activity->execute([
        'actor_id' => $actor['id'],
        'entity_id' => $id,
        'action' => $action,
        'description' => $description,
    ]);
    $pdo->commit();

    $updated = $pdo->prepare(
        "SELECT id, name, email, phone, role, status, created_at, last_login_at
         FROM users WHERE id = :id LIMIT 1"
    );
    $updated->execute(['id' => $id]);
    sendResponse(['success' => true, 'data' => userResponse($updated->fetch())]);
} catch (PDOException $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    if ($error->getCode() === '23000') {
        sendError('An account already uses this email or phone number.', 409);
    }
    error_log('User update failed: ' . $error->getMessage());
    sendError('Unable to update this user.', 500);
}
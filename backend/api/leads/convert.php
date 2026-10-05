<?php
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../helpers/crm_api.php';

$actor = requireRole($pdo, ['admin', 'executive']);
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST, OPTIONS');
    sendError('Only POST method is allowed.', 405);
}
requireCsrfToken();
$id = filter_var($_GET['id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
if (!$id) sendError('A valid lead ID is required.', 400);
$leadOwner = crmAssertOwned($pdo, 'leads', (int) $id, $actor);

try {
    $pdo->beginTransaction();
    $lock = $pdo->prepare('SELECT id, lead_code, name, phone, email, location, pickup_location, notes, assigned_to, status, converted_customer_id FROM leads WHERE id = :id FOR UPDATE');
    $lock->execute(['id' => $id]);
    $lead = $lock->fetch();
    if (!$lead) {
        $pdo->rollBack();
        sendError('Lead not found.', 404);
    }
    if ($lead['converted_customer_id'] || $lead['status'] === 'Converted') {
        $pdo->rollBack();
        sendError('This lead has already been converted.', 409);
    }
    if ($lead['status'] !== 'Booking Confirmed') {
        $pdo->rollBack();
        sendError('Only Booking Confirmed leads can be converted.', 409);
    }
    if ($actor['role'] !== 'admin' && (int) $lead['assigned_to'] !== (int) $actor['id']) {
        $pdo->rollBack();
        sendError('You do not have access to this lead.', 403);
    }
    if (empty($lead['assigned_to'])) {
        $pdo->rollBack();
        sendError('Assign this lead to an active Calling Executive before converting it.', 422);
    }
    crmAssertExecutive($pdo, (int) $lead['assigned_to']);
    $customer = $pdo->prepare(
        "INSERT INTO customers (name, phone, email, address, city, status, assigned_to, created_by, notes, tags)
         VALUES (:name, :phone, :email, :address, :city, 'Active', :assigned_to, :created_by, :notes, :tags)"
    );
    $customer->execute([
        'name' => $lead['name'], 'phone' => $lead['phone'], 'email' => $lead['email'],
        'address' => $lead['pickup_location'] ?: $lead['location'], 'city' => $lead['location'],
        'assigned_to' => $lead['assigned_to'], 'created_by' => $actor['id'],
        'notes' => 'Converted from lead ' . $lead['lead_code'] . '. ' . $lead['notes'], 'tags' => '["Converted"]',
    ]);
    $customerId = (int) $pdo->lastInsertId();
    $updateLead = $pdo->prepare("UPDATE leads SET status = 'Converted', converted_customer_id = :customer_id, converted_at = CURRENT_TIMESTAMP WHERE id = :id");
    $updateLead->execute(['customer_id' => $customerId, 'id' => $id]);
    crmWriteAudit($pdo, $actor, 'leads', (int) $id, 'converted');
    crmWriteAudit($pdo, $actor, 'customers', $customerId, 'created');
    crmCreateNotification($pdo, (int) $lead['assigned_to'], 'Lead converted', $lead['lead_code'] . ' was converted to a customer.');
    $pdo->commit();
    $leadData = crmList($pdo, 'leads', $actor, (int) $id);
    $customerData = crmList($pdo, 'customers', $actor, $customerId);
    sendResponse(['success' => true, 'data' => ['lead' => $leadData[0], 'customer' => $customerData[0]]], 201);
} catch (PDOException $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('Lead conversion failed: ' . $error->getMessage());
    sendError('Unable to convert this lead.', 500);
}

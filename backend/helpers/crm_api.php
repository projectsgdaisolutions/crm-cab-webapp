<?php

require_once __DIR__ . '/response.php';
require_once __DIR__ . '/../middleware/auth.php';

function crmJsonBody(): array
{
    $body = json_decode(file_get_contents('php://input'), true);
    if (!is_array($body)) {
        sendError('Request body must be a JSON object.', 400);
    }
    return $body;
}

function crmDate(mixed $value, string $field, bool $required = false): ?string
{
    if ($value === null || $value === '') {
        if ($required) sendError("$field is required.", 422);
        return null;
    }
    if (!is_string($value) || strtotime($value) === false) {
        sendError("$field must be a valid date.", 422);
    }
    return date('Y-m-d H:i:s', strtotime($value));
}

function crmId(mixed $value, string $field, bool $required = false): ?int
{
    if ($value === null || $value === '') {
        if ($required) sendError("$field is required.", 422);
        return null;
    }
    $id = filter_var($value, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    if (!$id) sendError("$field is invalid.", 422);
    return (int) $id;
}

function crmRequiredText(array $body, string $field, string $label, int $maxLength): string
{
    $value = trim((string) ($body[$field] ?? ''));
    if ($value === '' || mb_strlen($value) > $maxLength) {
        sendError("$label is required and must be at most $maxLength characters.", 422);
    }
    return $value;
}

function crmAssertOwned(PDO $pdo, string $table, int $id, array $actor): array
{
    $owners = [
        'customers' => ['assigned_to'],
        'leads' => ['assigned_to'],
        'follow_ups' => ['assigned_to'],
        'bookings' => ['assigned_to', 'created_by'],
        'calls' => ['executive_id'],
        'tasks' => ['assigned_to', 'created_by'],
    ];
    if (!isset($owners[$table])) sendError('Unsupported resource.', 404);
    $columns = implode(', ', array_map(static fn ($column) => "`$column`", $owners[$table]));
    $statement = $pdo->prepare("SELECT id, $columns FROM `$table` WHERE id = :id LIMIT 1");
    $statement->execute(['id' => $id]);
    $record = $statement->fetch();
    if (!$record) sendError('Record not found.', 404);
    if ($actor['role'] !== 'admin') {
        $owned = false;
        foreach ($owners[$table] as $column) {
            if ((int) ($record[$column] ?? 0) === (int) ($actor['user_id'] ?? $actor['id'] ?? 0)) $owned = true;
        }
        if (!$owned) sendError('You do not have access to this record.', 403);
    }
    return $record;
}

function crmAssertExecutive(PDO $pdo, int $id): void
{
    $statement = $pdo->prepare("SELECT id FROM users WHERE id = :id AND role = 'executive' AND status = 'active' LIMIT 1 FOR UPDATE");
    $statement->execute(['id' => $id]);
    if (!$statement->fetchColumn()) sendError('Assigned user must be an active Calling Executive.', 422);
}

function crmValidateRelation(PDO $pdo, string $entityType, ?int $entityId, array $actor): void
{
    if (!$entityId) return;
    if (!in_array($entityType, ['Customer', 'Lead'], true)) sendError('Related record type is invalid.', 422);
    crmAssertOwned($pdo, $entityType === 'Customer' ? 'customers' : 'leads', $entityId, $actor);
}

function crmSelectSql(string $resource): string
{
    return match ($resource) {
        'customers' => "SELECT c.id, c.name, c.phone, COALESCE(c.email, '') AS email,
            COALESCE(c.alternate_phone, '') AS alternateNumber,
            COALESCE(c.address, '') AS location, c.city,
            COALESCE(c.pickup_location, '') AS pickupLocation, COALESCE(c.drop_location, '') AS dropLocation,
            c.status,
            COALESCE(c.assigned_to, c.created_by) AS assignedExecutiveId,
            COALESCE(u.name, 'Unassigned') AS assignedExecutiveName,
            (SELECT COUNT(*) FROM bookings b WHERE b.customer_id = c.id) AS totalBookings,
            (SELECT COALESCE(SUM(b.fare), 0) FROM bookings b WHERE b.customer_id = c.id AND b.status = 'Completed') AS totalSpend,
            COALESCE((SELECT MAX(call_time) FROM calls x WHERE x.customer_id = c.id), c.created_at) AS lastContact,
            c.created_at AS joinedOn, c.updated_at AS updatedOn, COALESCE(c.notes, '') AS notes, c.tags
            FROM customers c LEFT JOIN users u ON u.id = COALESCE(c.assigned_to, c.created_by)",
        'leads' => "SELECT l.id, l.lead_code AS leadId, l.name, l.phone, COALESCE(l.email, '') AS email,
            l.source, l.interested_service AS interestedService,
            COALESCE(l.pickup_location, l.location, '') AS pickupLocation,
            COALESCE(l.drop_location, '') AS dropLocation, l.travel_at AS travelAt,
            COALESCE(NULLIF(l.status, ''), 'New') AS status, COALESCE(NULLIF(l.priority, ''), 'Medium') AS priority,
            l.assigned_to AS assignedExecutiveId, COALESCE(u.name, 'Unassigned') AS assignedExecutiveName,
            l.next_follow_up AS nextFollowUp, l.created_at AS createdOn, l.updated_at AS updatedOn,
            l.converted_customer_id AS convertedCustomerId, l.converted_at AS convertedAt,
            l.estimated_value AS estimatedValue, COALESCE(l.notes, '') AS remarks,
            COALESCE(l.location, '') AS location
            FROM leads l LEFT JOIN users u ON u.id = l.assigned_to",
        'followups' => "SELECT f.id,
            COALESCE(c.name, l.name, '') AS customerOrLeadName,
            COALESCE(f.customer_id, f.lead_id, 0) AS customerOrLeadId,
            CASE WHEN f.customer_id IS NOT NULL THEN 'Customer' ELSE 'Lead' END AS type,
            f.assigned_to AS assignedExecutiveId, COALESCE(u.name, 'Unassigned') AS assignedExecutiveName,
            f.scheduled_at AS scheduledAt, f.status, f.priority, COALESCE(f.notes, '') AS notes,
            f.completed_at AS completedAt,
            f.reminder_sent AS reminderSent, f.channel
            FROM follow_ups f LEFT JOIN customers c ON c.id = f.customer_id
            LEFT JOIN leads l ON l.id = f.lead_id LEFT JOIN users u ON u.id = f.assigned_to",
        'bookings' => "SELECT b.id, COALESCE(b.booking_code, CONCAT('BK-', b.id)) AS bookingId,
            b.customer_id AS customerId, b.lead_id AS leadId,
            CASE WHEN b.customer_id IS NOT NULL THEN 'Customer' ELSE 'Lead' END AS customerOrLeadType,
            COALESCE(b.customer_id, b.lead_id) AS customerOrLeadId,
            COALESCE(c.name, l.name, '') AS customerName,
            COALESCE(NULLIF(b.mobile_number, ''), c.phone, l.phone, '') AS mobileNumber,
            b.pickup_location AS pickupLocation, b.drop_location AS dropLocation, b.booking_date AS travelDate,
            b.vehicle_type AS vehicleType, b.passenger_count AS passengerCount,
            CASE LOWER(b.status)
                WHEN 'pending' THEN 'Enquiry' WHEN 'enquiry' THEN 'Enquiry'
                WHEN 'confirmed' THEN 'Confirmed' WHEN 'assigned' THEN 'Assigned'
                WHEN 'in progress' THEN 'Assigned' WHEN 'completed' THEN 'Completed'
                WHEN 'cancelled' THEN 'Cancelled' ELSE b.status END AS bookingStatus,
            b.payment_status AS paymentStatus, b.fare AS amount,
            COALESCE(b.driver_vehicle_details, '') AS driverVehicleDetails,
            COALESCE(b.notes, '') AS remarks, COALESCE(creator.name, '') AS createdBy, b.created_at AS createdAt
            FROM bookings b LEFT JOIN customers c ON c.id = b.customer_id
            LEFT JOIN leads l ON l.id = b.lead_id
            LEFT JOIN users creator ON creator.id = b.created_by",
        'calls' => "SELECT x.id, CONCAT('CL-', x.id) AS callId,
            COALESCE(c.name, l.name, '') AS customerOrLeadName,
            COALESCE(x.customer_id, x.lead_id, 0) AS customerOrLeadId,
            CASE WHEN x.customer_id IS NOT NULL THEN 'Customer' ELSE 'Lead' END AS type,
            x.phone_number AS phoneNumber, x.executive_id AS executiveId, COALESCE(u.name, '') AS executiveName,
            CASE WHEN LOWER(x.call_type) IN ('incoming', 'inbound') THEN 'Incoming' ELSE 'Outgoing' END AS direction,
            x.call_time AS timestamp, x.duration_seconds AS durationSec,
            x.call_status AS status, (SELECT COUNT(*) > 0 FROM recordings r WHERE r.call_id = x.id) AS hasRecording,
            (SELECT CONCAT('rec-', r.id) FROM recordings r WHERE r.call_id = x.id ORDER BY r.id DESC LIMIT 1) AS recordingId,
            x.follow_up_id AS followUpId, COALESCE(x.notes, '') AS notes
            FROM calls x LEFT JOIN customers c ON c.id = x.customer_id LEFT JOIN leads l ON l.id = x.lead_id
            LEFT JOIN users u ON u.id = x.executive_id",
        'recordings' => "SELECT r.id, CONCAT('REC-', r.id) AS recordingId,
            x.id AS callId,
            COALESCE(c.name, l.name, '') AS customerOrLeadName, x.phone_number AS phoneNumber,
            COALESCE(u.name, '') AS executiveName, x.call_time AS callDate, r.duration_seconds AS durationSec,
            CASE WHEN r.file_path IS NULL OR r.file_path = '' THEN 'Unavailable' ELSE r.status END AS status,
            CASE WHEN r.file_path IS NULL OR r.file_path = '' THEN NULL ELSE CONCAT('/api/recordings/media.php?id=', r.id) END AS fileRef,
            NULL AS fileSizeKb,
            r.transcript, r.access_level AS accessLevel
            FROM recordings r JOIN calls x ON x.id = r.call_id
            LEFT JOIN customers c ON c.id = x.customer_id LEFT JOIN leads l ON l.id = x.lead_id
            LEFT JOIN users u ON u.id = x.executive_id",
        'tasks' => "SELECT t.id, t.title, COALESCE(t.description, '') AS description, t.status, t.priority,
            t.start_date AS startDate, t.due_date AS dueDate, t.assigned_to AS assignedToId, COALESCE(u.name, '') AS assignedToName,
            t.related_type AS relatedToType, t.related_id AS relatedToId,
            CASE WHEN t.related_type = 'Customer' THEN (SELECT name FROM customers WHERE id = t.related_id)
                 WHEN t.related_type = 'Lead' THEN (SELECT name FROM leads WHERE id = t.related_id)
                 WHEN t.related_type = 'Booking' THEN (SELECT booking_code FROM bookings WHERE id = t.related_id)
                 ELSE NULL END AS relatedToName,
            t.created_at AS createdOn, t.completed_at AS completedOn
            FROM tasks t LEFT JOIN users u ON u.id = t.assigned_to",
        'activities' => "SELECT a.id,
            a.user_id AS actorId,
            CASE a.entity_type WHEN 'calls' THEN 'call' WHEN 'followups' THEN 'follow-up' WHEN 'bookings' THEN 'booking' WHEN 'leads' THEN 'lead' WHEN 'tasks' THEN 'task' WHEN 'recordings' THEN 'recording' WHEN 'user' THEN 'assignment' ELSE 'note' END AS type,
            COALESCE(a.description, '') AS title,
            COALESCE(a.description, '') AS description, COALESCE(u.name, '') AS actor,
            CASE u.role WHEN 'admin' THEN 'Admin' ELSE 'Calling Executive' END AS actorRole,
            a.created_at AS timestamp, a.entity_id AS relatedId,
            CASE a.entity_type WHEN 'customers' THEN 'Customer' WHEN 'leads' THEN 'Lead' WHEN 'bookings' THEN 'Booking' WHEN 'calls' THEN 'Call' WHEN 'followups' THEN 'Follow-up' WHEN 'tasks' THEN 'Task' WHEN 'user' THEN 'User' ELSE NULL END AS relatedType
            FROM activities a LEFT JOIN users u ON u.id = a.user_id",
        default => '',
    };
}

function crmList(PDO $pdo, string $resource, array $actor, ?int $id = null, ?int $executiveId = null, ?int $activityUserId = null): array
{
    if (in_array($resource, ['tasks', 'followups'], true)) {
        crmGenerateReminderNotifications($pdo, $actor);
    }

    $sql = crmSelectSql($resource);
    if ($sql === '') sendError('Resource not found.', 404);
    $where = [];
    $parameters = [];
    if ($id !== null) {
        $where[] = match ($resource) {
            'customers' => 'c.id = :id', 'leads' => 'l.id = :id', 'followups' => 'f.id = :id',
            'bookings' => 'b.id = :id', 'calls' => 'x.id = :id', 'recordings' => 'r.id = :id',
            'tasks' => 't.id = :id', 'activities' => 'a.id = :id',
        };
        $parameters['id'] = $id;
    }
    if ($executiveId !== null) {
        $where[] = 'x.executive_id = :filter_executive_id';
        $parameters['filter_executive_id'] = $executiveId;
    }
    if ($activityUserId !== null) {
        $where[] = '(a.user_id = :filter_activity_actor OR (a.entity_type = \'user\' AND a.entity_id = :filter_activity_target))';
        $parameters['filter_activity_actor'] = $activityUserId;
        $parameters['filter_activity_target'] = $activityUserId;
    }
    if ($resource === 'activities' && $actor['role'] !== 'admin') {
        $where[] = "((a.entity_type = 'customers' AND EXISTS (SELECT 1 FROM customers c WHERE c.id = a.entity_id AND COALESCE(c.assigned_to, c.created_by) = :customer_owner))
            OR (a.entity_type = 'leads' AND EXISTS (SELECT 1 FROM leads l WHERE l.id = a.entity_id AND l.assigned_to = :lead_owner))
            OR (a.entity_type = 'followups' AND EXISTS (SELECT 1 FROM follow_ups f WHERE f.id = a.entity_id AND f.assigned_to = :followup_owner))
            OR (a.entity_type = 'bookings' AND EXISTS (SELECT 1 FROM bookings b LEFT JOIN customers bc ON bc.id = b.customer_id WHERE b.id = a.entity_id AND COALESCE(b.assigned_to, bc.assigned_to, b.created_by) = :booking_owner))
            OR (a.entity_type = 'calls' AND EXISTS (SELECT 1 FROM calls x WHERE x.id = a.entity_id AND x.executive_id = :call_owner))
            OR (a.entity_type = 'tasks' AND EXISTS (SELECT 1 FROM tasks t WHERE t.id = a.entity_id AND t.assigned_to = :task_owner))
            OR a.user_id = :actor_owner)";
        foreach (['customer_owner', 'lead_owner', 'followup_owner', 'booking_owner', 'call_owner', 'task_owner', 'actor_owner'] as $ownerKey) {
            $parameters[$ownerKey] = $actor['user_id'] ?? $actor['id'] ?? 0;
        }
    } elseif ($actor['role'] !== 'admin') {
        $owner = match ($resource) {
            'customers' => 'COALESCE(c.assigned_to, c.created_by)',
            'leads' => 'l.assigned_to', 'followups' => 'f.assigned_to',
            'bookings' => 'COALESCE(b.assigned_to, c.assigned_to, b.created_by)',
            'calls' => 'x.executive_id', 'recordings' => 'x.executive_id', 'tasks' => 't.assigned_to',
            default => null,
        };
        if ($owner) {
            $where[] = "$owner = :actor_id";
            $parameters['actor_id'] = $actor['user_id'] ?? $actor['id'] ?? 0;
        }
    }
    if ($resource === 'recordings') {
        $where[] = "r.access_level IN ('Admin', 'Public')";
    }
    // Optional server-side pagination/search/filter/date range. Existing clients may omit these.
    $page = max(1, (int)($_GET['page'] ?? 1));
    $limit = isset($_GET['limit']) && $_GET['limit'] !== ''
        ? min(200, max(1, (int)$_GET['limit']))
        : 0;
    $search = trim((string)($_GET['search'] ?? $_GET['q'] ?? ''));
    $status = trim((string)($_GET['status'] ?? ''));
    $dateFrom = $_GET['dateFrom'] ?? null;
    $dateTo = $_GET['dateTo'] ?? null;
    $searchColumns = match ($resource) {
        'customers' => ['c.name','c.phone','c.email','c.city'],
        'leads' => ['l.name','l.phone','l.email','l.lead_code','l.source'],
        'followups' => ['c.name','l.name','f.notes','f.channel'],
        'bookings' => ['b.booking_code','c.name','l.name','b.mobile_number','b.vehicle_type'],
        'calls' => ['x.phone_number','c.name','l.name','u.name','x.notes'],
        'recordings' => ['x.phone_number','c.name','l.name','u.name'],
        'tasks' => ['t.title','t.description','u.name'],
        'activities' => ['a.description','a.action','a.entity_type'],
        default => [],
    };
    if ($search !== '' && $searchColumns) {
        $parts=[]; foreach ($searchColumns as $i=>$column) { $key='search_'.$i; $parts[]="$column LIKE :$key"; $parameters[$key]='%'.$search.'%'; }
        $where[]='('.implode(' OR ',$parts).')';
    }
    if ($status !== '') {
        $statusColumn = match ($resource) { 'customers'=>'c.status','leads'=>'l.status','followups'=>'f.status','bookings'=>'b.status','calls'=>'x.call_status','tasks'=>'t.status', default=>null };
        if ($statusColumn) { $where[]="$statusColumn = :filter_status"; $parameters['filter_status']=$status; }
    }
    if ($dateFrom !== null && $dateFrom !== '') {
        $dateColumn = match ($resource) { 'customers'=>'c.created_at','leads'=>'l.created_at','followups'=>'f.scheduled_at','bookings'=>'b.booking_date','calls'=>'x.call_time','recordings'=>'r.uploaded_at','tasks'=>'t.due_date','activities'=>'a.created_at', default=>null };
        if ($dateColumn && strtotime((string)$dateFrom)!==false) { $where[]="$dateColumn >= :date_from"; $parameters['date_from']=date('Y-m-d H:i:s',strtotime((string)$dateFrom)); }
    }
    if ($dateTo !== null && $dateTo !== '') {
        $dateColumn = match ($resource) { 'customers'=>'c.created_at','leads'=>'l.created_at','followups'=>'f.scheduled_at','bookings'=>'b.booking_date','calls'=>'x.call_time','recordings'=>'r.uploaded_at','tasks'=>'t.due_date','activities'=>'a.created_at', default=>null };
        if ($dateColumn && strtotime((string)$dateTo)!==false) { $where[]="$dateColumn <= :date_to"; $parameters['date_to']=date('Y-m-d H:i:s',strtotime((string)$dateTo)); }
    }
    if ($where) $sql .= ' WHERE ' . implode(' AND ', $where);
    $sql .= match ($resource) {
        'customers' => ' ORDER BY c.created_at DESC, c.id DESC',
        'leads' => ' ORDER BY l.created_at DESC, l.id DESC',
        'followups' => ' ORDER BY f.scheduled_at ASC, f.id DESC',
        'bookings' => ' ORDER BY b.booking_date DESC, b.id DESC',
        'calls' => ' ORDER BY x.call_time DESC, x.id DESC',
        'recordings' => ' ORDER BY r.uploaded_at DESC, r.id DESC',
        'tasks' => ' ORDER BY t.due_date ASC, t.id DESC',
        'activities' => ' ORDER BY a.created_at DESC, a.id DESC',
    };
    if ($limit > 0) {
        $countSql = 'SELECT COUNT(*) FROM (' . $sql . ') AS counted_rows';
        $countStmt = $pdo->prepare($countSql); $countStmt->execute($parameters); $total=(int)$countStmt->fetchColumn();
        $sql .= ' LIMIT ' . (($page-1)*$limit) . ', ' . $limit;
        header('X-Total-Count: '.$total); header('X-Page: '.$page); header('X-Page-Size: '.$limit); header('X-Total-Pages: '.($limit ? (int)ceil($total/$limit) : 1));
    }
    $statement = $pdo->prepare($sql);
    $statement->execute($parameters);
    $rows = $statement->fetchAll();
    foreach ($rows as &$row) {
        $row['id'] = (string) $row['id'];
        foreach (['leadId', 'convertedCustomerId', 'assignedExecutiveId', 'customerId', 'customerOrLeadId', 'executiveId', 'assignedToId', 'relatedId', 'relatedToId', 'followUpId', 'actorId', 'callId'] as $key) {
            if (isset($row[$key])) $row[$key] = (string) $row[$key];
        }
        foreach (['totalBookings', 'callCount', 'leadCount', 'durationSec', 'passengerCount'] as $key) {
            if (isset($row[$key])) $row[$key] = (int) $row[$key];
        }
        foreach (['amount', 'distance', 'estimatedValue', 'totalSpend'] as $key) {
            if (isset($row[$key])) $row[$key] = (float) $row[$key];
        }
        if (isset($row['reminderSent'])) $row['reminderSent'] = (bool) $row['reminderSent'];
        if (isset($row['hasRecording'])) $row['hasRecording'] = (bool) $row['hasRecording'];
        if (isset($row['tags'])) {
            $row['tags'] = json_decode((string) $row['tags'], true) ?: [];
        }
    }
    return $rows;
}

function crmWriteFields(string $resource, array $body, array $actor, PDO $pdo): array
{
    $fields = [];
    $userId = (int) ($actor['user_id'] ?? $actor['id'] ?? 0);

    if ($userId <= 0) {
        sendError('Invalid authenticated user ID.', 401);
    }
    $role = $actor['role'];
    switch ($resource) {
        case 'customers':
            $alternatePhone = trim((string) ($body['alternateNumber'] ?? ''));
            if ($alternatePhone !== '' && (!preg_match('/^[+0-9() .-]{7,20}$/', $alternatePhone)
                || strlen(preg_replace('/\D+/', '', $alternatePhone)) < 7
                || strlen(preg_replace('/\D+/', '', $alternatePhone)) > 15)) {
                sendError('Enter a valid alternate phone number.', 422);
            }
            $fields = [
                'name' => crmRequiredText($body, 'name', 'Name', 150),
                'phone' => crmRequiredText($body, 'phone', 'Phone', 20),
                'alternate_phone' => $alternatePhone,
                'email' => trim((string) ($body['email'] ?? '')),
                'address' => trim((string) ($body['location'] ?? '')),
                'city' => trim((string) ($body['city'] ?? '')),
                'pickup_location' => trim((string) ($body['pickupLocation'] ?? '')),
                'drop_location' => trim((string) ($body['dropLocation'] ?? '')),
                'status' => (string) ($body['status'] ?? 'Active'),
                'notes' => trim((string) ($body['notes'] ?? '')),
                'tags' => json_encode(is_array($body['tags'] ?? null) ? $body['tags'] : [], JSON_THROW_ON_ERROR),
                'assigned_to' => $role === 'admin' ? crmId($body['assignedExecutiveId'] ?? $userId, 'Assigned executive', true) : $userId,
            ];
            crmAssertExecutive($pdo, (int) $fields['assigned_to']);
            foreach (['address', 'city', 'pickup_location', 'drop_location'] as $field) {
                if (mb_strlen($fields[$field]) > 500) sendError('Customer address and locations must be at most 500 characters.', 422);
            }
            if (mb_strlen($fields['notes']) > 5000) sendError('Notes must be at most 5000 characters.', 422);
            if (!in_array($fields['status'], ['Active', 'Inactive', 'VIP', 'Lead', 'Churned'], true)) sendError('Customer status is invalid.', 422);
            if ($fields['email'] !== '' && !filter_var($fields['email'], FILTER_VALIDATE_EMAIL)) sendError('Email is invalid.', 422);
            break;
        case 'leads':
            $phone = crmRequiredText($body, 'phone', 'Mobile', 20);
            $phoneDigits = preg_replace('/\D+/', '', $phone);
            if (!preg_match('/^[+0-9() .-]+$/', $phone) || strlen($phoneDigits) < 7 || strlen($phoneDigits) > 15) {
                sendError('Enter a valid mobile number.', 422);
            }
            $fields = [
                'name' => crmRequiredText($body, 'name', 'Customer name', 150),
                'phone' => $phone,
                'email' => trim((string) ($body['email'] ?? '')),
                'source' => trim((string) ($body['source'] ?? 'Website')),
                'status' => (string) ($body['status'] ?? 'New'),
                'priority' => (string) ($body['priority'] ?? 'Medium'),
                'assigned_to' => $role === 'admin' ? crmId($body['assignedExecutiveId'] ?? $userId, 'Assigned executive', true) : $userId,
                'interested_service' => crmRequiredText($body, 'interestedService', 'Cab requirement', 100),
                'pickup_location' => crmRequiredText($body, 'pickupLocation', 'Pickup location', 500),
                'drop_location' => crmRequiredText($body, 'dropLocation', 'Drop location', 500),
                'travel_at' => crmDate($body['travelAt'] ?? null, 'Travel date and time', true),
                'estimated_value' => max(0, (float) ($body['estimatedValue'] ?? 0)),
                'location' => trim((string) ($body['location'] ?? $body['pickupLocation'] ?? '')),
                'next_follow_up' => crmDate($body['nextFollowUp'] ?? null, 'Next follow-up'),
                'notes' => trim((string) ($body['remarks'] ?? '')),
            ];
            if ($role === 'admin') crmAssertExecutive($pdo, (int) $fields['assigned_to']);
            if (!in_array($fields['source'], ['Website', 'Facebook', 'Instagram', 'Google Ads', 'Referral', 'Walk-in', 'Inbound Call', 'Outbound Call'], true)) sendError('Lead source is invalid.', 422);
            if (!in_array($fields['status'], ['New', 'Contacted', 'Follow-up', 'Interested', 'Booking Confirmed', 'Converted', 'Lost'], true)) sendError('Lead status is invalid.', 422);
            if (!in_array($fields['priority'], ['Low', 'Medium', 'High', 'Urgent', 'Hot'], true)) sendError('Lead priority is invalid.', 422);
            if ($fields['email'] !== '' && !filter_var($fields['email'], FILTER_VALIDATE_EMAIL)) sendError('Email is invalid.', 422);
            if (mb_strlen($fields['notes']) > 5000) sendError('Notes must be at most 5000 characters.', 422);
            if ($fields['status'] === 'Follow-up' && $fields['next_follow_up'] === null) sendError('Set a follow-up date and time before entering the Follow-up stage.', 422);
            break;
        case 'followups':
            $type = (string) ($body['type'] ?? 'Lead');
            $relatedId = crmId($body['customerOrLeadId'] ?? null, 'Customer or lead');
            if (!$relatedId) sendError('Select an existing customer or lead.', 422);
            crmValidateRelation($pdo, $type, $relatedId, $actor);
            $fields = [
                'lead_id' => $type === 'Lead' ? $relatedId : null,
                'customer_id' => $type === 'Customer' ? $relatedId : null,
                'assigned_to' => $role === 'admin' ? crmId($body['assignedExecutiveId'] ?? $userId, 'Assigned executive', true) : $userId,
                'scheduled_at' => crmDate($body['scheduledAt'] ?? null, 'Scheduled time', true),
                'status' => (string) ($body['status'] ?? 'Pending'),
                'priority' => (string) ($body['priority'] ?? 'Medium'),
                'channel' => (string) ($body['channel'] ?? 'Phone'),
                'notes' => trim((string) ($body['notes'] ?? '')),
                'completed_at' => ($body['status'] ?? 'Pending') === 'Completed' ? date('Y-m-d H:i:s') : null,
            ];
            crmAssertExecutive($pdo, (int) $fields['assigned_to']);
            if (!in_array($fields['status'], ['Pending', 'Completed', 'Rescheduled', 'Cancelled'], true)) sendError('Follow-up status is invalid.', 422);
            if (!in_array($fields['priority'], ['Low', 'Medium', 'High', 'Urgent'], true)) sendError('Follow-up priority is invalid.', 422);
            if (!in_array($fields['channel'], ['Phone', 'WhatsApp', 'Email', 'Visit'], true)) sendError('Follow-up channel is invalid.', 422);
            break;
        case 'bookings':
            $relatedType = (string) ($body['customerOrLeadType'] ?? '');
            $relatedId = crmId($body['customerOrLeadId'] ?? null, 'Customer or lead', true);
            crmValidateRelation($pdo, $relatedType, $relatedId, $actor);
            $mobileNumber = crmRequiredText($body, 'mobileNumber', 'Mobile number', 20);
            $mobileDigits = preg_replace('/\D+/', '', $mobileNumber);
            if (!preg_match('/^[+0-9() .-]+$/', $mobileNumber) || strlen($mobileDigits) < 7 || strlen($mobileDigits) > 15) {
                sendError('Enter a valid mobile number.', 422);
            }
            $passengerCount = filter_var($body['passengerCount'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
            if ($passengerCount === false) sendError('Passenger count must be at least 1.', 422);
            $fields = [
                'customer_id' => $relatedType === 'Customer' ? $relatedId : null,
                'lead_id' => $relatedType === 'Lead' ? $relatedId : null,
                'mobile_number' => $mobileNumber,
                'booking_date' => crmDate($body['travelDate'] ?? null, 'Travel date', true),
                'pickup_location' => crmRequiredText($body, 'pickupLocation', 'Pickup location', 500),
                'drop_location' => crmRequiredText($body, 'dropLocation', 'Drop location', 500),
                'vehicle_type' => crmRequiredText($body, 'vehicleType', 'Vehicle type', 100),
                'passenger_count' => $passengerCount,
                'driver_vehicle_details' => trim((string) ($body['driverVehicleDetails'] ?? '')),
                'status' => (string) ($body['bookingStatus'] ?? 'Enquiry'),
                'payment_status' => (string) ($body['paymentStatus'] ?? 'Unpaid'),
                'fare' => max(0, (float) ($body['amount'] ?? 0)),
                'notes' => trim((string) ($body['remarks'] ?? '')),
            ];
            $fields['assigned_to'] = $userId;
            if (!in_array($fields['status'], ['Enquiry', 'Confirmed', 'Assigned', 'Completed', 'Cancelled'], true)) sendError('Booking status is invalid.', 422);
            if (!in_array($fields['payment_status'], ['Unpaid', 'Partial', 'Paid', 'Refunded'], true)) sendError('Payment status is invalid.', 422);
            if (in_array($fields['status'], ['Assigned', 'Completed'], true) && $fields['driver_vehicle_details'] === '') {
                sendError('Driver / vehicle details are required once a booking is assigned.', 422);
            }
            break;
        case 'tasks':
            $assignedTo = $role === 'admin' ? crmId($body['assignedToId'] ?? $userId, 'Assigned user', true) : $userId;
            crmAssertExecutive($pdo, (int) $assignedTo);
            $relatedType = $body['relatedToType'] ?? null;
            $relatedId = crmId($body['relatedToId'] ?? null, 'Related record');
            if ($relatedId && !in_array($relatedType, ['Customer', 'Lead', 'Booking'], true)) sendError('Related record type is invalid.', 422);
            if ($relatedId && in_array($relatedType, ['Customer', 'Lead'], true)) crmValidateRelation($pdo, $relatedType, $relatedId, $actor);
            if ($relatedId && $relatedType === 'Booking') crmAssertOwned($pdo, 'bookings', $relatedId, $actor);
            $status = (string) ($body['status'] ?? 'Pending');
            $fields = [
                'title' => crmRequiredText($body, 'title', 'Title', 200),
                'description' => trim((string) ($body['description'] ?? '')),
                'assigned_to' => $assignedTo,
                'start_date' => crmDate($body['startDate'] ?? null, 'Start date'),
                'due_date' => crmDate($body['dueDate'] ?? null, 'Due date'),
                'priority' => (string) ($body['priority'] ?? 'Medium'),
                'status' => $status,
                'related_type' => $relatedType,
                'related_id' => $relatedId,
                'completed_at' => $status === 'Completed' ? date('Y-m-d H:i:s') : null,
            ];
            if (!in_array($fields['status'], ['Pending', 'In Progress', 'Completed'], true)) sendError('Task status is invalid.', 422);
            if (!in_array($fields['priority'], ['Low', 'Medium', 'High', 'Urgent'], true)) sendError('Task priority is invalid.', 422);
            break;
        case 'calls':
            $type = (string) ($body['type'] ?? 'Lead');
            $relatedId = crmId($body['customerOrLeadId'] ?? null, 'Customer or lead');
            if (!$relatedId) sendError('Select an existing customer or lead.', 422);
            crmValidateRelation($pdo, $type, $relatedId, $actor);
            $phoneStatement = $pdo->prepare($type === 'Customer' ? 'SELECT phone FROM customers WHERE id = :id' : 'SELECT phone FROM leads WHERE id = :id');
            $phoneStatement->execute(['id' => $relatedId]);
            $fields = [
                'customer_id' => $type === 'Customer' ? $relatedId : null,
                'lead_id' => $type === 'Lead' ? $relatedId : null,
                'executive_id' => $userId,
                'phone_number' => trim((string) ($body['phoneNumber'] ?? $phoneStatement->fetchColumn())),
                'call_type' => ($body['direction'] ?? 'Outgoing') === 'Incoming' ? 'Incoming' : 'Outgoing',
                'call_status' => (string) ($body['status'] ?? 'Answered'),
                'duration_seconds' => max(0, (int) ($body['durationSec'] ?? 0)),
                'call_time' => crmDate($body['timestamp'] ?? null, 'Call time', true),
                'notes' => trim((string) ($body['notes'] ?? '')),
                'follow_up_id' => crmId($body['followUpId'] ?? null, 'Follow-up'),
            ];
            if (!in_array($fields['call_status'], ['Answered', 'Missed', 'Busy', 'Rejected', 'Failed'], true)) sendError('Call status is invalid.', 422);
            break;
    }
    return $fields;
}

function crmTable(string $resource): string
{
    return match ($resource) {
        'customers' => 'customers', 'leads' => 'leads', 'followups' => 'follow_ups',
        'bookings' => 'bookings', 'calls' => 'calls', 'tasks' => 'tasks',
        default => '',
    };
}

function crmWriteAudit(PDO $pdo, array $actor, string $resource, int $id, string $action): void
{
    $statement = $pdo->prepare(
        'INSERT INTO activities (user_id, entity_type, entity_id, action, description)
         VALUES (:user_id, :entity_type, :entity_id, :action, :description)'
    );
    $statement->execute([
        'user_id' => $actor['user_id'] ?? $actor['id'] ?? 0,
        'entity_type' => $resource,
        'entity_id' => $id,
        'action' => $action,
        'description' => ucfirst($action) . ' ' . $resource . ' #' . $id,
    ]);
}

function crmAssertLeadTransition(string $currentStatus, string $nextStatus): void
{
    if ($currentStatus === $nextStatus) return;
    $allowed = [
        'New' => ['Contacted'],
        'Contacted' => ['Follow-up'],
        'Follow-up' => ['Interested'],
        'Interested' => ['Booking Confirmed'],
        'Booking Confirmed' => ['Lost'],
        'Converted' => [],
        'Lost' => [],
    ];
    if (!in_array($nextStatus, $allowed[$currentStatus] ?? [], true)) {
        sendError("Lead cannot move from $currentStatus to $nextStatus.", 409);
    }
}

function crmBookingStatus(string $status): string
{
    return match (strtolower($status)) {
        'pending', 'enquiry' => 'Enquiry',
        'confirmed' => 'Confirmed',
        'assigned', 'in progress' => 'Assigned',
        'completed' => 'Completed',
        'cancelled' => 'Cancelled',
        default => $status,
    };
}

function crmAssertBookingTransition(string $currentStatus, string $nextStatus): void
{
    $currentStatus = crmBookingStatus($currentStatus);
    $nextStatus = crmBookingStatus($nextStatus);
    if ($currentStatus === $nextStatus) return;
    $allowed = [
        'Enquiry' => ['Confirmed'],
        'Confirmed' => ['Assigned'],
        'Assigned' => ['Completed', 'Cancelled'],
        'Completed' => [],
        'Cancelled' => [],
    ];
    if (!in_array($nextStatus, $allowed[$currentStatus] ?? [], true)) {
        sendError("Booking cannot move from $currentStatus to $nextStatus.", 409);
    }
}

function crmCreateNotification(PDO $pdo, int $userId, string $title, string $message): void
{
    $statement = $pdo->prepare('INSERT INTO notifications (user_id, type, title, message, related_type, related_id, is_read) VALUES (:user_id, :type, :title, :message, :related_type, :related_id, 0)');
    $statement->execute([
        'user_id' => $userId,
        'type' => 'general',
        'title' => $title,
        'message' => $message,
        'related_type' => null,
        'related_id' => null,
    ]);
}

function crmCreateTypedNotification(PDO $pdo, int $userId, string $title, string $message, string $type = 'general', ?string $relatedType = null, ?int $relatedId = null): void
{
    if ($relatedType !== null && $relatedId !== null) {
        $duplicate = $pdo->prepare('SELECT id FROM notifications WHERE user_id = :user_id AND type = :type AND related_type = :related_type AND related_id = :related_id AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) LIMIT 1');
        $duplicate->execute([
            'user_id' => $userId,
            'type' => $type,
            'related_type' => $relatedType,
            'related_id' => $relatedId,
        ]);
        if ($duplicate->fetchColumn()) {
            return;
        }
    }

    $statement = $pdo->prepare('INSERT INTO notifications (user_id, type, title, message, related_type, related_id, is_read) VALUES (:user_id, :type, :title, :message, :related_type, :related_id, 0)');
    $statement->execute([
        'user_id' => $userId,
        'type' => $type,
        'title' => $title,
        'message' => $message,
        'related_type' => $relatedType,
        'related_id' => $relatedId,
    ]);
}

function crmGenerateReminderNotifications(PDO $pdo, array $actor): void
{
    if (!in_array($actor['role'], ['admin', 'executive'], true)) {
        return;
    }

    $taskQuery = $pdo->prepare("SELECT id, title, assigned_to, due_date FROM tasks WHERE assigned_to = :user_id AND status IN ('Pending', 'In Progress') AND (due_date IS NULL OR due_date <= DATE_ADD(NOW(), INTERVAL 1 DAY)) ORDER BY due_date ASC");
    $taskQuery->execute(['user_id' => $actor['user_id'] ?? $actor['id'] ?? 0]);
    while ($task = $taskQuery->fetch()) {
        $taskTitle = $task['due_date'] !== null && strtotime((string) $task['due_date']) < time()
            ? 'Task overdue'
            : 'Task due soon';
        crmCreateTypedNotification($pdo, (int) $task['assigned_to'], $taskTitle, $task['title'] . ' is due ' . (string) $task['due_date'] . '.', 'task', 'task', (int) $task['id']);
    }

    $followupQuery = $pdo->prepare("SELECT id, assigned_to, scheduled_at, notes FROM follow_ups WHERE assigned_to = :user_id AND status = 'Pending' AND scheduled_at <= DATE_ADD(NOW(), INTERVAL 1 DAY) ORDER BY scheduled_at ASC");
    $followupQuery->execute(['user_id' => $actor['user_id'] ?? $actor['id'] ?? 0]);
    while ($followup = $followupQuery->fetch()) {
        $label = strtotime((string) $followup['scheduled_at']) < time() ? 'Follow-up overdue' : 'Follow-up due soon';
        crmCreateTypedNotification($pdo, (int) $followup['assigned_to'], $label, ($followup['notes'] !== '' ? $followup['notes'] : 'Follow-up') . ' is scheduled for ' . (string) $followup['scheduled_at'] . '.', 'follow-up', 'follow-up', (int) $followup['id']);
    }
}

function crmSyncLeadFollowup(PDO $pdo, int $leadId, array $leadFields, string $leadCode, bool $notify = true): void
{
    $scheduledAt = $leadFields['next_follow_up'] ?? null;
    $pendingQuery = $pdo->prepare("SELECT id FROM follow_ups WHERE lead_id = :lead_id AND status = 'Pending' ORDER BY id DESC LIMIT 1 FOR UPDATE");
    $pendingQuery->execute(['lead_id' => $leadId]);
    $pendingId = $pendingQuery->fetchColumn();

    if ($scheduledAt === null) {
        if ($pendingId) {
            $cancel = $pdo->prepare("UPDATE follow_ups SET status = 'Cancelled' WHERE id = :id");
            $cancel->execute(['id' => $pendingId]);
        }
        return;
    }

    $notes = 'Scheduled from Lead ' . $leadCode;
    if ($pendingId) {
        $update = $pdo->prepare("UPDATE follow_ups SET assigned_to = :assigned_to, scheduled_at = :scheduled_at, notes = :notes WHERE id = :id");
        $update->execute(['assigned_to' => $leadFields['assigned_to'], 'scheduled_at' => $scheduledAt, 'notes' => $notes, 'id' => $pendingId]);
    } else {
        $insert = $pdo->prepare("INSERT INTO follow_ups (lead_id, assigned_to, scheduled_at, status, priority, channel, notes) VALUES (:lead_id, :assigned_to, :scheduled_at, 'Pending', 'Medium', 'Phone', :notes)");
        $insert->execute(['lead_id' => $leadId, 'assigned_to' => $leadFields['assigned_to'], 'scheduled_at' => $scheduledAt, 'notes' => $notes]);
    }
    if ($notify) {
        crmCreateTypedNotification($pdo, (int) $leadFields['assigned_to'], 'Lead follow-up scheduled', $leadCode . ' follow-up is scheduled for ' . $scheduledAt . '.', 'follow-up', 'lead', $leadId);
    }
}

function handleCrmResource(PDO $pdo, string $resource): never
{
    $actor = requireRole($pdo, ['admin', 'executive']);
    if (!in_array($resource, ['customers', 'leads', 'followups', 'bookings', 'calls', 'recordings', 'tasks', 'activities'], true)) {
        sendError('Resource not found.', 404);
    }

    $method = $_SERVER['REQUEST_METHOD'];
    if (!in_array($method, ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], true)) {
        header('Allow: GET, POST, PUT, PATCH, DELETE, OPTIONS');
        sendError('Method not allowed.', 405);
    }
    if ($method !== 'GET') requireCsrfToken();

    $rawId = $_GET['id'] ?? null;
    $id = $rawId === null ? null : filter_var($rawId, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    if ($rawId !== null && !$id) sendError('Record ID is invalid.', 400);

    $executiveId = null;
    if (isset($_GET['executiveId'])) {
        if ($actor['role'] !== 'admin' || !in_array($resource, ['calls', 'recordings'], true)) {
            sendError('You do not have permission to view this user history.', 403);
        }
        $executiveId = filter_var($_GET['executiveId'], FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        if (!$executiveId) sendError('Calling Executive ID is invalid.', 400);
        $executiveCheck = $pdo->prepare("SELECT id FROM users WHERE id = :id AND role = 'executive' LIMIT 1");
        $executiveCheck->execute(['id' => $executiveId]);
        if (!$executiveCheck->fetchColumn()) sendError('Calling Executive not found.', 404);
    }

    $activityUserId = null;
    if (isset($_GET['userId'])) {
        if ($actor['role'] !== 'admin' || $resource !== 'activities') {
            sendError('You do not have permission to view this user history.', 403);
        }
        $activityUserId = filter_var($_GET['userId'], FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        if (!$activityUserId) sendError('Calling Executive ID is invalid.', 400);
        $userCheck = $pdo->prepare("SELECT id FROM users WHERE id = :id AND role = 'executive' LIMIT 1");
        $userCheck->execute(['id' => $activityUserId]);
        if (!$userCheck->fetchColumn()) sendError('Calling Executive not found.', 404);
    }

    if ($method === 'GET') {
        $data = crmList($pdo, $resource, $actor, $id === null ? null : (int) $id, $executiveId === null ? null : (int) $executiveId, $activityUserId === null ? null : (int) $activityUserId);
        if ($id !== null && !$data) sendError('Record not found.', 404);
        sendResponse(['success' => true, 'data' => $id === null ? $data : $data[0]]);
    }
    if ($resource === 'activities' || $resource === 'recordings') sendError('This resource is read-only.', 405);

    if ($method === 'DELETE') {
        if (!$id) sendError('Record ID is required.', 400);
        crmAssertOwned($pdo, crmTable($resource), (int) $id, $actor);
        $table = crmTable($resource);
        try {
            $pdo->beginTransaction();
            $statement = $pdo->prepare("DELETE FROM `$table` WHERE id = :id");
            $statement->execute(['id' => $id]);
            crmWriteAudit($pdo, $actor, $resource, (int) $id, 'deleted');
            $pdo->commit();
            sendResponse(['success' => true]);
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            error_log('CRM delete failed: ' . $error->getMessage());
            sendError('Unable to delete this record.', 500);
        }
    }

    $body = crmJsonBody();
    $fields = crmWriteFields($resource, $body, $actor, $pdo);
    $table = crmTable($resource);
    try {
        $pdo->beginTransaction();
        if ($method === 'POST') {
            if ($resource === 'leads') crmAssertExecutive($pdo, (int) $fields['assigned_to']);
            if ($resource === 'bookings' && $fields['status'] !== 'Enquiry') {
                sendError('New bookings must start in the Enquiry stage.', 422);
            }
            if (in_array($resource, ['customers', 'leads', 'bookings', 'tasks'], true)) {
                $fields['created_by'] = $actor['user_id'] ?? $actor['id'] ?? 0;
            }
            $columns = array_keys($fields);
            $quoted = implode(', ', array_map(static fn ($column) => "`$column`", $columns));
            $placeholders = implode(', ', array_map(static fn ($column) => ':' . $column, $columns));
            $statement = $pdo->prepare("INSERT INTO `$table` ($quoted) VALUES ($placeholders)");
            $statement->execute($fields);
            $newId = (int) $pdo->lastInsertId();
            if ($resource === 'leads') {
                $leadCode = 'LD-' . str_pad((string) $newId, 6, '0', STR_PAD_LEFT);
                $codeStatement = $pdo->prepare('UPDATE leads SET lead_code = :lead_code WHERE id = :id');
                $codeStatement->execute(['lead_code' => $leadCode, 'id' => $newId]);
                crmCreateTypedNotification($pdo, (int) $fields['assigned_to'], 'New lead assigned', $leadCode . ' has been assigned to you.', 'lead', 'lead', $newId);
                crmSyncLeadFollowup($pdo, $newId, $fields, $leadCode);
            }
            if ($resource === 'bookings') {
                $code = 'BK-' . str_pad((string) $newId, 5, '0', STR_PAD_LEFT);
                $codeStatement = $pdo->prepare('UPDATE bookings SET booking_code = :code WHERE id = :id');
                $codeStatement->execute(['code' => $code, 'id' => $newId]);
                $recipientId = isset($fields['assigned_to']) ? (int) $fields['assigned_to'] : (int) ($actor['user_id'] ?? $actor['id'] ?? 0);
                crmCreateTypedNotification($pdo, $recipientId, 'New booking created', 'Booking ' . $code . ' was created for you.', 'booking', 'booking', $newId);
            }
            if ($resource === 'tasks') {
                $taskTitle = (string) $fields['title'];
                $taskMessage = $taskTitle . ' is assigned to you' . (($fields['due_date'] !== null && $fields['due_date'] !== '') ? ' and due on ' . $fields['due_date'] : '') . '.';
                crmCreateTypedNotification($pdo, (int) $fields['assigned_to'], 'New task assigned', $taskMessage, 'task', 'task', $newId);
            }
            if ($resource === 'calls') {
                $callLabel = (string) $fields['call_status'];
                $recipient = (int) $fields['executive_id'];
                $callMessage = $callLabel === 'Missed' ? 'A missed call was logged for your queue.' : 'A new call was logged for your queue.';
                crmCreateTypedNotification($pdo, $recipient, 'Call activity', $callMessage, 'call', 'call', $newId);
            }
            crmWriteAudit($pdo, $actor, $resource, $newId, 'created');
            $pdo->commit();
            $created = crmList($pdo, $resource, $actor, $newId);
            if (!$created) sendError('Created record is not available to this account.', 403);
            sendResponse(['success' => true, 'data' => $created[0]], 201);
        }

        if (!$id) sendError('Record ID is required.', 400);
        crmAssertOwned($pdo, $table, (int) $id, $actor);
        $currentLead = null;
        if ($resource === 'leads') {
            $currentQuery = $pdo->prepare('SELECT status, assigned_to, lead_code, next_follow_up FROM leads WHERE id = :id LIMIT 1 FOR UPDATE');
            $currentQuery->execute(['id' => $id]);
            $currentLead = $currentQuery->fetch();
            if (!$currentLead) sendError('Lead not found.', 404);
            crmAssertExecutive($pdo, (int) $fields['assigned_to']);
            crmAssertLeadTransition((string) $currentLead['status'], (string) $fields['status']);
        }
        if ($resource === 'bookings') {
            $currentQuery = $pdo->prepare('SELECT status FROM bookings WHERE id = :id LIMIT 1 FOR UPDATE');
            $currentQuery->execute(['id' => $id]);
            $currentStatus = $currentQuery->fetchColumn();
            if ($currentStatus === false) sendError('Booking not found.', 404);
            crmAssertBookingTransition((string) $currentStatus, (string) $fields['status']);
        }
        if ($resource === 'customers') {
            unset($fields['assigned_to']);
            if ($actor['role'] === 'admin' && isset($body['assignedExecutiveId'])) {
                $fields['assigned_to'] = crmId($body['assignedExecutiveId'], 'Assigned executive', true);
            }
        }
        if ($resource === 'leads' && $actor['role'] === 'admin' && isset($body['assignedExecutiveId'])) {
            $fields['assigned_to'] = crmId($body['assignedExecutiveId'], 'Assigned executive', true);
        }
        $assignments = implode(', ', array_map(static fn ($column) => "`$column` = :$column", array_keys($fields)));
        if ($resource === 'customers') $assignments .= ', `updated_at` = CURRENT_TIMESTAMP';
        $fields['id'] = $id;
        $statement = $pdo->prepare("UPDATE `$table` SET $assignments WHERE id = :id");
        $statement->execute($fields);
        if ($resource === 'leads' && $currentLead) {
            $leadFields = $fields;
            unset($leadFields['id']);
            $previousAssignee = (int) $currentLead['assigned_to'];
            $newAssignee = (int) $fields['assigned_to'];
            if ($newAssignee !== $previousAssignee) {
                crmCreateTypedNotification($pdo, $newAssignee, 'Lead assigned', $currentLead['lead_code'] . ' has been assigned to you.', 'lead', 'lead', (int) $id);
            }
            $scheduleChanged = (string) ($currentLead['next_follow_up'] ?? '') !== (string) ($fields['next_follow_up'] ?? '');
            $statusChanged = $currentLead['status'] !== $fields['status'];
            if ($currentLead['status'] === 'Follow-up' && $fields['status'] === 'Interested') {
                $completeFollowup = $pdo->prepare("UPDATE follow_ups SET status = 'Completed', completed_at = CURRENT_TIMESTAMP WHERE lead_id = :lead_id AND status = 'Pending'");
                $completeFollowup->execute(['lead_id' => $id]);
            }
            if ($statusChanged && $newAssignee === $previousAssignee) {
                crmCreateTypedNotification($pdo, $newAssignee, 'Lead status updated', $currentLead['lead_code'] . ' moved to ' . $fields['status'] . '.', 'lead', 'lead', (int) $id);
            }
            $enteredFollowup = $currentLead['status'] !== 'Follow-up' && $fields['status'] === 'Follow-up';
            if ($scheduleChanged || $newAssignee !== $previousAssignee || $enteredFollowup) {
                crmSyncLeadFollowup($pdo, (int) $id, $leadFields, (string) $currentLead['lead_code'], $scheduleChanged || $newAssignee !== $previousAssignee);
            }
        }
        if ($resource === 'tasks') {
            $assignedTo = (int) $fields['assigned_to'];
            $taskLabel = $fields['status'] === 'Completed' ? 'Task completed' : 'Task updated';
            $taskMessage = $fields['title'] . ' has been updated' . (($fields['due_date'] !== null && $fields['due_date'] !== '') ? ' and is due on ' . $fields['due_date'] : '') . '.';
            crmCreateTypedNotification($pdo, $assignedTo, $taskLabel, $taskMessage, 'task', 'task', (int) $id);
        }
        if ($resource === 'bookings') {
            $recipientId = isset($fields['assigned_to']) ? (int) $fields['assigned_to'] : (int) ($actor['user_id'] ?? $actor['id'] ?? 0);
            $status = (string) $fields['status'];
            $bookingCode = 'BK-' . str_pad((string) $id, 5, '0', STR_PAD_LEFT);
            crmCreateTypedNotification($pdo, $recipientId, 'Booking status updated', 'Booking ' . $bookingCode . ' is now ' . $status . '.', 'booking', 'booking', (int) $id);
        }
        if ($resource === 'followups') {
            $followupStatus = (string) $fields['status'];
            $followupMessage = 'Follow-up is ' . $followupStatus . ' for ' . ($fields['notes'] !== '' ? trim((string) $fields['notes']) : 'your record') . '.';
            crmCreateTypedNotification($pdo, (int) $fields['assigned_to'], 'Follow-up updated', $followupMessage, 'follow-up', 'follow-up', (int) $id);
        }
        if ($resource === 'calls' && isset($fields['call_status'])) {
            $callMessage = $fields['call_status'] === 'Missed' ? 'A missed call was logged.' : 'A new call was logged.';
            crmCreateTypedNotification($pdo, (int) $fields['executive_id'], 'Call activity', $callMessage, 'call', 'call', (int) $id);
        }
        crmWriteAudit($pdo, $actor, $resource, (int) $id, 'updated');
        $pdo->commit();
        $updated = crmList($pdo, $resource, $actor, (int) $id);
        sendResponse(['success' => true, 'data' => $updated[0] ?? null]);
    } catch (PDOException $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        error_log('CRM DATABASE ERROR: ' . $error->getMessage());
        error_log('CRM SQLSTATE: ' . $error->getCode());
        error_log('CRM PDO ERROR INFO: ' . json_encode($error->errorInfo));

        if ($error->getCode() === '23000') {
            sendError(
                'A referenced record does not exist or this conflicts with an existing record.',
                409
            );
        }

        sendError('Unable to save this record.', 500);
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        error_log('CRM write failed: ' . $error->getMessage());
        sendError('Unable to save this record.', 500);
    }
}

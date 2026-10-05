<?php
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../helpers/crm_api.php';

$actor = requireRole($pdo, ['admin', 'executive']);
$range = $_GET['range'] ?? '7d';
$days = match ($range) { '30d' => 30, '90d' => 90, default => 7 };

if ($actor['role'] === 'admin' && filter_var($_GET['summary'] ?? false, FILTER_VALIDATE_BOOLEAN)) {
    $metricsStatement = $pdo->query("SELECT
        executives.total_calling_executives,
        customers.total_customers,
        leads.total_leads,
        leads.new_leads,
        leads.active_leads,
        leads.converted_leads,
        followups.pending_followups,
        followups.completed_followups,
        calls.total_calls,
        calls.missed_calls,
        calls.answered_calls,
        recordings.recorded_calls,
        calls.total_call_duration_seconds,
        bookings.total_bookings,
        bookings.confirmed_bookings,
        bookings.cancelled_bookings
        FROM (SELECT COUNT(*) AS total_calling_executives FROM users WHERE role = 'executive') executives
        CROSS JOIN (SELECT COUNT(*) AS total_customers FROM customers) customers
        CROSS JOIN (SELECT COUNT(*) AS total_leads,
            COALESCE(SUM(status = 'New'), 0) AS new_leads,
            COALESCE(SUM(status IN ('New', 'Contacted', 'Follow-up', 'Interested', 'Booking Confirmed')), 0) AS active_leads,
            COALESCE(SUM(status = 'Converted'), 0) AS converted_leads
            FROM leads) leads
        CROSS JOIN (SELECT COALESCE(SUM(status = 'Pending'), 0) AS pending_followups,
            COALESCE(SUM(status = 'Completed'), 0) AS completed_followups
            FROM follow_ups) followups
        CROSS JOIN (SELECT COUNT(*) AS total_calls,
            COALESCE(SUM(call_status = 'Missed'), 0) AS missed_calls,
            COALESCE(SUM(call_status = 'Answered'), 0) AS answered_calls,
            COALESCE(SUM(duration_seconds), 0) AS total_call_duration_seconds
            FROM calls) calls
        CROSS JOIN (SELECT COUNT(DISTINCT call_id) AS recorded_calls FROM recordings) recordings
        CROSS JOIN (SELECT COUNT(*) AS total_bookings,
            COALESCE(SUM(LOWER(status) = 'confirmed'), 0) AS confirmed_bookings,
            COALESCE(SUM(LOWER(status) = 'cancelled'), 0) AS cancelled_bookings
            FROM bookings) bookings");
    $metrics = array_map('intval', $metricsStatement->fetch(PDO::FETCH_ASSOC) ?: []);

    $activitiesStatement = $pdo->query("SELECT a.id,
        CASE a.entity_type WHEN 'calls' THEN 'call' WHEN 'followups' THEN 'follow-up' WHEN 'bookings' THEN 'booking' WHEN 'leads' THEN 'lead' WHEN 'tasks' THEN 'task' WHEN 'recordings' THEN 'recording' ELSE 'note' END AS type,
        COALESCE(a.description, '') AS title,
        COALESCE(a.description, '') AS description,
        COALESCE(u.name, '') AS actor,
        CASE u.role WHEN 'admin' THEN 'Admin' ELSE 'Calling Executive' END AS actorRole,
        a.created_at AS timestamp,
        a.entity_id AS relatedId,
        CASE a.entity_type WHEN 'customers' THEN 'Customer' WHEN 'leads' THEN 'Lead' WHEN 'bookings' THEN 'Booking' WHEN 'calls' THEN 'Call' WHEN 'followups' THEN 'Follow-up' WHEN 'tasks' THEN 'Task' ELSE NULL END AS relatedType
        FROM activities a LEFT JOIN users u ON u.id = a.user_id
        ORDER BY a.created_at DESC, a.id DESC LIMIT 8");
    $activities = $activitiesStatement->fetchAll();
    foreach ($activities as &$activity) {
        $activity['id'] = (string) $activity['id'];
        if ($activity['relatedId'] !== null) $activity['relatedId'] = (string) $activity['relatedId'];
    }
    unset($activity);

    sendResponse(['success' => true, 'data' => ['adminMetrics' => $metrics, 'activities' => $activities]]);
}

$customers = crmList($pdo, 'customers', $actor);
$leads = crmList($pdo, 'leads', $actor);
$calls = crmList($pdo, 'calls', $actor);
$followups = crmList($pdo, 'followups', $actor);
$bookings = crmList($pdo, 'bookings', $actor);
$tasks = crmList($pdo, 'tasks', $actor);

if ($actor['role'] === 'admin') {
    $usersQuery = $pdo->query("SELECT id, name, email, phone, role, status, created_at AS joinedOn, updated_at AS lastActive FROM users WHERE role IN ('admin','executive') ORDER BY name");
    $users = array_map(static function ($user) {
        $user['id'] = (string) $user['id'];
        $user['role'] = $user['role'] === 'admin' ? 'Admin' : 'Calling Executive';
        $user['active'] = $user['status'] === 'active';
        unset($user['status']);
        return $user;
    }, $usersQuery->fetchAll());
    $activities = crmList($pdo, 'activities', $actor);
} else {
    $users = [[
        'id' => (string) $actor['id'], 'name' => $actor['name'], 'email' => $actor['email'],
        'phone' => $actor['phone'] ?? '', 'role' => 'Calling Executive', 'active' => true,
        'leadCount' => count($leads), 'callCount' => count($calls), 'conversionRate' => 0,
        'joinedOn' => '', 'lastActive' => '',
    ]];
    $activitiesStatement = $pdo->prepare("SELECT a.id, a.action AS type, a.description AS title, a.description, u.name AS actor, u.role AS actorRole, a.created_at AS timestamp, a.entity_id AS relatedId, a.entity_type AS relatedType FROM activities a JOIN users u ON u.id = a.user_id WHERE a.user_id = :user_id ORDER BY a.created_at DESC LIMIT 30");
    $activitiesStatement->execute(['user_id' => $actor['id']]);
    $activities = $activitiesStatement->fetchAll();
}

$today = date('Y-m-d');
$todayCalls = count(array_filter($calls, static fn ($call) => substr((string) $call['timestamp'], 0, 10) === $today));
$daysList = [];
for ($offset = $days - 1; $offset >= 0; $offset--) {
    $date = date('Y-m-d', strtotime("-$offset days"));
    $dayCalls = array_values(array_filter($calls, static fn ($call) => substr((string) $call['timestamp'], 0, 10) === $date));
    $daysList[] = ['day' => date('D', strtotime($date)), 'calls' => count($dayCalls), 'answered' => count(array_filter($dayCalls, static fn ($call) => $call['status'] === 'Answered'))];
}

$leadWeeks = [];
for ($offset = 5; $offset >= 0; $offset--) {
    $weekStart = strtotime('monday this week') - ($offset * 7 * 86400);
    $weekEnd = $weekStart + (7 * 86400);
    $weekLeads = array_values(array_filter($leads, static function ($lead) use ($weekStart, $weekEnd) {
        $timestamp = strtotime((string) $lead['createdOn']);
        return $timestamp >= $weekStart && $timestamp < $weekEnd;
    }));
    $leadWeeks[] = ['week' => date('M j', $weekStart), 'leads' => count($weekLeads), 'converted' => count(array_filter($weekLeads, static fn ($lead) => $lead['status'] === 'Converted'))];
}

$stages = ['New', 'Contacted', 'Interested', 'Follow-up', 'Converted', 'Lost'];
$leadFunnel = [];
foreach ($stages as $index => $stage) {
    $leadFunnel[] = ['stage' => $stage, 'value' => count(array_filter($leads, static fn ($lead) => $lead['status'] === $stage)), 'color' => ['#0f172a', '#334155', '#0d9488', '#14b8a6', '#10b981', '#ef4444'][$index]];
}

$bookingMonths = [];
for ($offset = 5; $offset >= 0; $offset--) {
    $month = date('Y-m', strtotime("first day of -$offset months"));
    $monthBookings = array_values(array_filter($bookings, static fn ($booking) => substr((string) $booking['travelDate'], 0, 7) === $month));
    $bookingMonths[] = ['month' => date('M', strtotime($month . '-01')), 'bookings' => count($monthBookings), 'revenue' => array_sum(array_map(static fn ($booking) => (float) $booking['amount'], array_filter($monthBookings, static fn ($booking) => $booking['bookingStatus'] === 'Completed')))];
}

$bySource = [];
foreach ($leads as $lead) {
    $source = $lead['source'] ?: 'Unknown';
    $bySource[$source] ??= ['name' => $source, 'value' => 0, 'converted' => 0, 'lost' => 0, 'color' => ['#0f172a', '#14b8a6', '#10b981', '#3b82f6', '#f59e0b', '#ef4444'][count($bySource) % 6]];
    $bySource[$source]['value']++;
    if ($lead['status'] === 'Converted') $bySource[$source]['converted']++;
    if ($lead['status'] === 'Lost') $bySource[$source]['lost']++;
}

$callStats = [];
foreach ($calls as $call) {
    $name = $call['executiveName'] ?: 'Unassigned';
    $callStats[$name] ??= ['name' => $name, 'calls' => 0, 'conversions' => 0, 'missed' => 0, 'duration' => 0];
    $callStats[$name]['calls']++;
    if ($call['status'] === 'Answered') { $callStats[$name]['conversions']++; $callStats[$name]['duration'] += (int) $call['durationSec']; }
    if ($call['status'] === 'Missed') $callStats[$name]['missed']++;
}
$executivePerformance = array_values(array_map(static function ($row) {
    $row['conversionRate'] = $row['calls'] > 0 ? round(($row['conversions'] / $row['calls']) * 100, 1) : 0;
    $row['avgDuration'] = $row['conversions'] > 0 ? (int) round($row['duration'] / $row['conversions']) : 0;
    unset($row['duration']);
    return $row;
}, $callStats));

sendResponse(['success' => true, 'data' => [
    'customers' => $customers, 'leads' => $leads, 'calls' => $calls,
    'followups' => $followups, 'bookings' => $bookings, 'tasks' => $tasks,
    'users' => $users, 'activities' => $activities,
    'callsOverTime' => $daysList, 'leadsOverTime' => $leadWeeks,
    'leadFunnel' => $leadFunnel, 'bookingTrends' => $bookingMonths,
    'executivePerformance' => $executivePerformance,
    'leadSourceDistribution' => array_values($bySource),
]]);

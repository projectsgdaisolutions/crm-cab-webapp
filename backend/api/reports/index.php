<?php
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../helpers/crm_api.php';

$actor = requireRole($pdo, ['admin']);
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    header('Allow: GET, OPTIONS');
    sendError('Only GET method is allowed.', 405);
}
$range = $_GET['range'] ?? '30d';
$days = match ($range) { '7d' => 7, '90d' => 90, '12m' => 365, default => 30 };
$cutoff = strtotime("-$days days");
$recent = static fn (array $row, string $dateKey): bool => strtotime((string) $row[$dateKey]) >= $cutoff;
$calls = array_values(array_filter(crmList($pdo, 'calls', ['role' => 'admin', 'id' => 0]), static fn ($row) => $recent($row, 'timestamp')));
$leads = array_values(array_filter(crmList($pdo, 'leads', ['role' => 'admin', 'id' => 0]), static fn ($row) => $recent($row, 'createdOn')));
$followups = array_values(array_filter(crmList($pdo, 'followups', ['role' => 'admin', 'id' => 0]), static fn ($row) => $recent($row, 'scheduledAt')));
$bookings = array_values(array_filter(crmList($pdo, 'bookings', ['role' => 'admin', 'id' => 0]), static fn ($row) => $recent($row, 'travelDate')));
$customers = array_values(array_filter(crmList($pdo, 'customers', ['role' => 'admin', 'id' => 0]), static fn ($row) => $recent($row, 'joinedOn')));

$callStats = [];
foreach ($calls as $call) {
    $name = $call['executiveName'] ?: 'Unassigned';
    $callStats[$name] ??= ['name' => $name, 'calls' => 0, 'conversions' => 0, 'missed' => 0, 'duration' => 0];
    $callStats[$name]['calls']++;
    if ($call['status'] === 'Answered') { $callStats[$name]['conversions']++; $callStats[$name]['duration'] += (int) $call['durationSec']; }
    if ($call['status'] === 'Missed') $callStats[$name]['missed']++;
}
$callPerformanceByExec = array_values(array_map(static function ($row) {
    $row['conversionRate'] = $row['calls'] > 0 ? round(($row['conversions'] / $row['calls']) * 100, 1) : 0;
    $row['avgDuration'] = $row['conversions'] > 0 ? (int) round($row['duration'] / $row['conversions']) : 0;
    unset($row['duration']);
    return $row;
}, $callStats));

$leadStats = [];
foreach ($leads as $lead) {
    $source = $lead['source'] ?: 'Unknown';
    $leadStats[$source] ??= ['name' => $source, 'value' => 0, 'converted' => 0, 'lost' => 0, 'color' => ['#0f172a', '#14b8a6', '#10b981', '#3b82f6', '#f59e0b', '#ef4444'][count($leadStats) % 6]];
    $leadStats[$source]['value']++;
    if ($lead['status'] === 'Converted') $leadStats[$source]['converted']++;
    if ($lead['status'] === 'Lost') $leadStats[$source]['lost']++;
}

$weekStats = [];
foreach ($followups as $followup) {
    $week = date('o-\\WW', strtotime($followup['scheduledAt']));
    $weekStats[$week] ??= ['week' => $week, 'scheduled' => 0, 'completed' => 0];
    $weekStats[$week]['scheduled']++;
    if ($followup['status'] === 'Completed') $weekStats[$week]['completed']++;
}

$monthStats = [];
foreach ($bookings as $booking) {
    $month = date('Y-m', strtotime($booking['travelDate']));
    $monthStats[$month] ??= ['month' => date('M', strtotime($month . '-01')), 'bookings' => 0, 'revenue' => 0];
    $monthStats[$month]['bookings']++;
    if ($booking['bookingStatus'] === 'Completed') $monthStats[$month]['revenue'] += (float) $booking['amount'];
}

$acquisition = [];
foreach ($customers as $customer) {
    $month = date('Y-m', strtotime($customer['joinedOn']));
    $acquisition[$month] ??= ['month' => date('M', strtotime($month . '-01')), 'new' => 0, 'churned' => 0];
    if ($customer['status'] === 'Churned') $acquisition[$month]['churned']++;
    else $acquisition[$month]['new']++;
}
$executivePerformance = array_map(static fn ($row) => ['name' => $row['name'], 'calls' => $row['calls'], 'conversions' => $row['conversions']], $callPerformanceByExec);

sendResponse(['success' => true, 'data' => [
    'callPerformanceByExec' => $callPerformanceByExec,
    'leadConversionBySource' => array_values($leadStats),
    'customerAcquisition' => array_values($acquisition),
    'followUpCompletion' => array_values($weekStats),
    'bookingTrends' => array_values($monthStats),
    'executivePerformance' => $executivePerformance,
]]);

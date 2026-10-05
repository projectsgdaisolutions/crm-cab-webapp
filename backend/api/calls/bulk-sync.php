<?php
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../helpers/crm_api.php';
$actor = requireRole($pdo, ['admin', 'executive']);
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { header('Allow: POST, OPTIONS'); sendError('Only POST method is allowed.', 405); }
requireCsrfToken(); $body=json_decode(file_get_contents('php://input'),true); if (!is_array($body) || !isset($body['calls']) || !is_array($body['calls'])) sendError('calls must be an array.',400);
if (count($body['calls']) < 1 || count($body['calls']) > 500) sendError('calls must contain between 1 and 500 records.',422);
$created=[]; $duplicates=[]; $pdo->beginTransaction();
try {
  foreach ($body['calls'] as $index=>$item) {
    if (!is_array($item)) sendError('Each call must be an object.',422);
    $syncId=trim((string)($item['syncId']??''));
    if ($syncId !== '') { $q=$pdo->prepare('SELECT id FROM calls WHERE executive_id=:exec AND client_sync_id=:sync LIMIT 1'); $q->execute(['exec'=>$actor['id'],'sync'=>$syncId]); if ($existing=$q->fetchColumn()) { $duplicates[]=$syncId; continue; } }
    $type=(string)($item['type']??'Lead'); $relatedId=filter_var($item['customerOrLeadId']??null,FILTER_VALIDATE_INT,['options'=>['min_range'=>1]]); if(!$relatedId) sendError('Call #' . ($index+1) . ': customerOrLeadId is invalid.',422);
    if(!in_array($type,['Customer','Lead'],true)) sendError('Call #' . ($index+1) . ': type is invalid.',422); crmValidateRelation($pdo,$type,(int)$relatedId,$actor);
    $phoneQ=$pdo->prepare($type==='Customer'?'SELECT phone FROM customers WHERE id=:id':'SELECT phone FROM leads WHERE id=:id'); $phoneQ->execute(['id'=>$relatedId]); $phone=(string)$phoneQ->fetchColumn();
    $status=(string)($item['status']??'Answered'); if(!in_array($status,['Answered','Missed','Busy','Rejected','Failed'],true)) sendError('Call #' . ($index+1) . ': status is invalid.',422);
    $timestamp=$item['timestamp']??null; if(!is_string($timestamp)||strtotime($timestamp)===false) sendError('Call #' . ($index+1) . ': timestamp is invalid.',422);
    $followUpId=filter_var($item['followUpId']??null,FILTER_VALIDATE_INT,['options'=>['min_range'=>1]]); if($followUpId){ crmAssertOwned($pdo,'follow_ups',(int)$followUpId,$actor); }
    $fields=['customer_id'=>$type==='Customer'?(int)$relatedId:null,'lead_id'=>$type==='Lead'?(int)$relatedId:null,'executive_id'=>(int)$actor['id'],'phone_number'=>trim((string)($item['phoneNumber']??$phone)),'call_type'=>(($item['direction']??'Outgoing')==='Incoming'?'Incoming':'Outgoing'),'call_status'=>$status,'duration_seconds'=>max(0,(int)($item['durationSec']??0)),'call_time'=>date('Y-m-d H:i:s',strtotime($timestamp)),'notes'=>trim((string)($item['notes']??'')),'follow_up_id'=>$followUpId,'client_sync_id'=>$syncId!==''?$syncId:null];
    $sql='INSERT INTO calls (customer_id,lead_id,executive_id,phone_number,call_type,call_status,duration_seconds,call_time,notes,follow_up_id,client_sync_id) VALUES (:customer_id,:lead_id,:executive_id,:phone_number,:call_type,:call_status,:duration_seconds,:call_time,:notes,:follow_up_id,:client_sync_id)'; $stmt=$pdo->prepare($sql); $stmt->execute($fields); $newId=(int)$pdo->lastInsertId();
    $read=$pdo->prepare('SELECT x.id, CONCAT("CL-",x.id) AS callId, COALESCE(c.name,l.name,"") AS customerOrLeadName, COALESCE(x.customer_id,x.lead_id,0) AS customerOrLeadId, CASE WHEN x.customer_id IS NOT NULL THEN "Customer" ELSE "Lead" END AS type, x.phone_number AS phoneNumber, x.executive_id AS executiveId, COALESCE(u.name,"") AS executiveName, CASE WHEN LOWER(x.call_type) IN ("incoming","inbound") THEN "Incoming" ELSE "Outgoing" END AS direction, x.call_time AS timestamp, x.duration_seconds AS durationSec, x.call_status AS status, (SELECT COUNT(*)>0 FROM recordings r WHERE r.call_id=x.id) AS hasRecording, (SELECT CONCAT("rec-",r.id) FROM recordings r WHERE r.call_id=x.id ORDER BY r.id DESC LIMIT 1) AS recordingId, x.follow_up_id AS followUpId, COALESCE(x.notes,"") AS notes FROM calls x LEFT JOIN customers c ON c.id=x.customer_id LEFT JOIN leads l ON l.id=x.lead_id LEFT JOIN users u ON u.id=x.executive_id WHERE x.id=:id LIMIT 1'); $read->execute(['id'=>$newId]); $row=$read->fetch(); foreach(['id','customerOrLeadId','executiveId','followUpId'] as $k){if(isset($row[$k]))$row[$k]=(string)$row[$k];} $row['durationSec']=(int)$row['durationSec']; $row['hasRecording']=(bool)$row['hasRecording']; $created[]=$row;
  }
  $pdo->commit(); sendResponse(['success'=>true,'data'=>['created'=>$created,'duplicates'=>$duplicates]],201);
} catch (Throwable $e) { if($pdo->inTransaction())$pdo->rollBack(); error_log('Bulk call sync failed: '.$e->getMessage()); sendError('Unable to sync call records.',500); }

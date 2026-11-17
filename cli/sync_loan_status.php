<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('CLI only');
}
require dirname(__DIR__) . '/bootstrap.php';
try {
    notificationEnsureTable();
    $count = syncApprovedLoans();
    notificationSyncDueReminders();
    echo sprintf("[%s] Đã chuyển %d phiếu sang Đang mượn và đồng bộ nhắc hạn trả.\n", date('Y-m-d H:i:s'), $count);
} catch (Throwable $error) {
    fwrite(STDERR, '[LabTrack] ' . $error->getMessage() . PHP_EOL);
    exit(1);
}

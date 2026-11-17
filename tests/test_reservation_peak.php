<?php
declare(strict_types=1);
require dirname(__DIR__) . '/bootstrap.php';

function assertPeak(string $case, array $rows, string $from, string $to, int $expected): void {
    $actual = reservationPeak($rows, $from, $to);
    if ($actual !== $expected) {
        fwrite(STDERR, "FAIL {$case}: expected {$expected}, got {$actual}\n");
        exit(1);
    }
    echo "OK {$case}\n";
}
function booking(string $from, string $to, int $qty, string $status='da_duyet'): array {
    return ['ngay_muon'=>$from,'ngay_hen_tra'=>$to,'so_luong'=>$qty,'trang_thai'=>$status];
}
assertPeak('Khong co phieu',[], '2026-12-01','2026-12-08',0);
assertPeak('Hai lich roi nhau',[
    booking('2026-12-01','2026-12-03',2), booking('2026-12-05','2026-12-08',3)],
    '2026-12-01','2026-12-08',3);
assertPeak('Hai lich trung 1 ngay',[
    booking('2026-12-01','2026-12-03',2), booking('2026-12-03','2026-12-08',3)],
    '2026-12-01','2026-12-08',5);
assertPeak('Khoang khong trung',[
    booking('2026-12-01','2026-12-03',5)],
    '2026-12-04','2026-12-05',0);
assertPeak('Khong tinh thang truoc',[
    booking('2026-11-01','2026-11-03',6),booking('2026-12-07','2026-12-09',2)],
    '2026-12-01','2026-12-08',2);
assertPeak('Dang muon qua han van chiem kho',[
    booking('2026-11-01','2026-11-03',2,'dang_muon'), booking('2026-12-01','2026-12-06',3)],
    '2026-12-01','2026-12-08',5);
assertPeak('Cho xac nhan tra van chiem',[
    booking('2026-11-01','2026-11-03',2,'cho_tra')],
    '2026-12-01','2026-12-02',2);
assertPeak('Chi trong ngay',[
    booking('2026-12-07','2026-12-07',1)], '2026-12-07','2026-12-07',1);

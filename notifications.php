<?php

declare(strict_types=1);

function notificationEnsureTable(): void
{
    static $ready = false;
    if ($ready) return;
    try {
        db()->query('SELECT id FROM thong_bao LIMIT 0');
    } catch (PDOException $e) {
        if ((int) ($e->errorInfo[1] ?? 0) !== 1146) throw $e;
        db()->exec(<<<'SQL'
CREATE TABLE IF NOT EXISTS thong_bao (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    tai_khoan_id BIGINT UNSIGNED NOT NULL,
    phieu_muon_id BIGINT UNSIGNED NULL,
    loai VARCHAR(32) NOT NULL,
    tieu_de VARCHAR(160) NOT NULL,
    noi_dung VARCHAR(500) NOT NULL,
    su_kien_khoa VARCHAR(100) NULL,
    da_doc TINYINT(1) NOT NULL DEFAULT 0,
    da_xoa TINYINT(1) NOT NULL DEFAULT 0,
    tao_luc TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_thong_bao_su_kien (tai_khoan_id, su_kien_khoa),
    INDEX idx_thong_bao_tai_khoan (tai_khoan_id, da_doc, id),
    CONSTRAINT fk_thong_bao_tai_khoan FOREIGN KEY (tai_khoan_id)
        REFERENCES tai_khoan(id) ON DELETE CASCADE,
    CONSTRAINT fk_thong_bao_phieu FOREIGN KEY (phieu_muon_id)
        REFERENCES phieu_muon(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL);
    }
    try {
        db()->query('SELECT da_xoa FROM thong_bao LIMIT 0');
    } catch (PDOException $e) {
        if ((int) ($e->errorInfo[1] ?? 0) !== 1054) throw $e;
        try {
            db()->exec('ALTER TABLE thong_bao ADD COLUMN da_xoa TINYINT(1) NOT NULL DEFAULT 0 AFTER da_doc');
        } catch (PDOException $migrationError) {
            if ((int) ($migrationError->errorInfo[1] ?? 0) !== 1060) throw $migrationError;
        }
    }
    $ready = true;
}

function notificationTrim(string $value, int $limit): string
{
    if (function_exists('mb_substr')) return mb_substr($value, 0, $limit, 'UTF-8');
    if (preg_match('/^.{0,' . $limit . '}/us', $value, $matches)) return $matches[0];
    return substr($value, 0, $limit);
}

function notificationSend(int $accountId, string $type, string $title, string $message,
    ?int $loanId = null, ?string $eventKey = null): void
{
    $title = notificationTrim($title, 160);
    $message = notificationTrim($message, 500);
    dbExec('INSERT IGNORE INTO thong_bao
      (tai_khoan_id, phieu_muon_id, loai, tieu_de, noi_dung, su_kien_khoa)
      VALUES (?,?,?,?,?,?)', [$accountId, $loanId, $type, $title, $message, $eventKey]);
}

function notificationToBorrower(int $borrowerId, string $type, string $title,
    string $message, ?int $loanId = null, ?string $eventKey = null): void
{
    $accounts = dbExec("SELECT id FROM tai_khoan WHERE nguoi_muon_id=? AND vai_tro='user' AND hoat_dong=1", [$borrowerId])->fetchAll();
    foreach ($accounts as $account) {
        notificationSend((int) $account['id'], $type, $title, $message, $loanId, $eventKey);
    }
}

function notificationToAdmins(string $type, string $title, string $message,
    ?int $loanId = null, ?string $eventKey = null): void
{
    $admins = dbExec("SELECT id FROM tai_khoan WHERE vai_tro='admin' AND hoat_dong=1")->fetchAll();
    foreach ($admins as $admin) {
        notificationSend((int) $admin['id'], $type, $title, $message, $loanId, $eventKey);
    }
}

function notificationSyncDueReminders(): void
{
    $today = date('Y-m-d');
    $plusTwoDays = date('Y-m-d', strtotime('+2 days'));
    $loans = dbExec("SELECT pm.id, pm.nguoi_muon_id, pm.ngay_hen_tra, nm.ho_ten
        FROM phieu_muon pm JOIN nguoi_muon nm ON nm.id=pm.nguoi_muon_id
        WHERE pm.trang_thai IN ('dang_muon','cho_tra') AND pm.ngay_hen_tra <= ?
        ORDER BY pm.ngay_hen_tra DESC LIMIT 1000", [$plusTwoDays])->fetchAll();
    foreach ($loans as $loan) {
        $id = (int) $loan['id'];
        $borrowerId = (int) $loan['nguoi_muon_id'];
        $due = (string) $loan['ngay_hen_tra'];
        $days = (int) ((new DateTimeImmutable($today))->diff(new DateTimeImmutable($due))->format('%r%a'));
        $code = '#PM' . str_pad((string) $id, 4, '0', STR_PAD_LEFT);
        $niceDue = date('d/m/Y', strtotime($due));
        if ($days < 0) {
            $type = 'overdue';
            $key = "loan:{$id}:overdue";
            $title = "Phiếu {$code} đã quá hạn";
            $userMessage = "Phiếu mượn đã quá hạn từ {$niceDue}. Vui lòng sớm bàn giao thiết bị.";
            $adminMessage = "Phiếu {$code} của {$loan['ho_ten']} đã quá hạn trả từ {$niceDue}.";
        } elseif ($days === 0) {
            $type = 'due_today';
            $key = "loan:{$id}:due:0";
            $title = "Phiếu {$code} đến hạn hôm nay";
            $userMessage = "Hôm nay ({$niceDue}) là hạn trả thiết bị của bạn. Vui lòng bàn giao đúng hạn.";
            $adminMessage = "Phiếu {$code} của {$loan['ho_ten']} đến hạn trả hôm nay ({$niceDue}).";
        } elseif ($days === 1 || $days === 2) {
            $type = 'due_soon';
            $key = "loan:{$id}:due:{$days}";
            $title = "Phiếu {$code} sắp đến hạn trả";
            $userMessage = "Còn {$days} ngày đến hạn trả {$niceDue}. Hãy chuẩn bị bàn giao thiết bị.";
            $adminMessage = "Phiếu {$code} của {$loan['ho_ten']} sẽ đến hạn trả trong {$days} ngày ({$niceDue}).";
        } else {
            continue;
        }
        notificationToBorrower($borrowerId, $type, $title, $userMessage, $id, $key);
        notificationToAdmins($type, $title, $adminMessage, $id, $key);
    }
}

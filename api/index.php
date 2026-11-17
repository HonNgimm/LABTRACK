<?php
declare(strict_types=1);
require dirname(__DIR__) . '/bootstrap.php';

header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');
header('Cache-Control: no-store');

try {
    $action = (string) ($_GET['action'] ?? '');
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    $getActions = ['session', 'dashboard', 'equipment_list', 'borrower_list', 'loan_list', 'notification_list',
        'availability_check', 'availability_calendar'];
    $postActions = [
        'login', 'register', 'logout', 'equipment_save', 'equipment_toggle',
        'borrower_save', 'borrower_toggle', 'profile_update', 'loan_create',
        'loan_approve', 'loan_reject', 'loan_cancel', 'loan_request_return', 'loan_return',
        'notification_read', 'notification_read_all', 'notification_delete', 'notification_delete_all',
    ];
    if (!in_array($action, array_merge($getActions, $postActions), true)) fail('API không tồn tại.', 404);
    if ($method !== (in_array($action, $getActions, true) ? 'GET' : 'POST')) fail('Phương thức không được hỗ trợ.', 405);
    if ($method === 'POST') csrfCheck();
    $data = $method === 'POST' ? body() : [];

    if (!in_array($action, ['login', 'register', 'logout'], true) && account() !== null) {
        notificationEnsureTable();
        syncApprovedLoans();
    }

    switch ($action) {
        case 'session':
            jsonResponse(['success' => true, 'csrf' => $_SESSION['csrf'], 'user' => account()]);

        case 'login':
            if (account()) fail('Bạn đã đăng nhập.');
            $email = strtolower(strField($data, 'email', 190));
            $password = strField($data, 'password', 200);
            $row = dbExec('SELECT * FROM tai_khoan WHERE email = ? LIMIT 1', [$email])->fetch();
            if (!$row || !password_verify($password, $row['mat_khau']) || !(int) $row['hoat_dong']) {
                fail('Email hoặc mật khẩu không đúng, hoặc tài khoản đã bị khóa.', 401);
            }
            if ($row['vai_tro'] === 'user') {
                $borrower = dbExec('SELECT hoat_dong FROM nguoi_muon WHERE id = ?', [$row['nguoi_muon_id']])->fetch();
                if (!$borrower || !(int) $borrower['hoat_dong']) fail('Tài khoản đã bị khóa.', 403);
            }
            notificationEnsureTable();
            session_regenerate_id(true);
            $_SESSION['user_id'] = (int) $row['id'];
            syncApprovedLoans();
            jsonResponse(['success' => true, 'message' => 'Đăng nhập thành công.', 'user' => account()]);

        case 'register':
            if (account()) fail('Vui lòng đăng xuất trước khi đăng ký.');
            $name = strField($data, 'name', 120);
            $unit = strField($data, 'department', 160);
            $phone = strField($data, 'phone', 20);
            $email = strtolower(strField($data, 'email', 190));
            $password = strField($data, 'password', 200);
            $passwordConfirm = strField($data, 'password_confirm', 200);
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail('Email không hợp lệ.');
            if (!preg_match('/^[0-9+().\s-]{9,20}$/', $phone)) fail('Số điện thoại không hợp lệ.');
            if (strlen($password) < 8) fail('Mật khẩu phải có ít nhất 8 ký tự.');
            if (!hash_equals($password, $passwordConfirm)) fail('Mật khẩu xác nhận không khớp.');
            withTransaction(function () use ($name, $unit, $phone, $email, $password): void {
                dbExec('INSERT INTO nguoi_muon (ho_ten, don_vi, sdt) VALUES (?, ?, ?)', [$name, $unit, $phone]);
                $borrowerId = (int) db()->lastInsertId();
                dbExec("INSERT INTO tai_khoan (nguoi_muon_id, email, mat_khau, ten_hien_thi, vai_tro)
                    VALUES (?, ?, ?, ?, 'user')", [$borrowerId, $email, password_hash($password, PASSWORD_DEFAULT), $name]);
            });
            jsonResponse(['success' => true, 'message' => 'Đăng ký thành công! Vui lòng đăng nhập.'], 201);

        case 'logout':
            $_SESSION = [];
            session_regenerate_id(true);
            $_SESSION['csrf'] = bin2hex(random_bytes(32));
            jsonResponse(['success' => true, 'csrf' => $_SESSION['csrf']]);

        case 'notification_list':
            $user = authorize();
            notificationSyncDueReminders();
            $items = dbExec('SELECT id, phieu_muon_id, loai, tieu_de, noi_dung, da_doc, tao_luc
                FROM thong_bao WHERE tai_khoan_id=? AND da_xoa=0 ORDER BY id DESC LIMIT 40', [$user['id']])->fetchAll();
            $count = dbExec('SELECT COUNT(*) FROM thong_bao WHERE tai_khoan_id=? AND da_doc=0 AND da_xoa=0', [$user['id']])->fetchColumn();
            jsonResponse(['success' => true, 'items' => $items, 'unread' => (int) $count]);

        case 'notification_read':
            $user = authorize();
            $id = positiveInt($data['id'] ?? null, 'ID thông báo');
            $item = dbExec('SELECT id FROM thong_bao WHERE id=? AND tai_khoan_id=? AND da_xoa=0', [$id, $user['id']])->fetch();
            if (!$item) fail('Không tìm thấy thông báo thuộc tài khoản của bạn.', 404);
            dbExec('UPDATE thong_bao SET da_doc=1 WHERE id=? AND tai_khoan_id=? AND da_xoa=0', [$id, $user['id']]);
            jsonResponse(['success' => true, 'message' => 'Đã đánh dấu thông báo là đã đọc.']);

        case 'notification_read_all':
            $user = authorize();
            dbExec('UPDATE thong_bao SET da_doc=1 WHERE tai_khoan_id=? AND da_doc=0 AND da_xoa=0', [$user['id']]);
            jsonResponse(['success' => true, 'message' => 'Đã đánh dấu tất cả thông báo là đã đọc.']);

        case 'notification_delete':
            $user = authorize();
            $id = positiveInt($data['id'] ?? null, 'ID thông báo');
            $deleted = dbExec('UPDATE thong_bao SET da_xoa=1, da_doc=1
                WHERE id=? AND tai_khoan_id=? AND da_xoa=0', [$id, $user['id']]);
            if ($deleted->rowCount() === 0) fail('Không tìm thấy thông báo thuộc tài khoản của bạn.', 404);
            jsonResponse(['success' => true, 'message' => 'Đã xóa thông báo.']);

        case 'notification_delete_all':
            $user = authorize();
            dbExec('UPDATE thong_bao SET da_xoa=1, da_doc=1 WHERE tai_khoan_id=? AND da_xoa=0', [$user['id']]);
            jsonResponse(['success' => true, 'message' => 'Đã xóa tất cả thông báo.']);

        case 'dashboard':
            $user = authorize();
            if ($user['role'] === 'admin') {
                $stats = db()->query("SELECT
                    (SELECT COUNT(*) FROM thiet_bi WHERE hoat_dong = 1) AS equipment,
                    (SELECT COUNT(*) FROM nguoi_muon WHERE hoat_dong = 1) AS borrowers,
                    (SELECT COUNT(*) FROM phieu_muon WHERE trang_thai = 'cho_duyet') AS pending,
                    (SELECT COUNT(*) FROM phieu_muon WHERE trang_thai = 'da_duyet') AS approved,
                    (SELECT COUNT(*) FROM phieu_muon WHERE trang_thai IN ('dang_muon','cho_tra')) AS active,
                    (SELECT COUNT(*) FROM phieu_muon WHERE trang_thai IN ('dang_muon','cho_tra') AND ngay_hen_tra < CURDATE()) AS overdue,
                    (SELECT COALESCE(SUM(so_luong_hong),0) FROM thiet_bi) AS damaged,
                    (SELECT COUNT(*) FROM phieu_muon WHERE trang_thai='cho_tra') AS returns")->fetch();
            } else {
                $stats = dbExec("SELECT
                    COUNT(*) AS total,
                    COALESCE(SUM(trang_thai='cho_duyet'),0) AS pending,
                    COALESCE(SUM(trang_thai='da_duyet'),0) AS approved,
                    COALESCE(SUM(trang_thai IN ('dang_muon','cho_tra')),0) AS active,
                    COALESCE(SUM(trang_thai='da_tra'),0) AS returned,
                    COALESCE(SUM(trang_thai IN ('dang_muon','cho_tra') AND ngay_hen_tra < CURDATE()),0) AS overdue
                    FROM phieu_muon WHERE nguoi_muon_id = ?", [$user['borrower_id']])->fetch();
            }
            jsonResponse(['success' => true, 'stats' => $stats]);

        case 'equipment_list':
            $user = authorize();
            $search = trim((string) ($_GET['q'] ?? ''));
            if ((function_exists('mb_strlen') ? mb_strlen($search, 'UTF-8') : strlen($search)) > 100) fail('Từ khóa quá dài.');
            $where = [];
            $args = [];
            if ($user['role'] !== 'admin') $where[] = 'tb.hoat_dong = 1';
            if ($search !== '') {
                $where[] = '(tb.ma_thiet_bi LIKE ? OR tb.ten_thiet_bi LIKE ? OR tb.loai LIKE ? OR tb.mo_ta LIKE ?)';
                $args = array_fill(0, 4, '%' . $search . '%');
            }
            $whereSql = $where ? 'WHERE ' . implode(' AND ', $where) : '';
            $items = dbExec("SELECT tb.*,
                    COALESCE(outstanding.qty,0) AS dang_muon,
                    GREATEST(0, tb.so_luong-tb.so_luong_hong-COALESCE(outstanding.qty,0)) AS so_luong_trong
                FROM thiet_bi tb
                LEFT JOIN (
                    SELECT ct.thiet_bi_id, SUM(ct.so_luong) AS qty
                    FROM chi_tiet_muon ct INNER JOIN phieu_muon pm ON pm.id = ct.phieu_muon_id
                    WHERE (pm.trang_thai='da_duyet' AND CURDATE() BETWEEN pm.ngay_muon AND pm.ngay_hen_tra)
                       OR pm.trang_thai IN ('dang_muon','cho_tra') GROUP BY ct.thiet_bi_id
                ) outstanding ON outstanding.thiet_bi_id = tb.id
                $whereSql ORDER BY tb.hoat_dong DESC, tb.id DESC", $args)->fetchAll();
            jsonResponse(['success' => true, 'items' => $items]);

        case 'availability_check':
            authorize();
            $start = sqlDate((string) ($_GET['start'] ?? ''), 'Ngày mượn');
            $due = sqlDate((string) ($_GET['due'] ?? ''), 'Ngày hẹn trả');
            if ($start < date('Y-m-d')) fail('Ngày mượn không được ở quá khứ.');
            if ($due < $start) fail('Ngày trả phải từ ngày mượn trở đi.');
            if ((new DateTimeImmutable($start))->diff(new DateTimeImmutable($due))->days > 60)
                fail('Thời hạn mượn tối đa là 60 ngày.');
            $idsText = (string) ($_GET['ids'] ?? '');
            if (!preg_match('/^[0-9]+(?:,[0-9]+){0,99}$/', $idsText)) fail('Danh sách thiết bị không hợp lệ.');
            $ids = array_map('intval', explode(',', $idsText));
            if (count(array_unique($ids)) !== count($ids) || min($ids) < 1) fail('Danh sách ID thiết bị bị trùng hoặc không hợp lệ.');
            $results = [];
            foreach ($ids as $deviceId) $results[] = availabilityForPeriod($deviceId, $start, $due);
            jsonResponse(['success' => true, 'start' => $start, 'due' => $due, 'items' => $results]);

        case 'availability_calendar':
            authorize();
            $deviceId = positiveInt($_GET['device_id'] ?? null, 'ID thiết bị');
            $month = (string) ($_GET['month'] ?? '');
            if (!preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $month)) fail('Tháng không hợp lệ.');
            $start = $month . '-01';
            $due = (new DateTimeImmutable($start))->format('Y-m-t');
            $device = dbExec('SELECT id, ma_thiet_bi, ten_thiet_bi, so_luong, so_luong_hong, tinh_trang, hoat_dong FROM thiet_bi WHERE id=?', [$deviceId])->fetch();
            if (!$device || (!(int) $device['hoat_dong'] && account()['role'] !== 'admin')) fail('Không tìm thấy thiết bị.', 404);
            $capacity = max(0, (int) $device['so_luong'] - (int) $device['so_luong_hong']);
            $rows = reservationRows($deviceId, $start, $due);
            $days = [];
            for ($date = new DateTimeImmutable($start); $date->format('Y-m-d') <= $due; $date = $date->modify('+1 day')) {
                $day = $date->format('Y-m-d');
                $reserved = reservationPeak($rows, $day, $day);
                $available = ((int) $device['hoat_dong'] && $device['tinh_trang'] === 'tot')
                    ? max(0, $capacity - $reserved) : 0;
                $days[] = ['date' => $day, 'reserved' => $reserved, 'available' => $available];
            }
            jsonResponse(['success' => true, 'device' => $device, 'capacity' => $capacity,
                'month' => $month, 'days' => $days]);

        case 'equipment_save':
            authorize('admin');
            $id = isset($data['id']) && $data['id'] !== '' ? positiveInt($data['id'], 'ID thiết bị') : null;
            $code = strtoupper(strField($data, 'code', 30, false));
            $name = strField($data, 'name', 160);
            $category = strField($data, 'category', 100);
            $description = strField($data, 'description', 2000, false);
            $condition = strField($data, 'condition', 20);
            if (!in_array($condition, ['tot', 'bao_tri', 'hong'], true)) fail('Tình trạng thiết bị không hợp lệ.');
            $quantity = positiveInt($data['quantity'] ?? null, 'Tổng số lượng', true);
            $damaged = positiveInt($data['damaged'] ?? null, 'Số lượng hỏng', true);
            if ($quantity > 1000000 || $damaged > $quantity) fail('Số lượng hỏng không được vượt quá tổng số lượng.');
            $savedCode = $code;
            try {
                withTransaction(function () use ($id, $code, $name, $category, $description, $condition, $quantity, $damaged, &$savedCode): void {
                    if ($id !== null) {
                        $row = dbExec('SELECT id, ma_thiet_bi FROM thiet_bi WHERE id = ? FOR UPDATE', [$id])->fetch();
                        if (!$row) fail('Thiết bị không tồn tại.', 404);
                        $savedCode = $code !== '' ? $code : $row['ma_thiet_bi'];
                        $duplicate = dbExec('SELECT id FROM thiet_bi WHERE ma_thiet_bi = ? AND id <> ? LIMIT 1', [$savedCode, $id])->fetch();
                        if ($duplicate) fail("Mã thiết bị {$savedCode} đã tồn tại. Hãy nhập mã khác.", 409);
                        $outstanding = $quantity - $damaged;
                        $reservedPeak = maximumReserved($id);
                        if ($outstanding < $reservedPeak) {
                            fail('Số lượng sau khi sửa không đủ cho các phiếu đã được duyệt.');
                        }
                        dbExec('UPDATE thiet_bi SET ma_thiet_bi=?, ten_thiet_bi=?, loai=?, mo_ta=?,
                            tinh_trang=?, so_luong=?, so_luong_hong=? WHERE id=?',
                            [$savedCode, $name, $category, $description, $condition, $quantity, $damaged, $id]);
                    } elseif ($code !== '') {
                        $duplicate = dbExec('SELECT id FROM thiet_bi WHERE ma_thiet_bi = ? LIMIT 1', [$code])->fetch();
                        if ($duplicate) fail("Mã thiết bị {$code} đã tồn tại (kể cả thiết bị đã ẩn). Hãy dùng mã khác hoặc bỏ trống để tự tạo.", 409);
                        dbExec('INSERT INTO thiet_bi (ma_thiet_bi, ten_thiet_bi, loai, mo_ta, tinh_trang, so_luong, so_luong_hong)
                            VALUES (?,?,?,?,?,?,?)', [$code, $name, $category, $description, $condition, $quantity, $damaged]);
                    } else {
                        $temporaryCode = 'AUTO-' . strtoupper(bin2hex(random_bytes(10)));
                        dbExec('INSERT INTO thiet_bi (ma_thiet_bi, ten_thiet_bi, loai, mo_ta, tinh_trang, so_luong, so_luong_hong)
                            VALUES (?,?,?,?,?,?,?)', [$temporaryCode, $name, $category, $description, $condition, $quantity, $damaged]);
                        $newId = (int) db()->lastInsertId();
                        $candidate = 'TB' . str_pad((string) $newId, 3, '0', STR_PAD_LEFT);
                        if (dbExec('SELECT id FROM thiet_bi WHERE ma_thiet_bi = ? AND id <> ? LIMIT 1', [$candidate, $newId])->fetch()) {
                            $candidate = 'TB' . $newId . '-' . strtoupper(bin2hex(random_bytes(4)));
                        }
                        dbExec('UPDATE thiet_bi SET ma_thiet_bi = ? WHERE id = ?', [$candidate, $newId]);
                        $savedCode = $candidate;
                    }
                });
            } catch (PDOException $e) {
                if ((int) ($e->errorInfo[1] ?? 0) === 1062) {
                    fail('Mã thiết bị đã tồn tại. Hãy nhập mã khác hoặc để trống để hệ thống tự tạo mã.', 409);
                }
                throw $e;
            }
            jsonResponse([
                'success' => true,
                'message' => $id ? 'Đã cập nhật thiết bị.' : "Đã thêm thiết bị mới (mã {$savedCode}).",
                'code' => $savedCode,
            ]);

        case 'equipment_toggle':
            authorize('admin');
            $id = positiveInt($data['id'] ?? null, 'ID thiết bị');
            $active = $data['active'] ?? null;
            if (!is_bool($active)) fail('Trạng thái hoạt động không hợp lệ.');
            withTransaction(function () use ($id, $active): void {
                if (!dbExec('SELECT id FROM thiet_bi WHERE id=? FOR UPDATE', [$id])->fetch()) fail('Không tìm thấy thiết bị.', 404);
                dbExec('UPDATE thiet_bi SET hoat_dong=? WHERE id=?', [$active ? 1 : 0, $id]);
            });
            jsonResponse(['success' => true, 'message' => $active ? 'Đã khôi phục thiết bị.' : 'Đã xóa (ẩn) thiết bị. Có thể khôi phục bằng bộ lọc thiết bị đã ẩn.']);

        case 'borrower_list':
            authorize('admin');
            $rows = db()->query("SELECT nm.id, nm.ho_ten, nm.don_vi, nm.sdt, nm.hoat_dong,
                tk.email, tk.id AS account_id, tk.tao_luc,
                (SELECT COUNT(*) FROM phieu_muon pm WHERE pm.nguoi_muon_id=nm.id) AS so_phieu
                FROM nguoi_muon nm LEFT JOIN tai_khoan tk ON tk.nguoi_muon_id=nm.id
                ORDER BY nm.hoat_dong DESC, nm.id DESC")->fetchAll();
            jsonResponse(['success' => true, 'items' => $rows]);

        case 'borrower_save':
            authorize('admin');
            $id = isset($data['id']) && $data['id'] !== '' ? positiveInt($data['id'], 'ID người mượn') : null;
            $name = strField($data, 'name', 120);
            $department = strField($data, 'department', 160);
            $phone = strField($data, 'phone', 20);
            $email = strtolower(strField($data, 'email', 190));
            $password = strField($data, 'password', 200, false);
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail('Email không hợp lệ.');
            if (!preg_match('/^[0-9+().\s-]{9,20}$/', $phone)) fail('Số điện thoại không hợp lệ.');
            if (($id === null || $password !== '') && strlen($password) < 8) fail('Mật khẩu phải có ít nhất 8 ký tự.');
            withTransaction(function () use ($id, $name, $department, $phone, $email, $password): void {
                if ($id !== null) {
                    if (!dbExec('SELECT id FROM nguoi_muon WHERE id=? FOR UPDATE', [$id])->fetch()) fail('Người mượn không tồn tại.', 404);
                    dbExec('UPDATE nguoi_muon SET ho_ten=?, don_vi=?, sdt=? WHERE id=?', [$name, $department, $phone, $id]);
                    $account = dbExec('SELECT id FROM tai_khoan WHERE nguoi_muon_id=?', [$id])->fetch();
                    if (!$account) fail('Người mượn chưa có tài khoản liên kết.');
                    dbExec('UPDATE tai_khoan SET email=?, ten_hien_thi=? WHERE id=?', [$email, $name, $account['id']]);
                    if ($password !== '') {
                        dbExec('UPDATE tai_khoan SET mat_khau=? WHERE id=?', [password_hash($password, PASSWORD_DEFAULT), $account['id']]);
                    }
                } else {
                    dbExec('INSERT INTO nguoi_muon (ho_ten, don_vi, sdt) VALUES (?,?,?)', [$name, $department, $phone]);
                    $newId = (int) db()->lastInsertId();
                    dbExec("INSERT INTO tai_khoan (nguoi_muon_id, email, mat_khau, ten_hien_thi, vai_tro)
                        VALUES (?,?,?,?,'user')", [$newId, $email, password_hash($password, PASSWORD_DEFAULT), $name]);
                }
            });
            jsonResponse(['success' => true, 'message' => $id ? 'Đã cập nhật người mượn.' : 'Đã tạo tài khoản người mượn.']);

        case 'borrower_toggle':
            authorize('admin');
            $id = positiveInt($data['id'] ?? null, 'ID người mượn');
            $active = $data['active'] ?? null;
            if (!is_bool($active)) fail('Trạng thái hoạt động không hợp lệ.');
            withTransaction(function () use ($id, $active): void {
                if (!dbExec('SELECT id FROM nguoi_muon WHERE id=? FOR UPDATE', [$id])->fetch()) fail('Không tìm thấy người mượn.', 404);
                if (!$active) {
                    $count = dbExec("SELECT COUNT(*) FROM phieu_muon
                        WHERE nguoi_muon_id=? AND trang_thai IN ('cho_duyet','da_duyet','dang_muon','cho_tra')", [$id])->fetchColumn();
                    if ((int) $count > 0) fail('Người mượn đang có phiếu chưa hoàn tất, không thể khóa.');
                }
                dbExec('UPDATE nguoi_muon SET hoat_dong=? WHERE id=?', [$active ? 1 : 0, $id]);
                dbExec('UPDATE tai_khoan SET hoat_dong=? WHERE nguoi_muon_id=?', [$active ? 1 : 0, $id]);
            });
            jsonResponse(['success' => true, 'message' => $active ? 'Đã mở lại tài khoản.' : 'Đã vô hiệu hóa người mượn.']);

        case 'profile_update':
            $user = authorize('user');
            $name = strField($data, 'name', 120);
            $department = strField($data, 'department', 160);
            $phone = strField($data, 'phone', 20);
            if (!preg_match('/^[0-9+().\s-]{9,20}$/', $phone)) fail('Số điện thoại không hợp lệ.');
            dbExec('UPDATE nguoi_muon SET ho_ten=?, don_vi=?, sdt=? WHERE id=?', [$name, $department, $phone, $user['borrower_id']]);
            dbExec('UPDATE tai_khoan SET ten_hien_thi=? WHERE id=?', [$name, $user['id']]);
            jsonResponse(['success' => true, 'message' => 'Đã cập nhật thông tin cá nhân.', 'user' => account()]);

        case 'loan_list':
            $user = authorize();
            $sql = "SELECT pm.id, pm.nguoi_muon_id, pm.ngay_muon, pm.ngay_hen_tra, pm.ngay_tra,
                pm.trang_thai, pm.ghi_chu, pm.ly_do_tu_choi, pm.tao_luc,
                nm.ho_ten, nm.don_vi, nm.sdt,
                (pm.trang_thai IN ('dang_muon','cho_tra') AND pm.ngay_hen_tra < CURDATE()) AS qua_han
                FROM phieu_muon pm JOIN nguoi_muon nm ON nm.id=pm.nguoi_muon_id";
            $args = [];
            if ($user['role'] !== 'admin') {
                $sql .= ' WHERE pm.nguoi_muon_id=?';
                $args[] = $user['borrower_id'];
            }
            $sql .= ' ORDER BY pm.id DESC LIMIT 500';
            $tickets = dbExec($sql, $args)->fetchAll();
            if ($tickets) {
                $ids = array_map(static fn($row) => (int) $row['id'], $tickets);
                $placeholders = implode(',', array_fill(0, count($ids), '?'));
                $details = dbExec("SELECT ct.phieu_muon_id, ct.thiet_bi_id, ct.so_luong, ct.so_luong_hong,
                        tb.ma_thiet_bi, tb.ten_thiet_bi
                    FROM chi_tiet_muon ct JOIN thiet_bi tb ON tb.id=ct.thiet_bi_id
                    WHERE ct.phieu_muon_id IN ($placeholders) ORDER BY tb.ten_thiet_bi", $ids)->fetchAll();
                $byTicket = [];
                foreach ($details as $detail) $byTicket[(int) $detail['phieu_muon_id']][] = $detail;
                foreach ($tickets as &$t) $t['items'] = $byTicket[(int) $t['id']] ?? [];
                unset($t);
            }
            jsonResponse(['success' => true, 'items' => $tickets]);

        case 'loan_create':
            $user = authorize('user');
            $start = sqlDate(strField($data, 'start', 10), 'Ngày mượn');
            $due = sqlDate(strField($data, 'due', 10), 'Ngày hẹn trả');
            if ($start < date('Y-m-d')) fail('Ngày mượn không được ở quá khứ.');
            if ($due < $start) fail('Ngày hẹn trả phải từ ngày mượn trở đi.');
            if ((new DateTimeImmutable($start))->diff(new DateTimeImmutable($due))->days > 60) {
                fail('Thời hạn mượn tối đa là 60 ngày.');
            }
            $note = strField($data, 'note', 500, false);
            $items = $data['items'] ?? null;
            if (!is_array($items) || !$items || count($items) > 20) fail('Chọn từ 1 đến 20 loại thiết bị.');
            $quantities = [];
            foreach ($items as $item) {
                if (!is_array($item)) fail('Danh sách thiết bị không hợp lệ.');
                $id = positiveInt($item['id'] ?? null, 'ID thiết bị');
                $qty = positiveInt($item['quantity'] ?? null, 'Số lượng mượn');
                if ($qty > 10000 || isset($quantities[$id])) fail('Thiết bị trùng hoặc số lượng vượt giới hạn.');
                $quantities[$id] = $qty;
            }
            withTransaction(function () use ($user, $start, $due, $note, $quantities): void {
                $deviceIds = array_keys($quantities);
                sort($deviceIds, SORT_NUMERIC);
                foreach ($deviceIds as $deviceId) {
                    $locked = dbExec('SELECT id FROM thiet_bi WHERE id=? FOR UPDATE', [$deviceId])->fetch();
                    if (!$locked) fail('Thiết bị không tồn tại.', 404);
                }
                foreach ($deviceIds as $deviceId) {
                    $availability = availabilityForPeriod($deviceId, $start, $due);
                    if ($quantities[$deviceId] > $availability['available']) {
                        fail('Thiết bị ' . $availability['name'] . ' chỉ còn ' . $availability['available'] .
                            ' trong khoảng ' . $start . ' đến ' . $due . '. Vui lòng đổi lịch hoặc số lượng.', 409);
                    }
                }
                dbExec("INSERT INTO phieu_muon (nguoi_muon_id, ngay_muon, ngay_hen_tra, ghi_chu)
                    VALUES (?,?,?,?)", [$user['borrower_id'], $start, $due, $note]);
                $ticketId = (int) db()->lastInsertId();
                foreach ($quantities as $id => $quantity) {
                    dbExec('INSERT INTO chi_tiet_muon (phieu_muon_id,thiet_bi_id,so_luong)
                        VALUES (?,?,?)', [$ticketId, $id, $quantity]);
                }
                notificationToAdmins('new_loan', 'Có phiếu mượn mới #PM' . str_pad((string) $ticketId, 4, '0', STR_PAD_LEFT),
                    $user['name'] . ' vừa gửi yêu cầu mượn thiết bị, cần Admin xem xét.', $ticketId);
            });
            jsonResponse(['success' => true, 'message' => 'Đã gửi phiếu đăng ký mượn. Vui lòng chờ Admin duyệt.'], 201);

        case 'loan_approve':
            authorize('admin');
            $id = positiveInt($data['id'] ?? null, 'Mã phiếu');
            withTransaction(function () use ($id): void {
                $record = ticket($id, true);
                if ($record['trang_thai'] !== 'cho_duyet') fail('Chỉ được duyệt phiếu đang chờ.');
                if ($record['ngay_hen_tra'] < date('Y-m-d')) fail('Phiếu đã quá ngày hẹn trả, không thể duyệt.');
                $items = dbExec('SELECT * FROM chi_tiet_muon WHERE phieu_muon_id=? ORDER BY thiet_bi_id FOR UPDATE', [$id])->fetchAll();
                if (!$items) fail('Phiếu mượn không có thiết bị.');
                foreach ($items as $item) {
                    $device = dbExec('SELECT id, hoat_dong, tinh_trang FROM thiet_bi WHERE id=? FOR UPDATE', [$item['thiet_bi_id']])->fetch();
                    if (!$device || !(int) $device['hoat_dong'] || $device['tinh_trang'] !== 'tot') {
                        fail('Có thiết bị đã ngừng hoạt động hoặc đang bảo trì/hỏng.');
                    }
                }
                foreach ($items as $item) {
                    $availability = availabilityForPeriod((int) $item['thiet_bi_id'],
                        max($record['ngay_muon'], date('Y-m-d')), $record['ngay_hen_tra']);
                    if ($availability['available'] < (int) $item['so_luong']) {
                        fail('Trùng lịch hoặc thiếu số lượng thiết bị ' . $availability['name'] .
                            ' (chỉ còn ' . $availability['available'] . ' trong khoảng đã chọn).', 409);
                    }
                }
                $nextStatus = $record['ngay_muon'] <= date('Y-m-d') ? 'dang_muon' : 'da_duyet';
                dbExec('UPDATE phieu_muon SET trang_thai=? WHERE id=?', [$nextStatus, $id]);
                notificationToBorrower((int) $record['nguoi_muon_id'], 'approved',
                    'Phiếu #PM' . str_pad((string) $id, 4, '0', STR_PAD_LEFT) . ' đã được duyệt',
                    $nextStatus === 'da_duyet'
                        ? 'Yêu cầu đã được chấp thuận. Phiếu sẽ chuyển sang Đang mượn từ ngày ' . date('d/m/Y', strtotime($record['ngay_muon'])) . '.'
                        : 'Yêu cầu đã được chấp thuận và đang ở trạng thái Đang mượn.', $id);
            });
            jsonResponse(['success' => true, 'message' => 'Duyệt thành công. Thiết bị đã được giữ theo lịch mượn; đến ngày mượn sẽ tự chuyển sang Đang mượn.']);

        case 'loan_reject':
            authorize('admin');
            $id = positiveInt($data['id'] ?? null, 'Mã phiếu');
            $reason = strField($data, 'reason', 500);
            withTransaction(function () use ($id, $reason): void {
                if (ticket($id, true)['trang_thai'] !== 'cho_duyet') fail('Chỉ được từ chối phiếu đang chờ.');
                $record = ticket($id, true);
                dbExec("UPDATE phieu_muon SET trang_thai='tu_choi', ly_do_tu_choi=? WHERE id=?", [$reason, $id]);
                notificationToBorrower((int) $record['nguoi_muon_id'], 'rejected',
                    'Phiếu #PM' . str_pad((string) $id, 4, '0', STR_PAD_LEFT) . ' bị từ chối',
                    'Lý do: ' . $reason, $id);
            });
            jsonResponse(['success' => true, 'message' => 'Đã từ chối phiếu mượn.']);

        case 'loan_cancel':
            $user = authorize('user');
            $id = positiveInt($data['id'] ?? null, 'Mã phiếu');
            withTransaction(function () use ($id, $user): void {
                $record = ticket($id, true);
                if ((int) $record['nguoi_muon_id'] !== $user['borrower_id']) fail('Bạn không có quyền sửa phiếu này.', 403);
                if ($record['trang_thai'] !== 'cho_duyet') fail('Chỉ được hủy phiếu đang chờ duyệt.');
                dbExec("UPDATE phieu_muon SET trang_thai='da_huy' WHERE id=?", [$id]);
                notificationToAdmins('cancelled', 'Phiếu #PM' . str_pad((string) $id, 4, '0', STR_PAD_LEFT) . ' đã hủy',
                    $user['name'] . ' vừa hủy yêu cầu mượn thiết bị.', $id);
            });
            jsonResponse(['success' => true, 'message' => 'Đã hủy phiếu mượn.']);

        case 'loan_request_return':
            $user = authorize('user');
            $id = positiveInt($data['id'] ?? null, 'Mã phiếu');
            withTransaction(function () use ($id, $user): void {
                $record = ticket($id, true);
                if ((int) $record['nguoi_muon_id'] !== $user['borrower_id']) fail('Bạn không có quyền sửa phiếu này.', 403);
                if ($record['trang_thai'] !== 'dang_muon') fail('Chỉ được đề nghị trả khi phiếu ở trạng thái Đang mượn.');
                dbExec("UPDATE phieu_muon SET trang_thai='cho_tra' WHERE id=?", [$id]);
                notificationToAdmins('return_request', 'Có đề nghị trả phiếu #PM' . str_pad((string) $id, 4, '0', STR_PAD_LEFT),
                    $user['name'] . ' đã gửi đề nghị trả. Vui lòng kiểm tra thiết bị và xác nhận.', $id);
            });
            jsonResponse(['success' => true, 'message' => 'Đã gửi đề nghị trả. Hãy bàn giao thiết bị để Admin xác nhận.']);

        case 'loan_return':
            authorize('admin');
            $id = positiveInt($data['id'] ?? null, 'Mã phiếu');
            $badItems = $data['damages'] ?? null;
            if (!is_array($badItems)) fail('Danh sách hư hỏng không hợp lệ.');
            withTransaction(function () use ($id, $badItems): void {
                $record = ticket($id, true);
                if (!in_array($record['trang_thai'], ['dang_muon', 'cho_tra'], true)) fail('Chỉ được xác nhận trả cho phiếu Đang mượn hoặc Chờ xác nhận trả.');
                $items = dbExec('SELECT * FROM chi_tiet_muon WHERE phieu_muon_id=? ORDER BY thiet_bi_id FOR UPDATE', [$id])->fetchAll();
                $validIds = [];
                foreach ($items as $item) {
                    $deviceId = (int) $item['thiet_bi_id'];
                    $validIds[(string) $deviceId] = true;
                    if (!dbExec('SELECT id FROM thiet_bi WHERE id=? FOR UPDATE', [$deviceId])->fetch()) {
                        fail('Không tìm thấy thiết bị trong phiếu.');
                    }
                }
                foreach ($badItems as $key => $ignored) {
                    if (!isset($validIds[(string) $key])) fail('Danh sách thiết bị hư hỏng không khớp phiếu.');
                }
                foreach ($items as $item) {
                    $deviceId = (int) $item['thiet_bi_id'];
                    $bad = positiveInt($badItems[(string) $deviceId] ?? 0, 'Số lượng hỏng', true);
                    if ($bad > (int) $item['so_luong']) fail('Số lượng hỏng vượt số lượng đã mượn.');
                    dbExec('UPDATE chi_tiet_muon SET so_luong_hong=? WHERE phieu_muon_id=? AND thiet_bi_id=?',
                        [$bad, $id, $deviceId]);
                    dbExec('UPDATE thiet_bi SET so_luong_hong=so_luong_hong+? WHERE id=?', [$bad, $deviceId]);
                }
                dbExec("UPDATE phieu_muon SET trang_thai='da_tra', ngay_tra=CURDATE() WHERE id=?", [$id]);
                notificationToBorrower((int) $record['nguoi_muon_id'], 'returned',
                    'Phiếu #PM' . str_pad((string) $id, 4, '0', STR_PAD_LEFT) . ' đã hoàn tất',
                    'Admin đã xác nhận trả thiết bị. Cảm ơn bạn đã sử dụng LabTrack!', $id);
            });
            jsonResponse(['success' => true, 'message' => 'Đã ghi nhận trả thiết bị và cập nhật số lượng hỏng.']);
    }
} catch (ApiError $e) {
    jsonResponse(['success' => false, 'message' => $e->getMessage()], $e->status);
} catch (PDOException $e) {
    error_log('[CT428] DB: ' . $e->getMessage());
    $code = (string) $e->getCode();
    $message = $code === '23000' ? 'Mã thiết bị hoặc email đã tồn tại. Vui lòng dùng giá trị khác.' : 'Lỗi cơ sở dữ liệu. Kiểm tra log PHP/Apache trên XAMPP.';
    jsonResponse(['success' => false, 'message' => $message], $code === '23000' ? 409 : 500);
} catch (Throwable $e) {
    error_log('[CT428] ' . $e->getMessage());
    jsonResponse(['success' => false, 'message' => 'Có lỗi máy chủ xảy ra. Vui lòng thử lại.'], 500);
}

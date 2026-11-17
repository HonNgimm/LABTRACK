<?php
declare(strict_types=1);

$config = require __DIR__ . '/config.php';
date_default_timezone_set($config['timezone']);

if (session_status() !== PHP_SESSION_ACTIVE) {
    $isSecure = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
    session_name('CT428_SESSION');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => $isSecure,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}
if (!isset($_SESSION['csrf'])) {
    $_SESSION['csrf'] = bin2hex(random_bytes(32));
}

function db(): PDO
{
    static $instance = null;
    if ($instance instanceof PDO) return $instance;
    $cfg = require __DIR__ . '/config.php';
    $dsn = sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
        $cfg['db_host'], $cfg['db_port'], $cfg['db_name']);
    $instance = new PDO($dsn, $cfg['db_user'], $cfg['db_pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    $instance->exec("SET time_zone = '+07:00'");
    return $instance;
}

final class ApiError extends RuntimeException
{
    public function __construct(string $message, public int $status = 400)
    {
        parent::__construct($message);
    }
}

function fail(string $message, int $status = 400): never
{
    throw new ApiError($message, $status);
}

function jsonResponse(array $data, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    exit;
}

function body(): array
{
    $raw = file_get_contents('php://input', false, null, 0, 1024 * 1024 + 1);
    if ($raw === false || strlen($raw) > 1024 * 1024) fail('Dữ liệu gửi lên quá lớn.', 413);
    $json = json_decode($raw, true);
    if (!is_array($json) || json_last_error() !== JSON_ERROR_NONE) fail('Dữ liệu JSON không hợp lệ.');
    return $json;
}

function strField(array $data, string $key, int $limit = 255, bool $required = true): string
{
    $value = $data[$key] ?? '';
    if (!is_string($value)) fail("Trường {$key} phải là chuỗi.");
    $value = trim($value);
    if ($required && $value === '') fail("Vui lòng nhập {$key}.");
    $length = function_exists('mb_strlen') ? mb_strlen($value, 'UTF-8') : strlen($value);
    if ($length > $limit) fail("{$key} vượt quá {$limit} ký tự.");
    return $value;
}

function positiveInt(mixed $value, string $label, bool $allowZero = false): int
{
    if (!(is_int($value) || (is_string($value) && ctype_digit($value)))) fail("{$label} phải là số nguyên.");
    $number = filter_var($value, FILTER_VALIDATE_INT, ['options' => ['min_range' => $allowZero ? 0 : 1]]);
    if ($number === false) fail("{$label} không hợp lệ.");
    return $number;
}

function account(): ?array
{
    if (empty($_SESSION['user_id'])) return null;
    $stmt = db()->prepare('SELECT tk.id, tk.nguoi_muon_id, tk.email, tk.ten_hien_thi, tk.vai_tro,
             tk.hoat_dong, nm.ho_ten, nm.don_vi, nm.sdt, nm.hoat_dong AS nm_active
        FROM tai_khoan tk LEFT JOIN nguoi_muon nm ON nm.id = tk.nguoi_muon_id
        WHERE tk.id = ? LIMIT 1');
    $stmt->execute([$_SESSION['user_id']]);
    $user = $stmt->fetch();
    if (!$user || !(int) $user['hoat_dong'] ||
        ($user['vai_tro'] === 'user' && (!(int) $user['nm_active'] || !$user['nguoi_muon_id']))) {
        unset($_SESSION['user_id']);
        return null;
    }
    return [
        'id' => (int) $user['id'], 'borrower_id' => $user['nguoi_muon_id'] !== null ? (int) $user['nguoi_muon_id'] : null,
        'name' => $user['ho_ten'] ?: $user['ten_hien_thi'], 'email' => $user['email'],
        'role' => $user['vai_tro'], 'department' => $user['don_vi'] ?? '', 'phone' => $user['sdt'] ?? '',
    ];
}

function authorize(string $role = ''): array
{
    $user = account();
    if (!$user) fail('Bạn cần đăng nhập để tiếp tục.', 401);
    if ($role !== '' && $user['role'] !== $role) fail('Bạn không có quyền thực hiện chức năng này.', 403);
    return $user;
}

function csrfCheck(): void
{
    $header = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!is_string($header) || !hash_equals($_SESSION['csrf'] ?? '', $header)) {
        fail('Phiên bảo mật đã hết hạn. Vui lòng tải lại trang.', 419);
    }
}

function dbExec(string $sql, array $args = []): PDOStatement
{
    $stmt = db()->prepare($sql);
    $stmt->execute($args);
    return $stmt;
}

function sqlDate(string $value, string $label): string
{
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
    if (!$date || $date->format('Y-m-d') !== $value) fail("{$label} không hợp lệ.");
    return $value;
}

function ticket(int $id, bool $lock = false): array
{
    $sql = 'SELECT * FROM phieu_muon WHERE id = ?' . ($lock ? ' FOR UPDATE' : '');
    $row = dbExec($sql, [$id])->fetch();
    if (!$row) fail('Phiếu mượn không tồn tại.', 404);
    return $row;
}

function withTransaction(callable $job): mixed
{
    $pdo = db();
    $pdo->beginTransaction();
    try {
        $result = $job();
        $pdo->commit();
        return $result;
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
}

function syncApprovedLoans(?string $today = null): int
{
    $today = $today ?? date('Y-m-d');
    $upcoming = dbExec("SELECT id, nguoi_muon_id FROM phieu_muon
        WHERE trang_thai='da_duyet' AND ngay_muon <= ?", [$today])->fetchAll();
    $stmt = dbExec("UPDATE phieu_muon SET trang_thai='dang_muon'
        WHERE trang_thai='da_duyet' AND ngay_muon <= ?", [$today]);
    foreach ($upcoming as $loan) {
        $id = (int) $loan['id'];
        $code = '#PM' . str_pad((string) $id, 4, '0', STR_PAD_LEFT);
        notificationToBorrower((int) $loan['nguoi_muon_id'], 'started',
            "Phiếu {$code} đã đến ngày mượn",
            'Phiếu đã chuyển sang Đang mượn theo lịch. Vui lòng liên hệ cán bộ để nhận thiết bị nếu chưa bàn giao.',
            $id, "loan:{$id}:started");
    }
    return $stmt->rowCount();
}

function reservationRows(int $deviceId, string $start, string $due): array
{
    return dbExec("SELECT pm.ngay_muon, pm.ngay_hen_tra, pm.trang_thai, ct.so_luong
        FROM chi_tiet_muon ct JOIN phieu_muon pm ON pm.id=ct.phieu_muon_id
        WHERE ct.thiet_bi_id=? AND pm.ngay_muon <= ?
        AND ((pm.trang_thai='da_duyet' AND pm.ngay_hen_tra >= ?)
             OR pm.trang_thai IN ('dang_muon','cho_tra'))",
        [$deviceId, $due, $start])->fetchAll();
}

function reservationPeak(array $rows, string $start, string $due): int
{
    $events = [];
    foreach ($rows as $row) {
        $from = max($start, $row['ngay_muon']);
        $to = in_array($row['trang_thai'], ['dang_muon', 'cho_tra'], true)
            ? $due : min($due, $row['ngay_hen_tra']);
        if ($from > $to) continue;
        $qty = (int) $row['so_luong'];
        $events[$from] = ($events[$from] ?? 0) + $qty;
        $after = (new DateTimeImmutable($to))->modify('+1 day')->format('Y-m-d');
        $events[$after] = ($events[$after] ?? 0) - $qty;
    }
    ksort($events);
    $current = 0;
    $peak = 0;
    foreach ($events as $change) {
        $current += $change;
        $peak = max($peak, $current);
    }
    return $peak;
}

function availabilityForPeriod(int $deviceId, string $start, string $due): array
{
    $device = dbExec('SELECT id, ten_thiet_bi, so_luong, so_luong_hong, tinh_trang, hoat_dong
        FROM thiet_bi WHERE id=?', [$deviceId])->fetch();
    if (!$device) fail('Không tìm thấy thiết bị #' . $deviceId . '.', 404);
    $capacity = max(0, (int) $device['so_luong'] - (int) $device['so_luong_hong']);
    $peak = reservationPeak(reservationRows($deviceId, $start, $due), $start, $due);
    $available = max(0, $capacity - $peak);
    if (!(int) $device['hoat_dong'] || $device['tinh_trang'] !== 'tot') $available = 0;
    return ['id' => (int) $device['id'], 'name' => $device['ten_thiet_bi'],
        'capacity' => $capacity, 'reserved_peak' => $peak, 'available' => $available,
        'active' => (bool) ((int) $device['hoat_dong'] && $device['tinh_trang'] === 'tot')];
}

function maximumReserved(int $deviceId): int
{
    $rows = dbExec("SELECT pm.ngay_muon, pm.ngay_hen_tra, pm.trang_thai, ct.so_luong
        FROM chi_tiet_muon ct JOIN phieu_muon pm ON pm.id=ct.phieu_muon_id
        WHERE ct.thiet_bi_id=? AND pm.trang_thai IN ('da_duyet','dang_muon','cho_tra')",
        [$deviceId])->fetchAll();
    if (!$rows) return 0;
    return reservationPeak($rows, '1000-01-01', '9998-12-31');
}

function availableOf(int $deviceId): int
{
    $today = date('Y-m-d');
    return availabilityForPeriod($deviceId, $today, $today)['available'];
}

require_once __DIR__ . '/notifications.php';

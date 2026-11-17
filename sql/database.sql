CREATE DATABASE IF NOT EXISTS quan_ly_muon_thiet_bi
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE quan_ly_muon_thiet_bi;

CREATE TABLE IF NOT EXISTS nguoi_muon (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    ho_ten VARCHAR(120) NOT NULL,
    don_vi VARCHAR(160) NOT NULL,
    sdt VARCHAR(20) NOT NULL,
    hoat_dong TINYINT(1) NOT NULL DEFAULT 1,
    tao_luc TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_nguoi_muon_ten (ho_ten)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS tai_khoan (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    nguoi_muon_id BIGINT UNSIGNED NULL,
    email VARCHAR(190) NOT NULL,
    mat_khau VARCHAR(255) NOT NULL,
    ten_hien_thi VARCHAR(120) NOT NULL,
    vai_tro ENUM('admin','user') NOT NULL DEFAULT 'user',
    hoat_dong TINYINT(1) NOT NULL DEFAULT 1,
    tao_luc TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_email (email),
    UNIQUE KEY uq_tai_khoan_nguoi_muon (nguoi_muon_id),
    CONSTRAINT fk_tai_khoan_nguoi_muon FOREIGN KEY (nguoi_muon_id)
        REFERENCES nguoi_muon(id) ON DELETE RESTRICT,
    INDEX idx_vai_tro (vai_tro)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS thiet_bi (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    ma_thiet_bi VARCHAR(30) NOT NULL,
    ten_thiet_bi VARCHAR(160) NOT NULL,
    loai VARCHAR(100) NOT NULL,
    mo_ta TEXT NULL,
    tinh_trang ENUM('tot','bao_tri','hong') NOT NULL DEFAULT 'tot',
    so_luong INT UNSIGNED NOT NULL DEFAULT 0,
    so_luong_hong INT UNSIGNED NOT NULL DEFAULT 0,
    hoat_dong TINYINT(1) NOT NULL DEFAULT 1,
    tao_luc TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_ma_thiet_bi (ma_thiet_bi),
    INDEX idx_thiet_bi_loai (loai),
    INDEX idx_thiet_bi_tinh_trang (tinh_trang)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS phieu_muon (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    nguoi_muon_id BIGINT UNSIGNED NOT NULL,
    ngay_muon DATE NOT NULL,
    ngay_hen_tra DATE NOT NULL,
    ngay_tra DATE NULL,
    trang_thai ENUM('cho_duyet','da_duyet','dang_muon','cho_tra','da_tra','tu_choi','da_huy') NOT NULL DEFAULT 'cho_duyet',
    ghi_chu VARCHAR(500) NOT NULL DEFAULT '',
    ly_do_tu_choi VARCHAR(500) NULL,
    tao_luc TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    cap_nhat_luc TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_phieu_nguoi_muon FOREIGN KEY (nguoi_muon_id)
        REFERENCES nguoi_muon(id) ON DELETE RESTRICT,
    INDEX idx_phieu_nguoi_trang_thai (nguoi_muon_id, trang_thai),
    INDEX idx_phieu_han_tra (ngay_hen_tra, trang_thai)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS chi_tiet_muon (
    phieu_muon_id BIGINT UNSIGNED NOT NULL,
    thiet_bi_id BIGINT UNSIGNED NOT NULL,
    so_luong INT UNSIGNED NOT NULL,
    so_luong_hong INT UNSIGNED NOT NULL DEFAULT 0,
    PRIMARY KEY (phieu_muon_id, thiet_bi_id),
    CONSTRAINT fk_chi_tiet_phieu FOREIGN KEY (phieu_muon_id)
        REFERENCES phieu_muon(id) ON DELETE RESTRICT,
    CONSTRAINT fk_chi_tiet_thiet_bi FOREIGN KEY (thiet_bi_id)
        REFERENCES thiet_bi(id) ON DELETE RESTRICT,
    INDEX idx_chi_tiet_thiet_bi (thiet_bi_id)
) ENGINE=InnoDB;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

START TRANSACTION;

SET @id_nghiem := COALESCE(
  (SELECT nguoi_muon_id FROM tai_khoan
    WHERE email IN ('nghiemb2407591@student.ctu.edu.vn','student@lab.local')
      AND nguoi_muon_id IS NOT NULL
    ORDER BY (email = 'nghiemb2407591@student.ctu.edu.vn') DESC LIMIT 1),
  (SELECT id FROM nguoi_muon WHERE sdt='0833323337' ORDER BY id LIMIT 1)
);
SET @id_quynh := COALESCE(
  (SELECT nguoi_muon_id FROM tai_khoan
    WHERE email IN ('quynhb2407600@student.ctu.edu.vn','student2@lab.local')
      AND nguoi_muon_id IS NOT NULL
    ORDER BY (email = 'quynhb2407600@student.ctu.edu.vn') DESC LIMIT 1),
  (SELECT id FROM nguoi_muon WHERE sdt='0825569983' ORDER BY id LIMIT 1)
);
SET @id_vinh := COALESCE(
  (SELECT nguoi_muon_id FROM tai_khoan
    WHERE email IN ('vinhb2407615@student.ctu.edu.vn','lab@lab.local')
      AND nguoi_muon_id IS NOT NULL
    ORDER BY (email = 'vinhb2407615@student.ctu.edu.vn') DESC LIMIT 1),
  (SELECT id FROM nguoi_muon WHERE sdt='0944012806' ORDER BY id LIMIT 1)
);

INSERT INTO nguoi_muon (ho_ten, don_vi, sdt)
SELECT 'Đặng Hoàng Nghiêm', 'Trường Công nghệ thông tin và Truyền thông', '0833323337'
WHERE @id_nghiem IS NULL;
SET @id_nghiem := IF(@id_nghiem IS NULL, LAST_INSERT_ID(), @id_nghiem);

INSERT INTO nguoi_muon (ho_ten, don_vi, sdt)
SELECT 'La Như Quỳnh', 'Trường Kinh Tế', '0825569983'
WHERE @id_quynh IS NULL;
SET @id_quynh := IF(@id_quynh IS NULL, LAST_INSERT_ID(), @id_quynh);

INSERT INTO nguoi_muon (ho_ten, don_vi, sdt)
SELECT 'Võ Hoàng Vinh', 'Trường Bách Khoa', '0944012806'
WHERE @id_vinh IS NULL;
SET @id_vinh := IF(@id_vinh IS NULL, LAST_INSERT_ID(), @id_vinh);

INSERT IGNORE INTO tai_khoan (nguoi_muon_id, email, mat_khau, ten_hien_thi, vai_tro, hoat_dong)
VALUES
 (NULL, 'admin@gmail.com', '$2y$12$m98Pb8omMoPvBca5QLOJpuLQOTqD7yw9aVryyqE4y/jChRy5hdWdq', 'Quản trị viên', 'admin', 1),
 (@id_nghiem, 'nghiemb2407591@student.ctu.edu.vn', '$2y$12$bYoqqyy6A71gDEaDZWO.vuypdE4br9RlqbMPRaumzO6gnyzArJ//O', 'Đặng Hoàng Nghiêm', 'user', 1),
 (@id_quynh, 'quynhb2407600@student.ctu.edu.vn', '$2y$12$JTdARKoEHkFeeFU93bxAlO96XOcGT6tPcPD76Yw.dYS2kLsJaKFBm', 'La Như Quỳnh', 'user', 1),
 (@id_vinh, 'vinhb2407615@student.ctu.edu.vn', '$2y$12$4C5kBzRcK902tkSeU3AokOFLluN9kRq41JPz9GqqbND/I.KRDmKY6', 'Võ Hoàng Vinh', 'user', 1);

INSERT INTO thiet_bi
  (ma_thiet_bi, ten_thiet_bi, loai, mo_ta, tinh_trang, so_luong, so_luong_hong)
VALUES
  ('TB001', 'Laptop Dell Latitude 5440', 'Máy tính & CNTT', 'Laptop dùng cho sinh viên thực hành lập trình, làm đồ án và học phần ứng dụng CNTT.', 'tot', 12, 0),
  ('TB002', 'Máy chiếu Epson EB-X49', 'Giảng dạy & trình chiếu', 'Máy chiếu phục vụ giảng đường, hội thảo chuyên đề; đi kèm dây HDMI.', 'tot', 7, 0),
  ('TB003', 'Bộ Arduino Uno R3', 'Điện tử & IoT', 'Bộ phát triển Arduino phục vụ thực hành vi điều khiển, cảm biến và IoT.', 'tot', 30, 0),
  ('TB004', 'Camera Canon EOS 200D', 'Truyền thông & sự kiện', 'Máy ảnh dùng ghi hình học phần truyền thông, hoạt động học thuật và sự kiện sinh viên.', 'tot', 6, 0),
  ('TB005', 'Micro không dây Shure', 'Truyền thông & sự kiện', 'Micro không dây cho thuyết trình, báo cáo seminar và chương trình tại trường.', 'tot', 10, 0),
  ('TB006', 'Máy hiện sóng Rigol DS1054Z', 'Thí nghiệm & đo lường', 'Máy hiện sóng 4 kênh phục vụ thí nghiệm mạch điện và tín hiệu điện tử.', 'tot', 5, 0),
  ('TB007', 'Bộ Raspberry Pi 4', 'Điện tử & IoT', 'Bộ máy tính nhúng phục vụ học phần hệ thống nhúng, lập trình và thực nghiệm IoT.', 'tot', 15, 0),
  ('TB008', 'Màn hình LG 24 inch', 'Máy tính & CNTT', 'Màn hình Full HD cho phòng thực hành máy tính; hỗ trợ kết nối HDMI.', 'tot', 18, 0),
  ('TB009', 'Bộ phát Wi-Fi TP-Link', 'Mạng & viễn thông', 'Router cho thực hành cấu hình mạng máy tính; đang trong thời gian bảo trì.', 'bao_tri', 4, 0),
  ('TB010', 'Bàn phím cơ Keychron K2', 'Máy tính & CNTT', 'Bàn phím phục vụ phòng thực hành; hai chiếc đang ghi nhận hư hỏng.', 'hong', 2, 2),
  ('TB011', 'Laptop HP ProBook 440 G9', 'Máy tính & CNTT', 'Laptop phục vụ thực hành phần mềm, thuyết trình nhóm và nghiên cứu sinh viên.', 'tot', 10, 0),
  ('TB012', 'Máy tính mini Intel NUC', 'Máy tính & CNTT', 'Máy tính nhỏ gọn cho phòng thực hành hệ điều hành và quản trị máy tính.', 'tot', 8, 0),
  ('TB013', 'Bảng vẽ điện tử Wacom One', 'Giảng dạy & trình chiếu', 'Bảng vẽ điện tử hỗ trợ giảng viên giảng bài, chú thích và dạy học trực tuyến.', 'tot', 9, 0),
  ('TB014', 'Bút trình chiếu Logitech R400', 'Giảng dạy & trình chiếu', 'Thiết bị điều khiển slide cho giảng viên và sinh viên thuyết trình.', 'tot', 14, 0),
  ('TB015', 'Switch Cisco Catalyst 2960', 'Mạng & viễn thông', 'Switch dùng trong bài thực hành cấu hình VLAN, định tuyến và kiểm tra kết nối.', 'tot', 8, 0),
  ('TB016', 'Bộ dụng cụ bấm cáp mạng RJ45', 'Mạng & viễn thông', 'Bộ kìm bấm, dụng cụ tuốt dây và thiết bị kiểm tra cáp mạng cho phòng lab.', 'tot', 20, 0),
  ('TB017', 'Bộ ESP32 DevKit', 'Điện tử & IoT', 'Bộ kit ESP32 dùng cho bài thực hành lập trình cảm biến và giao tiếp Wi-Fi/Bluetooth.', 'tot', 25, 0),
  ('TB018', 'Nguồn DC điều chỉnh 30V 5A', 'Điện tử & IoT', 'Nguồn một chiều có điều chỉnh điện áp, dòng điện phục vụ thực hành điện tử.', 'tot', 7, 0),
  ('TB019', 'Đồng hồ vạn năng số', 'Thí nghiệm & đo lường', 'Thiết bị đo điện áp, dòng điện và điện trở trong phòng thí nghiệm kỹ thuật.', 'tot', 16, 0),
  ('TB020', 'Kính hiển vi quang học', 'Thí nghiệm & đo lường', 'Kính hiển vi dùng trong học phần thực hành sinh học và khoa học tự nhiên.', 'tot', 10, 0),
  ('TB021', 'Cân điện tử phòng thí nghiệm', 'Thí nghiệm & đo lường', 'Cân điện tử phục vụ đo khối lượng trong bài thực hành khoa học cơ bản.', 'tot', 6, 0),
  ('TB022', 'Máy in 3D Creality Ender-3', 'Cơ khí & chế tạo', 'Máy in 3D dùng tạo mẫu, thực hành thiết kế sản phẩm và đồ án kỹ thuật.', 'tot', 3, 0),
  ('TB023', 'Thước cặp điện tử 150 mm', 'Cơ khí & chế tạo', 'Dụng cụ đo kích thước chi tiết cơ khí trong các buổi thực hành.', 'tot', 18, 0),
  ('TB024', 'Chân máy ảnh 3 chân', 'Truyền thông & sự kiện', 'Tripod phục vụ ghi hình seminar, quay video học phần và sự kiện ở trường.', 'tot', 10, 0),
  ('TB025', 'Máy ghi âm Zoom H1n', 'Truyền thông & sự kiện', 'Máy ghi âm phỏng vấn, sản xuất nội dung báo chí và nghiên cứu định tính.', 'tot', 6, 0),
  ('TB026', 'Máy tính tài chính Casio FC-200V', 'Văn phòng & học tập', 'Máy tính tài chính phục vụ học phần tài chính, kế toán và phân tích đầu tư.', 'tot', 24, 0),
  ('TB027', 'Máy quét tài liệu A4', 'Văn phòng & học tập', 'Máy scan dành cho số hóa hồ sơ, tài liệu nghiên cứu và biểu mẫu thực hành.', 'tot', 5, 0),
  ('TB028', 'Máy tính Casio fx-580VN X', 'Văn phòng & học tập', 'Máy tính khoa học phục vụ học phần toán, thống kê và kỹ thuật cơ bản.', 'tot', 40, 0)
ON DUPLICATE KEY UPDATE
  loai = IF(ten_thiet_bi = VALUES(ten_thiet_bi), VALUES(loai), loai),
  mo_ta = IF(ten_thiet_bi = VALUES(ten_thiet_bi), VALUES(mo_ta), mo_ta);


SET @them_phieu_demo := IF((SELECT COUNT(*) FROM phieu_muon) = 0, 1, 0);
SET @nm_an := @id_nghiem;
SET @nm_binh := @id_quynh;
SET @nm_khoa := @id_vinh;

INSERT INTO phieu_muon (nguoi_muon_id, ngay_muon, ngay_hen_tra, trang_thai, ghi_chu)
SELECT @nm_an, DATE(UTC_TIMESTAMP() + INTERVAL 7 HOUR), DATE_ADD(DATE(UTC_TIMESTAMP() + INTERVAL 7 HOUR), INTERVAL 7 DAY), 'cho_duyet',
       'Demo: đăng ký mượn Arduino và Raspberry Pi'
WHERE @them_phieu_demo = 1;
SET @phieu_cho_duyet := LAST_INSERT_ID();
INSERT INTO chi_tiet_muon (phieu_muon_id, thiet_bi_id, so_luong, so_luong_hong)
SELECT @phieu_cho_duyet, id, 2, 0 FROM thiet_bi WHERE ma_thiet_bi = 'TB003' AND @them_phieu_demo = 1;
INSERT INTO chi_tiet_muon (phieu_muon_id, thiet_bi_id, so_luong, so_luong_hong)
SELECT @phieu_cho_duyet, id, 1, 0 FROM thiet_bi WHERE ma_thiet_bi = 'TB007' AND @them_phieu_demo = 1;

INSERT INTO phieu_muon (nguoi_muon_id, ngay_muon, ngay_hen_tra, trang_thai, ghi_chu)
SELECT @nm_an, DATE_SUB(DATE(UTC_TIMESTAMP() + INTERVAL 7 HOUR), INTERVAL 10 DAY), DATE_SUB(DATE(UTC_TIMESTAMP() + INTERVAL 7 HOUR), INTERVAL 2 DAY),
       'dang_muon', 'Demo: phiếu đang mượn quá hạn'
WHERE @them_phieu_demo = 1;
SET @phieu_qua_han := LAST_INSERT_ID();
INSERT INTO chi_tiet_muon (phieu_muon_id, thiet_bi_id, so_luong, so_luong_hong)
SELECT @phieu_qua_han, id, 1, 0 FROM thiet_bi WHERE ma_thiet_bi = 'TB001' AND @them_phieu_demo = 1;

INSERT INTO phieu_muon (nguoi_muon_id, ngay_muon, ngay_hen_tra, trang_thai, ghi_chu)
SELECT @nm_an, DATE_SUB(DATE(UTC_TIMESTAMP() + INTERVAL 7 HOUR), INTERVAL 3 DAY), DATE_ADD(DATE(UTC_TIMESTAMP() + INTERVAL 7 HOUR), INTERVAL 4 DAY),
       'cho_tra', 'Demo: chờ xác nhận trả micro'
WHERE @them_phieu_demo = 1;
SET @phieu_cho_tra := LAST_INSERT_ID();
INSERT INTO chi_tiet_muon (phieu_muon_id, thiet_bi_id, so_luong, so_luong_hong)
SELECT @phieu_cho_tra, id, 2, 0 FROM thiet_bi WHERE ma_thiet_bi = 'TB005' AND @them_phieu_demo = 1;

INSERT INTO phieu_muon (nguoi_muon_id, ngay_muon, ngay_hen_tra, ngay_tra, trang_thai, ghi_chu)
SELECT @nm_an, DATE_SUB(DATE(UTC_TIMESTAMP() + INTERVAL 7 HOUR), INTERVAL 18 DAY), DATE_SUB(DATE(UTC_TIMESTAMP() + INTERVAL 7 HOUR), INTERVAL 12 DAY),
       DATE_SUB(DATE(UTC_TIMESTAMP() + INTERVAL 7 HOUR), INTERVAL 11 DAY), 'da_tra', 'Demo: đã trả nhưng hỏng 1 máy chiếu'
WHERE @them_phieu_demo = 1;
SET @phieu_da_tra := LAST_INSERT_ID();
INSERT INTO chi_tiet_muon (phieu_muon_id, thiet_bi_id, so_luong, so_luong_hong)
SELECT @phieu_da_tra, id, 1, 1 FROM thiet_bi WHERE ma_thiet_bi = 'TB002' AND @them_phieu_demo = 1;
UPDATE thiet_bi SET so_luong_hong = so_luong_hong + 1
WHERE ma_thiet_bi = 'TB002' AND @them_phieu_demo = 1;

INSERT INTO phieu_muon (nguoi_muon_id, ngay_muon, ngay_hen_tra, trang_thai, ghi_chu, ly_do_tu_choi)
SELECT @nm_an, DATE_SUB(DATE(UTC_TIMESTAMP() + INTERVAL 7 HOUR), INTERVAL 5 DAY), DATE_ADD(DATE(UTC_TIMESTAMP() + INTERVAL 7 HOUR), INTERVAL 2 DAY),
       'tu_choi', 'Demo: mượn máy hiện sóng', 'Thiết bị đã được phân bổ cho nhóm khác.'
WHERE @them_phieu_demo = 1;
SET @phieu_tu_choi := LAST_INSERT_ID();
INSERT INTO chi_tiet_muon (phieu_muon_id, thiet_bi_id, so_luong, so_luong_hong)
SELECT @phieu_tu_choi, id, 1, 0 FROM thiet_bi WHERE ma_thiet_bi = 'TB006' AND @them_phieu_demo = 1;

INSERT INTO phieu_muon (nguoi_muon_id, ngay_muon, ngay_hen_tra, trang_thai, ghi_chu)
SELECT @nm_binh, DATE_SUB(DATE(UTC_TIMESTAMP() + INTERVAL 7 HOUR), INTERVAL 4 DAY), DATE_ADD(DATE(UTC_TIMESTAMP() + INTERVAL 7 HOUR), INTERVAL 2 DAY),
       'da_huy', 'Demo: người mượn hủy phiếu trước khi duyệt'
WHERE @them_phieu_demo = 1;
SET @phieu_da_huy := LAST_INSERT_ID();
INSERT INTO chi_tiet_muon (phieu_muon_id, thiet_bi_id, so_luong, so_luong_hong)
SELECT @phieu_da_huy, id, 1, 0 FROM thiet_bi WHERE ma_thiet_bi = 'TB008' AND @them_phieu_demo = 1;

INSERT INTO phieu_muon (nguoi_muon_id, ngay_muon, ngay_hen_tra, trang_thai, ghi_chu)
SELECT @nm_khoa, DATE_SUB(DATE(UTC_TIMESTAMP() + INTERVAL 7 HOUR), INTERVAL 2 DAY), DATE_ADD(DATE(UTC_TIMESTAMP() + INTERVAL 7 HOUR), INTERVAL 5 DAY),
       'dang_muon', 'Demo: đang mượn màn hình và camera'
WHERE @them_phieu_demo = 1;
SET @phieu_dang_muon := LAST_INSERT_ID();
INSERT INTO chi_tiet_muon (phieu_muon_id, thiet_bi_id, so_luong, so_luong_hong)
SELECT @phieu_dang_muon, id, 3, 0 FROM thiet_bi WHERE ma_thiet_bi = 'TB008' AND @them_phieu_demo = 1;
INSERT INTO chi_tiet_muon (phieu_muon_id, thiet_bi_id, so_luong, so_luong_hong)
SELECT @phieu_dang_muon, id, 1, 0 FROM thiet_bi WHERE ma_thiet_bi = 'TB004' AND @them_phieu_demo = 1;

INSERT INTO phieu_muon (nguoi_muon_id, ngay_muon, ngay_hen_tra, trang_thai, ghi_chu)
SELECT @nm_binh, DATE_ADD(DATE(UTC_TIMESTAMP() + INTERVAL 7 HOUR), INTERVAL 1 DAY), DATE_ADD(DATE(UTC_TIMESTAMP() + INTERVAL 7 HOUR), INTERVAL 6 DAY),
       'da_duyet', 'Demo: phiếu ĐÃ DUYỆT, chờ ngày mai để bắt đầu mượn'
WHERE @them_phieu_demo = 1;
SET @phieu_da_duyet_tuong_lai := LAST_INSERT_ID();
INSERT INTO chi_tiet_muon (phieu_muon_id, thiet_bi_id, so_luong, so_luong_hong)
SELECT @phieu_da_duyet_tuong_lai, id, 1, 0 FROM thiet_bi
WHERE ma_thiet_bi = 'TB003' AND @them_phieu_demo = 1;

COMMIT;

-- admin@gmail.com                         / 12345678
-- nghiemb2407591@student.ctu.edu.vn       / 12345678
-- quynhb2407600@student.ctu.edu.vn        / 12345678
-- vinhb2407615@student.ctu.edu.vn         / 12345678

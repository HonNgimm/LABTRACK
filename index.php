<?php declare(strict_types=1); ?>
<!doctype html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <script>
    (function () {
      var mode = null;
      try { mode = localStorage.getItem('labtrack-theme'); } catch (_) {}
      if (mode !== 'dark' && mode !== 'light') {
        mode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      document.documentElement.setAttribute('data-theme', mode);
    })();
  </script>
  <meta name="description" content="LabTrack - Quản lý mượn thiết bị giảng dạy, thực hành và nghiên cứu đại học">
  <title>LabTrack | Quản lý mượn thiết bị đại học</title>
  <link rel="stylesheet" href="assets/css/style.css?v=1.7.2">
  <script src="assets/js/app.js?v=1.7.2" defer></script>
</head>
<body>
  <svg aria-hidden="true" class="icon-defs" xmlns="http://www.w3.org/2000/svg">
    <symbol id="ic-grid" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></symbol>
    <symbol id="ic-box" viewBox="0 0 24 24"><path d="m12 3 9 5-9 5-9-5 9-5ZM3 8v9l9 5 9-5V8M12 13v9"/></symbol>
    <symbol id="ic-ticket" viewBox="0 0 24 24"><path d="M4 4h16v5a3 3 0 0 0 0 6v5H4v-5a3 3 0 0 0 0-6V4Zm8 0v16" stroke-dasharray="4 2"/></symbol>
    <symbol id="ic-users" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6m1 4a5 5 0 0 1 3 5"/></symbol>
    <symbol id="ic-user" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></symbol>
    <symbol id="ic-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></symbol>
    <symbol id="ic-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></symbol>
    <symbol id="ic-arrow" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></symbol>
    <symbol id="ic-logout" viewBox="0 0 24 24"><path d="M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5m4-4 4-4-4-4m4 4H9"/></symbol>
    <symbol id="ic-shield" viewBox="0 0 24 24"><path d="m12 2 9 4v6c0 6-4 9-9 11-5-2-9-5-9-11V6l9-4Zm-4 10 3 3 5-6"/></symbol>
    <symbol id="ic-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/></symbol>
    <symbol id="ic-check" viewBox="0 0 24 24"><path d="m5 12 5 5L20 7"/></symbol>
    <symbol id="ic-alert" viewBox="0 0 24 24"><path d="M12 3 2 21h20L12 3Zm0 7v4m0 3v.01"/></symbol>
    <symbol id="ic-settings" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="10" cy="18" r="2"/></symbol>
    <symbol id="ic-close" viewBox="0 0 24 24"><path d="M5 5 19 19M19 5 5 19"/></symbol>
    <symbol id="ic-trending" viewBox="0 0 24 24"><path d="M3 17 10 10l5 5 6-7m-6 0h6v6"/></symbol>
    <symbol id="ic-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></symbol>
    <symbol id="ic-bell" viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></symbol>
    <symbol id="ic-bell-check" viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/><path d="m9 10 2 2 4-4"/></symbol>
    <symbol id="ic-moon" viewBox="0 0 24 24"><path d="M20.3 15.4A8.5 8.5 0 0 1 8.6 3.7a8.8 8.8 0 1 0 11.7 11.7Z"/></symbol>
    <symbol id="ic-trash" viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2m3 0-1 15H6L5 6m5 4v7m4-7v7"/></symbol>
    <symbol id="ic-refresh" viewBox="0 0 24 24"><path d="M20 7V3h-4M4 17v4h4M5 9a8 8 0 0 1 14-2l1 0M4 17a8 8 0 0 0 15-2"/></symbol>
  </svg>

  <div id="auth-screen" class="auth-page">
    <section class="auth-showcase">
      <div class="auth-brand"><span class="brand-icon"><svg class="ico"><use href="#ic-box"></use></svg></span><span>LAB<span class="brand-accent">TRACK</span></span></div>
      <div class="auth-showcase-main">
        <div class="eyebrow-light"><span class="eyebrow-dot"></span> HỆ THỐNG QUẢN LÝ MƯỢN THIẾT BỊ</div>
        <h1>Mượn thiết bị dễ dàng.<br><span>Quản lý thông minh.</span></h1>
        <p>Nền tảng đăng ký mượn – trả thiết bị dành cho môi trường Đại học, giúp sinh viên và cán bộ dễ dàng tiếp cận thiết bị và hỗ trợ quản lý nhanh chóng, minh bạch, hiệu quả.</p>
        <div class="showcase-board">
          <div class="board-top"><span class="board-dots"><i></i><i></i><i></i></span><span>Inventory overview</span><span class="live-dot"></span></div>
          <div class="board-content"><div class="board-graphic"><span class="graph-bar b1"></span><span class="graph-bar b2"></span><span class="graph-bar b3"></span><span class="graph-bar b4"></span><span class="graph-bar b5"></span><span class="graph-bar b6"></span></div><div><div class="board-number">98.6%</div><div class="board-small">Tỷ lệ sẵn sàng <span>↗</span></div><div class="board-line"><span></span></div><div class="board-caption"></div></div></div>
        </div>
      </div>
      <div class="showcase-footer">CT428 · Bài tập nhóm 4 (HK1 2026–2027) </div>
    </section>
    <section class="auth-form-area">
      <button type="button" class="theme-toggle theme-toggle-auth" data-action="toggle-theme" aria-label="Chuyển chế độ giao diện" title="Chuyển chế độ giao diện"><svg class="ico"><use href="#ic-moon"></use></svg><span class="theme-toggle-label">Chế độ tối</span></button>
      <div class="auth-mobile-logo"><span class="brand-icon"><svg class="ico"><use href="#ic-box"></use></svg></span> LABTRACK</div>
      <div class="auth-panel">
        <div class="auth-heading"><span class="tiny-label">CHÀO MỪNG ĐẾN VỚI LABTRACK</span><h2 id="auth-heading">Đăng nhập tài khoản</h2><p id="auth-subtitle">Nhập thông tin để tiếp tục quản lý thiết bị.</p></div>
        <div class="auth-tabs"><button type="button" class="active" data-auth-tab="login">Đăng nhập</button><button type="button" data-auth-tab="register">Đăng ký</button></div>
        <form id="login-form" class="form-stack">
          <label class="field">Địa chỉ email<input name="email" type="email" placeholder="you@example.com" required autocomplete="username"></label>
          <label class="field">Mật khẩu<input name="password" type="password" placeholder="Nhập mật khẩu" required autocomplete="current-password"></label>
          <button type="submit" class="btn btn-primary btn-wide">Đăng nhập <svg class="ico"><use href="#ic-arrow"></use></svg></button>
        </form>
        <form id="register-form" class="form-stack hidden">
          <label class="field">Họ và tên<input name="name" maxlength="120" placeholder="Nguyễn Văn A" required autocomplete="name"></label>
          <label class="field">Đơn vị / lớp<input name="department" maxlength="160" placeholder="Khoa / phòng ban / lớp" required></label>
          <label class="field">Số điện thoại<input name="phone" type="tel" maxlength="20" placeholder="09xxxxxxxx" required></label>
          <label class="field">Email<input name="email" type="email" placeholder="you@example.com" required autocomplete="email"></label>
          <label class="field">Mật khẩu (ít nhất 8 ký tự)<input name="password" type="password" minlength="8" placeholder="Tạo mật khẩu" required autocomplete="new-password"></label>
          <label class="field">Xác nhận mật khẩu<input name="password_confirm" type="password" minlength="8" placeholder="Nhập lại mật khẩu" required autocomplete="new-password"></label>
          <button type="submit" class="btn btn-primary btn-wide">Tạo tài khoản <svg class="ico"><use href="#ic-arrow"></use></svg></button>
        </form>
        <p class="auth-hint">Tài khoản demo được ghi trong file <code>README.md</code>.</p>
      </div>
    </section>
  </div>

  <div id="dashboard-screen" class="workspace hidden">
    <div class="workspace-header">
      <aside class="sidebar" id="sidebar">
        <div class="sidebar-top">
          <div class="main-brand">
            <span class="brand-icon"><svg class="ico"><use href="#ic-box"></use></svg></span>
            <span>LAB<span>TRACK</span><small>DEVICE MANAGEMENT</small></span>
          </div>
        </div>
        <div class="sidebar-menu-title">KHÔNG GIAN LÀM VIỆC</div>
        <nav id="main-nav" class="sidebar-nav" aria-label="Chức năng hệ thống"></nav>
        <div class="sidebar-bottom">
          <div class="sidebar-note"><svg class="ico"><use href="#ic-shield"></use></svg><div><strong>Bảo mật phiên</strong><small>Phân quyền và xác thực an toàn</small></div></div>
          <button class="sidebar-signout" type="button" data-action="logout"><svg class="ico"><use href="#ic-logout"></use></svg> Đăng xuất</button>
        </div>
      </aside>
      <div class="sidebar-overlay" data-action="close-sidebar"></div>
      <header class="topbar">
        <button class="mobile-menu" id="open-sidebar" type="button" title="Mở menu" aria-label="Mở menu"><svg class="ico"><use href="#ic-settings"></use></svg></button>
        <div class="topbar-breadcrumb">Không gian làm việc <svg class="ico"><use href="#ic-arrow"></use></svg> <strong id="breadcrumb-current">Tổng quan</strong></div>
        <div class="topbar-right">
          <div class="notification-center" id="notification-center">
            <button class="notification-bell" id="notification-bell" type="button"
              aria-label="Thông báo" aria-haspopup="dialog" aria-expanded="false" aria-controls="notification-panel"
              title="Thông báo">
              <svg class="ico" aria-hidden="true"><use href="#ic-bell"></use></svg>
              <span class="notification-count hidden" id="notification-count" aria-hidden="true">0</span>
            </button>
            <section class="notification-panel hidden" id="notification-panel" role="dialog" aria-label="Trung tâm thông báo">
              <div class="notification-panel-head">
                <div class="notification-heading"><span class="notification-eyebrow">LABTRACK · ACTIVITY</span><h2>Thông báo</h2><p id="notification-subtitle">Cập nhật hoạt động mượn – trả</p></div>
                <button class="notification-close" type="button" data-action="close-notifications" title="Đóng thông báo" aria-label="Đóng thông báo"><svg class="ico"><use href="#ic-close"></use></svg></button>
              </div>
              <div class="notification-panel-toolbar">
                <span id="notification-unread-label">Chưa có thông báo mới</span>
                <div class="notification-toolbar-actions">
                  <button class="notification-read-all" id="notification-read-all" type="button" data-action="notification-read-all">Đánh dấu đã đọc tất cả</button>
                  <button class="notification-delete-all" id="notification-delete-all" type="button" data-action="notification-delete-all" disabled>Xóa tất cả</button>
                </div>
              </div>
              <div class="notification-items" id="notification-items" aria-live="polite"><div class="notification-empty">Đang tải thông báo…</div></div>
              <div class="notification-panel-foot">Thông báo được lưu trong tài khoản của bạn</div>
            </section>
          </div>
          <button type="button" class="theme-toggle theme-toggle-topbar" data-action="toggle-theme" aria-label="Chuyển chế độ giao diện" title="Chuyển chế độ giao diện"><svg class="ico"><use href="#ic-moon"></use></svg><span class="theme-toggle-label">Chế độ tối</span></button>
          <div class="account-dropdown">
            <button class="header-avatar" id="header-avatar" type="button" title="Mở menu tài khoản" aria-label="Mở menu tài khoản" aria-haspopup="true" aria-expanded="false" aria-controls="account-menu">U</button>
            <div class="account-menu hidden" id="account-menu" role="menu">
              <button type="button" role="menuitem" data-page="profile"><svg class="ico"><use href="#ic-user"></use></svg> Hồ sơ cá nhân</button>
              <button type="button" role="menuitem" data-action="logout"><svg class="ico"><use href="#ic-logout"></use></svg> Đăng xuất</button>
            </div>
          </div>
          <div class="header-user"><strong id="header-username">Người dùng</strong><small id="header-email"></small></div>
        </div>
      </header>
    </div>
    <div class="workspace-right">
      <main class="main-content"><div id="page-content"><div class="loading-state"><span class="spinner"></span> Đang tải dữ liệu…</div></div></main>
      <footer class="workspace-footer" aria-label="Thông tin về LabTrack">
        <div class="footer-card">
          <div class="footer-main">
            <div class="footer-brand-lockup">
              <span class="footer-logo" aria-hidden="true"><svg class="ico"><use href="#ic-box"></use></svg></span>
              <div class="footer-brand-copy">
                <strong>LAB<span>TRACK</span></strong>
                <p>Hệ thống Quản lý Mượn Thiết bị</p>
              </div>
            </div>
            <div class="footer-project">
              <span class="footer-course">CT428 <span class="footer-dot-separator">·</span> HK1 2026–2027</span>
            </div>
          </div>
          <div class="footer-divider"></div>
          <div class="footer-baseline">
            <span>CT428 · Bài tập nhóm 4 (HK1 2026–2027)</span>
            <span class="footer-context"><span class="footer-live-dot" aria-hidden="true"></span> Hệ thống Quản lý Mượn Thiết bị</span>
            <div class="footer-clock-wrap" aria-label="Thời gian hiện tại tại Việt Nam">
              <svg class="ico" aria-hidden="true"><use href="#ic-clock"></use></svg>
              <div class="footer-clock-details">
                <span class="footer-clock-label">Giờ Việt Nam (UTC+7)</span>
                <time id="footer-clock" datetime="">--:-- · --/--/----</time>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  </div>

  <div id="modal-backdrop" class="modal-backdrop hidden" aria-hidden="true"><div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header class="modal-header"><div><div class="modal-overline">LABTRACK MANAGEMENT</div><h2 id="modal-title">Chi tiết</h2></div><button class="modal-close" type="button" data-action="close-modal" aria-label="Đóng"><svg class="ico"><use href="#ic-close"></use></svg></button></header><div class="modal-body" id="modal-body"></div></div></div>
  <div id="toast-container" class="toast-container" aria-live="polite"></div>
  <noscript>Bạn cần bật JavaScript để sử dụng ứng dụng.</noscript>
</body>
</html>

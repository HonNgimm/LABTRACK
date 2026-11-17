(() => {
  'use strict';
  const state = {
    csrf: '', user: null, page: 'overview', equipment: [], borrowers: [], loans: [],
    stats: {}, equipmentSearch: '', equipmentCategory: '', loanSearch: '', loanStatus: '',
    borrowerSearch: '', showHiddenDevices: false, loadNumber: 0, welcomeDismissed: false,
    notifications: [], notificationUnread: 0, notificationLoaded: false, notificationRequest: 0,
    calendarDeviceId: null, calendarMonth: '', calendarRequest: 0, loanAvailabilityRequest: 0,
    calendarCheckRequest: 0, calendarAvailable: 0, calendarCanBorrow: false,
    calendarStart: '', calendarDue: '', calendarQuantity: 1, calendarNote: '',
    calendarExpanded: null,
  };
  const welcomeKey = 'labtrack-welcome-dismissed';
  try { state.welcomeDismissed = sessionStorage.getItem(welcomeKey) === '1'; } catch (_) {}
  const $ = (selector) => document.querySelector(selector);
  const icon = (id) => `<svg class="ico" aria-hidden="true"><use href="#ic-${id}"></use></svg>`;
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const num = value => Number(value || 0).toLocaleString('vi-VN');
  const dt = value => {
    if (!value) return '—';
    const iso = String(value).slice(0,10);
    const [y,m,d] = iso.split('-');
    return y && m && d ? `${d}/${m}/${y}` : esc(value);
  };
  const dateISO = (addDays = 0) => {
    const today = new Date();
    today.setDate(today.getDate() + addDays);
    return `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  };
  function dateOnlyMonth() {return dateISO().slice(0,7);}
  function addMonths(month, offset) {
    const [year, mm] = month.split('-').map(Number);
    const d = new Date(year, mm - 1 + offset, 1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  }
  function plusDaysISO(day, offset) {
    const [y,m,d] = day.split('-').map(Number);
    const dt = new Date(y, m-1, d+offset);
    return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
  }
  const themeKey = 'labtrack-theme';
  function syncThemeButtons() {
    const dark = document.documentElement.dataset.theme === 'dark';
    document.querySelectorAll('[data-action="toggle-theme"]').forEach(button => {
      const label = dark ? 'Chế độ sáng' : 'Chế độ tối';
      button.setAttribute('aria-label', `Chuyển sang ${label.toLowerCase()}`);
      button.setAttribute('title', `Chuyển sang ${label.toLowerCase()}`);
      const iconUse = button.querySelector('use');
      if (iconUse) iconUse.setAttribute('href', dark ? '#ic-sun' : '#ic-moon');
      const text = button.querySelector('.theme-toggle-label');
      if (text) text.textContent = label;
    });
  }
  function toggleTheme() {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(themeKey, next); } catch (_) { /* Trình duyệt có thể chặn lưu cục bộ. */ }
    syncThemeButtons();
  }
  function updateFooterClock() {
    const clock = $('#footer-clock');
    if (!clock) return;
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('vi-VN', {
      timeZone:'Asia/Ho_Chi_Minh', hour:'2-digit',minute:'2-digit',
      day:'2-digit',month:'2-digit',year:'numeric', hour12:false,
    });
    const parts = Object.fromEntries(formatter.formatToParts(now).map(({type,value})=>[type,value]));
    clock.textContent = `${parts.hour}:${parts.minute} · ${parts.day}/${parts.month}/${parts.year}`;
    clock.dateTime = now.toISOString();
  }
  const isAdmin = () => state.user?.role === 'admin';
  const labels = {
    cho_duyet: 'Chờ duyệt', da_duyet: 'Đã duyệt', dang_muon: 'Đang mượn', cho_tra: 'Chờ xác nhận trả',
    da_tra: 'Đã trả', tu_choi: 'Từ chối', da_huy: 'Đã hủy',
  };
  const pills = {
    cho_duyet: 'pending', da_duyet: 'approved', dang_muon: 'borrowing', cho_tra: 'wait-return',
    da_tra: 'returned', tu_choi: 'rejected', da_huy: 'cancelled',
  };
  const conditions = {tot: 'Hoạt động tốt', bao_tri: 'Bảo trì', hong: 'Hư hỏng'};
  const universityCategories = [
    'Máy tính & CNTT', 'Giảng dạy & trình chiếu', 'Mạng & viễn thông', 'Điện tử & IoT',
    'Thí nghiệm & đo lường', 'Cơ khí & chế tạo', 'Truyền thông & sự kiện', 'Văn phòng & học tập',
  ];
  const pageMeta = {
    overview: ['Tổng quan', 'Theo dõi toàn bộ hoạt động của hệ thống trong một nơi.'],
    devices: ['Danh mục thiết bị', 'Thiết bị phục vụ giảng dạy, học tập, thực hành và nghiên cứu tại đại học.'],
    calendar: ['Lịch đặt mượn', 'Đặt mượn nhanh theo ngày và kiểm tra số lượng còn trống tức thì.'],
    loans: ['Quản lý phiếu mượn', 'Theo dõi vòng đời của từng yêu cầu mượn – trả thiết bị.'],
    borrowers: ['Người mượn', 'Danh sách thông tin và tài khoản của người mượn.'],
    profile: ['Hồ sơ của tôi', 'Cập nhật thông tin cá nhân của bạn.'],
  };

  async function api(action, data, params = {}) {
    const url = new URL('api/index.php', document.baseURI);
    url.searchParams.set('action', action);
    Object.entries(params).forEach(([key,val]) => url.searchParams.set(key, val));
    let response;
    try {
      response = await fetch(url, {
        method: data === undefined ? 'GET' : 'POST',
        credentials: 'same-origin',
        headers: data === undefined ? {'Accept':'application/json'} : {
          'Accept':'application/json', 'Content-Type':'application/json', 'X-CSRF-Token':state.csrf,
        },
        body: data === undefined ? undefined : JSON.stringify(data),
      });
    } catch (_e) {
      throw new Error('Không thể kết nối đến máy chủ. Kiểm tra Apache và kết nối mạng.');
    }
    const result = await response.json().catch(() => {throw new Error(`API trả phản hồi không phải JSON (HTTP ${response.status}). Kiểm tra lỗi PHP trong XAMPP/apache/logs/error.log.`);});
    if (!response.ok || !result.success) {
      if (response.status === 401 && state.user) {
        state.user = null;
        showAuth();
      }
      throw new Error(result.message || `Thao tác thất bại (HTTP ${response.status}).`);
    }
    return result;
  }

  function toast(message, error=false) {
    const wrap = $('#toast-container');
    const element = document.createElement('div');
    element.className = 'toast' + (error ? ' error' : '');
    element.textContent = String(message);
    wrap.append(element);
    setTimeout(() => element.remove(), 4600);
  }
  function closeNotifications() {
    $('#notification-panel')?.classList.add('hidden');
    $('#notification-bell')?.setAttribute('aria-expanded', 'false');
  }
  function clearNotifications() {
    ++state.notificationRequest;
    state.notifications = [];
    state.notificationUnread = 0;
    state.notificationLoaded = false;
    closeNotifications();
    renderNotifications();
  }
  function notificationDate(value) {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
    return match ? `${match[3]}/${match[2]}/${match[1]} · ${match[4]}:${match[5]}` : 'Vừa cập nhật';
  }
  function notificationIcon(type) {
    if (type==='approved'||type==='returned') return 'check';
    if (type==='overdue'||type==='rejected') return 'alert';
    if (type==='new_loan'||type==='return_request'||type==='cancelled') return 'ticket';
    return 'clock';
  }
  function renderNotifications() {
    const count = $('#notification-count');
    if (!count) return;
    const unread = Math.max(0, Number(state.notificationUnread) || 0);
    count.classList.toggle('hidden', unread === 0 || !state.user);
    count.textContent = unread > 99 ? '99+' : String(unread);
    $('#notification-bell').setAttribute('aria-label', `Thông báo${unread ? ': '+unread+' chưa đọc' : ': không có thông báo chưa đọc'}`);
    $('#notification-unread-label').textContent = unread ? `${num(unread)} thông báo chưa đọc` : 'Đã xem hết thông báo';
    $('#notification-subtitle').textContent = isAdmin()
      ? 'Yêu cầu mượn, trả và các phiếu đến hạn' : 'Theo dõi phiếu mượn và các hạn trả thiết bị';
    $('#notification-read-all').disabled = unread === 0;
    $('#notification-delete-all').disabled = !state.notificationLoaded || state.notifications.length===0;
    const items = $('#notification-items');
    if (!state.notificationLoaded) {
      items.innerHTML = '<div class="notification-empty">Đang tải thông báo…</div>';
    } else if (!state.notifications.length) {
      items.innerHTML = `<div class="notification-empty">${icon('bell-check')}<strong>Chưa có thông báo</strong><span>Các hoạt động mượn – trả mới sẽ xuất hiện tại đây.</span></div>`;
    } else {
      items.innerHTML = state.notifications.map(item => `
        <div class="notification-item ${Number(item.da_doc)?'':'unread'}">
          <button type="button" class="notification-item-open"
            data-action="notification-open" data-id="${Number(item.id)}" data-loan="${Number(item.phieu_muon_id)||0}">
            <span class="notification-item-icon type-${esc(item.loai)}">${icon(notificationIcon(item.loai))}</span>
            <span class="notification-item-copy"><strong>${esc(item.tieu_de)}</strong>
              <span>${esc(item.noi_dung)}</span><small>${notificationDate(item.tao_luc)}</small></span>
            ${Number(item.da_doc)?'':'<span class="notification-unread-dot" aria-label="Chưa đọc"></span>'}
          </button>
          <button type="button" class="notification-delete" data-action="notification-delete"
            data-id="${Number(item.id)}" title="Xóa thông báo" aria-label="Xóa thông báo: ${esc(item.tieu_de)}">${icon('trash')}</button>
        </div>`).join('');
    }
  }
  async function loadNotifications(showErrors=false) {
    if (!state.user) return;
    const owner = state.user.id;
    const request = ++state.notificationRequest;
    try {
      const result = await api('notification_list');
      if (!state.user || state.user.id !== owner || request !== state.notificationRequest) return;
      state.notifications = result.items || [];
      state.notificationUnread = Number(result.unread) || 0;
      state.notificationLoaded = true;
      renderNotifications();
    } catch (error) {
      if (showErrors) toast('Không tải được thông báo: ' + error.message, true);
    }
  }
  async function openNotification(target) {
    const id = Number(target.dataset.id);
    const loanId = Number(target.dataset.loan);
    if (!Number.isSafeInteger(id) || id <= 0) return;
    try {
      await api('notification_read', {id});
      await loadNotifications();
      closeNotifications();
      if (loanId > 0) {
        await navigate('loans');
        if (getLoan(loanId)) loanDetailModal(loanId);
      }
    } catch (error) { toast(error.message, true); }
  }

  function closeAccountMenu() {
    const menu = $('#account-menu');
    const avatar = $('#header-avatar');
    if (menu) menu.classList.add('hidden');
    if (avatar) avatar.setAttribute('aria-expanded','false');
  }
  function showAuth(tab='login') {
    ++state.loadNumber;
    $('#auth-screen').classList.remove('hidden');
    $('#dashboard-screen').classList.add('hidden');
    closeAccountMenu();
    clearNotifications();
    setAuthTab(tab);
    closeModal();
  }
  
function setAuthTab(tab) {
    const register = tab === 'register';

    $('#auth-screen').classList.toggle('is-register', register);

    $('#login-form').classList.toggle('hidden', register);
    $('#register-form').classList.toggle('hidden', !register);

    $('#auth-heading').textContent = register ? 'Tạo tài khoản mới' : 'Đăng nhập tài khoản';
    $('#auth-subtitle').textContent = register
      ? 'Điền thông tin để đăng ký mượn thiết bị.' : 'Nhập thông tin để tiếp tục quản lý thiết bị.';

    document.querySelectorAll('[data-auth-tab]').forEach(button =>
      button.classList.toggle('active', button.dataset.authTab === tab));
}

  function showWorkspace() {
    $('#auth-screen').classList.add('hidden');
    $('#dashboard-screen').classList.remove('hidden');
    $('#header-username').textContent = state.user.name;
    $('#header-email').textContent = state.user.email;
    $('#header-avatar').textContent = (state.user.name || 'U').trim()[0].toUpperCase();
    updateFooterClock();
    closeAccountMenu();
    clearNotifications();
    renderNav();
    loadNotifications();
    navigate('overview');
  }
  function renderNav() {
    const nav = [
      ['overview', 'grid', 'Tổng quan'], ['devices','box','Thiết bị'], ['calendar','clock','Lịch đặt mượn'],
      ['loans','ticket',isAdmin()?'Phiếu mượn – trả':'Phiếu mượn của tôi'],
    ];
    if (isAdmin()) nav.push(['borrowers','users','Người mượn']);
    else nav.push(['profile','user','Hồ sơ cá nhân']);
    $('#main-nav').innerHTML = nav.map(([id, i, label]) => `
      <button type="button" class="nav-link ${state.page===id?'active':''}" data-page="${id}">
      ${icon(i)} <span>${esc(label)}</span></button>`).join('');
  }
  async function navigate(page) {
    if (!(page in pageMeta)) return;
    state.page = page;
    renderNav();
    $('#breadcrumb-current').textContent = pageMeta[page][0];
    closeSidebar();
    const seq = ++state.loadNumber;
    $('#page-content').innerHTML = `<div class="loading-state"><span class="spinner"></span> Đang tải dữ liệu…</div>`;
    try {
      if (page === 'overview') {
        const [stats, loans] = await Promise.all([api('dashboard'), api('loan_list')]);
        state.stats = stats.stats;
        state.loans = loans.items;
      } else if (page === 'devices') {
        state.equipment = (await api('equipment_list')).items;
      } else if (page === 'calendar') {
        state.equipment = (await api('equipment_list')).items;
      } else if (page === 'loans') {
        state.loans = (await api('loan_list')).items;
      } else if (page === 'borrowers') {
        if (!isAdmin()) return navigate('overview');
        state.borrowers = (await api('borrower_list')).items;
      }
      if (seq !== state.loadNumber) return;
      renderCurrent();
    } catch (error) {
      if (seq !== state.loadNumber) return;
      toast(error.message, true);
      $('#page-content').innerHTML = `<section class="panel"><div class="empty-state"><div class="empty-icon">${icon('alert')}</div><h3>Không thể tải dữ liệu</h3><p>${esc(error.message)}</p><button class="btn btn-primary" style="margin-top:15px" data-action="reload">Thử lại</button></div></section>`;
    }
  }
  function pageHeading(title, description, actions='') {
    return `<div class="page-head"><div><div class="page-kicker">LABTRACK / ${isAdmin()?'QUẢN TRỊ VIÊN':'NGƯỜI DÙNG'}</div><h1>${esc(title)}</h1><p>${esc(description)}</p></div><div class="page-actions">${actions}</div></div>`;
  }
  function renderCurrent() {
    if (state.page === 'overview') renderOverview();
    else if (state.page === 'devices') renderDevices();
    else if (state.page === 'loans') renderLoans();
    else if (state.page === 'calendar') renderCalendar();
    else if (state.page === 'borrowers') renderBorrowers();
    else if (state.page === 'profile') renderProfile();
  }
  function kpi(label, value, foot, iconName, color) {
    return `<div class="kpi-card"><div class="kpi-top"><span>${esc(label)}</span><span class="kpi-icon ${color}">${icon(iconName)}</span></div><div class="kpi-number">${num(value)}</div><div class="kpi-foot">${esc(foot)}</div></div>`;
  }
  function progress(label, count, total, color) {
    const percent = total > 0 ? Math.round(count / total * 100) : 0;
    return `<div class="progress-item"><div class="progress-row"><span>${esc(label)}</span><strong>${num(count)}</strong></div><div class="progress-track"><span class="progress-fill ${color}" style="width:${Math.min(100,percent)}%"></span></div></div>`;
  }
  function emptyState(title, subtitle) {
    return `<div class="empty-state"><div class="empty-icon">${icon('box')}</div><h3>${esc(title)}</h3><p>${esc(subtitle)}</p></div>`;
  }
  function statusBadge(loan) {
    const overdue = Number(loan.qua_han) === 1;
    const badge = `<span class="status-pill ${pills[loan.trang_thai]||'cancelled'}">${esc(labels[loan.trang_thai]||loan.trang_thai)}</span>`;
    return overdue ? `${badge} <span class="status-pill overdue">Quá hạn</span>` : badge;
  }
  function renderOverview() {
    const s = state.stats;
    const name = isAdmin() ? 'Admin' : ((state.user.name || '').trim().split(/\s+/).at(-1) || 'bạn');
    const total = isAdmin()
      ? Number(s.pending)+Number(s.approved)+Number(s.active)
      : Number(s.total);
    const actions = !isAdmin() ? `<button class="btn btn-primary" data-page="devices">${icon('plus')} Tìm thiết bị</button>` :
      `<button class="btn btn-primary" data-page="loans">${icon('ticket')} Xem phiếu mượn</button>`;
    const metrics = isAdmin() ? [
      kpi('Loại thiết bị',s.equipment,'Đang hiển thị trong hệ thống','box','blue'),
      kpi('Phiếu chờ duyệt',s.pending,'Yêu cầu cần xử lý','clock','amber'),
      kpi('Đã duyệt',s.approved,'Chưa tới ngày mượn','check','blue'),
      kpi('Đang được mượn',s.active,'Gồm phiếu đang chờ trả','ticket','teal'),
      kpi('Phiếu quá hạn',s.overdue,'Cần liên hệ người mượn','alert','rose'),
    ] : [
      kpi('Tổng phiếu của tôi',s.total,'Tất cả yêu cầu đã gửi','ticket','blue'),
      kpi('Chờ duyệt',s.pending,'Đang đợi quản trị viên','clock','amber'),
      kpi('Đã duyệt',s.approved,'Đang chờ đến ngày mượn','check','blue'),
      kpi('Đang mượn',s.active,'Thiết bị cần bàn giao lại','box','teal'),
      kpi('Đã trả',s.returned,'Phiếu đã hoàn tất','check','rose'),
    ];
    const recent = state.loans.slice(0,4);
    $('#page-content').innerHTML = `
      ${pageHeading('Tổng quan', 'Dữ liệu và hoạt động mượn thiết bị được cập nhật trực tiếp.', actions)}
      ${!state.welcomeDismissed ? `<div class="welcome-banner welcome-dismissible" role="region" aria-label="Thông báo chào mừng">
        <button type="button" class="welcome-dismiss" data-action="dismiss-welcome" aria-label="Đóng thông báo chào mừng" title="Đóng thông báo">${icon('close')}</button>
        <div><div class="welcome-tag">✦ CHÀO MỪNG QUAY TRỞ LẠI</div><h2>Xin chào, ${esc(name)}!</h2>
        <p>${isAdmin()?'Theo dõi phiếu mượn, tình trạng thiết bị và xử lý các yêu cầu đang chờ duyệt.':'Tìm kiếm thiết bị phù hợp, đăng ký mượn và theo dõi tiến độ xử lý của bạn.'}</p></div>
        <span class="welcome-symbol">${icon(isAdmin()?'grid':'box')}</span></div>` : ''}
      <div class="kpi-grid">${metrics.join('')}</div>
      <div class="overview-lower"><section class="panel"><div class="panel-header"><div><h3>Phiếu mượn gần đây</h3><p>Những yêu cầu được tạo mới nhất</p></div><button class="btn btn-subtle btn-mini" data-page="loans">Xem tất cả ${icon('arrow')}</button></div>
       ${recent.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Mã phiếu</th><th>${isAdmin()?'Người mượn':'Thiết bị'}</th><th>Hạn trả</th><th>Trạng thái</th></tr></thead><tbody>
         ${recent.map(l=>`<tr><td><strong>#PM${String(l.id).padStart(4,'0')}</strong></td><td>${esc(isAdmin()?l.ho_ten:(l.items?.[0]?.ten_thiet_bi ||'—'))}</td><td>${dt(l.ngay_hen_tra)}</td><td>${statusBadge(l)}</td></tr>`).join('')}
         </tbody></table></div>` : emptyState('Chưa có phiếu mượn','Các phiếu được tạo sẽ xuất hiện ở đây.')}</section>
       <section class="panel"><div class="panel-header"><div><h3>${isAdmin()?'Tình hình yêu cầu':'Trạng thái yêu cầu'}</h3><p>Tổng hợp phiếu mượn hiện tại</p></div>${icon('trending')}</div>
         <div class="panel-body">${progress('Chờ duyệt', Number(s.pending), total, 'amber')}
         ${progress('Đã duyệt', Number(s.approved), total, 'blue')}
         ${progress('Đang mượn', Number(s.active), total, 'teal')}
         ${isAdmin()? progress('Chờ xác nhận trả', Number(s.returns), total, '') : progress('Đã trả', Number(s.returned),total,'')}
         <div class="quick-card"><div class="quick-icon amber">${icon('alert')}</div><div><strong>${num(s.overdue)} phiếu quá hạn</strong><p>${isAdmin()?'Cần kiểm tra và nhắc nhở người mượn.':'Vui lòng bàn giao thiết bị sớm nhất.'}</p></div></div>
         ${isAdmin()?`<div class="quick-card"><div class="quick-icon teal">${icon('users')}</div><div><strong>${num(s.borrowers)} người mượn</strong><p>${num(s.damaged)} thiết bị đang ghi nhận hư hỏng.</p></div></div>`:''}</div></section></div>`;
  }
  const calendarDevices = () => state.equipment.filter(d => Number(d.hoat_dong)===1 && d.tinh_trang==='tot'
    && Number(d.so_luong)-Number(d.so_luong_hong)>0);

  const calendarDeviceLabel = d => `${d.ten_thiet_bi} · ${d.ma_thiet_bi}`;
  const calendarNormalize = v => String(v||'').toLocaleLowerCase('vi').normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').trim();
  let calendarActiveOption = 0;
  let calendarShowAllChoices = false;
  let calendarChoicesTerm = '';

  function calendarCloseChoices() {
    const wrap=$('#calendar-device-combobox');
    const input=$('#calendar-device-search');
    const list=$('#calendar-device-options');
    if(wrap)wrap.classList.remove('expanded');
    if(input){input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');}
    if(list)list.classList.add('hidden');
  }
  function calendarMarkActive(index) {
    const options=[...document.querySelectorAll('#calendar-device-options .calendar-option:not(:disabled)')];
    if(!options.length)return;
    calendarActiveOption=(index+options.length)%options.length;
    options.forEach((item,i)=>{
      item.classList.toggle('keyboard-active',i===calendarActiveOption);
      item.setAttribute('aria-selected',String(Number(item.dataset.id)===Number($('#calendar-device')?.value)));
    });
    const active=options[calendarActiveOption];
    $('#calendar-device-search')?.setAttribute('aria-activedescendant',active.id);
    active.scrollIntoView({block:'nearest'});
  }
  function calendarShowChoices(term='') {
    const wrap=$('#calendar-device-combobox');
    const input=$('#calendar-device-search');
    const list=$('#calendar-device-options');
    if(!wrap||!input||!list)return;
    calendarChoicesTerm=term;
    const normalized=calendarNormalize(term);
    const matches=state.equipment.filter(d=>Number(d.hoat_dong)===1 &&
      calendarNormalize(`${d.ten_thiet_bi} ${d.ma_thiet_bi} ${d.loai} ${d.mo_ta||''}`).includes(normalized));
    const shown=calendarShowAllChoices?matches:matches.slice(0,9);
    const eligibleIds=new Set(calendarDevices().map(d=>Number(d.id)));
    list.innerHTML=matches.length
      ? `<div class="calendar-options-caption">${normalized?'KẾT QUẢ TÌM KIẾM':'CHỌN THIẾT BỊ'} <span>${num(matches.length)} thiết bị</span></div>`+
        shown.map(d=>{
          const eligible=eligibleIds.has(Number(d.id));
          return `<button type="button" role="option" class="calendar-option ${eligible?'':'calendar-option-unavailable'}" id="calendar-option-${Number(d.id)}" data-action="calendar-pick-device" data-id="${Number(d.id)}" aria-selected="${eligible && Number(d.id)===Number($('#calendar-device')?.value)}" ${eligible?'':'disabled aria-disabled="true"'}>
            <span class="calendar-option-icon">${icon('box')}</span>
            <span class="calendar-option-detail"><strong>${esc(d.ten_thiet_bi)}</strong><small>${esc(d.ma_thiet_bi)} · ${esc(d.loai)}${eligible?'':' · Tạm không thể mượn'}</small></span>
            <span class="calendar-option-check">${icon('check')}</span></button>`;
        }).join('')+
        (matches.length>9?`<button type="button" class="calendar-options-more-btn" data-action="calendar-toggle-more" aria-expanded="${calendarShowAllChoices}">
          ${calendarShowAllChoices?`Thu gọn danh sách (${num(matches.length)} thiết bị)`:`Xem thêm ${num(matches.length-9)} thiết bị`}
          ${icon('arrow')}</button>`:'')
      : `<div class="calendar-options-empty">${icon('search')}<strong>Không tìm thấy thiết bị</strong><span>Thử tên khác, mã TB hoặc nhóm thiết bị.</span></div>`;
    wrap.classList.add('expanded');
    list.classList.remove('hidden');
    input.setAttribute('aria-expanded','true');
    const count=$('#calendar-device-count');
    if(count) count.textContent=normalized?`${num(matches.length)} thiết bị phù hợp · Bấm vào kết quả để chọn`:'Nhập tên hoặc mã thiết bị để tìm nhanh';
    calendarActiveOption=0;
    if(list.querySelector('.calendar-option:not(:disabled)'))calendarMarkActive(0);
    else input.removeAttribute('aria-activedescendant');
  }
  function calendarPickDevice(id) {
    const d=calendarDevices().find(device=>Number(device.id)===Number(id));
    if(!d)return;
    const input=$('#calendar-device-search');
    const hidden=$('#calendar-device');
    if(!input||!hidden)return;
    hidden.value=String(d.id);
    input.value=calendarDeviceLabel(d);
    const count=$('#calendar-device-count');
    if(count)count.textContent=`${d.loai} · Mã ${d.ma_thiet_bi} · Đã chọn`;
    calendarShowAllChoices=false;
    calendarCloseChoices();
    calendarSyncState();
    checkCalendarQuickForm();
    if(state.calendarExpanded)refreshCalendarMonth();
  }

  function calendarDuration(start, due) {
    const a = Date.parse(`${start}T12:00:00Z`);
    const b = Date.parse(`${due}T12:00:00Z`);
    return Number.isFinite(a) && Number.isFinite(b) ? Math.round((b-a)/86400000)+1 : 0;
  }

  function calendarSyncState() {
    const f=$('#calendar-quick-form');
    if(!f) return;
    state.calendarDeviceId=Number(f.elements.namedItem('device_id').value);
    state.calendarStart=f.elements.namedItem('start').value;
    state.calendarDue=f.elements.namedItem('due').value;
    state.calendarQuantity=Number(f.elements.namedItem('quantity')?.value||1);
    state.calendarNote=f.elements.namedItem('note')?.value||'';
  }

  function calendarPaintSelection() {
    const start=$('#calendar-start')?.value||state.calendarStart;
    const due=$('#calendar-due')?.value||state.calendarDue;
    document.querySelectorAll('#calendar-grid-wrap .calendar-day-button').forEach(button=>{
      const day=button.dataset.date;
      const picked=day===start;
      button.classList.toggle('range-start',picked);
      button.classList.toggle('range-end',day===due && day!==start);
      button.classList.toggle('range-between',day>start && day<due);
      button.setAttribute('aria-pressed',String(picked));
    });
    const description=$('#calendar-selected-days');
    if(description && start && due && due>=start) {
      description.textContent=`Đang chọn: ${dt(start)} – ${dt(due)} (${num(calendarDuration(start,due))} ngày)`;
    }
  }

  function calendarQuickMessage(kind,heading,message,free=null) {
    const el=$('#calendar-availability-result');
    if(!el) return;
    el.className=`calendar-result ${kind}`;
    el.innerHTML=`<span class="calendar-result-icon">${icon(kind==='ok'?'check':kind==='error'?'alert':'clock')}</span>
       <div class="calendar-result-copy"><strong>${esc(heading)}</strong><p>${esc(message)}</p></div>
       ${free!==null?`<span class="calendar-result-value">${num(free)} <small>còn</small></span>`:''}`;
  }

  function calendarRefreshPresets() {
    const f=$('#calendar-quick-form');
    if(!f)return;
    const duration=calendarDuration(f.elements.namedItem('start').value,f.elements.namedItem('due').value);
    document.querySelectorAll('[data-calendar-duration]').forEach(b=>{
      const selected=Number(b.dataset.calendarDuration)===duration;
      b.classList.toggle('selected',selected);
      b.setAttribute('aria-pressed',String(selected));
    });
  }

  async function checkCalendarQuickForm(enforce=false) {
    const form=$('#calendar-quick-form');
    if(!form)return false;
    const request=++state.calendarCheckRequest;
    const deviceId=Number(form.elements.namedItem('device_id').value);
    const start=form.elements.namedItem('start').value;
    const due=form.elements.namedItem('due').value;
    const qtyInput=form.elements.namedItem('quantity');
    const qty=Number(qtyInput?.value||1);
    const submit=$('#calendar-quick-submit');
    state.calendarCanBorrow=false;
    if(!Number.isSafeInteger(deviceId)||deviceId<1){
      calendarQuickMessage('error','Chưa chọn thiết bị','Vui lòng chọn thiết bị hợp lệ từ danh sách.');
      if(submit)submit.disabled=true;
      if(enforce)throw new Error('Vui lòng chọn thiết bị.');
      return false;
    }
    if(submit) submit.disabled=true;
    calendarPaintSelection();
    calendarRefreshPresets();
    const duration=calendarDuration(start,due);
    if(!start || !due || start<dateISO() || duration<1 || duration>61) {
      const message='Chọn ngày mượn từ hôm nay, ngày trả không sớm hơn ngày mượn và cách nhau tối đa 60 ngày.';
      calendarQuickMessage('error','Ngày chưa hợp lệ',message);
      if(enforce) throw new Error(message);
      return false;
    }
    if(!Number.isInteger(qty) || qty<1) {
      const message='Số lượng cần mượn phải là số nguyên từ 1 trở lên.';
      calendarQuickMessage('error','Số lượng không hợp lệ',message);
      if(enforce) throw new Error(message);
      return false;
    }
    calendarQuickMessage('loading','Đang kiểm tra lịch…','Đang xác nhận số lượng khả dụng cho tất cả ngày đã chọn.');
    try {
      const result=await api('availability_check',undefined,{start,due,ids:String(deviceId)});
      if(request!==state.calendarCheckRequest || state.page!=='calendar' || !document.contains(form) ||
          Number(form.elements.namedItem('device_id').value)!==deviceId ||
          form.elements.namedItem('start').value!==start || form.elements.namedItem('due').value!==due) {
        if(enforce) throw new Error('Lịch vừa thay đổi. Vui lòng thử gửi lại.');
        return false;
      }
      const info=result.items[0];
      if(!info) throw new Error('Không tìm thấy dữ liệu số lượng thiết bị.');
      const free=Number(info.available);
      state.calendarAvailable=free;
      if(qtyInput) qtyInput.max=String(Math.max(0,free));
      const total=$('#calendar-total');
      if(total) total.textContent=num(info.capacity);
      if(free<=0) {
        calendarQuickMessage('error','Đã hết thiết bị trong khoảng này','Thử đổi ngày mượn hoặc rút ngắn thời gian để tìm lịch còn trống.',0);
      } else if(qty>free) {
        calendarQuickMessage('error','Số lượng không đủ',`Bạn chọn ${num(qty)} thiết bị, nhưng trong khoảng này chỉ còn ${num(free)}. Hãy giảm số lượng hoặc đổi ngày.`,free);
      } else {
        state.calendarCanBorrow=true;
        calendarQuickMessage('ok','Có thể đăng ký mượn',`Còn đủ ${num(free)} thiết bị trong suốt ${num(duration)} ngày bạn chọn. Phiếu sẽ chờ Admin duyệt.`,free);
      }
      if(submit) submit.disabled=!state.calendarCanBorrow;
      if(enforce && !state.calendarCanBorrow) throw new Error('Khoảng thời gian này không còn đủ thiết bị theo số lượng yêu cầu.');
      return state.calendarCanBorrow;
    } catch(error) {
      if(request===state.calendarCheckRequest && state.page==='calendar' && document.contains(form)) {
        state.calendarCanBorrow=false;
        if(submit) submit.disabled=true;
        if(!String(error.message).startsWith('Khoảng thời gian này')) calendarQuickMessage('error','Không kiểm tra được lịch',error.message);
      }
      if(enforce) throw error;
      return false;
    }
  }

  async function refreshCalendarMonth() {
    const grid=$('#calendar-grid-wrap');
    if(!grid || state.page!=='calendar') return;
    const request=++state.calendarRequest;
    const month=state.calendarMonth;
    const id=state.calendarDeviceId;
    const title=$('#calendar-current-month');
    if(!id){++state.calendarRequest;grid.classList.remove('calendar-loading');grid.innerHTML='<div class="calendar-loading">Chọn một thiết bị để xem lịch trống.</div>';return;}
    if(title) title.textContent=new Intl.DateTimeFormat('vi-VN',{month:'long',year:'numeric'}).format(new Date(`${month}-02T12:00:00`));
    grid.classList.add('calendar-loading');
    grid.innerHTML=`<div class="calendar-loading">${icon('refresh')} Đang tải lịch trong tháng...</div>`;
    try {
      const result=await api('availability_calendar',undefined,{device_id:id,month});
      if(request!==state.calendarRequest || state.page!=='calendar' || !document.contains(grid))return;
      const today=dateISO();
      const offset=(new Date(`${month}-01T12:00:00`).getDay()+6)%7;
      const blanks='<div class="calendar-pad" aria-hidden="true"></div>'.repeat(offset);
      const days=result.days.map(day=>{
        const free=Number(day.available);
        const past=day.date<today;
        const label=`${dt(day.date)}, còn ${num(free)} thiết bị`; 
        return `<button type="button" class="calendar-day-button ${day.date===today?'today':''} ${past?'past':''} ${free===0?'soldout':''}"
          data-action="calendar-select-day" data-date="${day.date}" ${past?'disabled':''} aria-label="${esc(label)}" title="${esc(label)}">
          <span class="calendar-day-num">${Number(day.date.slice(-2))}</span>
          <span class="calendar-day-stock ${free===0?'zero':''}">${free===0?'Hết':`Còn ${num(free)}`}</span>
        </button>`;
      }).join('');
      grid.classList.remove('calendar-loading');
      grid.innerHTML=`<div class="calendar-weekdays">${['T2','T3','T4','T5','T6','T7','CN'].map(d=>`<span>${d}</span>`).join('')}</div>
         <div class="calendar-grid">${blanks}${days}</div>
         <div class="calendar-legend"><span><i class="legend-free"></i>Còn trống</span><span><i class="legend-full"></i>Hết thiết bị</span><span><i class="legend-today"></i>Hôm nay</span></div>`;
      calendarPaintSelection();
    } catch(error) {
      if(request===state.calendarRequest && state.page==='calendar' && document.contains(grid)) {
        grid.classList.remove('calendar-loading');
        grid.innerHTML=`<div class="calendar-error">${icon('alert')} ${esc(error.message)} <button class="btn btn-subtle btn-mini" data-action="calendar-retry">Thử lại</button></div>`;
      }
    }
  }

  function renderCalendar() {
    const devices=calendarDevices();
    if(!devices.length) {
      $('#page-content').innerHTML=pageHeading('Lịch đặt mượn','Kiểm tra thiết bị theo lịch') +
        emptyState('Chưa có thiết bị khả dụng','Admin cần kích hoạt thiết bị trong danh mục.');
      return;
    }
    if(!devices.some(d=>Number(d.id)===Number(state.calendarDeviceId))) state.calendarDeviceId=Number(devices[0].id);
    if(!state.calendarStart || state.calendarStart<dateISO()) state.calendarStart=dateISO();
    if(!state.calendarDue || state.calendarDue<state.calendarStart) state.calendarDue=plusDaysISO(state.calendarStart,2);
    if(!state.calendarMonth) state.calendarMonth=state.calendarStart.slice(0,7);
    if(state.calendarExpanded===null) state.calendarExpanded=!window.matchMedia('(max-width: 850px)').matches;
    const selected=devices.find(d=>Number(d.id)===state.calendarDeviceId);
    const adminText=isAdmin()?`<div class="calendar-admin-note">${icon('shield')} Bạn đang xem lịch với quyền quản trị. Sinh viên có thể tạo phiếu từ màn hình này.</div>`:'';
    $('#page-content').innerHTML=`${pageHeading('Lịch đặt mượn','Chỉ cần chọn thiết bị, ngày và số lượng. Hệ thống kiểm tra lịch tự động.')}
    <div class="calendar-easy-layout">
      <section class="panel calendar-quick-card" aria-label="Đặt mượn nhanh">
        <div class="calendar-easy-header"><div class="calendar-easy-kicker">ĐĂNG KÝ NHANH</div><h2>${isAdmin()?'Tra cứu lịch trống':'Bạn muốn mượn khi nào?'}</h2>
          <p>Điền thông tin theo từng bước, kết quả còn trống sẽ hiển thị ngay.</p></div>
        <form id="calendar-quick-form" class="calendar-quick-form">
          <div class="calendar-field"><div class="calendar-step"><b>1</b> Chọn thiết bị</div>
            <div class="calendar-combobox" id="calendar-device-combobox">
              <div class="calendar-combobox-control">
                ${icon('search')}
                <input type="search" id="calendar-device-search" role="combobox" aria-label="Tìm và chọn thiết bị" aria-autocomplete="list" aria-haspopup="listbox" aria-expanded="false" aria-controls="calendar-device-options" placeholder="Nhập tên, mã hoặc loại thiết bị..." autocomplete="off" spellcheck="false" value="${esc(calendarDeviceLabel(selected))}">
                <span class="calendar-combobox-chevron" aria-hidden="true">${icon('arrow')}</span>
              </div>
              <div class="calendar-combobox-options hidden" id="calendar-device-options" role="listbox" aria-label="Thiết bị phù hợp"></div>
            </div>
            <input type="hidden" name="device_id" id="calendar-device" value="${Number(selected.id)}">
            <small class="calendar-device-count" id="calendar-device-count">${esc(selected.loai)} · Mã ${esc(selected.ma_thiet_bi)} · Đã chọn</small></div>
          <div class="calendar-step"><b>2</b> Chọn thời gian</div>
          <div class="calendar-date-fields"><label class="field">Ngày bắt đầu<input type="date" id="calendar-start" name="start" min="${dateISO()}" value="${state.calendarStart}" required></label>
            <label class="field">Ngày trả dự kiến<input type="date" id="calendar-due" name="due" min="${state.calendarStart}" max="${plusDaysISO(state.calendarStart,60)}" value="${state.calendarDue}" required></label></div>
          <div class="calendar-presets" role="group" aria-label="Chọn nhanh thời gian mượn">
            <span>Mượn nhanh:</span>${[1,3,7].map(n=>`<button type="button" data-action="calendar-preset" data-calendar-duration="${n}" aria-pressed="false">${n} ngày</button>`).join('')}</div>
          <div class="calendar-step"><b>3</b> ${isAdmin()?'Kiểm tra số lượng':'Số lượng và ghi chú'}</div>
          <div class="calendar-qty-row"><label class="field">Số lượng cần mượn<input type="number" name="quantity" id="calendar-quantity" min="1" step="1" value="${Number(state.calendarQuantity)>0?Math.floor(Number(state.calendarQuantity)):1}" required></label>
            <div class="calendar-capacity">Tổng hoạt động tốt <strong id="calendar-total">${num(Number(selected.so_luong)-Number(selected.so_luong_hong))}</strong> thiết bị</div></div>
          ${isAdmin()?'':`<label class="field calendar-note-field">Ghi chú (không bắt buộc)<textarea name="note" rows="2" maxlength="500" placeholder="Ví dụ: phục vụ buổi thực hành, làm đồ án...">${esc(state.calendarNote)}</textarea></label>`}
          <div id="calendar-availability-result" class="calendar-result loading" role="status" aria-live="polite"><span class="calendar-result-icon">${icon('clock')}</span><div class="calendar-result-copy"><strong>Đang kiểm tra lịch...</strong><p>Kết quả sẽ được cập nhật ngay khi bạn đổi ngày hoặc số lượng.</p></div></div>
          ${adminText}
          ${isAdmin()?'':`<button type="submit" id="calendar-quick-submit" class="btn btn-primary calendar-submit" disabled>${icon('check')} Gửi yêu cầu mượn</button>
            <p class="calendar-submit-hint">Không thu phí · Yêu cầu gửi đi sẽ ở trạng thái <strong>Chờ duyệt</strong>. Số lượng được kiểm tra lại khi Admin duyệt.</p>`}
        </form>
      </section>
      <section class="panel calendar-browser-card" aria-label="Xem lịch tháng">
        <div class="calendar-browser-heading"><div><div class="calendar-easy-kicker">THAM KHẢO</div><h2>Lịch số lượng theo ngày</h2><p>Bấm một ngày để điền ngày bắt đầu vào form bên trái.</p></div>
          <button type="button" class="calendar-expand" data-action="calendar-toggle" aria-expanded="${state.calendarExpanded}" aria-controls="calendar-browser-body">${state.calendarExpanded?'Thu gọn':'Xem lịch tháng'} ${icon('arrow')}</button></div>
        <div id="calendar-browser-body" ${!state.calendarExpanded?'class="hidden"':''}>
          <div class="calendar-month-controls"><button class="btn btn-subtle" type="button" data-action="calendar-prev" aria-label="Tháng trước">‹</button>
            <strong id="calendar-current-month"></strong><button class="btn btn-subtle" type="button" data-action="calendar-next" aria-label="Tháng sau">›</button>
            <button class="btn btn-subtle btn-mini" type="button" data-action="calendar-current">Tháng này</button></div>
          <p class="calendar-selected-days" id="calendar-selected-days"></p>
          <div id="calendar-grid-wrap" class="calendar-loading">${icon('refresh')} Đang tải lịch...</div>
          <p class="calendar-calendar-hint">Các ngày đầu và cuối đều được tính. Phiếu <b>Chờ duyệt</b> chưa giữ chỗ; kết quả được kiểm tra lại khi Admin duyệt.</p>
        </div>
      </section>
    </div>`;
    calendarRefreshPresets();
    calendarPaintSelection();
    checkCalendarQuickForm();
    if(state.calendarExpanded) refreshCalendarMonth();
  }

  function deviceStatus(device) {
    if (!Number(device.hoat_dong)) return `<span class="status-pill inactive">Đã ẩn</span>`;
    if (device.tinh_trang === 'bao_tri') return `<span class="status-pill maintenance">Bảo trì</span>`;
    if (device.tinh_trang === 'hong') return `<span class="status-pill damaged">Hư hỏng</span>`;
    if (Number(device.so_luong_trong) === 0) return `<span class="status-pill pending">Hết thiết bị</span>`;
    return `<span class="status-pill good">Sẵn sàng</span>`;
  }
  function deviceCard(d) {
    const available = d.tinh_trang === 'tot' && Number(d.hoat_dong) === 1 ? Number(d.so_luong_trong) : 0;
    const adminActions = `<button class="btn btn-subtle btn-mini" data-action="edit-device" data-id="${Number(d.id)}">Sửa</button>
      <button class="btn ${Number(d.hoat_dong)?'btn-danger':'btn-success'} btn-mini" data-action="toggle-device" data-id="${Number(d.id)}" data-active="${Number(d.hoat_dong)?'0':'1'}">${Number(d.hoat_dong)?'Xóa':'Khôi phục'}</button>`;
    return `<article class="device-card"><div class="device-top"><div class="device-art">${icon('box')}</div>${deviceStatus(d)}</div>
      <div class="device-code">${esc(d.ma_thiet_bi)} · ${esc(d.loai)}</div><div class="device-title">${esc(d.ten_thiet_bi)}</div>
      <div class="device-desc" title="${esc(d.mo_ta)}">${esc(d.mo_ta || 'Thiết bị phục vụ công tác và học tập.')}</div>
      <div class="device-detail-row"><span>Tổng: <strong>${num(d.so_luong)}</strong></span><span>Đã giữ / đang mượn: <strong>${num(d.dang_muon)}</strong></span><span>Hỏng: <strong>${num(d.so_luong_hong)}</strong></span></div>
      <div class="device-bottom"><div><div class="stock-number">${num(available)}</div><div class="stock-caption">Còn hôm nay · kiểm tra theo lịch</div></div><div class="device-actions">
        ${isAdmin()?adminActions:`<button class="btn btn-primary btn-mini" data-action="start-loan" data-id="${Number(d.id)}" ${Number(d.so_luong)-Number(d.so_luong_hong)<=0?'disabled':''}>${icon('plus')} Đăng ký mượn</button>`}
      </div></div></article>`;
  }
  function filteredDevices() {
    const search = state.equipmentSearch.toLocaleLowerCase('vi');
    return state.equipment.filter(e =>
      (state.showHiddenDevices || Number(e.hoat_dong) === 1) &&
      (!state.equipmentCategory || e.loai === state.equipmentCategory) &&
      (!search || `${e.ten_thiet_bi} ${e.ma_thiet_bi} ${e.loai} ${e.mo_ta || ''}`.toLocaleLowerCase('vi').includes(search)));
  }
  function renderDevices() {
    const types = [...new Set(state.equipment.filter(e => isAdmin() || Number(e.hoat_dong)===1).map(e=>e.loai))]
      .sort((a,b)=>universityCategories.indexOf(a) < 0 ? (universityCategories.indexOf(b)<0 ? a.localeCompare(b,'vi') : 1) :
        (universityCategories.indexOf(b)<0 ? -1 : universityCategories.indexOf(a)-universityCategories.indexOf(b)));
    const items = filteredDevices();
    const activeCount = state.equipment.filter(e=>Number(e.hoat_dong)===1).length;
    const hiddenCount = state.equipment.length-activeCount;
    const addButton = isAdmin()?`<button class="btn btn-primary" data-action="new-device">${icon('plus')} Thêm thiết bị</button>`:
      `<button class="btn btn-primary" data-action="start-loan">${icon('plus')} Tạo phiếu mượn</button>`;
    $('#page-content').innerHTML = `
      ${pageHeading('Danh mục thiết bị đại học', `Có ${activeCount} mẫu thiết bị thuộc ${types.length} nhóm phục vụ học tập, giảng dạy và nghiên cứu.`,addButton)}
      <div class="toolbar"><div class="toolbar-left"><div class="search-box">${icon('search')}<input type="search" id="device-search" placeholder="Tên, mã, nhóm hoặc mục đích sử dụng..." value="${esc(state.equipmentSearch)}"></div>
      <select id="device-category" class="filter-select"><option value="">Tất cả nhóm</option>${types.map(t=>`<option value="${esc(t)}" ${state.equipmentCategory===t?'selected':''}>${esc(t)}</option>`).join('')}</select></div>
      <span class="result-hint" id="device-result-count">${num(items.length)} kết quả</span></div>
      <div class="category-shortcuts" aria-label="Lọc nhanh nhóm thiết bị">
        <button type="button" class="category-chip ${state.equipmentCategory===''?'active':''}" data-action="filter-device-category" data-category="">Tất cả</button>
        ${types.map(t=>`<button type="button" class="category-chip ${state.equipmentCategory===t?'active':''}" data-action="filter-device-category" data-category="${esc(t)}">${esc(t)}</button>`).join('')}
      </div>
      ${isAdmin()?`<label class="hidden-device-filter"><input type="checkbox" id="device-show-hidden" ${state.showHiddenDevices?'checked':''}> Hiển thị thiết bị đã xóa (ẩn) (${hiddenCount})</label>`:''}
      <div id="device-results">${items.length?`<div class="device-grid">${items.map(deviceCard).join('')}</div>`:emptyState('Không có thiết bị phù hợp','Hãy thử từ khóa hoặc loại thiết bị khác.')}</div>`;
  }
  function refreshDeviceResults() {
    const items = filteredDevices();
    $('#device-result-count').textContent = `${num(items.length)} kết quả`;
    document.querySelectorAll('.category-chip').forEach(chip => chip.classList.toggle('active', chip.dataset.category === state.equipmentCategory));
    $('#device-results').innerHTML = items.length?`<div class="device-grid">${items.map(deviceCard).join('')}</div>`:emptyState('Không có thiết bị phù hợp','Hãy thử từ khóa hoặc loại thiết bị khác.');
  }
  function loanRows(loans) {
    return loans.map(loan=>{
      const summary = (loan.items||[]).map(i=>`${esc(i.ten_thiet_bi)} × ${num(i.so_luong)}`).join('<br>');
      return `<tr><td><div class="name-main">#PM${String(loan.id).padStart(4,'0')}</div><div class="name-second">${dt(loan.tao_luc)}</div></td>
        ${isAdmin()?`<td><div class="name-main">${esc(loan.ho_ten)}</div><div class="name-second">${esc(loan.don_vi)}</div></td>`:''}
        <td><div class="name-main">${summary||'—'}</div></td><td><div>${dt(loan.ngay_muon)}</div><div class="name-second">→ ${dt(loan.ngay_hen_tra)}</div></td>
        <td>${statusBadge(loan)}</td><td><div class="table-actions"><button class="btn btn-subtle btn-mini" data-action="view-loan" data-id="${Number(loan.id)}">Chi tiết</button>
        ${loan.trang_thai==='cho_duyet' && isAdmin()?`<button class="btn btn-success btn-mini" data-action="approve-loan" data-id="${Number(loan.id)}">Duyệt</button>`:''}
        ${loan.trang_thai==='cho_duyet' && !isAdmin()?`<button class="btn btn-danger btn-mini" data-action="cancel-loan" data-id="${Number(loan.id)}">Hủy</button>`:''}
        ${['dang_muon','cho_tra'].includes(loan.trang_thai) && isAdmin()?`<button class="btn btn-success btn-mini" data-action="return-loan" data-id="${Number(loan.id)}">Trả</button>`:''}
        ${loan.trang_thai==='dang_muon' && !isAdmin()?`<button class="btn btn-amber btn-mini" data-action="request-return" data-id="${Number(loan.id)}">Đề nghị trả</button>`:''}
      </div></td></tr>`;
    }).join('');
  }
  function renderLoans() {
    const controls = isAdmin() ? '' : `<button class="btn btn-primary" data-page="devices">${icon('plus')} Mượn thiết bị</button>`;
    $('#page-content').innerHTML = `${pageHeading(isAdmin()?'Quản lý phiếu mượn':'Phiếu mượn của tôi',
      isAdmin()?'Duyệt yêu cầu, ghi nhận trả và giám sát các phiếu quá hạn.':'Xem trạng thái phiếu, hủy yêu cầu hoặc gửi đề nghị trả thiết bị.',controls)}
      <div class="toolbar"><div class="toolbar-left"><div class="search-box">${icon('search')}<input type="search" id="loan-search" placeholder="Mã phiếu, thiết bị, người mượn..." value="${esc(state.loanSearch)}"></div>
      <select class="filter-select" id="loan-status"><option value="">Tất cả trạng thái</option><option value="qua_han" ${state.loanStatus==='qua_han'?'selected':''}>Quá hạn</option>
      ${Object.entries(labels).map(([id,text])=>`<option value="${id}" ${state.loanStatus===id?'selected':''}>${esc(text)}</option>`).join('')}</select></div>
      <span id="loan-result-count" class="result-hint">${num(state.loans.length)} phiếu</span></div>
      <section class="panel" id="loan-results"></section>`;
    refreshLoanResults();
  }
  function refreshLoanResults() {
    const search = state.loanSearch.toLocaleLowerCase('vi');
    const filtered = state.loans.filter(l => {
      const statusOk = !state.loanStatus || (state.loanStatus==='qua_han' ? Number(l.qua_han) === 1 : l.trang_thai===state.loanStatus);
      const searchOk = !search || (`PM${l.id} ${l.id} ${l.ho_ten} `+(l.items||[]).map(i=>i.ten_thiet_bi).join(' ')).toLocaleLowerCase('vi').includes(search);
      return statusOk && searchOk;
    });
    $('#loan-result-count').textContent = `${num(filtered.length)} phiếu`;
    $('#loan-results').innerHTML = filtered.length?`<div class="table-wrap"><table class="data-table"><thead><tr><th>Phiếu mượn</th>${isAdmin()?'<th>Người mượn</th>':''}<th>Thiết bị</th><th>Ngày mượn / Hẹn trả</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>${loanRows(filtered)}</tbody></table></div>`:
      emptyState('Chưa có phiếu phù hợp','Thử thay đổi bộ lọc, hoặc tạo phiếu đăng ký mượn mới.');
  }
  function renderBorrowers() {
    const search = state.borrowerSearch.toLocaleLowerCase('vi');
    const items = state.borrowers.filter(u=>`${u.ho_ten} ${u.don_vi} ${u.email} ${u.sdt}`.toLocaleLowerCase('vi').includes(search));
    $('#page-content').innerHTML = `${pageHeading('Quản lý người mượn','Thêm, sửa, vô hiệu hóa và mở lại tài khoản người mượn.',
      `<button class="btn btn-primary" data-action="new-borrower">${icon('plus')} Thêm người mượn</button>`)}
      <div class="toolbar"><div class="toolbar-left"><div class="search-box">${icon('search')}<input type="search" id="borrower-search" placeholder="Tên, đơn vị, email, SĐT..." value="${esc(state.borrowerSearch)}"></div></div>
      <span class="result-hint" id="borrower-result-count">${num(items.length)} người</span></div>
      <section class="panel" id="borrower-results"></section>`;
    refreshBorrowerResults();
  }
  function refreshBorrowerResults() {
    const search = state.borrowerSearch.toLocaleLowerCase('vi');
    const items = state.borrowers.filter(u=>`${u.ho_ten} ${u.don_vi} ${u.email} ${u.sdt}`.toLocaleLowerCase('vi').includes(search));
    $('#borrower-result-count').textContent = `${num(items.length)} người`;
    $('#borrower-results').innerHTML = items.length?`<div class="table-wrap"><table class="data-table"><thead><tr><th>Người mượn</th><th>Email</th><th>Đơn vị</th><th>Số phiếu</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>
      ${items.map(u=>`<tr><td><div class="name-main">${esc(u.ho_ten)}</div><div class="name-second">${esc(u.sdt)}</div></td><td>${esc(u.email||'—')}</td><td>${esc(u.don_vi)}</td>
      <td>${num(u.so_phieu)}</td><td><span class="status-pill ${Number(u.hoat_dong)?'good':'inactive'}">${Number(u.hoat_dong)?'Hoạt động':'Đã khóa'}</span></td>
      <td><div class="table-actions"><button class="btn btn-subtle btn-mini" data-action="edit-borrower" data-id="${Number(u.id)}">Sửa</button>
      <button class="btn ${Number(u.hoat_dong)?'btn-danger':'btn-success'} btn-mini" data-action="toggle-borrower" data-id="${Number(u.id)}" data-active="${Number(u.hoat_dong)?'0':'1'}">${Number(u.hoat_dong)?'Xóa':'Khôi phục'}</button></div></td></tr>`).join('')}</tbody></table></div>`:
      emptyState('Chưa có người mượn','Bạn có thể thêm người mượn mới bằng nút phía trên.');
  }
  function renderProfile() {
    const user = state.user;
    $('#page-content').innerHTML = `${pageHeading('Hồ sơ cá nhân','Quản lý thông tin người mượn của bạn.')}
      <section class="panel profile-card"><div class="panel-body"><div class="profile-summary"><div class="avatar-large">${esc(user.name[0].toUpperCase())}</div><div><h3>${esc(user.name)}</h3><p>${esc(user.email)} · Người dùng</p></div></div>
      <form id="profile-form" class="form-grid"><label class="field span-full">Họ và tên<input name="name" maxlength="120" value="${esc(user.name)}" required></label>
      <label class="field">Đơn vị / lớp<input name="department" maxlength="160" value="${esc(user.department)}" required></label>
      <label class="field">Số điện thoại<input name="phone" maxlength="20" value="${esc(user.phone)}" required></label>
      <label class="field span-full">Email (không chỉnh sửa tại đây)<input value="${esc(user.email)}" disabled></label>
      <div class="form-footer span-full"><button class="btn btn-primary" type="submit">${icon('check')} Lưu thay đổi</button></div></form></div></section>`;
  }
  function openModal(title, content) {
    $('#modal-title').textContent = title;
    $('#modal-body').innerHTML = content;
    $('#modal-backdrop').classList.remove('hidden');
    $('#modal-backdrop').setAttribute('aria-hidden','false');
    document.body.style.overflow = 'hidden';
    $('#modal-body').querySelector('input,select,button')?.focus();
  }
  function closeModal() {
    $('#modal-backdrop').classList.add('hidden');
    $('#modal-backdrop').setAttribute('aria-hidden','true');
    document.body.style.overflow='';
  }
  const formFooter = (label) => `<div class="form-footer span-full"><button type="button" class="btn btn-subtle" data-action="close-modal">Hủy</button><button class="btn btn-primary" type="submit">${icon('check')} ${esc(label)}</button></div>`;
  function equipmentModal(id=null) {
    const d = id==null?null:state.equipment.find(e=>Number(e.id)===Number(id));
    if (id!=null && !d) return toast('Thiết bị không tồn tại.',true);
    openModal(d?'Chỉnh sửa thiết bị':'Thêm thiết bị', `<form id="equipment-form" class="form-grid">
      <input type="hidden" name="id" value="${d?Number(d.id):''}">
      <label class="field">Mã thiết bị (để trống để tự tạo)<input name="code" maxlength="30" value="${esc(d?.ma_thiet_bi)}" placeholder="Tự tạo, ví dụ TB011" autocomplete="off"></label>
      <label class="field">Nhóm thiết bị<input name="category" list="equipment-category-options" maxlength="100" value="${esc(d?.loai)}" placeholder="Chọn hoặc nhập nhóm thiết bị" required>
        <datalist id="equipment-category-options">${[...new Set([...universityCategories, ...state.equipment.map(e=>e.loai)])].map(c=>`<option value="${esc(c)}"></option>`).join('')}</datalist></label>
      <label class="field span-full">Tên thiết bị<input name="name" maxlength="160" value="${esc(d?.ten_thiet_bi)}" placeholder="Tên đầy đủ của thiết bị" required></label>
      <label class="field">Tổng số lượng<input name="quantity" type="number" min="0" max="1000000" value="${d?Number(d.so_luong):1}" required></label>
      <label class="field">Số lượng hỏng<input name="damaged" type="number" min="0" max="1000000" value="${d?Number(d.so_luong_hong):0}" required></label>
      <label class="field span-full">Tình trạng<select name="condition"><option value="tot" ${!d||d.tinh_trang==='tot'?'selected':''}>Hoạt động tốt</option>
      <option value="bao_tri" ${d?.tinh_trang==='bao_tri'?'selected':''}>Đang bảo trì</option><option value="hong" ${d?.tinh_trang==='hong'?'selected':''}>Hư hỏng / Ngừng cho mượn</option></select></label>
      <label class="field span-full">Mục đích sử dụng / mô tả<textarea name="description" maxlength="2000" placeholder="Ví dụ: Phòng thực hành mạng; phục vụ học phần Mạng máy tính; kèm cáp nguồn...">${esc(d?.mo_ta)}</textarea></label>
      <p class="form-hint span-full">Gợi ý: chọn nhóm thiết bị thống nhất theo trường đại học để thuận tiện lọc và tìm kiếm. Nếu chưa có mã, cứ để trống: hệ thống sẽ tự sinh mã không trùng. Mã đã tồn tại, kể cả thiết bị đã ẩn, không thể dùng lại. Tổng số lượng − số lượng hỏng phải đủ cho các phiếu đã duyệt.</p>
      ${formFooter(d?'Lưu thay đổi':'Thêm thiết bị')}</form>`);
  }
  function borrowerModal(id=null) {
    const u = id==null?null:state.borrowers.find(e=>Number(e.id)===Number(id));
    if (id!=null && !u) return toast('Không tìm thấy người mượn.',true);
    openModal(u?'Chỉnh sửa người mượn':'Thêm người mượn', `<form id="borrower-form" class="form-grid"><input type="hidden" name="id" value="${u?Number(u.id):''}">
      <label class="field span-full">Họ và tên<input name="name" maxlength="120" required value="${esc(u?.ho_ten)}" placeholder="Họ tên đầy đủ"></label>
      <label class="field">Đơn vị / lớp<input name="department" maxlength="160" required value="${esc(u?.don_vi)}" placeholder="Đơn vị công tác"></label>
      <label class="field">Số điện thoại<input name="phone" maxlength="20" required value="${esc(u?.sdt)}" placeholder="09xxxxxxxx"></label>
      <label class="field span-full">Email đăng nhập<input name="email" type="email" maxlength="190" required value="${esc(u?.email)}" placeholder="name@example.com"></label>
      <label class="field span-full">${u?'Mật khẩu mới (để trống nếu không đổi)':'Mật khẩu ban đầu'}<input name="password" type="password" minlength="8" ${u?'':'required'} placeholder="Ít nhất 8 ký tự" autocomplete="new-password"></label>
      <p class="form-hint span-full">Người mượn đăng nhập bằng email và mật khẩu. Chỉ Admin có quyền tạo, khóa hoặc mở lại tài khoản tại đây.</p>
      ${formFooter(u?'Lưu thay đổi':'Tạo người mượn')}</form>`);
  }
  async function checkLoanForm(form, enforce=false) {
    const start = form.elements.namedItem('start')?.value || '';
    const due = form.elements.namedItem('due')?.value || '';
    const status = form.querySelector('#loan-availability-status');
    const inputs = [...form.querySelectorAll('[data-qty-id]')];
    if (!start || !due || due < start || start < dateISO() || plusDaysISO(start,60) < due) {
      const message = 'Ngày mượn phải từ hôm nay, ngày trả không sớm hơn ngày mượn và thời hạn tối đa 60 ngày.';
      if(status) status.textContent = message;
      if(enforce) throw new Error(message);
      return false;
    }
    const req = ++state.loanAvailabilityRequest;
    if(status) status.textContent = 'Đang kiểm tra lịch và số lượng thiết bị...';
    try {
      const result = await api('availability_check',undefined,{start,due,ids:inputs.map(x=>x.dataset.qtyId).join(',')});
      if (req!==state.loanAvailabilityRequest || !document.contains(form)) {
        if (enforce) throw new Error('Lịch đã thay đổi trong lúc kiểm tra. Vui lòng thử lại.');
        return false;
      }
      const byId = new Map(result.items.map(i=>[Number(i.id),i]));
      let warning = '';
      inputs.forEach(input=>{
        const info = byId.get(Number(input.dataset.qtyId));
        if (!info) return;
        const free = Number(info.available);
        input.max = String(free);
        const stock = form.querySelector(`[data-free-id="${Number(info.id)}"]`);
        if(stock) stock.textContent = num(free);
        const requested = Number(input.value||0);
        if (requested > free && !warning) warning = `${info.name} chỉ còn ${free} trong lịch đã chọn.`;
      });
      if(status) {
        status.textContent = warning || 'Đã kiểm tra: số lượng hiển thị là mức còn trống thấp nhất trong suốt khoảng mượn.';
        status.classList.toggle('schedule-warning',Boolean(warning));
      }
      if(warning && enforce) throw new Error(warning);
      return !warning;
    } catch (e) {
      if (req===state.loanAvailabilityRequest && status) {
        status.textContent=e.message;
        status.classList.add('schedule-warning');
      }
      if(enforce) throw e;
      return false;
    }
  }

  async function loanCreateModal(focusId=null, requestedDate=null) {
    try {
      const items=(await api('equipment_list')).items;
      const available=items.filter(i=>i.tinh_trang==='tot' && Number(i.hoat_dong)===1 &&
        Number(i.so_luong)>Number(i.so_luong_hong));
      const singleDevice=focusId!==null && focusId!==undefined;
      const chosen=singleDevice ? available.find(i=>Number(i.id)===Number(focusId)) : null;
      if(singleDevice && !chosen) return toast('Thiết bị này không còn hoạt động hoặc đã hỏng.',true);
      const devices=singleDevice?[chosen]:available;
      if(!devices.length) return toast('Không có thiết bị hoạt động để đăng ký.',true);
      const start=requestedDate && requestedDate>=dateISO()? requestedDate:dateISO();
      const due=plusDaysISO(start,7);
      const deviceList=singleDevice ? `<div class="span-full"><h3 class="detail-heading">Thiết bị đã chọn</h3>
        <div class="selected-loan-item"><div class="selected-loan-art">${icon('box')}</div>
          <div class="selected-loan-description"><strong>${esc(chosen.ten_thiet_bi)}</strong>
            <small>${esc(chosen.ma_thiet_bi)} · ${esc(chosen.loai)}</small>
            <span>Còn theo lịch đã chọn: <b data-free-id="${Number(chosen.id)}">...</b></span></div>
          <label class="selected-loan-quantity">Số lượng
            <input data-qty-id="${Number(chosen.id)}" type="number" required min="1" max="${Number(chosen.so_luong)-Number(chosen.so_luong_hong)}" value="1"></label>
        </div><p class="form-hint">Chỉ đăng ký thiết bị được chọn. Có thể thay đổi ngày để xem số lượng còn trống.</p></div>`
        : `<div class="span-full"><h3 class="detail-heading">Chọn thiết bị</h3>
          <p class="form-hint">Nhập số lượng (0 nếu không chọn). Số lượng trống được tính theo khoảng ngày bên trên.</p>
          <div class="table-wrap"><table class="loan-choose-table"><thead><tr><th>Thiết bị</th><th>Còn theo lịch</th><th>Đăng ký</th></tr></thead><tbody>
          ${devices.map(i=>`<tr><td><strong>${esc(i.ten_thiet_bi)}</strong><div class="name-second">${esc(i.ma_thiet_bi)}</div></td>
             <td><strong data-free-id="${Number(i.id)}">...</strong></td><td><input data-qty-id="${Number(i.id)}" type="number" min="0" max="${Number(i.so_luong)-Number(i.so_luong_hong)}" value="0" aria-label="Số lượng ${esc(i.ten_thiet_bi)}"></td></tr>`).join('')}
          </tbody></table></div></div>`;
      openModal(singleDevice?`Đăng ký mượn: ${chosen.ten_thiet_bi}`:'Đăng ký mượn thiết bị',
        `<form id="loan-form" class="form-grid">
          <label class="field">Ngày mượn<input type="date" name="start" min="${dateISO()}" value="${start}" required></label>
          <label class="field">Ngày hẹn trả<input type="date" name="due" min="${start}" value="${due}" required></label>
          <div class="span-full loan-date-status" id="loan-availability-status" role="status">Đang tải lịch...</div>
          ${deviceList}
          <label class="field span-full">Ghi chú (tùy chọn)<textarea maxlength="500" name="note" placeholder="Mục đích sử dụng thiết bị..."></textarea></label>
          <p class="form-hint span-full">Phiếu <b>Chờ duyệt</b> chưa giữ chỗ. Khi Admin duyệt, hệ thống kiểm tra lại lịch để tránh cấp vượt số lượng. Các ngày đầu/cuối đều tính là ngày sử dụng thiết bị.</p>
          ${formFooter('Gửi yêu cầu mượn')}</form>`);
      await checkLoanForm($('#loan-form'));
    } catch(e) {toast(e.message,true);}
  }

  function getLoan(id) {
    const l = state.loans.find(i=>Number(i.id)===Number(id));
    if (!l) toast('Không tìm thấy phiếu. Vui lòng tải lại.',true);
    return l;
  }
  function loanDetailModal(id) {
    const l = getLoan(id);
    if (!l) return;
    const lines = (l.items||[]).map(i=>`<tr><td><strong>${esc(i.ten_thiet_bi)}</strong><div class="name-second">${esc(i.ma_thiet_bi)}</div></td><td>${num(i.so_luong)}</td><td>${num(i.so_luong_hong)}</td></tr>`).join('');
    const actions=[];
    if (isAdmin() && l.trang_thai==='cho_duyet') {
      actions.push(`<button class="btn btn-danger" data-action="reject-loan" data-id="${Number(l.id)}">Từ chối</button>`);
      actions.push(`<button class="btn btn-success" data-action="approve-loan" data-id="${Number(l.id)}">Duyệt phiếu</button>`);
    }
    if (isAdmin() && ['dang_muon','cho_tra'].includes(l.trang_thai)) actions.push(`<button class="btn btn-success" data-action="return-loan" data-id="${Number(l.id)}">Ghi nhận trả</button>`);
    if (!isAdmin() && l.trang_thai==='cho_duyet') actions.push(`<button class="btn btn-danger" data-action="cancel-loan" data-id="${Number(l.id)}">Hủy phiếu</button>`);
    if (!isAdmin() && l.trang_thai==='dang_muon') actions.push(`<button class="btn btn-amber" data-action="request-return" data-id="${Number(l.id)}">Đề nghị trả</button>`);
    openModal('Chi tiết phiếu #PM'+String(l.id).padStart(4,'0'), `
      <div class="detail-grid"><div class="detail-item"><small>Người mượn</small><strong>${esc(l.ho_ten)}</strong></div><div class="detail-item"><small>Trạng thái</small>${statusBadge(l)}</div>
      <div class="detail-item"><small>Ngày mượn</small><strong>${dt(l.ngay_muon)}</strong></div><div class="detail-item"><small>Ngày hẹn trả</small><strong>${dt(l.ngay_hen_tra)}</strong></div>
      <div class="detail-item"><small>Ngày trả thực tế</small><strong>${dt(l.ngay_tra)}</strong></div><div class="detail-item"><small>Đơn vị / lớp</small><strong>${esc(l.don_vi)}</strong></div></div>
      <h3 class="detail-heading">Thiết bị trong phiếu</h3><div class="table-wrap"><table class="detail-table"><thead><tr><th>Thiết bị</th><th>Số lượng</th><th>Đã ghi hỏng</th></tr></thead><tbody>${lines}</tbody></table></div>
      ${l.trang_thai==='da_duyet'?`<div class="message-box">Phiếu đã được duyệt. Hệ thống sẽ tự chuyển sang <strong>Đang mượn</strong> vào ngày ${dt(l.ngay_muon)} (giờ Việt Nam). Thiết bị đã được giữ số lượng.</div>`:''}
      ${l.ghi_chu?`<div class="message-box">Ghi chú: ${esc(l.ghi_chu)}</div>`:''}
      ${l.ly_do_tu_choi?`<div class="message-box">Lý do từ chối: ${esc(l.ly_do_tu_choi)}</div>`:''}
      ${actions.length?`<div class="form-footer">${actions.join('')}</div>`:''}`);
  }
  function returnModal(id) {
    const l=getLoan(id);
    if (!l) return;
    openModal('Xác nhận trả phiếu #PM'+String(id).padStart(4,'0'), `<form id="return-form" class="form-grid"><input type="hidden" name="id" value="${Number(id)}">
      <div class="span-full"><p class="form-hint">Kiểm tra toàn bộ thiết bị đã bàn giao. Điền số lượng hỏng tại thời điểm trả (mặc định 0).</p>
      <div class="table-wrap"><table class="loan-choose-table"><thead><tr><th>Thiết bị</th><th>Đã mượn</th><th>Số lượng hỏng</th></tr></thead><tbody>
      ${(l.items||[]).map(i=>`<tr><td><strong>${esc(i.ten_thiet_bi)}</strong></td><td>${num(i.so_luong)}</td><td><input class="return-quantity" type="number" data-damaged-id="${Number(i.thiet_bi_id)}" min="0" max="${Number(i.so_luong)}" value="0" required></td></tr>`).join('')}
      </tbody></table></div></div>
      <div class="message-box span-full">Thao tác này ghi nhận trả <strong>toàn bộ</strong> phiếu, giải phóng số lượng sử dụng tốt. Thiết bị hỏng sẽ được cộng vào tồn hỏng và không được cho mượn tiếp.</div>
      ${formFooter('Xác nhận đã nhận trả')}</form>`);
  }
  function rejectModal(id) {
    openModal('Từ chối phiếu #PM'+String(id).padStart(4,'0'), `<form id="reject-form" class="form-grid"><input type="hidden" name="id" value="${Number(id)}">
      <label class="field span-full">Lý do từ chối<textarea name="reason" maxlength="500" required placeholder="Ví dụ: Thiết bị không đủ số lượng hoặc không đáp ứng điều kiện mượn..."></textarea></label>
      ${formFooter('Xác nhận từ chối')}</form>`);
  }
  async function performAction(action, data, confirmation) {
    if (confirmation && !window.confirm(confirmation)) return;
    try {
      const result = await api(action,data);
      toast(result.message || 'Thao tác thành công.');
      closeModal();
      await navigate(state.page);
      loadNotifications();
    } catch (error) {toast(error.message,true);}
  }
  function validateRegisterPasswords(form) {
    const password=form.querySelector('input[name="password"]');
    const confirm=form.querySelector('input[name="password_confirm"]');
    if(!password || !confirm)return true;
    confirm.setCustomValidity(confirm.value && password.value!==confirm.value ? 'Mật khẩu xác nhận không khớp.' : '');
    return confirm.checkValidity();
  }
  function showFormError(form, message) {
    let node = form.querySelector('.form-error');
    if (!node) {
      node = document.createElement('div');
      node.className = 'form-error span-full';
      node.setAttribute('role', 'alert');
      form.querySelector('.form-footer')?.before(node);
      if (!node.isConnected) form.prepend(node);
    }
    node.textContent = message;
    node.scrollIntoView({behavior:'smooth',block:'nearest'});
  }
  function closeSidebar() {
    $('#sidebar').classList.remove('open');
    $('.sidebar-overlay').classList.remove('show');
  }

  document.addEventListener('click', async (event) => {
    const avatar = event.target.closest('#header-avatar');
    if (avatar) {
      closeNotifications();
      const menu = $('#account-menu');
      const opening = menu.classList.contains('hidden');
      menu.classList.toggle('hidden',!opening);
      avatar.setAttribute('aria-expanded',String(opening));
      return;
    }
    const bell = event.target.closest('#notification-bell');
    if (bell) {
      closeAccountMenu();
      const panel = $('#notification-panel');
      const opening = panel.classList.contains('hidden');
      panel.classList.toggle('hidden', !opening);
      bell.setAttribute('aria-expanded', String(opening));
      if (opening) loadNotifications(true);
      return;
    }
    if (!event.target.closest('#calendar-device-combobox')) calendarCloseChoices();
    if (!event.target.closest('.notification-center')) closeNotifications();
    if (!event.target.closest('#account-menu')) closeAccountMenu();
    const tab = event.target.closest('[data-auth-tab]');
    if (tab) {setAuthTab(tab.dataset.authTab);return;}
    const route = event.target.closest('[data-page]');
    if (route) {closeAccountMenu();navigate(route.dataset.page);return;}
    const target = event.target.closest('[data-action]');
    if (!target) return;
    const action=target.dataset.action;
    const id=Number(target.dataset.id);
    switch(action) {
      case 'close-notifications':closeNotifications();break;
      case 'notification-read-all':
        try { await api('notification_read_all', {}); await loadNotifications(); }
        catch (e) { toast(e.message, true); }
        break;
      case 'notification-open': await openNotification(target); break;
      case 'notification-delete':
        try {
          const result=await api('notification_delete',{id});
          await loadNotifications();
          toast(result.message);
        } catch(e) {toast(e.message,true);}
        break;
      case 'notification-delete-all':
        if (!state.notifications.length || !window.confirm('Bạn muốn xóa tất cả thông báo của tài khoản này?')) break;
        try {
          const result=await api('notification_delete_all',{});
          await loadNotifications();
          toast(result.message);
        } catch(e) {toast(e.message,true);}
        break;
      case 'toggle-theme':toggleTheme();break;
      case 'dismiss-welcome':
        state.welcomeDismissed = true;
        try { sessionStorage.setItem(welcomeKey,'1'); } catch (_) {}
        if (state.page === 'overview') renderOverview();
        break;
      case 'close-modal':closeModal();break;
      case 'close-sidebar':closeSidebar();break;
      case 'reload':navigate(state.page);break;
      case 'logout':
        try {const r=await api('logout',{});state.csrf=r.csrf;state.user=null;showAuth();toast('Đã đăng xuất.');}
        catch (e) {toast(e.message,true);}break;
      case 'filter-device-category':
        state.equipmentCategory = target.dataset.category || '';
        if ($('#device-category')) $('#device-category').value = state.equipmentCategory;
        refreshDeviceResults();
        break;
      case 'calendar-pick-device':calendarPickDevice(id);break;
      case 'calendar-toggle-more':
        calendarShowAllChoices=!calendarShowAllChoices;
        calendarShowChoices(calendarChoicesTerm);
        if(calendarShowAllChoices) [...document.querySelectorAll('#calendar-device-options .calendar-option')][9]?.scrollIntoView({block:'nearest'});
        break;
      case 'calendar-prev': state.calendarMonth=addMonths(state.calendarMonth,-1);refreshCalendarMonth();break;
      case 'calendar-next': state.calendarMonth=addMonths(state.calendarMonth,1);refreshCalendarMonth();break;
      case 'calendar-current': state.calendarMonth=dateOnlyMonth();refreshCalendarMonth();break;
      case 'calendar-retry': refreshCalendarMonth();break;
      case 'calendar-toggle':
        state.calendarExpanded=!state.calendarExpanded;
        { const body=$('#calendar-browser-body');
          const toggle=document.querySelector('[data-action="calendar-toggle"]');
          if(body) body.classList.toggle('hidden',!state.calendarExpanded);
          if(toggle) {toggle.setAttribute('aria-expanded',String(state.calendarExpanded));toggle.innerHTML=`${state.calendarExpanded?'Thu gọn':'Xem lịch tháng'} ${icon('arrow')}`;}
          if(state.calendarExpanded) refreshCalendarMonth(); }
        break;
      case 'calendar-preset': {
        const form=$('#calendar-quick-form'); if(!form)break;
        const n=Number(target.dataset.calendarDuration);
        form.elements.namedItem('due').value=plusDaysISO(form.elements.namedItem('start').value,n-1);
        calendarSyncState();checkCalendarQuickForm();break;
      }
      case 'calendar-select-day': {
        const form=$('#calendar-quick-form');if(!form)break;
        const selectedDay=target.dataset.date;
        if(!selectedDay || selectedDay<dateISO())break;
        const currentLength=Math.max(1,Math.min(61,calendarDuration(form.elements.namedItem('start').value,form.elements.namedItem('due').value)||3));
        form.elements.namedItem('start').value=selectedDay;
        form.elements.namedItem('due').min=selectedDay;
        form.elements.namedItem('due').max=plusDaysISO(selectedDay,60);
        form.elements.namedItem('due').value=plusDaysISO(selectedDay,currentLength-1);
        calendarSyncState();checkCalendarQuickForm();break;
      }
      case 'new-device':equipmentModal();break;
      case 'edit-device':equipmentModal(id);break;
      case 'toggle-device':performAction('equipment_toggle',{id,active:target.dataset.active==='1'},target.dataset.active==='1'?'Khôi phục thiết bị này?':'Ẩn thiết bị này khỏi danh mục? Lịch sử và phiếu đang mượn vẫn được giữ nguyên.');break;
      case 'new-borrower':borrowerModal();break;
      case 'edit-borrower':borrowerModal(id);break;
      case 'toggle-borrower':performAction('borrower_toggle',{id,active:target.dataset.active==='1'},target.dataset.active==='1'?'Mở lại tài khoản người mượn?':'Vô hiệu hóa người mượn và tài khoản đăng nhập?');break;
      case 'start-loan':loanCreateModal(target.dataset.id? id:null);break;
      case 'view-loan':loanDetailModal(id);break;
      case 'approve-loan':performAction('loan_approve',{id},'Xác nhận Duyệt phiếu mượn này?');break;
      case 'reject-loan':rejectModal(id);break;
      case 'cancel-loan':performAction('loan_cancel',{id},'Bạn chắc chắn muốn hủy phiếu đang chờ duyệt?');break;
      case 'request-return':performAction('loan_request_return',{id},'Bạn xác nhận muốn gửi đề nghị trả thiết bị?');break;
      case 'return-loan':returnModal(id);break;
    }
  });
  document.addEventListener('keydown',e => {if (e.key==='Escape') {closeModal();closeAccountMenu();closeNotifications();}});
  $('#modal-backdrop').addEventListener('click',e=>{if(e.target===$('#modal-backdrop'))closeModal();});
  $('#open-sidebar').addEventListener('click',()=>{
    $('#sidebar').classList.add('open'); $('.sidebar-overlay').classList.add('show');
  });
  document.addEventListener('focusin',e=>{
    if(e.target.id!=='calendar-device-search')return;
    const selected=calendarDevices().find(d=>Number(d.id)===Number($('#calendar-device')?.value));
    if(selected && e.target.value===calendarDeviceLabel(selected)) {
      e.target.select(); 
      calendarShowAllChoices=false;
      calendarShowChoices('');
    } else {calendarShowAllChoices=false;calendarShowChoices(e.target.value);}
  });
  document.addEventListener('keydown',e=>{
    if(e.target.id!=='calendar-device-search')return;
    const input=e.target;
    const options=[...document.querySelectorAll('#calendar-device-options .calendar-option:not(:disabled)')];
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){
      e.preventDefault();
      if(input.getAttribute('aria-expanded')!=='true')calendarShowChoices('');
      else if(options.length)calendarMarkActive(calendarActiveOption+(e.key==='ArrowDown'?1:-1));
    } else if(e.key==='Enter'){
      e.preventDefault(); 
      if(input.getAttribute('aria-expanded')==='true' && options[calendarActiveOption])
        calendarPickDevice(Number(options[calendarActiveOption].dataset.id));
    } else if(e.key==='Escape'){
      calendarCloseChoices();
    } else if(e.key==='Tab')calendarCloseChoices();
  });
  document.addEventListener('input', (e) => {
    if (e.target.id==='device-search') {state.equipmentSearch=e.target.value;refreshDeviceResults();}
    if (e.target.id==='loan-search') {state.loanSearch=e.target.value;refreshLoanResults();}
    if (e.target.id==='borrower-search') {state.borrowerSearch=e.target.value;refreshBorrowerResults();}
    if (e.target.id==='calendar-device-search') {
      const hidden=$('#calendar-device');
      const selected=calendarDevices().find(d=>Number(d.id)===Number(hidden?.value));
      if(!selected || e.target.value!==calendarDeviceLabel(selected)) {
        if(hidden)hidden.value='';
        calendarSyncState();
        checkCalendarQuickForm(); 
        if(state.calendarExpanded)refreshCalendarMonth();
      }
      calendarShowAllChoices=false;
      calendarShowChoices(e.target.value);
    }
    if(e.target.matches('#register-form input[name="password"], #register-form input[name="password_confirm"]')) {
      validateRegisterPasswords($('#register-form'));
    }
    if (e.target.id==='calendar-quantity') {calendarSyncState();checkCalendarQuickForm();}
    if (e.target.matches('#calendar-quick-form textarea[name="note"]')) calendarSyncState();
    if (e.target.matches('#loan-form [data-qty-id]')) {
      const max=Number(e.target.max);
      if(Number(e.target.value)>max) { const s=$('#loan-availability-status'); if(s) {s.textContent='Số lượng đã nhập vượt số còn trống trong khoảng ngày chọn.';s.classList.add('schedule-warning');} }
    }
  });
  document.addEventListener('change', (e) => {
    if (e.target.id==='device-category') {state.equipmentCategory=e.target.value;refreshDeviceResults();}
    if (e.target.id==='device-show-hidden') {state.showHiddenDevices=e.target.checked;refreshDeviceResults();}
    if (e.target.closest('#calendar-quick-form') && ['start','due','quantity'].includes(e.target.name)) {
      const f=e.target.closest('form');
      if(e.target.name==='start') {
        f.elements.namedItem('due').min=e.target.value;
        f.elements.namedItem('due').max=plusDaysISO(e.target.value,60);
        if(f.elements.namedItem('due').value<e.target.value) f.elements.namedItem('due').value=e.target.value;
        if(f.elements.namedItem('due').value>f.elements.namedItem('due').max) f.elements.namedItem('due').value=f.elements.namedItem('due').max;
        if(state.calendarExpanded && e.target.value.slice(0,7)!==state.calendarMonth) {
          state.calendarMonth=e.target.value.slice(0,7);refreshCalendarMonth();
        }
      }
      calendarSyncState();checkCalendarQuickForm();
    }
    if (e.target.closest('#loan-form') && ['start','due'].includes(e.target.name)) {
      const f=e.target.closest('form');
      if (e.target.name==='start' && f.elements.namedItem('due')) {
        f.elements.namedItem('due').min=e.target.value;
        if (f.elements.namedItem('due').value < e.target.value) f.elements.namedItem('due').value=e.target.value;
      }
      checkLoanForm(f);
    }
    if (e.target.id==='loan-status') {state.loanStatus=e.target.value;refreshLoanResults();}
  });
  document.addEventListener('submit', async (event) => {
    const form=event.target;
    const formId=form.getAttribute('id');
    if (!['login-form','register-form','equipment-form','borrower-form','loan-form','calendar-quick-form','return-form','reject-form','profile-form'].includes(formId)) return;
    event.preventDefault();
    const button = form.querySelector('[type=submit]');
    if (button) button.disabled=true;
    const values=Object.fromEntries(new FormData(form).entries());
    try {
      switch (formId) {
        case 'login-form': {
          const result=await api('login',{email:values.email,password:values.password});
          state.user=result.user;
          state.calendarDeviceId=null;state.calendarMonth='';state.calendarStart='';state.calendarDue='';
          state.calendarQuantity=1;state.calendarNote='';state.calendarExpanded=null;
          state.welcomeDismissed = false;
          try { sessionStorage.removeItem(welcomeKey); } catch (_) {}
          form.reset();
          showWorkspace();toast('Đăng nhập thành công.');break;
        }
        case 'register-form': {
          if (!values.password_confirm || values.password!==values.password_confirm || !validateRegisterPasswords(form)) {
            form.elements.namedItem('password_confirm')?.focus();
            throw new Error('Mật khẩu xác nhận phải trùng với mật khẩu đã nhập.');
          }
          const result=await api('register',values);
          form.reset();setAuthTab('login');toast(result.message);break;
        }
        case 'equipment-form': {
          const payload={...values, quantity:Number(values.quantity), damaged:Number(values.damaged)};
          if (values.id) payload.id=Number(values.id); else delete payload.id;
          if (!Number.isSafeInteger(payload.quantity) || !Number.isSafeInteger(payload.damaged) || payload.quantity<0 || payload.damaged<0 || payload.damaged>payload.quantity) {
            throw new Error('Số lượng phải là số nguyên không âm và số lượng hỏng không được vượt quá tổng số lượng.');
          }
          const r=await api('equipment_save',payload);
          state.equipmentSearch='';state.equipmentCategory='';state.showHiddenDevices=false;
          closeModal();await navigate('devices');toast(r.message);break;
        }
        case 'borrower-form': {
          const r=await api('borrower_save',values);toast(r.message);closeModal();await navigate('borrowers');break;
        }
        case 'calendar-quick-form': {
          if(isAdmin()) throw new Error('Admin chỉ có thể tra cứu lịch.');
          calendarSyncState();
          await checkCalendarQuickForm(true);
          const deviceId=Number(values.device_id);
          const quantity=Number(values.quantity);
          const result=await api('loan_create',{start:values.start,due:values.due,note:values.note||'',items:[{id:deviceId,quantity}]});
          toast(result.message);await navigate('loans');loadNotifications();break;
        }
        case 'loan-form': {
          const items=[...form.querySelectorAll('[data-qty-id]')].map(input=>({id:Number(input.dataset.qtyId),quantity:Number(input.value||0)})).filter(i=>i.quantity>0);
          if (!items.length) throw new Error('Vui lòng chọn ít nhất một thiết bị có số lượng lớn hơn 0.');
          await checkLoanForm(form,true);
          const r=await api('loan_create',{start:values.start,due:values.due,note:values.note,items});
          toast(r.message);closeModal();await navigate('loans');loadNotifications();break;
        }
        case 'return-form': {
          const damages={};
          form.querySelectorAll('[data-damaged-id]').forEach(input=>damages[input.dataset.damagedId]=Number(input.value));
          const r=await api('loan_return',{id:Number(values.id),damages});
          toast(r.message);closeModal();await navigate('loans');loadNotifications();break;
        }
        case 'reject-form': {
          const r=await api('loan_reject',{id:Number(values.id),reason:values.reason});
          toast(r.message);closeModal();await navigate('loans');loadNotifications();break;
        }
        case 'profile-form': {
          const r=await api('profile_update',values);state.user=r.user;toast(r.message);showWorkspace();navigate('profile');break;
        }
      }
    } catch(error) {
      toast(error.message,true);
      if (formId==='equipment-form') showFormError(form,error.message);
    } finally {if(button && document.contains(button))button.disabled=false;}
  });
  const serverDay = () => {
    const parts = new Intl.DateTimeFormat('en-US', {timeZone:'Asia/Ho_Chi_Minh',
      year:'numeric', month:'2-digit', day:'2-digit'}).formatToParts(new Date());
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  };
  let lastSeenDay = serverDay();
  async function refreshAfterDayChange() {
    const today = serverDay();
    if (today === lastSeenDay) return;
    if (!state.user) { lastSeenDay = today; return; }
    if (!$('#modal-backdrop').classList.contains('hidden')) return;
    try {
      await navigate(state.page);
      lastSeenDay = today;
      updateFooterClock();
    } catch (_) { /* navigate tự thông báo; thử lại lần kiểm tra kế */ }
  }
  window.setInterval(refreshAfterDayChange, 60 * 1000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) { updateFooterClock(); refreshAfterDayChange(); loadNotifications(); }
  });
  window.addEventListener('focus', () => { refreshAfterDayChange(); loadNotifications(); });
  window.setInterval(() => { if (state.user && !document.hidden) loadNotifications(); }, 20 * 1000);

  syncThemeButtons();
  updateFooterClock();
  window.setInterval(updateFooterClock, 15 * 1000);
  (async()=>{
    try {
      const session=await api('session');
      state.csrf=session.csrf;state.user=session.user;
      if (state.user) showWorkspace();else showAuth();
    } catch(e) {
      showAuth();
      toast('Không kết nối được API: '+e.message,true);
    }
  })();
})();

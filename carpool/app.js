let me = null;
let activeChatUserId = null;
let selectedRating = 5;

function $(id) { return document.getElementById(id); }
function $$(sel) { return document.querySelectorAll(sel); }

function showScreen(id) {
  const screens = $$('.screen');
  for (let i = 0; i < screens.length; i++) screens[i].classList.remove('active');
  $(id).classList.add('active');
}

function showPage(name) {
  const menuBtns = $$('.menu button');
  for (let i = 0; i < menuBtns.length; i++) {
    menuBtns[i].classList.toggle('active', menuBtns[i].dataset.page === name);
  }
  const pages = $$('.page');
  for (let i = 0; i < pages.length; i++) {
    pages[i].classList.toggle('active', pages[i].id === 'page-' + name);
  }
  if (name === 'trips') renderTrips();
  if (name === 'search') renderSearchResults([]);
  if (name === 'chat') renderChat();
  if (name === 'profile') renderProfile();
}

function fmtDate(d) {
  return new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}
function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

const tabs = $$('.tab');
for (let i = 0; i < tabs.length; i++) {
  tabs[i].onclick = function() {
    for (let j = 0; j < tabs.length; j++) tabs[j].classList.remove('active');
    this.classList.add('active');
    const isReg = this.dataset.mode === 'register';
    $('reg-name').hidden = !isReg;
    $('reg-name').style.display = isReg ? 'block' : 'none';
    const rolePicker = document.getElementById('role-picker');
    if (rolePicker) {
      rolePicker.style.display = isReg ? 'block' : 'none';
    }
  const agreeWrap = document.getElementById('agree-wrap');
if (agreeWrap) {
  agreeWrap.style.display = isReg ? 'flex' : 'none';
  if (!isReg) {
  const ps = document.getElementById('pass-strength');
  if (ps) ps.style.display = 'none';
} else {
  updatePasswordStrength();
}
}  
    $('auth-btn').textContent = isReg ? 'Зарегистрироваться' : 'Войти';
    $('auth-error').textContent = '';
  };
}

$('auth-form').onsubmit = function(e) {
  e.preventDefault();
  const activeTab = document.querySelector('.tab.active');
  const mode = activeTab.dataset.mode;
  const email = $('reg-email').value.trim();
  const pass = $('reg-pass').value;
  $('auth-error').textContent = '';

  try {
    if (mode === 'register') {
  const name = $('reg-name').value.trim();
  if (!name) throw new Error('Введи имя');

  const agreeCheckbox = document.getElementById('agree-checkbox');
  if (agreeCheckbox && !agreeCheckbox.checked) {
    throw new Error('Нужно согласиться с условиями');
  }

  const roleInput = document.querySelector('input[name="reg-role"]:checked');
  const role = roleInput ? roleInput.value : 'passenger';
  createUser(name, email, pass, role);
}
    me = login(email, pass);
    startApp();
  } catch (err) {
    $('auth-error').textContent = err.message;
  }
};

$('logout').onclick = function() {
  logout();
  me = null;
  showScreen('screen-auth');
};

function startApp() {
  showScreen('screen-app');
  showPage('trips');
  updateChatBadge();
  renderRoleBadge();
}

function updateChatBadge() {
  if (!me) return;
  const n = getUnreadCount(me.id);
  $('chat-badge').textContent = n > 0 ? n : '';
}

function tripCardHTML(trip) {
  const isMine = trip.driverId === me.id;

  const typeLabels = {
    driver: { icon: '🚗', label: 'ВОДИТЕЛЬ', color: '#22c55e' },
    companion: { icon: '🧳', label: 'ИЩУ ПОПУТЧИКОВ', color: '#4f6ef7' },
    seeker: { icon: '🚕', label: 'ИЩУ ВОДИТЕЛЯ', color: '#f59e0b' }
  };
  const tripType = trip.type || 'driver';
  const typeInfo = typeLabels[tripType];

  let booked = false;
  const bookings = getBookings();
  for (let i = 0; i < bookings.length; i++) {
    if (bookings[i].tripId === trip.id && bookings[i].userId === me.id) booked = true;
  }

  let actionBtn = '';
  if (isMine) {
    actionBtn = '<button class="secondary" onclick="openChatWith(\'' + trip.driverId + '\')">Мои заявки</button>';
  } else if (tripType === 'driver') {
    if (booked) {
      actionBtn = '<button disabled>Заявка отправлена</button>';
    } else if (trip.seats > 0) {
      actionBtn = '<button onclick="handleBook(\'' + trip.id + '\')">Подать заявку</button>';
    } else {
      actionBtn = '<button disabled>Мест нет</button>';
    }
  } else {
    let alreadyJoined = false;
    const allMates = getMates();
    for (let k = 0; k < allMates.length; k++) {
      if (allMates[k].tripId === trip.id && allMates[k].fromUserId === me.id && allMates[k].status !== 'rejected') {
        alreadyJoined = true;
      }
    }
    const participantsCount = (trip.participants || [trip.driverId]).length;
    if (alreadyJoined) {
      actionBtn = '<button disabled>Запрос отправлен</button>';
    } else if (participantsCount > trip.seats) {
      actionBtn = '<button disabled>Мест нет</button>';
    } else {
      actionBtn = '<button onclick="handleJoin(\'' + trip.id + '\')">Присоединиться</button>';
    }
  }

  let priceStr = trip.price ? '<span>' + trip.price + ' руб</span>' : '<span>Бесплатно</span>';

  let html = '<div class="trip-card">';
  html += '<div class="trip-type-badge" style="background:' + typeInfo.color + '">';
  html += typeInfo.icon + ' ' + typeInfo.label;
  html += '</div>';
  html += '<div class="trip-route">' + trip.from + ' &rarr; ' + trip.to + '</div>';
  html += '<div class="trip-meta">';
  html += '<span>' + fmtDate(trip.date) + ', ' + trip.time + '</span>';
  html += '<span>Мест: ' + trip.seats + '</span>';
  html += priceStr;
  html += '<span>Водитель: ' + trip.driverName + '</span>';
  html += '</div>';
  if (trip.comment) html += '<div class="muted">' + trip.comment + '</div>';
  html += '<div class="trip-actions">';
  html += actionBtn;
  html += '<button class="secondary" onclick="showRouteOnMap(\'' + trip.id + '\')">На карте</button>';
  if (!isMine) html += '<button class="secondary" onclick="openChatWith(\'' + trip.driverId + '\')">Написать</button>';
  if (!isMine) html += '<button class="secondary" onclick="openReviewFor(\'' + trip.driverId + '\')">Отзыв</button>';
  if (isMine) html += '<button class="danger" onclick="handleDeleteTrip(\'' + trip.id + '\')">Удалить</button>';
  html += '</div></div>';
  return html;
}

function renderTrips() {
  const trips = getAllTrips();
  if (trips.length === 0) {
    $('trips-list').innerHTML = '<p class="muted">Пока нет поездок</p>';
    return;
  }
  let html = '';
  for (let i = 0; i < trips.length; i++) html += tripCardHTML(trips[i]);
  $('trips-list').innerHTML = html;
}

$('f-search').onclick = function() {
  applySearchFilters();
};

function renderSearchResults(list) {
  if (list.length === 0) {
    $('search-results').innerHTML = '<p class="muted">Ничего не найдено</p>';
    return;
  }
  let html = '';
  for (let i = 0; i < list.length; i++) html += tripCardHTML(list[i]);
  $('search-results').innerHTML = html;
}

$('trip-form').onsubmit = function(e) {
  e.preventDefault();
  $('create-msg').textContent = '';

  const typeInput = document.querySelector('input[name="trip-type"]:checked');
  const tripType = typeInput ? typeInput.value : 'driver';

  try {
    createTrip({
      from: $('c-from').value,
      to: $('c-to').value,
      date: $('c-date').value,
      time: $('c-time').value,
      seats: $('c-seats').value,
      price: $('c-price').value,
      comment: $('c-comment').value,
      type: tripType
    }, me);
    $('trip-form').reset();
    $('c-seats').value = 3;
    showPage('trips');
  } catch (err) {
    $('create-msg').textContent = err.message;
  }
};

function handleBook(tripId) {
  try {
    bookTrip(tripId, me);
    renderTrips();
    alert('Заявка отправлена водителю!');
  } catch (err) {
    alert(err.message);
  }
}

function handleJoin(tripId) {
  try {
    joinTrip(tripId, me);
    renderTrips();
    alert('Запрос на присоединение отправлен!');
  } catch (err) {
    alert(err.message);
  }
}

function handleDeleteTrip(tripId) {
  const trip = getTrip(tripId);
  if (!trip) return;
  const confirmed = confirm('Удалить поездку?\n\n' + trip.from + ' -> ' + trip.to + '\n' + fmtDate(trip.date) + ', ' + trip.time + '\n\nЭто действие нельзя отменить.');
  if (!confirmed) return;
  try {
    deleteTrip(tripId, me);
    renderTrips();
    if (document.getElementById('page-profile').classList.contains('active')) renderProfile();
    alert('Поездка удалена');
  } catch (err) {
    alert('Ошибка: ' + err.message);
  }
}

function openChatWith(userId) {
  if (userId === me.id) { showPage('chat'); return; }
  activeChatUserId = userId;
  showPage('chat');
}

function renderChat() {
  const partners = getChatPartners(me.id);
  if (partners.length === 0) {
    $('chat-users').innerHTML = '<p class="muted" style="padding:15px">Нет диалогов. Зайди в поездку и нажми "Написать".</p>';
  } else {
    let usersHtml = '';
    for (let i = 0; i < partners.length; i++) {
      const u = partners[i];
      const dialog = getDialog(me.id, u.id);
      const last = dialog[dialog.length - 1];
      let preview = '';
      if (last) preview = (last.fromId === me.id ? 'Ты: ' : '') + last.text;
      if (!preview) preview = 'Нет сообщений';
      const isActive = u.id === activeChatUserId ? ' active' : '';
      usersHtml += '<div class="chat-user' + isActive + '" onclick="selectChatUser(\'' + u.id + '\')">';
      usersHtml += '<div class="name">' + u.name + '</div>';
      usersHtml += '<div class="preview">' + preview + '</div>';
      usersHtml += '</div>';
    }
    $('chat-users').innerHTML = usersHtml;
  }

  if (activeChatUserId) {
    const user = findUserById(activeChatUserId);
    $('chat-header').textContent = user ? user.name : '—';
    renderMessages();
  } else {
    $('chat-header').textContent = 'Выбери собеседника';
    $('chat-messages').innerHTML = '';
  }
  updateChatBadge();
}

function selectChatUser(id) {
  activeChatUserId = id;
  renderChat();
}

function renderMessages() {
  const dialog = getDialog(me.id, activeChatUserId);
  const box = $('chat-messages');
  if (dialog.length === 0) {
    box.innerHTML = '<p class="muted" style="margin:auto">Пока нет сообщений</p>';
  } else {
    let html = '';
    for (let i = 0; i < dialog.length; i++) {
      const m = dialog[i];
      const cls = m.fromId === me.id ? 'me' : 'them';
      html += '<div class="msg ' + cls + '">';
      html += String(m.text);
      html += '<span class="msg-time">' + fmtTime(m.at) + '</span>';
      html += '</div>';
    }
    box.innerHTML = html;
  }
  box.scrollTop = box.scrollHeight;
}

$('chat-form').onsubmit = function(e) {
  e.preventDefault();
  if (!activeChatUserId) return;
  const text = $('chat-text').value.trim();
  if (!text) return;
  sendMessage(me.id, activeChatUserId, text);
  $('chat-text').value = '';
  renderMessages();
  updateChatBadge();
};

function renderProfile() {
  me = findUserById(me.id);

   renderAvatar();

  $('p-avatar').textContent = me.name[0].toUpperCase();
  $('p-name').textContent = me.name;
  $('p-email').textContent = me.email;
  $('p-rating').textContent = (me.rating || 0).toFixed(1);
  $('p-reviews-count').textContent = me.reviewsCount || 0;

  const myTrips = getAllTrips().filter(function(t) { return t.driverId === me.id; });

  if (myTrips.length === 0) {
    $('p-trips').innerHTML = '<p class="muted">Ты ещё не создавал поездок</p>';
  } else {
    let html = '';
    for (let i = 0; i < myTrips.length; i++) {
      const t = myTrips[i];
      const tripBookings = getBookings().filter(function(b) { return b.tripId === t.id; });
      html += '<div class="trip-card">';
      html += '<div class="trip-route">' + t.from + ' &rarr; ' + t.to + '</div>';
      html += '<div class="trip-meta"><span>' + fmtDate(t.date) + ', ' + t.time + '</span><span>Осталось мест: ' + t.seats + '</span></div>';
      html += '<div class="muted">Заявки:</div>';
      if (tripBookings.length === 0) {
        html += '<div class="muted">Заявок пока нет</div>';
      } else {
        for (let j = 0; j < tripBookings.length; j++) {
          const b = tripBookings[j];
          let statusText = b.status === 'pending' ? 'ожидает' : b.status === 'accepted' ? 'принята' : 'отклонена';
          html += '<div style="display:flex;gap:8px;align-items:center;margin-top:6px;flex-wrap:wrap">';
          html += '<span>' + b.userName + '</span>';
          html += '<span class="muted">(' + statusText + ')</span>';
          if (b.status === 'pending') {
            html += '<button style="padding:4px 10px;font-size:12px" onclick="setBooking(\'' + b.id + '\',\'accepted\')">Принять</button>';
            html += '<button class="danger" style="padding:4px 10px;font-size:12px" onclick="setBooking(\'' + b.id + '\',\'rejected\')">Отклонить</button>';
          }
          html += '<button class="secondary" style="padding:4px 10px;font-size:12px" onclick="openChatWith(\'' + b.userId + '\')">Чат</button>';
          html += '</div>';
        }
      }
      html += '</div>';
    }
    $('p-trips').innerHTML = html;
  }

  const myBookings = getBookings().filter(function(b) { return b.userId === me.id; });
  if (myBookings.length === 0) {
    $('p-bookings').innerHTML = '<p class="muted">Заявок пока нет</p>';
  } else {
    let html = '';
    for (let i = 0; i < myBookings.length; i++) {
      const b = myBookings[i];
      const t = getTrip(b.tripId);
      if (!t) continue;
      let statusText = b.status === 'pending' ? 'ожидает' : b.status === 'accepted' ? 'принята' : 'отклонена';
      html += '<div class="trip-card">';
      html += '<div class="trip-route">' + t.from + ' &rarr; ' + t.to + '</div>';
      html += '<div class="trip-meta">';
      html += '<span>' + fmtDate(t.date) + ', ' + t.time + '</span>';
      html += '<span>Водитель: ' + t.driverName + '</span>';
      html += '<span>' + statusText + '</span>';
      html += '</div>';
      html += '<div class="trip-actions">';
      html += '<button class="secondary" onclick="openChatWith(\'' + t.driverId + '\')">Чат</button>';
      html += '<button class="danger" onclick="cancelBookingUI(\'' + b.id + '\')">Отменить</button>';
      html += '</div>';
      html += '</div>';
    }
    $('p-bookings').innerHTML = html;
  }

  const pendingMates = getPendingMatesForUser(me.id);
  if (pendingMates.length === 0) {
    $('p-mate-requests').innerHTML = '<p class="muted">Запросов пока нет</p>';
  } else {
    let mateHtml = '';
    for (let i = 0; i < pendingMates.length; i++) {
      const m = pendingMates[i];
      const t = getTrip(m.tripId);
      if (!t) continue;
      mateHtml += '<div class="trip-card">';
      mateHtml += '<div class="trip-route">' + m.fromUserName + ' хочет присоединиться</div>';
      mateHtml += '<div class="trip-meta">';
      mateHtml += '<span>Поездка: ' + t.from + ' &rarr; ' + t.to + '</span>';
      mateHtml += '<span>' + fmtDate(t.date) + ', ' + t.time + '</span>';
      mateHtml += '</div>';
      mateHtml += '<div class="trip-actions">';
      mateHtml += '<button onclick="acceptMate(\'' + m.id + '\')">Согласиться</button>';
      mateHtml += '<button class="danger" onclick="rejectMate(\'' + m.id + '\')">Отклонить</button>';
      mateHtml += '<button class="secondary" onclick="openChatWith(\'' + m.fromUserId + '\')">Чат</button>';
      mateHtml += '</div>';
      mateHtml += '</div>';
    }
    $('p-mate-requests').innerHTML = mateHtml;
  }

  const myMates = getMates().filter(function(m) {
    return m.fromUserId === me.id && m.status === 'accepted';
  });
  const myTrips2 = getAllTrips().filter(function(t) { return t.driverId === me.id; });
  let acceptedToMe = [];
  for (let i = 0; i < myTrips2.length; i++) {
    const tripMates = getAcceptedMates(myTrips2[i].id);
    acceptedToMe = acceptedToMe.concat(tripMates);
  }
  const allMyMates = myMates.concat(acceptedToMe);

  if (allMyMates.length === 0) {
    $('p-mates').innerHTML = '<p class="muted">Попутчиков пока нет</p>';
  } else {
    let matesHtml = '';
    for (let i = 0; i < allMyMates.length; i++) {
      const m = allMyMates[i];
      const t = getTrip(m.tripId);
      if (!t) continue;
      const otherUserId = m.fromUserId === me.id ? m.toUserId : m.fromUserId;
      const otherUserName = m.fromUserId === me.id ? t.driverName : m.fromUserName;
      matesHtml += '<div class="trip-card">';
      matesHtml += '<div class="trip-route">' + otherUserName + '</div>';
      matesHtml += '<div class="trip-meta">';
      matesHtml += '<span>Поездка: ' + t.from + ' &rarr; ' + t.to + '</span>';
      matesHtml += '<span>' + fmtDate(t.date) + ', ' + t.time + '</span>';
      matesHtml += '</div>';
      matesHtml += '<div class="trip-actions">';
      matesHtml += '<button class="secondary" onclick="openChatWith(\'' + otherUserId + '\')">Открыть чат</button>';
      matesHtml += '</div>';
      matesHtml += '</div>';
    }
    $('p-mates').innerHTML = matesHtml;
  }

  const reviews = getReviews().filter(function(r) { return r.toId === me.id; });
  if (reviews.length === 0) {
    $('p-reviews').innerHTML = '<p class="muted">Отзывов пока нет</p>';
  } else {
    let html = '';
    for (let i = 0; i < reviews.length; i++) {
      const r = reviews[i];
      let stars = '';
      for (let k = 0; k < r.rating; k++) stars += '*';
      for (let k = r.rating; k < 5; k++) stars += '.';
      html += '<div class="trip-card">';
      html += '<div><b>' + r.fromName + '</b> &mdash; <span style="color:#f59e0b">' + stars + '</span></div>';
      if (r.text) html += '<div class="muted">' + String(r.text) + '</div>';
      html += '</div>';
    }
    $('p-reviews').innerHTML = html;
    
// === РОЛЬ ===
  const role = me.role || 'passenger';
  const roleEmoji = role === 'driver' ? '🚗' : '🧳';
  const roleName = role === 'driver' ? 'Водитель' : 'Пассажир';
  const roleEl = document.getElementById('p-role');
  if (roleEl) {
    roleEl.innerHTML = '<span class="role-badge ' + role + '">' + roleEmoji + ' ' + roleName + '</span>';
  }

  const changeBtn = document.getElementById('p-role-change');
  if (changeBtn) {
    changeBtn.textContent = role === 'driver' ? 'Стать пассажиром' : 'Стать водителем';
    changeBtn.onclick = function() {
      const newRole = role === 'driver' ? 'passenger' : 'driver';
      updateUserRole(me.id, newRole);
      me = findUserById(me.id);
      renderProfile();
      const role = me.role || 'passenger';
  const roleEmoji = role === 'driver' ? '🚗' : '🧳';
  const roleName = role === 'driver' ? 'Водитель' : 'Пассажир';
  const roleEl = document.getElementById('p-role');
  if (roleEl) {
    roleEl.innerHTML = '<span class="role-badge ' + role + '">' + roleEmoji + ' ' + roleName + '</span>';
  }
  const changeBtn = document.getElementById('p-role-change');
  if (changeBtn) {
    changeBtn.textContent = role === 'driver' ? 'Стать пассажиром' : 'Стать водителем';
    changeBtn.onclick = function() {
      const newRole = role === 'driver' ? 'passenger' : 'driver';
      updateUserRole(me.id, newRole);
      me = findUserById(me.id);
      renderProfile();
      renderRoleBadge();
}
    };
  }
}
    };
  }

  

function setBooking(id, status) {
  updateBookingStatus(id, status);
  renderProfile();
}

function cancelBookingUI(id) {
  if (!confirm('Отменить заявку?')) return;
  cancelBooking(id);
  renderProfile();
}

function acceptMate(mateId) {
  try {
    updateMateStatus(mateId, 'accepted');
    alert('Попутчик принят! Теперь вы можете общаться в чате.');
    renderProfile();
  } catch (err) {
    alert('Ошибка: ' + err.message);
  }
}

function rejectMate(mateId) {
  if (!confirm('Отклонить запрос?')) return;
  try {
    updateMateStatus(mateId, 'rejected');
    renderProfile();
  } catch (err) {
    alert('Ошибка: ' + err.message);
  }
}

function openReviewFor(toUserId) {
  const user = findUserById(toUserId);
  if (!user || user.id === me.id) return;
  selectedRating = 5;
  let starsHtml = '';
  for (let n = 1; n <= 5; n++) {
    const cls = n <= selectedRating ? 'active' : '';
    starsHtml += '<span data-v="' + n + '" class="' + cls + '">*</span>';
  }
  $('modal-content').innerHTML =
    '<h3>Оставить отзыв</h3>' +
    '<p class="muted" style="margin-bottom:15px">Кому: ' + user.name + '</p>' +
    '<div class="stars" id="stars">' + starsHtml + '</div>' +
    '<textarea id="review-text" rows="3" placeholder="Напиши отзыв (необязательно)" style="width:100%;margin-top:15px;padding:10px;border:2px solid #e2e8f0;border-radius:10px"></textarea>' +
    '<button id="review-submit" style="margin-top:15px;width:100%;padding:12px;border:none;background:#4f6ef7;color:white;border-radius:10px;font-weight:600;cursor:pointer">Отправить</button>';
  const stars = $('stars').children;
  for (let i = 0; i < stars.length; i++) {
    stars[i].onclick = function() {
      selectedRating = Number(this.dataset.v);
      for (let j = 0; j < stars.length; j++) {
        stars[j].classList.toggle('active', Number(stars[j].dataset.v) <= selectedRating);
      }
    };
  }
  $('review-submit').onclick = function() {
    addReview(me, toUserId, selectedRating, $('review-text').value);
    closeModal();
    alert('Спасибо за отзыв!');
    if (document.getElementById('page-profile').classList.contains('active')) renderProfile();
  };
  $('modal').classList.add('active');
}

function closeModal() { $('modal').classList.remove('active'); }
$('modal-close').onclick = closeModal;
$('modal').onclick = function(e) { if (e.target.id === 'modal') closeModal(); };

const menuBtns = $$('.menu button');
for (let i = 0; i < menuBtns.length; i++) {
  menuBtns[i].onclick = function() { showPage(this.dataset.page); };
}

(function init() {
  if (getAllUsers().length === 0) {
    const demo = createUser('Демо Пользователь', 'demo@gmail.com', '1234');
    const other1 = createUser('Анна Карпина', 'anna@gmail.com', '1234');
    const other2 = createUser('Валерия Кочакина', 'lera@gmail.com', '1234');
    const today = new Date();
    const tomorrow = new Date(today.getTime() + 86400000).toISOString().slice(0, 10);
    const dayAfter = new Date(today.getTime() + 2 * 86400000).toISOString().slice(0, 10);
    createTrip({ from: 'Москва', to: 'Санкт-Петербург', date: tomorrow, time: '09:00', seats: 2, price: 800, comment: 'Еду с комфортом, есть кондиционер', type: 'driver' }, other1);
    createTrip({ from: 'Казань', to: 'Москва', date: dayAfter, time: '18:30', seats: 3, price: 1200, comment: 'Выезд вечером, багаж приветствуется', type: 'companion' }, other2);
    sendMessage(other1.id, demo.id, 'Привет! Вижу, ты интересуешься поездкой. Пиши, если есть вопросы!');
  }
  const session = currentUser();
  if (session) {
    me = session;
    startApp();
  } else {
    showScreen('screen-auth');
  }
})();

/* ====== ЧАТ ПОДДЕРЖКИ ====== */
const SUPPORT_KEY = 'cp_support_history';
const SUPPORT_SHOWN_KEY = 'cp_support_shown';

const SUPPORT_QUICK = [
  { label: 'Как подать заявку?', key: 'book' },
  { label: 'Как создать поездку?', key: 'create' },
  { label: 'Как отменить бронь?', key: 'cancel' },
  { label: 'Сколько стоит?', key: 'price' },
  { label: 'Как связаться с водителем?', key: 'contact' }
];

const SUPPORT_ANSWERS = {
  book: 'Чтобы подать заявку: открой раздел «Поездки», найди подходящий маршрут и нажми «Подать заявку». Водитель получит уведомление.',
  create: 'Раздел «Создать» — заполни маршрут, дату, время, количество мест и цену — нажми «Опубликовать».',
  cancel: 'Зайди в «Профиль» — раздел «Мои заявки как пассажир» — найди нужную и нажми «Отменить».',
  price: 'Цену устанавливает водитель. Сервис бесплатный — мы не берём комиссию.',
  contact: 'Открой поездку и нажми «Написать» — откроется чат с водителем.',
  hello: 'Привет! Чем могу помочь? Выбери вопрос ниже или напиши свой.',
  thanks: 'Всегда рады помочь! Хорошей поездки!',
  bye: 'До встречи! Возвращайся, если будут вопросы.',
  default: 'Спасибо за вопрос! Я передал его оператору — он ответит в течение дня. А пока можешь выбрать один из частых вопросов ниже.'
};

function supportGetHistory() {
  try {
    return JSON.parse(localStorage.getItem(SUPPORT_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function supportSaveHistory(history) {
  localStorage.setItem(SUPPORT_KEY, JSON.stringify(history));
}

function supportFormatTime(ts) {
  const d = new Date(ts);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return h + ':' + m;
}

function supportAddMessage(from, text) {
  const history = supportGetHistory();
  history.push({ from: from, text: text, at: Date.now() });
  supportSaveHistory(history);
  supportRenderMessages();
}

function supportRenderMessages() {
  const box = document.getElementById('support-messages');
  if (!box) return;
  const history = supportGetHistory();
  if (history.length === 0) {
    box.innerHTML = '';
    return;
  }
  let html = '';
  for (let i = 0; i < history.length; i++) {
    const m = history[i];
    const cls = m.from === 'me' ? 'me' : 'bot';
    const time = supportFormatTime(m.at);
    html += '<div class="support-msg ' + cls + '">' + m.text + '<span class="support-msg-time">' + time + '</span></div>';
  }
  box.innerHTML = html;
  box.scrollTop = box.scrollHeight;
}

function supportRenderQuick() {
  const box = document.getElementById('support-quick');
  if (!box) return;
  let html = '';
  for (let i = 0; i < SUPPORT_QUICK.length; i++) {
    html += '<button type="button" onclick="supportAskQuick(\'' + SUPPORT_QUICK[i].key + '\')">' + SUPPORT_QUICK[i].label + '</button>';
  }
  box.innerHTML = html;
}

function supportAskQuick(key) {
  const item = SUPPORT_QUICK.find(function(q) { return q.key === key; });
  const questionText = item ? item.label : key;
  supportAddMessage('me', questionText);
  setTimeout(function() {
    const answer = SUPPORT_ANSWERS[key] || SUPPORT_ANSWERS.default;
    supportAddMessage('bot', answer);
  }, 500);
}

function supportBotReply(userText) {
  const t = userText.toLowerCase();
  if (t.includes('привет') || t.includes('здравств')) return SUPPORT_ANSWERS.hello;
  if (t.includes('спасибо') || t.includes('благодар')) return SUPPORT_ANSWERS.thanks;
  if (t.includes('пока') || t.includes('до свид')) return SUPPORT_ANSWERS.bye;
  if (t.includes('заявк') || t.includes('бронь')) return SUPPORT_ANSWERS.book;
  if (t.includes('создать') || t.includes('опублик')) return SUPPORT_ANSWERS.create;
  if (t.includes('отмен')) return SUPPORT_ANSWERS.cancel;
  if (t.includes('цен') || t.includes('стоим') || t.includes('сколько')) return SUPPORT_ANSWERS.price;
  if (t.includes('водител') || t.includes('связат') || t.includes('написать')) return SUPPORT_ANSWERS.contact;
  return SUPPORT_ANSWERS.default;
}

function supportOpen() {
  const win = document.getElementById('support-window');
  win.classList.add('open');
  localStorage.setItem(SUPPORT_SHOWN_KEY, '1');
  supportUpdateBadge();
  const history = supportGetHistory();
  if (history.length === 0) {
    setTimeout(function() {
      supportAddMessage('bot', 'Здравствуйте! Я оператор сервиса «Попутчик». Чем могу помочь?');
    }, 300);
  }
  setTimeout(function() {
    const box = document.getElementById('support-messages');
    if (box) box.scrollTop = box.scrollHeight;
  }, 100);
}

function supportClose() {
  document.getElementById('support-window').classList.remove('open');
}

function supportUpdateBadge() {
  const win = document.getElementById('support-window');
  const badge = document.getElementById('support-badge');
  if (!badge) return;
  if (win.classList.contains('open')) {
    badge.textContent = '';
    return;
  }
  const history = supportGetHistory();
  const isShown = localStorage.getItem(SUPPORT_SHOWN_KEY);
  if (!isShown && history.length === 0) {
    badge.textContent = '1';
  } else {
    badge.textContent = '';
  }
}

/* ====== КАРТА МАРШРУТА ====== */
const CITY_COORDS = {
  'москва': [55.7558, 37.6173],
  'санкт-петербург': [59.9343, 30.3351],
  'питер': [59.9343, 30.3351],
  'спб': [59.9343, 30.3351],
  'казань': [55.7963, 49.1088],
  'новосибирск': [55.0084, 82.9357],
  'екатеринбург': [56.8389, 60.6057],
  'нижний новгород': [56.3269, 44.0059],
  'самара': [53.1959, 50.1002],
  'омск': [54.9885, 73.3242],
  'челябинск': [55.1644, 61.4368],
  'ростов-на-дону': [47.2225, 39.7187],
  'уфа': [54.7388, 55.9721],
  'красноярск': [56.0153, 92.8932],
  'воронеж': [51.6720, 39.1843],
  'пермь': [58.0105, 56.2502],
  'волгоград': [48.7080, 44.5133],
  'краснодар': [45.0355, 38.9753],
  'сочи': [43.6028, 39.7342],
  'тюмень': [57.1522, 65.5272],
  'саратов': [51.5336, 46.0343],
  'иркутск': [52.2870, 104.3050],
  'хабаровск': [48.4827, 135.0838],
  'владивосток': [43.1155, 131.8855],
  'тольятти': [53.5303, 49.3461],
  'ижевск': [56.8527, 53.2115],
  'барнаул': [53.3548, 83.7698],
  'ульяновск': [54.3142, 48.4031],
  'ярославль': [57.6261, 39.8845],
  'владимир': [56.1290, 40.4070],
  'тула': [54.1961, 37.6182],
  'калуга': [54.5138, 36.2612],
  'тверь': [56.8587, 35.9176],
  'смоленск': [54.7818, 32.0401],
  'брянск': [53.2434, 34.3639],
  'белгород': [50.5952, 36.5873],
  'курск': [51.7304, 36.1926],
  'орёл': [52.9651, 36.0785],
  'липецк': [52.6031, 39.5708],
  'тамбов': [52.7212, 41.4523],
  'пенза': [53.2007, 45.0046],
  'саранск': [54.1838, 45.1749],
  'чебоксары': [56.1463, 47.2519],
  'йошкар-ола': [56.6388, 47.8908],
  'киров': [58.6035, 49.6679],
  'магнитогорск': [53.4186, 59.0472],
  'оренбург': [51.7682, 55.0969],
  'астрахань': [46.3497, 48.0408],
  'махачкала': [42.9764, 47.5024],
  'грозный': [43.3179, 45.6981],
  'ставрополь': [45.0428, 41.9734],
  'пятигорск': [44.0486, 43.0593],
  'кисловодск': [43.9052, 42.7168],
  'новороссийск': [44.7239, 37.7686],
  'анапа': [44.8950, 37.3169],
  'геленджик': [44.5622, 38.0848],
  'севастополь': [44.6166, 33.5254],
  'симферополь': [44.9521, 34.1024],
  'ялта': [44.4952, 34.1663],
  'минск': [53.9006, 27.5590],
  'киев': [50.4501, 30.5234],
  'алматы': [43.2220, 76.8512],
  'астана': [51.1605, 71.4704],
  'ташкент': [41.2995, 69.2401],
  'бишкек': [42.8746, 74.5698],
  'тбилиси': [41.7151, 44.8271],
  'ереван': [40.1792, 44.4991],
  'баку': [40.4093, 49.8671]
};

function getCityCoords(cityName) {
  if (!cityName) return null;
  const key = cityName.toLowerCase().trim();
  return CITY_COORDS[key] || null;
}

function showRouteOnMap(tripId) {
  const trip = getTrip(tripId);
  if (!trip) { alert('Поездка не найдена'); return; }
  const fromCoords = getCityCoords(trip.from);
  const toCoords = getCityCoords(trip.to);
  const title = document.getElementById('map-modal-title');
  const info = document.getElementById('map-info');
  title.textContent = 'Маршрут: ' + trip.from + ' -> ' + trip.to;

  if (!fromCoords || !toCoords) {
    let missing = [];
    if (!fromCoords) missing.push('«' + trip.from + '»');
    if (!toCoords) missing.push('«' + trip.to + '»');
    document.getElementById('map-container').innerHTML =
      '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#64748b;text-align:center;padding:20px;">' +'Не удалось определить координаты города(ов):' + missing.join(', ') +'Попробуй написать название по-другому' +
      '</div>';
    info.innerHTML = '';
    document.getElementById('map-modal').classList.add('active');
    return;
  }

  document.getElementById('map-container').innerHTML = '';
  document.getElementById('map-modal').classList.add('active');

  setTimeout(function() {
    if (window._currentMap) {
  window._currentMap.remove();
  window._currentMap = null;
}
const map = L.map('map-container');
window._currentMap = map;
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
      attribution: '© Esri',
      maxZoom: 19
    }).addTo(map);
    L.marker(fromCoords).addTo(map).bindPopup('Откуда: ' + trip.from);
    L.marker(toCoords).addTo(map).bindPopup('Куда: ' + trip.to);
    const line = L.polyline([fromCoords, toCoords], {
      color: '#4f6ef7', weight: 4, opacity: 0.7, dashArray: '10, 8'
    }).addTo(map);
    map.fitBounds(line.getBounds(), { padding: [40, 40] });

    const R = 6371;
    const lat1 = fromCoords[0] * Math.PI / 180;
    const lat2 = toCoords[0] * Math.PI / 180;
    const dLat = (toCoords[0] - fromCoords[0]) * Math.PI / 180;
    const dLon = (toCoords[1] - fromCoords[1]) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceKm = Math.round(R * c);

    info.innerHTML =
      '<div class="map-info-item"><span class="map-info-label">Откуда:</span> ' + trip.from + '</div>' +
      '<div class="map-info-item"><span class="map-info-label">Куда:</span> ' + trip.to + '</div>' +
      '<div class="map-info-item"><span class="map-info-label">Расстояние:</span> ~' + distanceKm + ' км</div>' +
      '<div class="map-info-item"><span class="map-info-label">Дата:</span> ' + fmtDate(trip.date) + ', ' + trip.time + '</div>';
  }, 100);
}

/* ====== ИНИЦИАЛИЗАЦИЯ ====== */
document.addEventListener('DOMContentLoaded', function() {
  const btn = document.getElementById('support-btn');
  const close = document.getElementById('support-close');
  const form = document.getElementById('support-form');

  if (btn) btn.onclick = supportOpen;
  if (close) close.onclick = supportClose;

  supportRenderQuick();
  supportRenderMessages();
  supportUpdateBadge();

  if (form) {
    form.onsubmit = function(e) {
      e.preventDefault();
      const input = document.getElementById('support-text');
      const text = input.value.trim();
      if (!text) return;
      supportAddMessage('me', text);
      input.value = '';
      setTimeout(function() {
        const reply = supportBotReply(text);
        supportAddMessage('bot', reply);
      }, 600);
    };
  }

  const mapClose = document.getElementById('map-modal-close');
  const mapModal = document.getElementById('map-modal');
  if (mapClose) mapClose.onclick = function() { mapModal.classList.remove('active'); };
  if (mapModal) mapModal.onclick = function(e) {
    if (e.target.id === 'map-modal') mapModal.classList.remove('active');
  };
});
/* ====== АВТОДОПОЛНЕНИЕ ГОРОДОВ ====== */
function getCityList() {
  const seen = {};
  const list = [];
  for (const key in CITY_COORDS) {
    const displayName = key.charAt(0).toUpperCase() + key.slice(1);
    if (!seen[displayName]) {
      seen[displayName] = true;
      list.push(displayName);
    }
  }
  return list.sort();
}

const ALL_CITIES = getCityList();

function findCities(prefix, limit) {
  if (!prefix) return [];
  const p = prefix.toLowerCase().trim();
  if (!p) return [];

  const startsWith = [];
  const contains = [];

  for (let i = 0; i < ALL_CITIES.length; i++) {
    const city = ALL_CITIES[i];
    const low = city.toLowerCase();
    if (low.indexOf(p) === 0) {
      startsWith.push(city);
    } else if (low.indexOf(p) > 0) {
      contains.push(city);
    }
  }

  return startsWith.concat(contains).slice(0, limit);
}

function setupAutocomplete(inputId, listId) {
  const input = document.getElementById(inputId);
  const list = document.getElementById(listId);
  if (!input || !list) return;

  let activeIndex = -1;

  function closeList() {
    list.classList.remove('open');
    list.innerHTML = '';
    activeIndex = -1;
  }

  function openList(cities) {
    if (cities.length === 0) {
      closeList();
      return;
    }
    let html = '';
    for (let i = 0; i < cities.length; i++) {
      html += '<div class="autocomplete-item" data-value="' + cities[i] + '">' + cities[i] + '</div>';
    }
    list.innerHTML = html;
    list.classList.add('open');
    activeIndex = -1;

    const items = list.querySelectorAll('.autocomplete-item');
    for (let i = 0; i < items.length; i++) {
      items[i].onclick = function() {
        input.value = this.dataset.value;
        closeList();
      };
    }
  }

  input.oninput = function() {
    const val = input.value.trim();
    if (!val) {
      closeList();
      return;
    }
    const cities = findCities(val, 4);
    openList(cities);
  };

  input.onkeydown = function(e) {
    const items = list.querySelectorAll('.autocomplete-item');
    if (!list.classList.contains('open') || items.length === 0) {
      if (e.key === 'Escape') closeList();
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = (activeIndex + 1) % items.length;
      updateActive(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = activeIndex <= 0 ? items.length - 1 : activeIndex - 1;
      updateActive(items);
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0) {
        e.preventDefault();
        input.value = items[activeIndex].dataset.value;
        closeList();
      }
    } else if (e.key === 'Escape') {
      closeList();
    }
  };

  function updateActive(items) {
    for (let i = 0; i < items.length; i++) {
      items[i].classList.toggle('active', i === activeIndex);
    }
  }

  input.onblur = function() {
    setTimeout(closeList, 150);
  };
}

document.addEventListener('DOMContentLoaded', function() {
  setupAutocomplete('f-from', 'ac-from');
  setupAutocomplete('f-to', 'ac-to');
});
/* ====== БЕЙДЖ РОЛИ В ПРОФИЛЕ ====== */
function renderRoleBadge() {
  if (!me) return;

  const role = me.role || 'passenger';
  const roleEmoji = role === 'driver' ? '🚗' : '🧳';
  const roleName = role === 'driver' ? 'Водитель' : 'Пассажир';

  const roleEl = document.getElementById('p-role');
  if (roleEl) {
    roleEl.innerHTML = '<span class="role-badge ' + role + '">' + roleEmoji + ' ' + roleName + '</span>';
  }

  const changeBtn = document.getElementById('p-role-change');
  if (changeBtn) {
    changeBtn.textContent = role === 'driver' ? 'Стать пассажиром' : 'Стать водителем';
    changeBtn.onclick = function() {
      const newRole = role === 'driver' ? 'passenger' : 'driver';
      updateUserRole(me.id, newRole);
      me = findUserById(me.id);
      renderRoleBadge();
    };
  }
}
/* ====== ЗАГРУЗКА АВАТАРА ====== */
function loadAvatarFile(file) {
  return new Promise(function(resolve, reject) {
    const reader = new FileReader();
    reader.onload = function(e) {
      const img = new Image();
      img.onload = function() {
        const canvas = document.createElement('canvas');
        const size = 200;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);

        const base64 = canvas.toDataURL('image/jpeg', 0.85);
        resolve(base64);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function handleAvatarClick() {
  const input = document.getElementById('avatar-input');
  if (input) input.click();
}

function handleAvatarFile(file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    alert('Это не картинка');
    return;
  }

  loadAvatarFile(file).then(function(base64) {
    setAvatar(me.id, base64);
    renderAvatar();
  }).catch(function() {
    alert('Не удалось загрузить фото');
  });
}

function renderAvatar() {
  const av = document.getElementById('p-avatar');
  if (!av || !me) return;

  const photo = getAvatar(me.id);
  const removeBtn = document.getElementById('avatar-remove-btn');

  if (photo) {
    av.style.backgroundImage = 'url(' + photo + ')';
    av.classList.add('has-photo');
    av.textContent = '';
    if (removeBtn) removeBtn.style.display = 'inline-block';
  } else {
    av.style.backgroundImage = '';
    av.classList.remove('has-photo');
    av.textContent = me.name[0].toUpperCase();
    if (removeBtn) removeBtn.style.display = 'none';
  }
}

function handleAvatarRemove() {
  if (!me) return;
  if (!confirm('Удалить фото профиля?')) return;
  removeAvatar(me.id);
  renderAvatar();
}

document.addEventListener('DOMContentLoaded', function() {
  const av = document.getElementById('p-avatar');
  const input = document.getElementById('avatar-input');
  const uploadBtn = document.getElementById('avatar-upload-btn');
  const removeBtn = document.getElementById('avatar-remove-btn');

  if (av) av.onclick = handleAvatarClick;
  if (uploadBtn) uploadBtn.onclick = handleAvatarClick;
  if (removeBtn) removeBtn.onclick = handleAvatarRemove;
  if (input) {
    input.onchange = function(e) {
      handleAvatarFile(e.target.files[0]);
      e.target.value = '';
    };
  }
});
/* ====== ИНДИКАТОР СИЛЫ ПАРОЛЯ ====== */
function checkPasswordStrength(password) {
  if (!password) return { level: 'empty', label: '—' };

  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 8) score++;
  if (password.length >= 10) score++;
  if (/[a-zA-Zа-яА-Я]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Zа-яА-Я0-9]/.test(password)) score++;

  if (password.length < 6 || score <= 2) {
    return { level: 'weak', label: 'Слабый' };
  }
  if (score <= 4) {
    return { level: 'medium', label: 'Средний' };
  }
  return { level: 'strong', label: 'Сильный' };
}

function updatePasswordStrength() {
  const pass = document.getElementById('reg-pass');
  const wrap = document.getElementById('pass-strength');
  const fill = document.getElementById('pass-fill');
  const label = document.getElementById('pass-label');

  if (!pass || !wrap || !fill || !label) return;

  const isReg = document.querySelector('.tab.active');
  if (isReg && isReg.dataset.mode !== 'register') {
    wrap.style.display = 'none';
    return;
  }

  const val = pass.value;
  if (!val) {
    wrap.style.display = 'none';
    return;
  }

  wrap.style.display = 'block';
  const result = checkPasswordStrength(val);

  fill.className = 'pass-fill';
  label.className = 'pass-label';

  if (result.level === 'weak') {
    fill.classList.add('weak');
    label.classList.add('weak');
  } else if (result.level === 'medium') {
    fill.classList.add('medium');
    label.classList.add('medium');
  } else if (result.level === 'strong') {
    fill.classList.add('strong');
    label.classList.add('strong');
  }

  label.textContent = 'Сила пароля: ' + result.label;
}

document.addEventListener('DOMContentLoaded', function() {
  const pass = document.getElementById('reg-pass');
  if (pass) {
    pass.oninput = updatePasswordStrength;
  }
});
/* ====== ФИЛЬТР ПО ЦЕНЕ ====== */
function updatePriceSlider() {
  const slider = document.getElementById('f-price');
  const valueEl = document.getElementById('price-value');
  if (!slider || !valueEl) return;

  const min = Number(slider.min);
  const max = Number(slider.max);
  const val = Number(slider.value);
  const percent = ((val - min) / (max - min)) * 100;

  slider.style.background = 'linear-gradient(to right, #4f6ef7 0%, #4f6ef7 ' + percent + '%, #e2e8f0 ' + percent + '%, #e2e8f0 100%)';

  valueEl.textContent = val === max ? 'без ограничений' : val;
}

function applySearchFilters() {
  const from = document.getElementById('f-from').value.trim();
  const to = document.getElementById('f-to').value.trim();
  const date = document.getElementById('f-date').value;
  const maxPrice = Number(document.getElementById('f-price').value);
  const onlyFree = document.getElementById('f-free').checked;

  let results = searchTrips({ from: from, to: to, date: date });

  if (onlyFree) {
    results = results.filter(function(t) { return !t.price || t.price === 0; });
  } else {
    results = results.filter(function(t) {
      return !t.price || t.price === 0 || t.price <= maxPrice;
    });
  }

  renderSearchResults(results);
}
/* ====== ИНИЦИАЛИЗАЦИЯ ФИЛЬТРА ЦЕНЫ ====== */
document.addEventListener('DOMContentLoaded', function() {
  const slider = document.getElementById('f-price');
  const freeCheck = document.getElementById('f-free');

  if (slider) {
    updatePriceSlider();
    slider.oninput = function() {
      updatePriceSlider();
      applySearchFilters();
    };
  }

  if (freeCheck) {
    freeCheck.onchange = function() {
      if (this.checked && slider) {
        slider.disabled = true;
        slider.style.opacity = '0.4';
      } else if (slider) {
        slider.disabled = false;
        slider.style.opacity = '1';
      }
      applySearchFilters();
    };
  }
});
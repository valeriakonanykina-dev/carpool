const DB = {
  users:    'cp_users',
  trips:    'cp_trips',
  bookings: 'cp_bookings',
  reviews:  'cp_reviews',
  messages: 'cp_messages',
  session:  'cp_session'
};

function get(key, def) {
  if (def === undefined) def = [];
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v === null ? def : v;
  } catch (e) {
    return def;
  }
}
function set(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

function getAllUsers() { return get(DB.users); }
function findUser(email) {
  const users = getAllUsers();
  for (let i = 0; i < users.length; i++) {
    if (users[i].email.toLowerCase() === email.toLowerCase()) return users[i];
  }
  return null;
}
function findUserById(id) {
  const users = getAllUsers();
  for (let i = 0; i < users.length; i++) {
    if (users[i].id === id) return users[i];
  }
  return null;
}
function createUser(name, email, password) {
   const cleanName = (name || '').trim();
  if (!cleanName) throw new Error('Введи имя');
  if (cleanName.length < 3) throw new Error('Имя должно быть минимум 3 символа');
  if (cleanName.length > 30) throw new Error('Имя слишком длинное');
  if (!/^[А-Яа-яЁёA-Za-z\s-]+$/.test(cleanName)) {
    throw new Error('Имя может содержать только буквы, пробел и дефис');
  }
   // === ПРОВЕРКА EMAIL ===
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail) throw new Error('Введи email');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error('Email должен быть в формате имя@домен.зона');
  }
  const users = getAllUsers();
  if (findUser(email)) throw new Error('Такой email уже занят');
  const user = {
    id: 'u_' + Date.now(),
    name: name.trim(),
    email: email.trim().toLowerCase(),
    password: password,
    rating: 0,
    reviewsCount: 0,
    createdAt: new Date().toISOString()
  };
  users.push(user);
  set(DB.users, users);
  return user;
}
function updateUserRole(userId, role) {
  const users = getAllUsers().map(function(u) {
    return u.id === userId ? Object.assign({}, u, { role: role }) : u;
  });
  set(DB.users, users);
}

function login(email, password) {
  const u = findUser(email);
  if (!u || u.password !== password) throw new Error('Неверный email или пароль');
  set(DB.session, { userId: u.id, at: Date.now() });
  return u;
}
function currentUser() {
  const s = get(DB.session, null);
  if (!s) return null;
  return findUserById(s.userId);
}
function logout() { localStorage.removeItem(DB.session); }

function getAllTrips() {
  const trips = get(DB.trips);
  trips.sort(function(a, b) {
    return (a.date + a.time).localeCompare(b.date + b.time);
  });
  return trips;
}
function getTrip(id) {
  const trips = getAllTrips();
  for (let i = 0; i < trips.length; i++) {
    if (trips[i].id === id) return trips[i];
  }
  return null;
}
function createTrip(data, driver) {
  const trips = get(DB.trips);
  const trip = {
    id: 't_' + Date.now(),
    driverId: driver.id,
    driverName: driver.name,
    from: data.from.trim(),
    to: data.to.trim(),
    date: data.date,
    time: data.time,
    seats: Number(data.seats),
    price: Number(data.price) || 0,
    comment: (data.comment || '').trim(),
    type: data.type || 'driver',
    participants: [driver.id],
    createdAt: new Date().toISOString()
  };
  trips.push(trip);
  set(DB.trips, trips);
  return trip;
}
function searchTrips(filters) {
  const from = filters.from || '';
  const to = filters.to || '';
  const date = filters.date || '';
  return getAllTrips().filter(function(t) {
    if (from && t.from.toLowerCase().indexOf(from.toLowerCase()) === -1) return false;
    if (to && t.to.toLowerCase().indexOf(to.toLowerCase()) === -1) return false;
    if (date && t.date !== date) return false;
    return true;
  });
}

function getBookings() { return get(DB.bookings); }

function bookTrip(tripId, user) {
  const trip = getTrip(tripId);
  if (!trip) throw new Error('Поездка не найдена');
  if (trip.driverId === user.id) throw new Error('Нельзя бронировать свою поездку');
  if (trip.seats <= 0) throw new Error('Свободных мест нет');

  const bookings = getBookings();
  for (let i = 0; i < bookings.length; i++) {
    if (bookings[i].tripId === tripId && bookings[i].userId === user.id) {
      throw new Error('Ты уже подал заявку');
    }
  }

  const booking = {
    id: 'b_' + Date.now(),
    tripId: tripId,
    userId: user.id,
    userName: user.name,
    driverId: trip.driverId,
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  bookings.push(booking);
  set(DB.bookings, bookings);

  const trips = get(DB.trips).map(function(t) {
    return t.id === tripId ? Object.assign({}, t, { seats: t.seats - 1 }) : t;
  });
  set(DB.trips, trips);

  return booking;
}

function updateBookingStatus(bookingId, status) {
  const bookings = get(DB.bookings).map(function(b) {
    return b.id === bookingId ?
    Object.assign({}, b, { status: status }) : b;
  });
  set(DB.bookings, bookings);

  if (status === 'rejected') {
    const b = bookings.find(function(x) { return x.id === bookingId; });
    const trips = get(DB.trips).map(function(t) {
      return t.id === b.tripId ? Object.assign({}, t, { seats: t.seats + 1 }) : t;
    });
    set(DB.trips, trips);
  }
}

function cancelBooking(bookingId) {
  const bookings = getBookings();
  let target = null;
  for (let i = 0; i < bookings.length; i++) {
    if (bookings[i].id === bookingId) target = bookings[i];
  }
  if (!target) return;
  set(DB.bookings, bookings.filter(function(x) { return x.id !== bookingId; }));
  const trips = get(DB.trips).map(function(t) {
    return t.id === target.tripId ? Object.assign({}, t, { seats: t.seats + 1 }) : t;
  });
  set(DB.trips, trips);
}

function getReviews() { return get(DB.reviews); }

function addReview(fromUser, toUserId, rating, text) {
  const reviews = getReviews();
  reviews.push({
    id: 'r_' + Date.now(),
    fromId: fromUser.id,
    fromName: fromUser.name,
    toId: toUserId,
    rating: Number(rating),
    text: text.trim(),
    createdAt: new Date().toISOString()
  });
  set(DB.reviews, reviews);

  const forUser = reviews.filter(function(r) { return r.toId === toUserId; });
  let sum = 0;
  for (let i = 0; i < forUser.length; i++) sum += forUser[i].rating;
  const avg = sum / forUser.length;
  const users = getAllUsers().map(function(u) {
    if (u.id === toUserId) {
      return Object.assign({}, u, {
        rating: Number(avg.toFixed(1)),
        reviewsCount: forUser.length
      });
    }
    return u;
  });
  set(DB.users, users);
}

function getMessages() { return get(DB.messages); }

function sendMessage(fromId, toId, text) {
  const messages = getMessages();
  messages.push({
    id: 'm_' + Date.now(),
    fromId: fromId,
    toId: toId,
    text: text.trim(),
    at: new Date().toISOString()
  });
  set(DB.messages, messages);
}

function getDialog(userA, userB) {
  const dialog = getMessages().filter(function(m) {
    return (m.fromId === userA && m.toId === userB) ||
           (m.fromId === userB && m.toId === userA);
  });
  dialog.sort(function(a, b) { return a.at.localeCompare(b.at); });
  return dialog;
}

function getChatPartners(userId) {
  const messages = getMessages();
  const ids = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.fromId === userId && ids.indexOf(m.toId) === -1) ids.push(m.toId);
    if (m.toId === userId && ids.indexOf(m.fromId) === -1) ids.push(m.fromId);
  }
  const result = [];
  for (let i = 0; i < ids.length; i++) {
    const u = findUserById(ids[i]);
    if (u) result.push(u);
  }
  return result;
}

function getUnreadCount(userId) {
  const partners = getChatPartners(userId);
  let count = 0;
  for (let i = 0; i < partners.length; i++) {
    const dialog = getDialog(userId, partners[i].id);
    if (dialog.length && dialog[dialog.length - 1].fromId !== userId) count++;
  }
  return count;
}
/* ====== ЗАПРОСЫ НА ПРИСОЕДИНЕНИЕ К ПОЕЗДКЕ ====== */
const MATES_KEY = 'cp_mates';

function getMates() {
  return get(MATES_KEY);
}

function getMateRequestsForTrip(tripId) {
  return getMates().filter(function(m) { return m.tripId === tripId; });
}

function getPendingMatesForUser(userId) {
  return getMates().filter(function(m) {
    return m.toUserId === userId && m.status === 'pending';
  });
}

function getMyMateRequests(userId) {
  return getMates().filter(function(m) { return m.fromUserId === userId; });
}

function getAcceptedMates(tripId) {
  return getMates().filter(function(m) {
    return m.tripId === tripId && m.status === 'accepted';
  });
}

function joinTrip(tripId, user) {
  const trip = getTrip(tripId);
  if (!trip) throw new Error('Поездка не найдена');
  if (trip.driverId === user.id) throw new Error('Это твоя поездка');

  const mates = getMates();
  for (let i = 0; i < mates.length; i++) {
    if (mates[i].tripId === tripId && mates[i].fromUserId === user.id && mates[i].status !== 'rejected') {
      throw new Error('Ты уже отправил запрос на эту поездку');
    }
  }

  const participants = trip.participants || [trip.driverId];
  if (participants.length >= trip.seats + 1) {
    throw new Error('В поездке нет свободных мест');
  }

  const mate = {
    id: 'mt_' + Date.now(),
    tripId: tripId,
    fromUserId: user.id,
    fromUserName: user.name,
    toUserId: trip.driverId,
    toUserName: trip.driverName,
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  mates.push(mate);
  set(MATES_KEY, mates);
  return mate;
}

function updateMateStatus(mateId, status) {
  const mates = getMates().map(function(m) {
    return m.id === mateId ? Object.assign({}, m, { status: status }) : m;
  });
  set(MATES_KEY, mates);

  if (status === 'accepted') {
    const mate = mates.find(function(m) { return m.id === mateId; });
    if (!mate) return;

    const trips = get(DB.trips).map(function(t) {
      if (t.id === mate.tripId) {
        const participants = t.participants || [t.driverId];
        if (participants.indexOf(mate.fromUserId) === -1) {
          participants.push(mate.fromUserId);
        }
        return Object.assign({}, t, { participants: participants });
      }
      return t;
    });
    set(DB.trips, trips);
  }
}

function cancelMateRequest(mateId) {
  const mates = getMates();
  set(MATES_KEY, mates.filter(function(m) { return m.id !== mateId; }));
}
/* ====== УДАЛЕНИЕ ПОЕЗДКИ ====== */
function deleteTrip(tripId, user) {
  const trip = getTrip(tripId);
  if (!trip) throw new Error('Поездка не найдена');
  if (trip.driverId !== user.id) throw new Error('Можно удалять только свои поездки');

  // 1. Удаляем саму поездку
  const trips = get(DB.trips).filter(function(t) { return t.id !== tripId; });
  set(DB.trips, trips);

  // 2. Удаляем заявки на эту поездку
  const bookings = getBookings().filter(function(b) { return b.tripId !== tripId; });
  set(DB.bookings, bookings);

  // 3. Удаляем запросы на присоединение
  const mates = getMates().filter(function(m) { return m.tripId !== tripId; });
  set(MATES_KEY, mates);

  return true;
}
/* ====== АВАТАРЫ ====== */
const AVATARS_KEY = 'cp_avatars';

function getAvatars() {
  return get(AVATARS_KEY, {});
}

function setAvatar(userId, base64) {
  const avatars = getAvatars();
  avatars[userId] = base64;
  set(AVATARS_KEY, avatars);
}

function getAvatar(userId) {
  const avatars = getAvatars();
  return avatars[userId] || null;
}

function removeAvatar(userId) {
  const avatars = getAvatars();
  delete avatars[userId];
  set(AVATARS_KEY, avatars);
}
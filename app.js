// ─── CONFIG ──────────────────────────────────────────────────────────────────
const SUPABASE_URL      = 'https://gbhpxrmyqlkyoszwhhna.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdiaHB4cm15cWxreW9zendoaG5hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MjczOTQsImV4cCI6MjA4OTQwMzM5NH0.vop9JG2CVuffRMKWcA8Gv8AmDtlIti9JTUN7xqqLUzg';
const AUTH_URL = 'auth.html';

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── STATE ───────────────────────────────────────────────────────────────────
let user = null, events = [], favs = new Set(), regs = new Set(), curSlide = 0, activeEvent = null;
const COLOR_BARS = [
  'linear-gradient(180deg,#2563EB,#93C5FD)',
  'linear-gradient(180deg,#7C3AED,#a78bfa)',
  'linear-gradient(180deg,#0891b2,#67e8f9)',
  'linear-gradient(180deg,#10B981,#6ee7b7)',
  'linear-gradient(180deg,#d97706,#fde68a)'
];
const SLIDE_IMAGES = [
  'ACMChapter.png',
  'codechef.png',
  'hackex.webp',
  'hackexpro.avif',
  'siemens.png'
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function toast(msg, type) {
  type = type || 'ok';
  const el = document.getElementById('toast');
  el.textContent = ({ ok: '✅', err: '❌', info: 'ℹ️' }[type]) + '  ' + msg;
  el.className = 'toast ' + type + ' show';
  setTimeout(function() { el.classList.remove('show'); }, 3000);
}
function navTo(page) {
  document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
  document.getElementById('page-' + page).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(function(n) { n.classList.remove('active'); });
  document.getElementById('nav-' + page).classList.add('active');
}
function formatDate(d) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function setLoading(btnId, textId, on) {
  var btn = document.getElementById(btnId), txt = document.getElementById(textId);
  if (on) {
    txt.style.display = 'none';
    var sp = document.createElement('div');
    sp.className = 'spinner'; sp.id = btnId + '_sp';
    btn.appendChild(sp); btn.disabled = true;
  } else {
    var sp2 = document.getElementById(btnId + '_sp');
    if (sp2) sp2.remove();
    txt.style.display = ''; btn.disabled = false;
  }
}

// ─── INIT ────────────────────────────────────────────────────────────────────
async function init() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { window.location.href = AUTH_URL; return; }
  user = session.user;
  document.getElementById('loading').style.display = 'none';
  const a = document.getElementById('app'); a.style.display = 'flex'; a.style.flexDirection = 'column';
  // FIX: Load regs/favs/profile first so they're ready before rendering
  await Promise.all([loadFavs(), loadRegs(), loadProfile()]);
  await loadEvents();
  setInterval(function() { carSlide(1); }, 3500);
}

// ─── DATA LOADERS ────────────────────────────────────────────────────────────
async function loadEvents() {
  const { data } = await sb.from('events').select('*').order('event_date', { ascending: true });
  events = data || [];
  renderCarousel();
  renderHome();
}
async function loadFavs() {
  if (!user) return;
  const { data } = await sb.from('favourites').select('event_id').eq('user_id', user.id);
  favs = new Set((data || []).map(function(r) { return r.event_id; }));
}
async function loadRegs() {
  if (!user) return;
  const { data } = await sb.from('registrations').select('event_id').eq('user_id', user.id);
  regs = new Set((data || []).map(function(r) { return r.event_id; }));
}
async function loadProfile() {
  if (!user) return;
  const { data } = await sb.from('profiles').select('*').eq('id', user.id).single();
  const un = (data && data.username) || (user.user_metadata && user.user_metadata.username) || 'User';
  document.getElementById('profile-name').textContent = un;
  document.getElementById('p-username').value = (data && data.username) || '';
  document.getElementById('p-contact').value = (data && data.contact) || '';
  document.getElementById('p-rollno').value = (data && data.roll_no) || '';
  document.getElementById('p-phone').textContent = user.phone || '—';
  document.getElementById('p-email').textContent = user.email || '—';
  const ini = (un[0] || 'U').toUpperCase();
  document.getElementById('profile-avatar').textContent = ini;
  document.getElementById('avatar-btn').textContent = ini;
}

// ─── CAROUSEL ────────────────────────────────────────────────────────────────
function renderCarousel() {
  const sl = document.getElementById('slides'), ds = document.getElementById('dots');
  sl.innerHTML = ''; ds.innerHTML = '';
  events.slice(0, 5).forEach(function(e, i) {
    const d = document.createElement('div');
    d.className = 'slide';
    const img = SLIDE_IMAGES[i];
    if (img) { d.style.backgroundImage = 'url(' + img + ')'; }
    else { d.style.background = e.image_gradient; }
    d.onclick = function() { openEventModal(e.id); };
    d.innerHTML = '<div class="slide-info"><div class="slide-tag">' + e.tag + '</div><div class="slide-title">' + e.title + '</div><div class="slide-sub">📍 ' + (e.location ? e.location.split(',')[0] : '') + ' &nbsp;•&nbsp; ' + new Date(e.event_date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) + '</div></div>';
    sl.appendChild(d);
    const dt = document.createElement('div');
    dt.className = 'dot' + (i === 0 ? ' active' : '');
    dt.onclick = function() { goToSlide(i); };
    ds.appendChild(dt);
  });
}
function carSlide(d) {
  const total = Math.min(events.length, 5);
  if (total === 0) return;
  curSlide = (curSlide + d + total) % total;
  updateCarousel();
}
function goToSlide(i) { curSlide = i; updateCarousel(); }
function updateCarousel() {
  document.getElementById('slides').style.transform = 'translateX(-' + (curSlide * 100) + '%)';
  document.querySelectorAll('.dot').forEach(function(d, i) { d.classList.toggle('active', i === curSlide); });
}

// ─── HOME PAGE RENDER ────────────────────────────────────────────────────────
function renderHome() {
  // --- Registered events section (top) ---
  const reggedEvents = events.filter(function(e) { return regs.has(e.id); });
  const regsSec = document.getElementById('regs-section');
  const regsList = document.getElementById('regs-list');
  if (reggedEvents.length > 0) {
    regsSec.style.display = '';
    regsList.innerHTML = '';
    reggedEvents.forEach(function(e) {
      const d = document.createElement('div');
      d.className = 'event-card';
      d.onclick = function() { openEventModal(e.id); };
      d.innerHTML = '<div class="card-bar" style="background:linear-gradient(180deg,#10B981,#6ee7b7)"></div>'
        + '<div class="card-body">'
        + '<div class="card-row1"><div class="card-title">' + e.title + '</div>'
        + '<span class="badge badge-free">✅ Registered</span></div>'
        + '<div class="card-meta"><span>📅 ' + formatDate(e.event_date) + '</span></div>'
        + '<div class="card-meta"><span>📍 ' + (e.location ? e.location.split(',')[0] : '') + '</span>'
        + '<span class="badge ' + (e.is_free ? 'badge-free' : 'badge-paid') + '">' + (e.is_free ? 'Free' : '₹' + e.price) + '</span>'
        + '</div></div>';
      regsList.appendChild(d);
    });
  } else {
    regsSec.style.display = 'none';
  }

  // --- Available events (unregistered only) ---
  renderList(events);
}

// ─── EVENT LIST ──────────────────────────────────────────────────────────────
function renderList(list) {
  const el = document.getElementById('events-list');
  el.innerHTML = '';
  // Only show events the user hasn't registered for
  const available = list.filter(function(e) { return !regs.has(e.id); });
  if (available.length === 0) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">🎉</div><div class="empty-title">You\'re all caught up!</div><div class="empty-sub">You\'ve registered for all available events.</div></div>';
    return;
  }
  available.forEach(function(e, i) {
    const d = document.createElement('div');
    d.className = 'event-card';
    d.onclick = function() { openEventModal(e.id); };
    d.innerHTML = '<div class="card-bar" style="background:' + COLOR_BARS[i % 5] + '"></div>'
      + '<div class="card-body">'
      + '<div class="card-row1"><div class="card-title">' + e.title + '</div>'
      + '<button class="fav-btn" id="fav-' + e.id + '" onclick="(function(ev){ev.stopPropagation();toggleFav(\'' + e.id + '\');})(event)">' + (favs.has(e.id) ? '❤️' : '🤍') + '</button></div>'
      + '<div class="card-meta"><span>📅 ' + formatDate(e.event_date) + '</span></div>'
      + '<div class="card-meta"><span>📍 ' + (e.location ? e.location.split(',')[0] : '') + '</span>'
      + '<span class="badge ' + (e.is_free ? 'badge-free' : 'badge-paid') + '">' + (e.is_free ? 'Free' : '₹' + e.price) + '</span>'
      + '</div></div>';
    el.appendChild(d);
  });
}
function filterEvents(cat, filterEl) {
  document.querySelectorAll('.chip').forEach(function(c) { c.classList.remove('active'); });
  if (filterEl) filterEl.classList.add('active');
  renderList(cat === 'All' ? events : events.filter(function(e) { return e.category === cat; }));
}

// ─── FAVOURITES ──────────────────────────────────────────────────────────────
async function toggleFav(id) {
  if (!user) return;
  const btn = document.getElementById('fav-' + id);
  if (favs.has(id)) {
    await sb.from('favourites').delete().eq('user_id', user.id).eq('event_id', id);
    favs.delete(id); btn.textContent = '🤍'; toast('Removed from favourites', 'info');
  } else {
    await sb.from('favourites').insert({ user_id: user.id, event_id: id });
    favs.add(id); btn.textContent = '❤️'; toast('Added to favourites!');
  }
}

// ─── EVENT DETAIL MODAL ──────────────────────────────────────────────────────
function openEventModal(id) {
  activeEvent = events.find(function(e) { return e.id === id; });
  if (!activeEvent) return;
  document.getElementById('modal-gradient').style.background = activeEvent.image_gradient;
  document.getElementById('modal-tag').textContent = activeEvent.tag;
  document.getElementById('modal-title-sm').textContent = activeEvent.title;
  document.getElementById('modal-title').textContent = activeEvent.title;
  document.getElementById('modal-desc').textContent = activeEvent.description || '';
  document.getElementById('modal-date').textContent = formatDate(activeEvent.event_date);
  document.getElementById('modal-location').textContent = activeEvent.location;
  document.getElementById('modal-price').textContent = activeEvent.is_free ? 'Free Entry' : '₹' + activeEvent.price;
  document.getElementById('modal-organizer').textContent = 'Organised by: ' + (activeEvent.organizer_name || 'Evently Team');
  const rb = document.getElementById('register-btn');
  if (regs.has(id)) {
    rb.textContent = '✅ Already Registered';
    rb.classList.add('registered');
    rb.onclick = null;
  } else {
    rb.textContent = 'Register Now';
    rb.classList.remove('registered');
    rb.onclick = openRegForm;
  }
  document.getElementById('modal-event').classList.add('open');
}
function closeEventModal(e) {
  if (!e || e.target === document.getElementById('modal-event'))
    document.getElementById('modal-event').classList.remove('open');
}

// ─── REGISTRATION FORM MODAL ─────────────────────────────────────────────────
function openRegForm() {
  if (!activeEvent) return;
  const un = document.getElementById('p-username').value || '';
  const em = document.getElementById('p-email').textContent || '';
  const ph = document.getElementById('p-phone').textContent || '';
  const rn = document.getElementById('p-rollno').value || '';
  document.getElementById('reg-name').value  = (un && un !== 'Enter username') ? un : '';
  document.getElementById('reg-email').value = (em && em !== '—') ? em : '';
  document.getElementById('reg-phone').value = (ph && ph !== '—') ? ph : '';
  document.getElementById('reg-roll').value  = (rn && rn !== 'Enter roll no') ? rn : '';
  document.getElementById('reg-event-name').textContent = activeEvent.title;
  document.getElementById('reg-form-view').style.display = '';
  document.getElementById('reg-success-view').style.display = 'none';
  document.getElementById('modal-event').classList.remove('open');
  document.getElementById('modal-reg').classList.add('open');
}
function closeRegModal(e) {
  if (!e || e.target === document.getElementById('modal-reg')) {
    document.getElementById('modal-reg').classList.remove('open');
    document.getElementById('reg-form-view').style.display = '';
    document.getElementById('reg-success-view').style.display = 'none';
  }
}

// ─── SUBMIT REGISTRATION ─────────────────────────────────────────────────────
async function submitRegistration() {
  if (!activeEvent || !user) return;
  const name  = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const phone = document.getElementById('reg-phone').value.trim();
  const roll  = document.getElementById('reg-roll').value.trim();
  if (!name || !email || !phone) return toast('Please fill Name, Email and Phone', 'err');

  setLoading('reg-submit-btn', 'reg-submit-text', true);

  // FIX: use INSERT instead of upsert — avoids missing UPDATE RLS policy
  const { error } = await sb.from('registrations').insert({
    user_id: user.id,
    event_id: activeEvent.id,
    participant_name: name,
    participant_email: email,
    participant_phone: phone,
    participant_roll: roll || null
  });

  setLoading('reg-submit-btn', 'reg-submit-text', false);

  if (error) {
    if (error.code === '23505') {
      // Already registered (duplicate key) — treat as success
      regs.add(activeEvent.id);
      renderHome();
      toast('You are already registered!', 'info');
    } else {
      console.error('Registration error:', error);
      toast(error.message, 'err');
    }
    return;
  }

  regs.add(activeEvent.id);
  renderHome(); // moves event up to My Registrations
  document.getElementById('reg-success-msg').textContent = 'You are registered for ' + activeEvent.title + '! See you there 🎉';
  document.getElementById('reg-form-view').style.display = 'none';
  document.getElementById('reg-success-view').style.display = '';
  toast('Registration successful! 🎉', 'ok');
}

// ─── PROFILE ─────────────────────────────────────────────────────────────────
async function saveProfile() {
  if (!user) return;
  const username = document.getElementById('p-username').value.trim();
  const contact  = document.getElementById('p-contact').value.trim();
  const roll_no  = document.getElementById('p-rollno').value.trim();
  const { error } = await sb.from('profiles').upsert({ id: user.id, username, contact, roll_no, updated_at: new Date().toISOString() });
  if (error) { toast(error.message, 'err'); return; }
  document.getElementById('profile-name').textContent = username || 'User';
  document.getElementById('profile-avatar').textContent = (username[0] || 'U').toUpperCase();
  document.getElementById('avatar-btn').textContent = (username[0] || 'U').toUpperCase();
  toast('Profile saved! ✨');
}
async function logout() { await sb.auth.signOut(); window.location.href = AUTH_URL; }

init();

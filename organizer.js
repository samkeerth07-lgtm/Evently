// ─── CONFIG ──────────────────────────────────────────────────────────────────
const SUPABASE_URL      = 'https://gbhpxrmyqlkyoszwhhna.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdiaHB4cm15cWxreW9zendoaG5hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MjczOTQsImV4cCI6MjA4OTQwMzM5NH0.vop9JG2CVuffRMKWcA8Gv8AmDtlIti9JTUN7xqqLUzg';
const AUTH_URL = 'auth.html';

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── STATE ────────────────────────────────────────────────────────────────────
let user = null;
let myEvents    = [];
let regCounts   = {};
let allRegs     = [];
let activeFilter = 'all';
let realtimeChannel = null;

const COLOR_BARS = [
  'linear-gradient(180deg,#2563EB,#93C5FD)',
  'linear-gradient(180deg,#7C3AED,#a78bfa)',
  'linear-gradient(180deg,#0891b2,#67e8f9)',
  'linear-gradient(180deg,#10B981,#6ee7b7)',
  'linear-gradient(180deg,#d97706,#fde68a)'
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
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
  if (page === 'regs') {
    const badge = document.getElementById('regs-nav-badge');
    badge.textContent = ''; badge.classList.remove('show');
  }
}
function formatDate(d) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function formatTime(d) {
  return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });
}
function highlight(text, query) {
  if (!query || !text) return text || '';
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp('(' + escaped + ')', 'gi'), '<span class="hl">$1</span>');
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
async function init() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { window.location.href = AUTH_URL; return; }
  user = session.user;
  document.getElementById('loading').style.display = 'none';
  const a = document.getElementById('app'); a.style.display = 'flex'; a.style.flexDirection = 'column';
  await Promise.all([loadMyEvents(), loadProfile()]);
  subscribeToRegistrations();
}

// ─── DATA LOADERS ─────────────────────────────────────────────────────────────
async function loadMyEvents() {
  if (!user) return;
  const { data } = await sb.from('events')
    .select('*')
    .eq('organizer_id', user.id)
    .order('created_at', { ascending: false });
  myEvents = data || [];
  await loadAllRegistrations();
  renderMyEvents();
  renderRegsPage();
}

async function loadAllRegistrations() {
  if (!myEvents.length) { allRegs = []; regCounts = {}; return; }
  const ids = myEvents.map(function(e) { return e.id; });
  const { data } = await sb.from('registrations')
    .select('*')
    .in('event_id', ids)
    .order('registered_at', { ascending: false });
  allRegs = data || [];
  regCounts = {};
  allRegs.forEach(function(r) {
    regCounts[r.event_id] = (regCounts[r.event_id] || 0) + 1;
  });
}

async function loadProfile() {
  if (!user) return;
  const { data } = await sb.from('profiles').select('*').eq('id', user.id).single();
  const un = (data && data.username) || (user.user_metadata && user.user_metadata.username) || user.email || 'Organizer';
  document.getElementById('profile-name').textContent = un;
  document.getElementById('p-username').value = (data && data.username) || '';
  document.getElementById('p-contact').value  = (data && data.contact)  || '';
  document.getElementById('p-rollno').value   = (data && data.roll_no)  || '';
  document.getElementById('p-email').textContent = user.email || '—';
  const ini = (un[0] || 'O').toUpperCase();
  document.getElementById('profile-avatar').textContent = ini;
  document.getElementById('avatar-btn').textContent = ini;
}

// ─── REALTIME ─────────────────────────────────────────────────────────────────
function subscribeToRegistrations() {
  if (realtimeChannel) { sb.removeChannel(realtimeChannel); }
  if (!myEvents.length) return;
  const eventIds = myEvents.map(function(e) { return e.id; });

  realtimeChannel = sb.channel('org-registrations')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'registrations' },
      function(payload) {
        const newReg = payload.new;
        if (!eventIds.includes(newReg.event_id)) return;
        newReg._isNew = true;
        allRegs.unshift(newReg);
        regCounts[newReg.event_id] = (regCounts[newReg.event_id] || 0) + 1;
        renderMyEvents();
        const regsPage = document.getElementById('page-regs');
        if (regsPage.classList.contains('active')) {
          // If currently searching, refresh search too
          const q = document.getElementById('search-input').value.trim();
          if (q) { onSearch(q); } else { renderRegsPage(newReg.event_id); }
        } else {
          showRegsBadge();
        }
        const ev = myEvents.find(function(e) { return e.id === newReg.event_id; });
        toast('🎟️ New registration for ' + (ev ? ev.title : 'your event') + '!', 'ok');
      })
    .subscribe();
}

function showRegsBadge() {
  const badge = document.getElementById('regs-nav-badge');
  badge.textContent = (parseInt(badge.textContent) || 0) + 1;
  badge.classList.add('show');
}

// ─── RENDER MY EVENTS ─────────────────────────────────────────────────────────
function renderMyEvents() {
  const el = document.getElementById('my-events-list');
  if (myEvents.length === 0) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">🎪</div><div class="empty-title">No events yet</div><div class="empty-sub">No events have been created yet.</div></div>';
    return;
  }
  el.innerHTML = '';
  myEvents.forEach(function(e, i) {
    const cnt = regCounts[e.id] || 0;
    const d = document.createElement('div');
    d.className = 'event-card';
    d.onclick = function() { openParticipantsModal(e.id, e.title, cnt); };
    d.innerHTML = '<div class="card-bar" style="background:' + COLOR_BARS[i % 5] + '"></div>'
      + '<div class="card-body">'
      + '<div class="card-row1"><div class="card-title">' + e.title + '</div></div>'
      + '<div class="card-meta"><span>📅 ' + formatDate(e.event_date) + '</span></div>'
      + '<div class="card-meta">'
      + '<span>📍 ' + (e.location ? e.location.split(',')[0] : '') + '</span>'
      + '<span class="badge ' + (e.is_free ? 'badge-free' : 'badge-paid') + '">' + (e.is_free ? 'Free' : '₹' + e.price) + '</span>'
      + '<span class="badge badge-reg">👥 ' + cnt + ' registered</span>'
      + '</div></div>';
    el.appendChild(d);
  });
}

// ─── RENDER REGISTRATIONS PAGE ────────────────────────────────────────────────
function renderRegsPage(autoOpenEventId) {
  const container = document.getElementById('regs-groups');
  const filterBar = document.getElementById('regs-filter');

  if (myEvents.length === 0) {
    filterBar.innerHTML = '';
    container.innerHTML = '<div class="regs-empty"><div class="regs-empty-icon">📭</div><div class="regs-empty-title">No events yet</div><div class="regs-empty-sub">Create an event first.</div></div>';
    return;
  }

  // Filter chips
  filterBar.innerHTML = '';
  const allChip = document.createElement('button');
  allChip.className = 'chip' + (activeFilter === 'all' ? ' active' : '');
  allChip.textContent = 'All Events';
  allChip.onclick = function() { activeFilter = 'all'; renderRegsPage(); };
  filterBar.appendChild(allChip);
  myEvents.forEach(function(e) {
    const chip = document.createElement('button');
    chip.className = 'chip' + (activeFilter === e.id ? ' active' : '');
    chip.textContent = e.title;
    chip.onclick = function() { activeFilter = e.id; renderRegsPage(); };
    filterBar.appendChild(chip);
  });

  if (allRegs.length === 0) {
    container.innerHTML = '<div class="regs-empty"><div class="regs-empty-icon">🎟️</div><div class="regs-empty-title">No registrations yet</div><div class="regs-empty-sub">Registrations appear here in real-time.</div></div>';
    return;
  }

  const eventsToShow = activeFilter === 'all'
    ? myEvents
    : myEvents.filter(function(e) { return e.id === activeFilter; });

  container.innerHTML = '';
  eventsToShow.forEach(function(ev) {
    const eventRegs = allRegs.filter(function(r) { return r.event_id === ev.id; });
    const cnt = eventRegs.length;
    const shouldOpen = autoOpenEventId === ev.id || activeFilter === ev.id || activeFilter === 'all';
    const group = document.createElement('div');
    group.className = 'reg-event-group';
    group.id = 'reg-group-' + ev.id;
    group.innerHTML =
      '<div class="reg-event-header" onclick="toggleRegGroup(\'' + ev.id + '\')">'
      + '<div><div class="reg-event-name">' + ev.title + '</div>'
      + '<div class="reg-event-meta">📍 ' + (ev.location ? ev.location.split(',')[0] : '—') + ' &nbsp;•&nbsp; 📅 ' + new Date(ev.event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) + '</div></div>'
      + '<span class="reg-count-badge">' + cnt + ' registered</span>'
      + '</div>'
      + '<div class="reg-event-body' + (shouldOpen ? ' open' : '') + '" id="reg-body-' + ev.id + '">'
      + buildRegRows(eventRegs, '')
      + '</div>';
    container.appendChild(group);
  });
}

function buildRegRows(regs, query) {
  if (regs.length === 0) return '<div class="no-regs">No registrations for this event yet.</div>';
  let html = '';
  regs.forEach(function(r, i) {
    html += '<div class="reg-row' + (r._isNew ? ' new-flash' : '') + '">'
      + '<div class="reg-num">' + (i + 1) + '</div>'
      + '<div class="reg-details">'
      + '<div class="reg-name">'
        + highlight(r.participant_name || '—', query)
        + (r._isNew ? ' <span class="reg-new-tag">New</span>' : '')
      + '</div>'
      + '<div class="reg-info-row">'
      + '<span class="reg-info-item">📧 ' + highlight(r.participant_email || '—', query) + '</span>'
      + '<span class="reg-info-item">📞 ' + highlight(r.participant_phone || '—', query) + '</span>'
      + (r.participant_roll ? '<span class="reg-info-item">🎓 ' + highlight(r.participant_roll, query) + '</span>' : '')
      + '</div>'
      + '<div class="reg-time">Registered at ' + formatTime(r.registered_at) + '</div>'
      + '</div></div>';
  });
  return html;
}

function toggleRegGroup(eventId) {
  const body = document.getElementById('reg-body-' + eventId);
  if (body) body.classList.toggle('open');
}

// ─── SEARCH ───────────────────────────────────────────────────────────────────
function onSearch(q) {
  q = q.trim();
  const clearBtn       = document.getElementById('search-clear');
  const searchSection  = document.getElementById('search-results-section');
  const normalSection  = document.getElementById('normal-regs-section');
  const resultList     = document.getElementById('search-results-list');
  const resultTitle    = document.getElementById('search-result-title');

  // Show/hide clear button
  clearBtn.classList.toggle('show', q.length > 0);

  if (!q) {
    // Back to normal view
    searchSection.style.display = 'none';
    normalSection.style.display = '';
    return;
  }

  // Switch to search results view
  searchSection.style.display = '';
  normalSection.style.display = 'none';

  const lower = q.toLowerCase();
  const matches = allRegs.filter(function(r) {
    return (r.participant_name  && r.participant_name.toLowerCase().includes(lower))
        || (r.participant_email && r.participant_email.toLowerCase().includes(lower))
        || (r.participant_phone && r.participant_phone.toLowerCase().includes(lower))
        || (r.participant_roll  && r.participant_roll.toLowerCase().includes(lower));
  });

  resultTitle.textContent = matches.length
    ? matches.length + ' result' + (matches.length > 1 ? 's' : '') + ' for "' + q + '"'
    : 'No results for "' + q + '"';

  if (matches.length === 0) {
    resultList.innerHTML =
      '<div class="search-empty">'
      + '<div class="search-empty-icon">🔍</div>'
      + '<div style="font-weight:600;color:var(--text);margin-bottom:4px">Not found</div>'
      + '<div style="font-size:13px;color:var(--muted)"><strong>' + escHtml(q) + '</strong> is not registered for any of your events.</div>'
      + '</div>';
    return;
  }

  resultList.innerHTML = '';
  matches.forEach(function(r) {
    const ev = myEvents.find(function(e) { return e.id === r.event_id; });
    const card = document.createElement('div');
    card.className = 'search-result-card found';
    card.innerHTML =
      '<div class="search-result-name">'
      + highlight(r.participant_name || '—', q)
      + '<span class="search-status-badge found">✅ Registered</span>'
      + '</div>'
      + '<div class="search-result-info">'
      + '<span class="search-result-item">📧 ' + highlight(r.participant_email || '—', q) + '</span>'
      + '&nbsp;&nbsp;'
      + '<span class="search-result-item">📞 ' + highlight(r.participant_phone || '—', q) + '</span>'
      + (r.participant_roll ? '&nbsp;&nbsp;<span class="search-result-item">🎓 ' + highlight(r.participant_roll, q) + '</span>' : '')
      + '</div>'
      + (ev ? '<div><span class="search-event-tag">🎟️ ' + ev.title + '</span></div>' : '')
      + '<div class="reg-time" style="margin-top:6px">Registered at ' + formatTime(r.registered_at) + '</div>';
    resultList.appendChild(card);
  });
}

function clearSearch() {
  document.getElementById('search-input').value = '';
  onSearch('');
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ─── PARTICIPANTS MODAL (My Events click) ─────────────────────────────────────
async function openParticipantsModal(eventId, eventTitle, cnt) {
  document.getElementById('parts-event-title').textContent = eventTitle;
  document.getElementById('parts-event-sub').textContent = cnt + ' participant' + (cnt === 1 ? '' : 's') + ' registered';
  document.getElementById('parts-list').innerHTML = '<div style="text-align:center;padding:20px"><div class="spinner" style="margin:0 auto;border-top-color:var(--accent)"></div></div>';
  document.getElementById('modal-parts').classList.add('open');

  const { data, error } = await sb.from('registrations')
    .select('participant_name, participant_email, participant_phone, participant_roll, registered_at')
    .eq('event_id', eventId)
    .order('registered_at', { ascending: true });

  if (error || !data || data.length === 0) {
    document.getElementById('parts-list').innerHTML = '<div class="no-regs">👥 No registrations yet</div>';
    return;
  }
  let html = '<table class="part-table"><thead><tr><th>#</th><th>Name</th><th>Email</th><th>Phone</th><th>Roll No</th></tr></thead><tbody>';
  data.forEach(function(r, i) {
    html += '<tr><td>' + (i+1) + '</td><td>' + (r.participant_name||'—') + '</td>'
      + '<td style="font-size:12px">' + (r.participant_email||'—') + '</td>'
      + '<td>' + (r.participant_phone||'—') + '</td>'
      + '<td>' + (r.participant_roll||'—') + '</td></tr>';
  });
  html += '</tbody></table>';
  document.getElementById('parts-list').innerHTML = html;
}
function closePartsModal(e) {
  if (!e || e.target === document.getElementById('modal-parts'))
    document.getElementById('modal-parts').classList.remove('open');
}

// ─── PROFILE ──────────────────────────────────────────────────────────────────
async function saveProfile() {
  if (!user) return;
  const username = document.getElementById('p-username').value.trim();
  const contact  = document.getElementById('p-contact').value.trim();
  const roll_no  = document.getElementById('p-rollno').value.trim();
  const { error } = await sb.from('profiles').upsert({ id: user.id, username, contact, roll_no, updated_at: new Date().toISOString() });
  if (error) { toast(error.message, 'err'); return; }
  document.getElementById('profile-name').textContent = username || 'Organizer';
  document.getElementById('profile-avatar').textContent = (username[0]||'O').toUpperCase();
  document.getElementById('avatar-btn').textContent = (username[0]||'O').toUpperCase();
  toast('Profile saved! ✨');
}
async function logout() {
  if (realtimeChannel) sb.removeChannel(realtimeChannel);
  await sb.auth.signOut();
  window.location.href = AUTH_URL;
}

init();

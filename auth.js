// ─── CONFIG ──────────────────────────────────────────────────────────────────
const SUPABASE_URL      = 'https://gbhpxrmyqlkyoszwhhna.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdiaHB4cm15cWxreW9zendoaG5hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MjczOTQsImV4cCI6MjA4OTQwMzM5NH0.vop9JG2CVuffRMKWcA8Gv8AmDtlIti9JTUN7xqqLUzg';
const PARTICIPANT_URL   = 'app.html';
const ORGANIZER_URL     = 'organizer.html';

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── SMART REDIRECT ───────────────────────────────────────────────────────────
// If signed-in email matches organizers table → organizer page, else → participant
async function redirect(user) {
  const email = (user.email || '').toLowerCase();
  if (email) {
    const { data } = await sb.from('organizers').select('email').eq('email', email).maybeSingle();
    if (data) { window.location.href = ORGANIZER_URL; return; }
  }
  window.location.href = PARTICIPANT_URL;
}

// ─── UI HELPERS ───────────────────────────────────────────────────────────────
function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}
function switchTab(t) {
  document.getElementById('tab-si').classList.toggle('active', t === 'si');
  document.getElementById('tab-su').classList.toggle('active', t === 'su');
  show(t === 'si' ? 'scr-si-home' : 'scr-su-home');
}
function toast(msg, type = 'ok') {
  const el = document.getElementById('toast');
  el.textContent = ({ ok: '✅', err: '❌', info: 'ℹ️' }[type]) + '  ' + msg;
  el.className = 'toast ' + type + ' show';
  setTimeout(() => el.classList.remove('show'), 3500);
}
function setLoading(btnId, textId, on) {
  const btn = document.getElementById(btnId), txt = document.getElementById(textId);
  if (on) { txt.style.display = 'none'; const sp = document.createElement('div'); sp.className = 'spinner'; sp.id = btnId + '_sp'; btn.appendChild(sp); btn.disabled = true; }
  else { const sp = document.getElementById(btnId + '_sp'); if (sp) sp.remove(); txt.style.display = ''; btn.disabled = false; }
}

// ─── OTP HELPERS ──────────────────────────────────────────────────────────────
function otpNav(input, idx, prefix) {
  input.value = input.value.replace(/\D/g, '');
  const boxes = document.querySelectorAll('#' + prefix + '-otp-row .obox');
  if (input.value && idx < 5) boxes[idx + 1].focus();
  const code = [...boxes].map(b => b.value).join('');
  if (code.length === 6) { if (prefix === 'si') verifyOTP('si'); else verifyOTP('su'); }
}
function otpBack(e, input, idx, prefix) {
  if (e.key === 'Backspace' && !input.value && idx > 0)
    document.querySelectorAll('#' + prefix + '-otp-row .obox')[idx - 1].focus();
}
function getOTP(prefix) { return [...document.querySelectorAll('#' + prefix + '-otp-row .obox')].map(b => b.value).join(''); }
function clearOTP(prefix) { document.querySelectorAll('#' + prefix + '-otp-row .obox').forEach(b => b.value = ''); document.querySelectorAll('#' + prefix + '-otp-row .obox')[0].focus(); }
function startTimer(prefix) {
  let secs = 30;
  const timerEl = document.getElementById(prefix + '-timer'), resendEl = document.getElementById(prefix + '-resend');
  resendEl.style.pointerEvents = 'none'; resendEl.style.opacity = '.4';
  timerEl.textContent = '(' + secs + 's)';
  const iv = setInterval(() => { secs--; if (secs <= 0) { clearInterval(iv); timerEl.textContent = ''; resendEl.style.pointerEvents = ''; resendEl.style.opacity = ''; } else timerEl.textContent = '(' + secs + 's)'; }, 1000);
}

// ─── AUTH METHODS ─────────────────────────────────────────────────────────────
async function signInGoogle() {
  const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + '/auth-callback.html' } });
  if (error) toast(error.message, 'err');
}

async function sendOTP(prefix) {
  const isSu = prefix === 'su';
  const cc = document.getElementById(prefix + '-cc').value;
  const num = document.getElementById(prefix + '-phone').value.trim();
  if (!num) return toast('Enter your mobile number', 'err');
  if (isSu && !document.getElementById('su-username').value.trim()) return toast('Enter a username first', 'err');
  const phone = cc + num;
  setLoading(prefix + '-send-btn', prefix + '-send-text', true);
  const { error } = await sb.auth.signInWithOtp({ phone });
  setLoading(prefix + '-send-btn', prefix + '-send-text', false);
  if (error) { toast(error.message, 'err'); return; }
  document.getElementById(prefix + '-phone-shown').textContent = phone;
  show('scr-' + prefix + '-otp');
  clearOTP(prefix); startTimer(prefix);
  toast('OTP sent! 📲', 'ok');
}

async function resendOTP(prefix) {
  const cc = document.getElementById(prefix + '-cc').value;
  const num = document.getElementById(prefix + '-phone').value.trim();
  const { error } = await sb.auth.signInWithOtp({ phone: cc + num });
  if (error) { toast(error.message, 'err'); return; }
  clearOTP(prefix); startTimer(prefix); toast('OTP resent!', 'info');
}

async function verifyOTP(prefix) {
  const isSu = prefix === 'su';
  const cc = document.getElementById(prefix + '-cc').value;
  const num = document.getElementById(prefix + '-phone').value.trim();
  const token = getOTP(prefix);
  if (token.length < 6) return toast('Enter all 6 digits', 'err');
  setLoading(prefix + '-ver-btn', prefix + '-ver-text', true);
  const { data, error } = await sb.auth.verifyOtp({ phone: cc + num, token, type: 'sms' });
  setLoading(prefix + '-ver-btn', prefix + '-ver-text', false);
  if (error) { toast(error.message, 'err'); clearOTP(prefix); return; }
  if (isSu) {
    const username = document.getElementById('su-username').value.trim();
    if (username && data.user) await sb.from('profiles').upsert({ id: data.user.id, username });
  }
  window.location.href = PARTICIPANT_URL; // phone users always → participant
}

async function signInEmail() {
  const email = document.getElementById('si-email').value.trim();
  const password = document.getElementById('si-password').value;
  if (!email || !password) return toast('Fill in all fields', 'err');
  setLoading('si-email-btn', 'si-email-text', true);
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  setLoading('si-email-btn', 'si-email-text', false);
  if (error) { toast(error.message, 'err'); return; }
  await redirect(data.user);
}

async function signUpEmail() {
  const username = document.getElementById('su-em-user').value.trim();
  const email    = document.getElementById('su-email').value.trim();
  const password = document.getElementById('su-password').value;
  if (!username || !email || !password) return toast('Fill in all fields', 'err');
  if (password.length < 6) return toast('Password must be at least 6 characters', 'err');
  setLoading('su-email-btn', 'su-email-text', true);
  const { data, error } = await sb.auth.signUp({ email, password, options: { data: { username } } });
  setLoading('su-email-btn', 'su-email-text', false);
  if (error) { toast(error.message, 'err'); return; }
  if (data.session) await redirect(data.user);
  else { document.getElementById('success-msg').textContent = 'Check your email to confirm, then sign in!'; show('scr-success'); }
}

// ─── AUTO REDIRECT ────────────────────────────────────────────────────────────
(async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (session) await redirect(session.user);
})();

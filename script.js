'use strict';

/* ═══════════════════════════════════════════
   FIREBASE CONFIG
═══════════════════════════════════════════ */
const firebaseConfig = {
  apiKey: "AIzaSyD9zw80epBRQLMm3AnN8kKCBaEBlUqQqwI",
  authDomain: "avenzoofficialbyopg.firebaseapp.com",
  projectId: "avenzoofficialbyopg",
  storageBucket: "avenzoofficialbyopg.firebasestorage.app",
  messagingSenderId: "614977254220",
  appId: "1:614977254220:web:7f87296b9d2484fc6f55e9",
  measurementId: "G-GZ03S0DFQP"
};
var _fbApp = null, _auth = null, _db = null;
try {
  _fbApp = firebase.initializeApp(firebaseConfig);
  _auth  = firebase.auth();
  _db    = firebase.firestore();
} catch(e) { console.warn('Firebase init:', e); }

/* ═══════════════════════════════════════════
   EMAILJS — REST API (no CDN library needed)
═══════════════════════════════════════════ */
var EMAILJS_SERVICE_ID  = 'service_3ik6d2e';
var EMAILJS_TEMPLATE_ID = 'template_0zaypmd';
var EMAILJS_PUBLIC_KEY  = 'OOqUXRQAgjYrKa_Jo';

function _ejsSend(toEmail, toName, otpCode) {
  var payload = {
    service_id  : EMAILJS_SERVICE_ID,
    template_id : EMAILJS_TEMPLATE_ID,
    user_id     : EMAILJS_PUBLIC_KEY,
    accessToken : EMAILJS_PUBLIC_KEY,
    template_params: {
      to_email   : toEmail,
      to_name    : toName,
      email      : toEmail,
      user_email : toEmail,
      name       : toName,
      user_name  : toName,
      otp        : otpCode,
      otp_code   : otpCode,
      code       : otpCode,
      passcode   : otpCode,
      message    : 'Your AvenZo OTP is: ' + otpCode + '. Valid for 10 minutes. Do not share. - AvenZo Team'
    }
  };
  return fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body   : JSON.stringify(payload)
  }).then(function(res) {
    if (!res.ok) {
      return res.text().then(function(t) { throw new Error('EmailJS ' + res.status + ': ' + t); });
    }
    return res;
  });
}

/* ═══════════════════════════════════════════
   GLOBAL STATE
═══════════════════════════════════════════ */
var CU = null;
var allProds = [], cdTimer = null;
var sliderIndex = 0, sliderTimer = null, sliderSlides = [];
var touchStartX = 0, touchDeltaX = 0, isDragging = false;
var _currentBuyLink = '', _currentBuyName = '', _currentBuySection = 'Home';
var _currentProofData = null;
var _chatUnsubscribe = null;

/* ═══════════════════════════════════════════
   SAFE STORAGE
═══════════════════════════════════════════ */
var _mem = {};
function _lsGet(k, d) {
  try { var v = localStorage.getItem(k); return v !== null ? v : d; }
  catch(e) { return k in _mem ? _mem[k] : d; }
}
function _lsSet(k, v) {
  try { localStorage.setItem(k, v); } catch(e) { _mem[k] = v; }
}
function _lsRemove(k) {
  try { localStorage.removeItem(k); } catch(e) { delete _mem[k]; }
}

var S = {
  users    : function() { return JSON.parse(_lsGet('lk_users', '{}')); },
  saveU    : function(u) { _lsSet('lk_users', JSON.stringify(u)); },
  cur      : function() { return JSON.parse(_lsGet('az_cur', 'null')); },
  saveCur  : function(u) { _lsSet('az_cur', JSON.stringify(u)); CU = u; },
  prods    : function() { return JSON.parse(_lsGet('opg_admin_products', '[]')); },
  partners : function() { return JSON.parse(_lsGet('lk_partners', '[]')); },
  sliders  : function() { return JSON.parse(_lsGet('lk_sliders', '[]')); },
  hist     : function(id) { return JSON.parse(_lsGet('az_ch_' + id, '[]')); },
  saveHist : function(id, h) { _lsSet('az_ch_' + id, JSON.stringify(h)); },
  notifs   : function() { return JSON.parse(_lsGet('opg_notifs', '[]')); },
  orders   : function() { return JSON.parse(_lsGet('az_orders', '[]')); },
  saveOrders: function(o) { _lsSet('az_orders', JSON.stringify(o)); },
  wds      : function() { return JSON.parse(_lsGet('az_withdrawals', '[]')); },
  saveWDs  : function(w) { _lsSet('az_withdrawals', JSON.stringify(w)); }
};

/* ═══════════════════════════════════════════
   AUTH PANEL NAVIGATION
═══════════════════════════════════════════ */
function showMethodsPanel() {
  _show('auth-methods-panel');
  _hide('email-otp-panel');
  _hide('captcha-panel');
}
function showEmailOTPPanel() {
  _hide('auth-methods-panel');
  _show('email-otp-panel');
  _hide('captcha-panel');
  resetEmailOTP();
}
function showCaptchaPanel() {
  _hide('auth-methods-panel');
  _hide('email-otp-panel');
  _show('captcha-panel');
  showCapSignup();
}
function showCapSignup() { _show('cap-signup'); _hide('cap-login'); }
function showCapLogin()  { _hide('cap-signup'); _show('cap-login'); }

function _show(id) { var el = document.getElementById(id); if(el) el.style.display = ''; }
function _hide(id) { var el = document.getElementById(id); if(el) el.style.display = 'none'; }

/* ═══════════════════════════════════════════
   GOOGLE LOGIN
═══════════════════════════════════════════ */
function loginWithGoogle() {
  _showErr('auth-main-error', '');
  if (!_auth) { _showErr('auth-main-error', 'Firebase not available'); return; }

  var provider = new firebase.auth.GoogleAuthProvider();

  _auth.signInWithRedirect(provider)
  .then(function(result) {

    var u = result.user;
    var users = S.users();

    var existing = Object.values(users).find(function(x) {
      return x.email === u.email;
    });

    if (!existing) {
      var id = 'u_' + Date.now();
      var code = 'AVNZ' + Math.floor(Math.random() * 100000);

      existing = {
        id: id,
        name: u.displayName || 'AvenZo User',
        username: (u.displayName || 'user').split(' ')[0].toLowerCase(),
        email: u.email,
        phone: '',
        coins: 50,
        referralCode: code,
        joinDate: new Date().toLocaleDateString(),
        avatar: u.photoURL || ''
      };

      users[id] = existing;
      S.saveU(users);
    }

    S.saveCur(existing);

    _showSuccessAndGo('Welcome! 🎉', 'Logged in with Google');

  }).catch(function(e) {
    _showErr('auth-main-error', 'Google login failed: ' + e.message);
  });
}

/* ═══════════════════════════════════════════
   EMAIL OTP LOGIN
═══════════════════════════════════════════ */
var _eotpCode = '', _eotpEmail = '', _eotpName = '', _eotpResendTimer = null;

function sendEmailOTP(isResend) {
  _showErr('eotp-error1', '');
  var email = (document.getElementById('eotp-email') || {}).value;
  email = email ? email.trim().toLowerCase() : '';
  var name = (document.getElementById('eotp-name') || {}).value;
  name = name ? name.trim() : 'AvenZo User';

  if (!email || !/\S+@\S+\.\S+/.test(email)) {
    _showErr('eotp-error1', 'Enter a valid email address');
    return;
  }

  _eotpEmail = email;
  _eotpName  = name;
  _eotpCode  = String(Math.floor(100000 + Math.random() * 900000));

  var btn = document.getElementById('eotp-send-btn');
  var txt = document.getElementById('eotp-send-text');
  if (btn) btn.disabled = true;
  if (txt) txt.innerHTML = '<span class="btn-spin"></span> Sending...';

  console.log('OTP | to:', email, '| code:', _eotpCode);

  _ejsSend(email, name, _eotpCode).then(function() {
    console.log('OTP sent OK');
    _hide('email-step1');
    _show('email-step2');
    document.querySelectorAll('#eotp-boxes .otp-box').forEach(function(b) {
      b.value = ''; b.classList.remove('filled', 'shake');
    });
    _showErr('eotp-error2', '');
    _startResendTimer('eotp-countdown', 'eotp-resend-timer', 'eotp-resend-btn', 60, _eotpResendTimer);
    showToast('OTP sent! Check your inbox.');
  }).catch(function(err) {
    console.error('OTP send failed:', err);
    _showErr('eotp-error1', 'Failed to send OTP. ' + (err.message || 'Please try again.'));
  }).finally(function() {
    if (btn) btn.disabled = false;
    if (txt) txt.textContent = 'Send OTP';
  });
}

function verifyEmailOTP() {
  _showErr('eotp-error2', '');
  var boxes = document.querySelectorAll('#eotp-boxes .otp-box');
  var entered = Array.from(boxes).map(function(b) { return b.value; }).join('');
  if (entered.length !== 6) { _showErr('eotp-error2', 'Enter all 6 digits'); _shakeBoxes('#eotp-boxes .otp-box'); return; }
  var btn = document.getElementById('eotp-verify-btn');
  var txt = document.getElementById('eotp-verify-text');
  if (btn) btn.disabled = true;
  if (txt) txt.innerHTML = '<span class="btn-spin"></span> Verifying...';
  setTimeout(function() {
    if (entered === _eotpCode) {
      clearInterval(_eotpResendTimer);
      var users = S.users();
      var user = Object.values(users).find(function(u) { return u.email === _eotpEmail; });
      if (!user) {
        var id = 'u_' + Date.now();
        var code = 'AVNZ' + Math.floor(Math.random() * 100000);
        user = { id: id, name: _eotpName || _eotpEmail.split('@')[0], username: _eotpEmail.split('@')[0], email: _eotpEmail, phone: '', coins: 50, referralCode: code, joinDate: new Date().toLocaleDateString(), avatar: '' };
        users[id] = user; S.saveU(users);
      }
      S.saveCur(user);
      _showSuccessAndGo('Verified! 🎉', 'Welcome to AvenZo');
    } else {
      if (btn) btn.disabled = false;
      if (txt) txt.textContent = 'Verify OTP';
      _showErr('eotp-error2', 'Wrong OTP. Try again.');
      _shakeBoxes('#eotp-boxes .otp-box');
      boxes.forEach(function(b) { b.value = ''; b.classList.remove('filled'); });
      if (boxes[0]) boxes[0].focus();
    }
  }, 500);
}

function resetEmailOTP() {
  clearInterval(_eotpResendTimer);
  _show('email-step1'); _hide('email-step2');
  _showErr('eotp-error1', ''); _showErr('eotp-error2', '');
  var btn = document.getElementById('eotp-send-btn');
  if (btn) btn.disabled = false;
  var txt = document.getElementById('eotp-send-text');
  if (txt) txt.textContent = 'Send OTP';
}

function eotpNav(input, n) { _otpNav(input, n, document.querySelectorAll('#eotp-boxes .otp-box'), verifyEmailOTP); }
function eotpBack(input, n, e) { _otpBack(input, n, document.querySelectorAll('#eotp-boxes .otp-box'), e); }

/* ═══════════════════════════════════════════
   CAPTCHA SIGNUP
═══════════════════════════════════════════ */
var _cs = { code: '', timers: [], resendTimer: null, _pending: null };

function startCapSignup() {
  _showErr('cap-signup-error', '');
  var uname = (document.getElementById('r-uname') || {}).value;
  uname = uname ? uname.trim() : '';
  var email = (document.getElementById('r-email') || {}).value;
  email = email ? email.trim().toLowerCase() : '';
  var pass = (document.getElementById('r-pass') || {}).value;
  pass = pass ? pass.trim() : '';
  if (!uname) { _showErr('cap-signup-error', 'Choose a username'); return; }
  if (!email || !/\S+@\S+\.\S+/.test(email)) { _showErr('cap-signup-error', 'Enter a valid email'); return; }
  if (!pass || pass.length < 6) { _showErr('cap-signup-error', 'Password must be at least 6 characters'); return; }
  var users = S.users();
  if (Object.values(users).find(function(u) { return u.email === email; })) {
    _showErr('cap-signup-error', 'Email already registered — use Login'); return;
  }
  _cs._pending = { uname: uname, email: email, pass: pass };
  _hide('cap-signup-step1'); _show('cap-signup-step2');
  document.querySelectorAll('#cap-su-boxes .otp-box').forEach(function(b) { b.value = ''; b.classList.remove('filled', 'shake'); });
  _cs.code = _genCode();
  _runReveal('cap-su', _cs, function() { _startResendTimer('cap-su-cd', 'cap-su-timer', 'cap-su-resend', 10, _cs.resendTimer); });
}
function capSuNav(i, n) { _otpNav(i, n, document.querySelectorAll('#cap-su-boxes .otp-box'), verifyCapSignup); }
function capSuBack(i, n, e) { _otpBack(i, n, document.querySelectorAll('#cap-su-boxes .otp-box'), e); }
function verifyCapSignup() {
  _showErr('cap-signup-otp-error', '');
  var boxes = document.querySelectorAll('#cap-su-boxes .otp-box');
  var entered = Array.from(boxes).map(function(b) { return b.value; }).join('');
  if (entered.length !== 6) { _showErr('cap-signup-otp-error', 'Enter all 6 digits'); _shakeBoxes('#cap-su-boxes .otp-box'); return; }
  var btn = document.getElementById('cap-su-verify-btn');
  var txt = document.getElementById('cap-su-verify-text');
  if (btn) btn.disabled = true;
  if (txt) txt.innerHTML = '<span class="btn-spin"></span> Creating Account...';
  setTimeout(function() {
    if (entered === _cs.code) {
      var p = _cs._pending || {};
      var users = S.users();
      var id = 'u_' + Date.now();
      var code = 'AVNZ' + (p.uname || '').toUpperCase().slice(0, 3) + Math.floor(Math.random() * 10000);
      var newUser = { id: id, name: p.uname, username: p.uname, email: p.email, phone: '', password: p.pass, coins: 50, referralCode: code, joinDate: new Date().toLocaleDateString(), avatar: '' };
      users[id] = newUser; S.saveU(users); S.saveCur(newUser);
      _cs.timers.forEach(function(t) { clearTimeout(t); }); clearInterval(_cs.resendTimer);
      _showSuccessAndGo('Account Created! 🎉', 'Welcome to AvenZo');
    } else {
      if (btn) btn.disabled = false;
      if (txt) txt.textContent = 'Verify & Create Account';
      _showErr('cap-signup-otp-error', 'Wrong code. Try again.');
      _shakeBoxes('#cap-su-boxes .otp-box');
      boxes.forEach(function(b) { b.value = ''; b.classList.remove('filled'); });
      if (boxes[0]) boxes[0].focus();
    }
  }, 500);
}
function resendCapSu() {
  _cs.timers.forEach(function(t) { clearTimeout(t); });
  _cs.code = _genCode();
  document.querySelectorAll('#cap-su-boxes .otp-box').forEach(function(b) { b.value = ''; b.classList.remove('filled', 'shake'); });
  _hide('cap-su-entry'); _showErr('cap-signup-otp-error', '');
  var btn = document.getElementById('cap-su-verify-btn'); if (btn) btn.disabled = false;
  _runReveal('cap-su', _cs, function() { _startResendTimer('cap-su-cd', 'cap-su-timer', 'cap-su-resend', 10, _cs.resendTimer); });
}
function resetCapSignup() {
  _cs.timers.forEach(function(t) { clearTimeout(t); }); clearInterval(_cs.resendTimer);
  _show('cap-signup-step1'); _hide('cap-signup-step2'); _hide('cap-su-entry');
  _showErr('cap-signup-error', ''); _showErr('cap-signup-otp-error', '');
}

/* ═══════════════════════════════════════════
   CAPTCHA LOGIN
═══════════════════════════════════════════ */
var _cl = { code: '', timers: [], resendTimer: null, user: null };

function startCapLogin() {
  _showErr('cap-login-error', '');
  var email = (document.getElementById('cap-login-email') || {}).value;
  email = email ? email.trim().toLowerCase() : '';
  if (!email || !/\S+@\S+\.\S+/.test(email)) { _showErr('cap-login-error', 'Enter a valid email'); return; }
  var users = S.users();
  var user = Object.values(users).find(function(u) { return u.email === email; });
  if (!user) { _showErr('cap-login-error', 'No account found. Create one first.'); return; }
  _cl.user = user;
  _hide('cap-login-step1'); _show('cap-login-step2');
  document.querySelectorAll('#cap-ln-boxes .otp-box').forEach(function(b) { b.value = ''; b.classList.remove('filled', 'shake'); });
  _cl.code = _genCode();
  _runReveal('cap-ln', _cl, function() { _startResendTimer('cap-ln-cd', 'cap-ln-timer', 'cap-ln-resend', 10, _cl.resendTimer); });
}
function capLnNav(i, n) { _otpNav(i, n, document.querySelectorAll('#cap-ln-boxes .otp-box'), verifyCapLogin); }
function capLnBack(i, n, e) { _otpBack(i, n, document.querySelectorAll('#cap-ln-boxes .otp-box'), e); }
function verifyCapLogin() {
  _showErr('cap-login-otp-error', '');
  var boxes = document.querySelectorAll('#cap-ln-boxes .otp-box');
  var entered = Array.from(boxes).map(function(b) { return b.value; }).join('');
  if (entered.length !== 6) { _showErr('cap-login-otp-error', 'Enter all 6 digits'); _shakeBoxes('#cap-ln-boxes .otp-box'); return; }
  var btn = document.getElementById('cap-ln-verify-btn');
  var txt = document.getElementById('cap-ln-verify-text');
  if (btn) btn.disabled = true;
  if (txt) txt.innerHTML = '<span class="btn-spin"></span> Logging in...';
  setTimeout(function() {
    if (entered === _cl.code) {
      S.saveCur(_cl.user);
      _cl.timers.forEach(function(t) { clearTimeout(t); }); clearInterval(_cl.resendTimer);
      _showSuccessAndGo('Welcome Back! 👋', _cl.user.name || 'User');
    } else {
      if (btn) btn.disabled = false;
      if (txt) txt.textContent = 'Verify & Login';
      _showErr('cap-login-otp-error', 'Wrong code. Try again.');
      _shakeBoxes('#cap-ln-boxes .otp-box');
      boxes.forEach(function(b) { b.value = ''; b.classList.remove('filled'); });
      if (boxes[0]) boxes[0].focus();
    }
  }, 500);
}
function resendCapLn() {
  _cl.timers.forEach(function(t) { clearTimeout(t); });
  _cl.code = _genCode();
  document.querySelectorAll('#cap-ln-boxes .otp-box').forEach(function(b) { b.value = ''; b.classList.remove('filled', 'shake'); });
  _hide('cap-ln-entry'); _showErr('cap-login-otp-error', '');
  var btn = document.getElementById('cap-ln-verify-btn'); if (btn) btn.disabled = false;
  _runReveal('cap-ln', _cl, function() { _startResendTimer('cap-ln-cd', 'cap-ln-timer', 'cap-ln-resend', 10, _cl.resendTimer); });
}
function resetCapLogin() {
  _cl.timers.forEach(function(t) { clearTimeout(t); }); clearInterval(_cl.resendTimer);
  _show('cap-login-step1'); _hide('cap-login-step2'); _hide('cap-ln-entry');
  _showErr('cap-login-error', ''); _showErr('cap-login-otp-error', '');
}

/* ═══════════════════════════════════════════
   DIGIT REVEAL CORE
═══════════════════════════════════════════ */
function _genCode() { return String(Math.floor(100000 + Math.random() * 900000)); }

function _runReveal(prefix, flowObj, onDone) {
  var dispEl = document.getElementById(prefix + '-digit');
  var posEl  = document.getElementById(prefix + '-pos');
  var fillEl = document.getElementById(prefix + '-fill');
  var entryEl = document.getElementById(prefix + '-entry');
  flowObj.timers.forEach(function(t) { clearTimeout(t); }); flowObj.timers = [];
  if (dispEl) { dispEl.textContent = ''; dispEl.className = 'digit-display'; }
  if (posEl) posEl.textContent = '';
  if (fillEl) fillEl.style.width = '0%';
  if (entryEl) entryEl.style.display = 'none';
  var digits = flowObj.code.split('');
  digits.forEach(function(digit, idx) {
    var t = setTimeout(function() {
      if (!dispEl) return;
      dispEl.classList.remove('pop');
      if (idx > 0) {
        dispEl.classList.add('out');
        setTimeout(function() {
          dispEl.classList.remove('out');
          _showDigit(dispEl, posEl, fillEl, digit, idx, digits.length);
        }, 200);
      } else {
        _showDigit(dispEl, posEl, fillEl, digit, idx, digits.length);
      }
    }, idx * 1400);
    flowObj.timers.push(t);
  });
  var tDone = setTimeout(function() {
    if (dispEl) { dispEl.classList.add('out'); setTimeout(function() { dispEl.textContent = ''; dispEl.className = 'digit-display'; }, 230); }
    if (posEl) posEl.textContent = '';
    if (fillEl) fillEl.style.width = '100%';
    setTimeout(function() {
      if (entryEl) { entryEl.style.display = 'block'; }
      var firstBox = entryEl && entryEl.querySelector('.otp-box');
      if (firstBox) firstBox.focus();
      if (onDone) onDone();
    }, 350);
  }, digits.length * 1400 + 200);
  flowObj.timers.push(tDone);
}

function _showDigit(dispEl, posEl, fillEl, digit, idx, total) {
  dispEl.textContent = digit;
  void dispEl.offsetWidth;
  dispEl.classList.add('pop');
  if (posEl) posEl.textContent = 'Digit ' + (idx + 1) + ' of ' + total;
  if (fillEl) fillEl.style.width = (((idx + 1) / total) * 100) + '%';
}

function _startResendTimer(countId, timerId, btnId, seconds) {
  var timerEl = document.getElementById(timerId);
  var resendEl = document.getElementById(btnId);
  if (resendEl) resendEl.disabled = true;
  if (timerEl) timerEl.innerHTML = 'Resend in <b id="' + countId + '">' + seconds + '</b>s';
  var rem = seconds;
  var iv = setInterval(function() {
    rem--;
    var cd = document.getElementById(countId);
    if (cd) cd.textContent = rem;
    if (rem <= 0) {
      clearInterval(iv);
      if (timerEl) timerEl.textContent = 'Code expired.';
      if (resendEl) resendEl.disabled = false;
    }
  }, 1000);
  return iv;
}

/* ═══════════════════════════════════════════
   OTP NAV HELPERS
═══════════════════════════════════════════ */
function _otpNav(input, boxNum, boxes, autoFn) {
  var val = input.value;
  if (val.length > 1) {
    var digits = val.replace(/\D/g, '').slice(0, 6);
    boxes.forEach(function(b, i) { b.value = digits[i] || ''; b.classList.toggle('filled', !!digits[i]); });
    if (digits.length === 6) setTimeout(autoFn, 300);
    return;
  }
  if (/\d/.test(val)) {
    input.classList.add('filled');
    if (boxNum < 6) boxes[boxNum].focus();
    else { input.blur(); var all = Array.from(boxes).map(function(b) { return b.value; }).join(''); if (all.length === 6) setTimeout(autoFn, 350); }
  } else { input.value = ''; input.classList.remove('filled'); }
}
function _otpBack(input, boxNum, boxes, e) {
  if (e.key === 'Backspace' && !input.value && boxNum > 1) { boxes[boxNum - 2].value = ''; boxes[boxNum - 2].classList.remove('filled'); boxes[boxNum - 2].focus(); }
  if (e.key === 'ArrowLeft' && boxNum > 1) boxes[boxNum - 2].focus();
  if (e.key === 'ArrowRight' && boxNum < 6) boxes[boxNum].focus();
}
function _shakeBoxes(selector) {
  document.querySelectorAll(selector).forEach(function(b) {
    b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake');
    b.addEventListener('animationend', function() { b.classList.remove('shake'); }, { once: true });
  });
}
function _showErr(id, msg, type) {
  var el = document.getElementById(id);
  if (!el) return;
  if (msg) { el.textContent = msg; el.className = 'otp-error-box show' + (type === 'success' ? ' success-msg' : ''); }
  else { el.className = 'otp-error-box'; }
}
function togglePw(inputId, btn) {
  var inp = document.getElementById(inputId);
  if (!inp) return;
  if (inp.type === 'password') { inp.type = 'text'; btn.textContent = '🙈'; }
  else { inp.type = 'password'; btn.textContent = '👁'; }
}

/* ═══════════════════════════════════════════
   SUCCESS OVERLAY
═══════════════════════════════════════════ */
function _showSuccessAndGo(title, sub) {
  var ov = document.createElement('div');
  ov.className = 'verify-success-overlay';
  ov.innerHTML =
    '<div class="vso-circle">&#10003;</div>' +
    '<div class="vso-text">' + _esc(title) + '</div>' +
    '<div class="vso-sub">' + _esc(sub) + '</div>';
  document.body.appendChild(ov);
  confettiBurst();
  setTimeout(function() { if (ov.parentNode) ov.remove(); initApp(); }, 1600);
}

/* ═══════════════════════════════════════════
   APP INIT
═══════════════════════════════════════════ */
function initApp() {
  CU = S.cur();
  goS('s-app');
  updateUI();
  loadSlider();
  loadProducts();
  loadPartners();
  gotoSec('home');
  startCD();
  renderNotifsList();
  initChat();
  setInterval(function() {
    if (CU) { loadProducts(); loadPartners(); pollAdminNotifs(); }
  }, 6000);
}

/* ═══════════════════════════════════════════
   SCREEN / SECTION NAV
═══════════════════════════════════════════ */
function goS(id) {
  document.querySelectorAll('.screen').forEach(function(s) { s.classList.remove('active'); });
  var el = document.getElementById(id); if (el) el.classList.add('active');
}

function gotoSec(name) {
  document.querySelectorAll('.sec').forEach(function(s) { s.classList.remove('active'); });
  var sec = document.getElementById('sec-' + name); if (sec) sec.classList.add('active');
  document.querySelectorAll('.bni').forEach(function(b) { b.classList.remove('active'); });
  var nb = document.getElementById('bn-' + name); if (nb) nb.classList.add('active');
  if (name === 'rewards')   { renderRwdPage(); renderLeaderboard(); }
  if (name === 'deals')     { renderDeals('all'); }
  if (name === 'partners')  { renderPartnersPage(); }
  if (name === 'orders')    { renderOrders(); }
  if (name === 'wallet')    { renderWdHist(); }
  if (name === 'notifications') { renderNotifsList(); }
  if (name === 'chat')      { scrollChatBottom(); }
}

function navCk(name, el) {
  document.querySelectorAll('.bni').forEach(function(b) { b.classList.remove('active'); });
  el.classList.add('active');
  gotoSec(name);
}

/* ═══════════════════════════════════════════
   UI UPDATE
═══════════════════════════════════════════ */
function updateUI() {
  if (!CU) return;
  var c = CU.coins || 0;
  var moneyStr = (c / 100).toFixed(2);
  ['qs-c', 'rwd-coins', 'wallet-c', 'prof-coins'].forEach(function(id) {
    var el = document.getElementById(id); if (el) el.textContent = c;
  });
  setEl('wallet-money', moneyStr);
  setEl('prof-n', CU.name || 'User');
  setEl('prof-ph', CU.phone || '');
  setEl('prof-em', CU.email || '');
  setEl('prof-un', CU.username ? '@' + CU.username : '');
  ['ref-code', 'prof-ref'].forEach(function(id) { setEl(id, CU.referralCode || 'AVNZ01'); });
  var today = new Date().toDateString();
  var claimed = _lsGet('az_d_' + CU.id, '') === today;
  setEl('qs-d', claimed ? '✅' : 'Claim');
  ['daily-btn', 'daily-btn2'].forEach(function(id) {
    var b = document.getElementById(id);
    if (b) b.textContent = claimed ? '✅ Claimed!' : 'Claim 10 🪙';
  });
}

function setEl(id, v) { var el = document.getElementById(id); if (el) el.textContent = v; }

function addCoins(amt, lbl) {
  if (!CU) return;
  CU.coins = (CU.coins || 0) + amt;
  var u = S.users(); u[CU.id] = CU; S.saveU(u); S.saveCur(CU);
  var h = S.hist(CU.id);
  h.unshift({ lbl: lbl, amt: amt, date: new Date().toLocaleString() });
  S.saveHist(CU.id, h.slice(0, 50));
  updateUI();
  showToast('🪙 +' + amt + ' coins! ' + lbl);
}

function doLogout() {
  if (_chatUnsubscribe) _chatUnsubscribe();
  if (_auth) try { _auth.signOut(); } catch(e) {}
  _lsRemove('az_cur'); CU = null;
  goS('s-auth'); showMethodsPanel();
}

/* ═══════════════════════════════════════════
   PRODUCTS
═══════════════════════════════════════════ */
var DEF_PRODS = [
  { id: 'd1', name: 'Galaxy Smartwatch', image: '⌚', price: 999,  discount: 60, category: 'electronics', link: '#', status: 'on' },
  { id: 'd2', name: 'Wireless Earbuds',  image: '🎧', price: 799,  discount: 55, category: 'electronics', link: '#', status: 'on' },
  { id: 'd3', name: 'RGB Gaming Mouse',  image: '🖱️', price: 199,  discount: 75, category: 'electronics', link: '#', status: 'on' },
  { id: 'd4', name: 'JBL Speaker',       image: '🔊', price: 899,  discount: 45, category: 'electronics', link: '#', status: 'on' },
  { id: 'd5', name: 'Smart LED Strip',   image: '💡', price: 499,  discount: 50, category: 'home',        link: '#', status: 'on' },
  { id: 'd6', name: 'Running Shoes',     image: '👟', price: 1299, discount: 40, category: 'sports',      link: '#', status: 'on' }
];

function loadProducts() {
  var adminProds = S.prods().filter(function(p) { return p.status === 'on'; });
  if (adminProds.length > 0) {
    var seen = {};
    allProds = adminProds.filter(function(p) {
      if (seen[p.id]) return false; seen[p.id] = true; return true;
    }).map(function(p) {
      return { id: p.id, name: p.name, image: p.image || '🛍️', price: Number(p.price), discount: Number(p.discount) || 0, category: p.category || 'electronics', link: p.link || '#', status: 'on', clicks: p.clicks || 0 };
    });
  } else {
    allProds = DEF_PRODS.slice();
  }
  setEl('qs-dn', allProds.length);
  renderHomeProds();
}

function _pcHTML(p, i) {
  return '<div class="p-card" style="animation-delay:' + (i * 0.06) + 's" onclick="buyProd(' + "'" + _esc(p.link || '#') + "','" + _esc(p.name || '') + "'," + (p.price || 0) + ",'Home')"  + '">' +
    '<div class="p-img">' + (p.image || '🛍️') + '<span class="disc-badge">' + (p.discount || 0) + '% OFF</span></div>' +
    '<div class="p-info">' +
      '<div class="p-name">' + _esc(p.name || '') + '</div>' +
      '<div class="p-rat">⭐ 4.5</div>' +
      '<div class="p-row">' +
        '<span class="p-price">₹' + Number(p.price).toLocaleString() + '</span>' +
        '<button class="buy-btn" onclick="event.stopPropagation();buyProd(\'' + _esc(p.link || '#') + '\',\'' + _esc(p.name || '') + '\',' + (p.price || 0) + ',\'Deals\')" type="button">Buy Now</button>' +
      '</div>' +
    '</div></div>';
}

function renderHomeProds() {
  var el = document.getElementById('home-prods'); if (!el) return;
  if (!allProds.length) { el.innerHTML = '<div class="empty-b" style="grid-column:1/-1"><div>🛍️</div><p>No products yet</p></div>'; return; }
  el.innerHTML = allProds.slice(0, 6).map(function(p, i) { return _pcHTML(p, i); }).join('');
}

function renderDeals(cat) {
  var el = document.getElementById('deals-prods'); if (!el) return;
  var list = (!cat || cat === 'all') ? allProds : allProds.filter(function(p) { return p.category === cat; });
  if (!list.length) { el.innerHTML = '<p class="empty-b" style="grid-column:1/-1">No products found</p>'; return; }
  el.innerHTML = list.map(function(p, i) { return _pcHTML(p, i); }).join('');
}

function filterD(btn, cat) {
  document.querySelectorAll('.ft').forEach(function(t) { t.classList.remove('active'); });
  btn.classList.add('active');
  renderDeals(cat);
}

function searchProds(q) {
  var el = document.getElementById('home-prods'); if (!el) return;
  if (!q) { renderHomeProds(); return; }
  var r = allProds.filter(function(p) { return p.name.toLowerCase().indexOf(q.toLowerCase()) !== -1; });
  el.innerHTML = r.length ? r.map(function(p, i) { return _pcHTML(p, i); }).join('') : '<p style="color:var(--sub);grid-column:1/-1;text-align:center;padding:20px">No results</p>';
}

/* ═══════════════════════════════════════════
   BUY FLOW
═══════════════════════════════════════════ */
function buyProd(link, name, price, section) {
  var prods = S.prods();
  var idx = prods.findIndex(function(p) { return p.link === link && link !== '#'; });
  if (idx > -1) { prods[idx].clicks = (prods[idx].clicks || 0) + 1; _lsSet('opg_admin_products', JSON.stringify(prods)); }
  _currentBuyLink    = link || '#';
  _currentBuyName    = name || 'Product';
  _currentBuySection = section || 'Home';
  openModal('buy-instr-modal');
}

function openBuyLink() {
  closeModal('buy-instr-modal');
  if (_currentBuyLink && _currentBuyLink !== '#') window.open(_currentBuyLink, '_blank');
  if (CU) addCoins(2, 'Partner Link Click 🛍️');
  setTimeout(function() { openModal('order-proof-modal'); }, 800);
}

/* ═══════════════════════════════════════════
   ORDER PROOF
═══════════════════════════════════════════ */
function handleProofFile(input) {
  var file = input.files[0]; if (!file) return;
  var area = document.getElementById('proof-upload-area');
  var txt  = document.getElementById('proof-upload-text');
  var reader = new FileReader();
  reader.onload = function(e) {
    _currentProofData = e.target.result;
    if (area) area.classList.add('has-file');
    if (txt) txt.innerHTML =
      '<div class="proof-ico">✅</div>' +
      '<div class="proof-lbl">Screenshot uploaded!</div>' +
      '<div class="proof-sub-lbl">' + _esc(file.name) + '</div>';
  };
  reader.readAsDataURL(file);
}

function submitOrderProof() {
  _showErr('proof-error', '');
  var upiEl    = document.getElementById('proof-upi');
  var amtEl    = document.getElementById('order-amount');
  var msgEl    = document.getElementById('proof-msg');
  var upi      = upiEl ? upiEl.value.trim() : '';
  var amount   = amtEl ? amtEl.value.trim() : '';
  var message  = msgEl ? msgEl.value.trim() : '';

  if (!upi)              { _showErr('proof-error', 'Enter your UPI ID'); return; }
  if (!_currentProofData){ _showErr('proof-error', 'Please upload a screenshot'); return; }
  if (!CU)               { _showErr('proof-error', 'Not logged in'); return; }

  var orders = S.orders();
  var order = {
    id          : 'ord_' + Date.now(),
    userId      : CU.id,
    userName    : CU.name || CU.username || 'User',
    productName : _currentBuyName,
    productLink : _currentBuyLink,
    section     : _currentBuySection,
    screenshotData: _currentProofData,
    upiId       : upi,
    amount      : amount || '0',
    message     : message,
    status      : 'proof_submitted',
    date        : new Date().toLocaleString()
  };
  orders.unshift(order);
  S.saveOrders(orders);
  addCoins(5, 'Order Proof Submitted 📦');
  closeModal('order-proof-modal');

  // Reset proof modal
  _currentProofData = null;
  var area = document.getElementById('proof-upload-area'); if (area) area.classList.remove('has-file');
  var txtEl = document.getElementById('proof-upload-text');
  if (txtEl) txtEl.innerHTML = '<div class="proof-ico">📸</div><div class="proof-lbl">Tap to Upload Screenshot</div><div class="proof-sub-lbl">Order confirmation or cart screenshot</div>';
  if (upiEl) upiEl.value = '';
  if (amtEl) amtEl.value = '';
  if (msgEl) msgEl.value = '';
  var fi = document.getElementById('proof-file-input'); if (fi) fi.value = '';
  showToast('✅ Order proof submitted! Admin will verify soon.');
}

function renderOrders() {
  var el = document.getElementById('orders-list'); if (!el || !CU) return;
  var all = S.orders().filter(function(o) { return o.userId === CU.id; });
  if (!all.length) { el.innerHTML = '<div class="empty-b"><div>📦</div><p>No orders yet</p></div>'; return; }
  el.innerHTML = all.map(function(o) {
    var statusLabel = o.status === 'approved' ? '✅ Approved' : o.status === 'rejected' ? '❌ Rejected' : '📤 Submitted';
    return '<div class="order-card">' +
      '<div class="oc-top"><div class="oc-name">' + _esc(o.productName || 'Order') + '</div><span class="oc-status ' + _esc(o.status) + '">' + statusLabel + '</span></div>' +
      '<div class="oc-date">📅 ' + _esc(o.date) + '</div>' +
      '<div class="oc-upi">🏦 UPI: ' + _esc(o.upiId) + '</div>' +
      (o.amount ? '<div class="oc-amt">💰 ₹' + _esc(o.amount) + '</div>' : '') +
      '</div>';
  }).join('');
}

/* ═══════════════════════════════════════════
   PARTNERS
═══════════════════════════════════════════ */
var DEF_PARTNERS = [
  { id: 'dp1', name: 'Amazon',  image: '📦', description: "World's largest online store", link: 'https://amazon.in',  status: 'on' },
  { id: 'dp2', name: 'Flipkart',image: '🏬', description: "India's biggest marketplace",  link: 'https://flipkart.com',status: 'on' },
  { id: 'dp3', name: 'Ajio',    image: '👗', description: 'Fashion & lifestyle deals',    link: 'https://ajio.com',   status: 'on' },
  { id: 'dp4', name: 'Myntra',  image: '👠', description: 'Top fashion brands',           link: 'https://myntra.com', status: 'on' }
];

function loadPartners() {
  var adminP = S.partners().filter(function(p) { return p.status === 'on'; });
  var all = DEF_PARTNERS.concat(adminP);
  renderHomePartners(all);
}

function renderHomePartners(partners) {
  var el = document.getElementById('home-partners'); if (!el) return;
  el.innerHTML = (partners || []).map(function(p, i) {
    return '<div class="ps-item" style="animation-delay:' + (i * 0.08) + 's" onclick="buyProd(\'' + _esc(p.link) + '\',\'' + _esc(p.name) + '\',0,\'Partners\')">' +
      '<div class="ps-img">' + (p.image || '🤝') + '</div>' +
      '<div class="ps-name">' + _esc(p.name) + '</div>' +
      '<div class="ps-link">Shop Now</div>' +
      '</div>';
  }).join('');
}

function renderPartnersPage() {
  var el = document.getElementById('partners-grid'); if (!el) return;
  var adminP = S.partners().filter(function(p) { return p.status === 'on'; });
  var all = DEF_PARTNERS.concat(adminP);
  el.innerHTML = all.map(function(p, i) {
    return '<div class="pg-item" style="animation-delay:' + (i * 0.08) + 's">' +
      '<div class="pgi-top">' + (p.image || '🤝') + '</div>' +
      '<div class="pgi-info">' +
        '<div class="pgi-name">' + _esc(p.name) + '</div>' +
        '<div class="pgi-desc">' + _esc(p.description || '') + '</div>' +
        '<button class="pgi-btn" onclick="buyProd(\'' + _esc(p.link) + '\',\'' + _esc(p.name) + '\',0,\'Partners\')" type="button">Shop Now →</button>' +
      '</div></div>';
  }).join('');
}

/* ═══════════════════════════════════════════
   DAILY CLAIM
═══════════════════════════════════════════ */
function claimDaily() {
  if (!CU) return;
  var today = new Date().toDateString();
  var key = 'az_d_' + CU.id;
  if (_lsGet(key, '') === today) { showToast('✅ Already claimed today! Come back tomorrow 🌙'); return; }
  _lsSet(key, today);
  addCoins(10, 'Daily Login Reward 🎁');
  ['daily-btn', 'daily-btn2'].forEach(function(id) {
    var b = document.getElementById(id);
    if (b) { b.textContent = '✅ Claimed!'; b.style.background = 'rgba(0,230,160,.3)'; }
  });
  setEl('qs-d', '✅');
}

/* ═══════════════════════════════════════════
   REWARDS
═══════════════════════════════════════════ */
function renderRwdPage() {
  var el = document.getElementById('coins-hist'); if (!el || !CU) return;
  var h = S.hist(CU.id);
  if (!h.length) { el.innerHTML = '<div class="empty-b"><div>🪙</div><p>No coin history yet</p></div>'; return; }
  el.innerHTML = h.slice(0, 12).map(function(x) {
    return '<div class="ch-item"><div class="chi-ico">🪙</div><div class="chi-info"><h4>' + _esc(x.lbl) + '</h4><p>' + _esc(x.date) + '</p></div><div class="chi-amt">+' + x.amt + '</div></div>';
  }).join('');
}

function renderLeaderboard() {
  var el = document.getElementById('leaderboard-list'); if (!el) return;
  var users = Object.values(S.users()).sort(function(a, b) { return (b.coins || 0) - (a.coins || 0); }).slice(0, 100);
  if (!users.length) { el.innerHTML = '<div class="empty-b"><div>🏆</div><p>No users yet</p></div>'; return; }
  el.innerHTML = users.map(function(u, i) {
    var rank = i + 1;
    var rankClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
    var rankEmoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
    var isMe = CU && u.id === CU.id;
    return '<div class="lb-row' + (isMe ? ' me' : '') + '">' +
      '<span class="lb-rank ' + rankClass + '">' + rankEmoji + '</span>' +
      '<span class="lb-avatar">👤</span>' +
      '<span class="lb-name">' + _esc(u.name || u.username || 'User') + (isMe ? ' (You)' : '') + '</span>' +
      '<span class="lb-coins">🪙 ' + (u.coins || 0) + '</span>' +
      '</div>';
  }).join('');
}

/* ═══════════════════════════════════════════
   WALLET / WITHDRAW
═══════════════════════════════════════════ */
function submitWithdraw() {
  _showErr('wd-error', '');
  if (!CU) return;
  var upiEl   = document.getElementById('wd-upi');
  var msgEl   = document.getElementById('wd-msg');
  var coinsEl = document.getElementById('wd-coins-input');
  var upi     = upiEl ? upiEl.value.trim() : '';
  var msg     = msgEl ? msgEl.value.trim() : '';
  var coins   = parseInt(coinsEl ? coinsEl.value : 0);
  if (!upi)            { _showErr('wd-error', 'Enter your UPI ID'); return; }
  if (!coins || coins < 1000) { _showErr('wd-error', 'Minimum 1000 coins required'); return; }
  if (coins % 1000 !== 0)     { _showErr('wd-error', 'Enter coins in multiples of 1000'); return; }
  if ((CU.coins || 0) < coins){ _showErr('wd-error', 'Insufficient coins'); return; }
  var amount = (coins / 100).toFixed(2);
  CU.coins = (CU.coins || 0) - coins;
  var u = S.users(); u[CU.id] = CU; S.saveU(u); S.saveCur(CU);
  var wds = S.wds();
  wds.unshift({ id: 'wd_' + Date.now(), userId: CU.id, userName: CU.name || CU.username, coins: coins, amount: '₹' + amount, upiId: upi, message: msg, status: 'pending', date: new Date().toLocaleString() });
  S.saveWDs(wds);
  updateUI();
  if (upiEl)   upiEl.value   = '';
  if (msgEl)   msgEl.value   = '';
  if (coinsEl) coinsEl.value = '';
  renderWdHist();
  showToast('💸 Withdrawal request submitted! Admin will process soon.');
}

function renderWdHist() {
  var el = document.getElementById('wd-hist-list'); if (!el || !CU) return;
  var all = S.wds().filter(function(w) { return w.userId === CU.id; });
  if (!all.length) { el.innerHTML = '<div class="empty-b"><div>💸</div><p>No withdrawals yet</p></div>'; return; }
  el.innerHTML = all.map(function(w) {
    return '<div class="wd-hist-item">' +
      '<div class="whi-ico">💸</div>' +
      '<div class="whi-info"><h5>' + w.coins + '🪙 → ' + _esc(w.amount) + '</h5><p>UPI: ' + _esc(w.upiId) + ' • ' + _esc(w.date) + '</p></div>' +
      '<span class="whi-status ' + _esc(w.status) + '">' + (w.status === 'pending' ? '⏳ Pending' : '✅ Approved') + '</span>' +
      '</div>';
  }).join('');
}

/* ═══════════════════════════════════════════
   NOTIFICATIONS
═══════════════════════════════════════════ */
function renderNotifsList() {
  var el = document.getElementById('notifs-list'); if (!el) return;
  var notifs = S.notifs();
  var welcomeHTML = '<div class="ni"><div class="ni-i" style="background:rgba(168,85,247,.15)">⚡</div><div class="ni-t"><h4>Welcome to AvenZo!</h4><p>Start shopping &amp; earning coins today.</p><span class="nt">Just now</span></div></div>';
  if (!notifs.length) { el.innerHTML = welcomeHTML; return; }
  el.innerHTML = notifs.slice(0, 10).map(function(n) {
    return '<div class="ni"><div class="ni-i" style="background:rgba(168,85,247,.2)">🔔</div><div class="ni-t"><h4>' + _esc(n.title) + '</h4><p>' + _esc(n.message) + '</p><span class="nt">' + _esc(n.date) + '</span></div></div>';
  }).join('') + welcomeHTML;
  var badge = document.getElementById('prof-notif-badge'); if (badge) badge.textContent = notifs.length;
}

function pollAdminNotifs() {
  var notifs = S.notifs();
  var lastSeen = parseInt(_lsGet('az_last_notif', '0'));
  var fresh = notifs.filter(function(n) { return parseInt((n.id || '').replace('n_', '')) > lastSeen; });
  if (fresh.length) { _lsSet('az_last_notif', (fresh[0].id || '').replace('n_', '')); renderNotifsList(); }
}

/* ═══════════════════════════════════════════
   CHAT (FIRESTORE + localStorage fallback)
═══════════════════════════════════════════ */
function initChat() {
  if (!CU) return;
  if (_db) {
    var chatRef = _db.collection('chats').doc(CU.id).collection('messages').orderBy('timestamp', 'asc');
    if (_chatUnsubscribe) _chatUnsubscribe();
    _chatUnsubscribe = chatRef.onSnapshot(function(snapshot) {
      var el = document.getElementById('chat-msgs'); if (!el) return;
      el.innerHTML = '<div class="chat-bubble cb-admin">👋 Welcome to AvenZo Support! How can we help you?<span class="cb-time">AvenZo Team</span></div>';
      snapshot.forEach(function(doc) {
        var d = doc.data();
        var bubble = document.createElement('div');
        bubble.className = 'chat-bubble ' + (d.sender === 'user' ? 'cb-user' : 'cb-admin');
        var time = d.timestamp && d.timestamp.toDate ? new Date(d.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        bubble.innerHTML = _esc(d.text || '') + '<span class="cb-time">' + (d.sender === 'user' ? _esc(CU.name || 'You') : 'AvenZo Support') + (time ? ' • ' + time : '') + '</span>';
        el.appendChild(bubble);
      });
      scrollChatBottom();
    });
  } else {
    renderLocalChat();
  }
}

function sendChatMsg() {
  var input = document.getElementById('chat-input');
  var text = input ? input.value.trim() : '';
  if (!text || !CU) return;
  input.value = '';
  if (_db) {
    _db.collection('chats').doc(CU.id).collection('messages').add({
      text: text, sender: 'user',
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      userId: CU.id, userName: CU.name || CU.username
    }).catch(function(e) { showToast('Message failed: ' + e.message); });
  } else {
    var msgs = JSON.parse(_lsGet('az_chat_' + CU.id, '[]'));
    msgs.push({ text: text, sender: 'user', timestamp: Date.now() });
    _lsSet('az_chat_' + CU.id, JSON.stringify(msgs));
    renderLocalChat();
  }
}

function renderLocalChat() {
  var el = document.getElementById('chat-msgs'); if (!el || !CU) return;
  var msgs = JSON.parse(_lsGet('az_chat_' + CU.id, '[]'));
  el.innerHTML = '<div class="chat-bubble cb-admin">👋 Welcome to AvenZo Support! How can we help you?<span class="cb-time">AvenZo Team</span></div>';
  msgs.forEach(function(m) {
    var bubble = document.createElement('div');
    bubble.className = 'chat-bubble ' + (m.sender === 'user' ? 'cb-user' : 'cb-admin');
    bubble.innerHTML = _esc(m.text || '') + '<span class="cb-time">' + (m.sender === 'user' ? _esc(CU.name || 'You') : 'AvenZo Support') + '</span>';
    el.appendChild(bubble);
  });
  scrollChatBottom();
}

function scrollChatBottom() {
  var el = document.getElementById('chat-msgs');
  if (el) setTimeout(function() { el.scrollTop = el.scrollHeight; }, 100);
}

/* ═══════════════════════════════════════════
   REFERRAL
═══════════════════════════════════════════ */
function copyCode() {
  var c = CU ? (CU.referralCode || 'AVNZ01') : 'AVNZ01';
  if (navigator.clipboard) {
    navigator.clipboard.writeText(c).catch(function() {});
  }
  showToast('📋 Copied: ' + c);
}

/* ═══════════════════════════════════════════
   PROFILE EDIT
═══════════════════════════════════════════ */
function saveEdit() {
  if (!CU) return;
  var n  = (document.getElementById('e-name')  || {}).value;
  var un = (document.getElementById('e-uname') || {}).value;
  if (n  && n.trim())  CU.name     = n.trim();
  if (un && un.trim()) CU.username = un.trim();
  var u = S.users(); u[CU.id] = CU; S.saveU(u); S.saveCur(CU);
  updateUI(); closeModal('edit-modal'); showToast('✅ Profile updated!');
}

/* ═══════════════════════════════════════════
   SLIDER
═══════════════════════════════════════════ */
var DEF_GRADS = ['linear-gradient(135deg,#4c1d95,#7c3aed,#db2777)', 'linear-gradient(135deg,#1e1b4b,#7c3aed,#a855f7)', 'linear-gradient(135deg,#831843,#a21caf,#7c3aed)'];
var DEF_ICONS = ['🔥', '🎁', '⚡'];
var DEF_SUBS  = ['Up to 80% off!', 'Get 100 coins per referral', 'Start earning today'];
var DEF_SLIDES = [
  { id: 'ds1', image: '', url: '#', label: '🔥 AvenZo Best Deals — Shop &amp; Earn!', status: 'on' },
  { id: 'ds2', image: '', url: '#', label: '🎁 Refer Friends — Earn 100 Coins',       status: 'on' },
  { id: 'ds3', image: '', url: '#', label: '⚡ AvenZo — Earn While You Shop',          status: 'on' }
];

function loadSlider() {
  var active = S.sliders().filter(function(s) { return s.status === 'on'; });
  sliderSlides = active.length ? active : DEF_SLIDES;
  buildSlider();
}

function buildSlider() {
  var wrap  = document.getElementById('slider-wrap');
  var track = document.getElementById('slider-track');
  var dots  = document.getElementById('sl-dots');
  if (!wrap || !track || !dots || !sliderSlides.length) return;

  track.innerHTML = sliderSlides.map(function(s, i) {
    if (s.image && s.image.trim()) {
      return '<div class="slide" onclick="slideClick(\'' + _esc(s.url || '#') + '\')" tabindex="0">' +
        '<img class="slide-img" src="' + _esc(s.image) + '" alt="' + _esc(s.label || '') + '" loading="lazy" />' +
        '<div class="slide-overlay"></div>' +
        (s.label ? '<div class="slide-label">' + s.label + '</div>' : '') +
        '</div>';
    }
    return '<div class="slide" onclick="slideClick(\'' + _esc(s.url || '#') + '\')" tabindex="0">' +
      '<div class="slide-fallback" style="background:' + DEF_GRADS[i % 3] + '">' +
        '<div class="sf-ico">' + DEF_ICONS[i % 3] + '</div>' +
        '<div class="sf-text">' + (s.label || 'AvenZo Deals') + '</div>' +
        '<div class="sf-sub">' + DEF_SUBS[i % 3] + '</div>' +
      '</div></div>';
  }).join('');

  dots.innerHTML = sliderSlides.map(function(_, i) {
    return '<div class="sl-dot' + (i === 0 ? ' active' : '') + '" onclick="goSlide(' + i + ')"></div>';
  }).join('');

  // Touch events
  track.addEventListener('touchstart', function(e) {
    touchStartX = e.touches[0].clientX; isDragging = true;
    track.classList.add('dragging'); clearInterval(sliderTimer);
  }, { passive: true });
  track.addEventListener('touchmove', function(e) {
    if (!isDragging) return;
    touchDeltaX = e.touches[0].clientX - touchStartX;
    var base = -sliderIndex * 100;
    var drag = (touchDeltaX / wrap.offsetWidth) * 100;
    track.style.transform = 'translateX(' + (base + drag) + '%)';
  }, { passive: true });
  track.addEventListener('touchend', function() {
    isDragging = false; track.classList.remove('dragging');
    if (touchDeltaX < -50) sliderNext();
    else if (touchDeltaX > 50) sliderPrev();
    else goSlide(sliderIndex);
    touchDeltaX = 0; startSliderAuto();
  }, { passive: true });

  sliderIndex = 0; goSlide(0); startSliderAuto();
}

function goSlide(idx) {
  if (!sliderSlides.length) return;
  sliderIndex = (idx + sliderSlides.length) % sliderSlides.length;
  var track = document.getElementById('slider-track');
  if (track) track.style.transform = 'translateX(' + (-sliderIndex * 100) + '%)';
  document.querySelectorAll('.sl-dot').forEach(function(d, i) { d.classList.toggle('active', i === sliderIndex); });
}
function sliderNext() { goSlide(sliderIndex + 1); }
function sliderPrev() { goSlide(sliderIndex - 1); }
function startSliderAuto() {
  clearInterval(sliderTimer);
  if (sliderSlides.length > 1) sliderTimer = setInterval(function() { sliderNext(); }, 3500);
}
function slideClick(url) {
  if (url && url !== '#') { _currentBuyLink = url; _currentBuyName = 'Slider Deal'; _currentBuySection = 'Slider'; openModal('buy-instr-modal'); }
}

/* ═══════════════════════════════════════════
   COUNTDOWN TIMER
═══════════════════════════════════════════ */
function startCD() {
  if (cdTimer) clearInterval(cdTimer);
  var t = 4 * 3600 + 23 * 60;
  function upd() {
    var h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    setEl('cd-h', String(h).padStart(2, '0'));
    setEl('cd-m', String(m).padStart(2, '0'));
    setEl('cd-s', String(s).padStart(2, '0'));
    if (t <= 0) t = 24 * 3600; else t--;
  }
  upd(); cdTimer = setInterval(upd, 1000);
}

/* ═══════════════════════════════════════════
   MODAL
═══════════════════════════════════════════ */
function openModal(id)  { var el = document.getElementById(id); if (el) el.classList.add('open'); }
function closeModal(id) { var el = document.getElementById(id); if (el) el.classList.remove('open'); }

/* ═══════════════════════════════════════════
   PARTICLES & CURSOR
═══════════════════════════════════════════ */
function initParticles() {
  var c = document.getElementById('p-canvas'); if (!c) return;
  var ctx = c.getContext('2d');
  var W, H, pts;
  function resize() { W = c.width = window.innerWidth; H = c.height = window.innerHeight; }
  function make() {
    var n = Math.floor((W * H) / 14000);
    pts = [];
    for (var i = 0; i < n; i++) {
      pts.push({ x: Math.random()*W, y: Math.random()*H, r: Math.random()*1.6+.4, dx: (Math.random()-.5)*.35, dy: (Math.random()-.5)*.35, a: Math.random()*.5+.1, ph: Math.random()*Math.PI*2, ps: .02+Math.random()*.02 });
    }
  }
  function draw() {
    ctx.clearRect(0, 0, W, H);
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      p.ph += p.ps;
      var a = p.a * (.6 + .4 * Math.sin(p.ph));
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(168,85,247,' + a + ')'; ctx.fill();
      p.x += p.dx; p.y += p.dy;
      if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
    }
    for (var i = 0; i < pts.length; i++) {
      for (var j = i + 1; j < pts.length; j++) {
        var dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
        var d = Math.sqrt(dx*dx + dy*dy);
        if (d < 90) {
          ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y);
          ctx.strokeStyle = 'rgba(168,85,247,' + (.1*(1-d/90)) + ')'; ctx.lineWidth = .5; ctx.stroke();
        }
      }
    }
    requestAnimationFrame(draw);
  }
  resize(); make(); draw();
  window.addEventListener('resize', function() { resize(); make(); });
}

function initCursor() {
  var dot  = document.getElementById('cursor-dot');
  var ring = document.getElementById('cursor-ring');
  if (!dot || !ring) return;
  if (window.matchMedia('(pointer:coarse)').matches) { dot.style.display = 'none'; ring.style.display = 'none'; return; }
  var mx = 0, my = 0, rx = 0, ry = 0;
  document.addEventListener('mousemove', function(e) {
    mx = e.clientX; my = e.clientY;
    dot.style.left = mx + 'px'; dot.style.top = my + 'px';
    dot.style.opacity = '1'; ring.style.opacity = '1';
  });
  function animRing() { rx += (mx - rx) * .15; ry += (my - ry) * .15; ring.style.left = rx + 'px'; ring.style.top = ry + 'px'; requestAnimationFrame(animRing); }
  animRing();
}

/* ═══════════════════════════════════════════
   CONFETTI & TOAST
═══════════════════════════════════════════ */
function confettiBurst() {
  var colors = ['#a855f7','#c084fc','#ffd700','#ff4466','#00e89e','#7c3aed','#f9a8d4'];
  for (var i = 0; i < 60; i++) {
    var d = document.createElement('div');
    var cx = (Math.random()-.5)*400, cy = 200+Math.random()*300, cr = (360+Math.random()*360)+'deg';
    d.style.cssText = 'position:fixed;z-index:9999;pointer-events:none;width:' + (6+Math.random()*6) + 'px;height:' + (6+Math.random()*6) + 'px;background:' + colors[Math.floor(Math.random()*colors.length)] + ';border-radius:' + (Math.random()>.5?'50%':'2px') + ';left:' + (30+Math.random()*40) + '%;top:40%;animation:cfly ' + (1+Math.random()*1.5) + 's ease-out forwards';
    var style = document.createElement('style');
    style.textContent = '@keyframes cfly{0%{transform:translate(0,0) rotate(0deg);opacity:1}100%{transform:translate(' + cx + 'px,' + cy + 'px) rotate(' + cr + ');opacity:0}}';
    document.head.appendChild(style);
    document.body.appendChild(d);
    setTimeout(function() { if(d.parentNode) d.remove(); }, 3000);
  }
}

function showToast(msg) {
  var t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._t);
  t._t = setTimeout(function() { t.classList.remove('show'); }, 3200);
}

/* ═══════════════════════════════════════════
   ESCAPE HELPER (prevents XSS in innerHTML)
═══════════════════════════════════════════ */
function _esc(val) {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

/* ═══════════════════════════════════════════
   STORAGE SYNC (cross-tab)
═══════════════════════════════════════════ */
window.addEventListener('storage', function(e) {
  if (e.key === 'opg_admin_products') { loadProducts(); renderDeals('all'); }
  if (e.key === 'lk_sliders')   { loadSlider(); }
  if (e.key === 'lk_partners')  { loadPartners(); }
  if (e.key === 'opg_notifs')   { pollAdminNotifs(); }
});

/* ═══════════════════════════════════════════
   BOOT
═══════════════════════════════════════════ */
window.addEventListener('load', function() {
  initParticles();
  initCursor();
  var saved = null;
  try { saved = S.cur(); } catch(e) {}
  if (saved) { CU = saved; initApp(); }
  else { goS('s-auth'); showMethodsPanel(); }
});

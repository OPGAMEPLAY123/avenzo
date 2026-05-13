'use strict';

/* ═══════════ FIREBASE INIT ═══════════ */
const firebaseConfig = {
  apiKey: "AIzaSyD9zw80epBRQLMm3AnN8kKCBaEBlUqQqwI",
  authDomain: "avenzoofficialbyopg.firebaseapp.com",
  projectId: "avenzoofficialbyopg",
  storageBucket: "avenzoofficialbyopg.firebasestorage.app",
  messagingSenderId: "614977254220",
  appId: "1:614977254220:web:7f87296b9d2484fc6f55e9",
  measurementId: "G-GZ03S0DFQP"
};
let _fbApp, _auth, _db;
try {
  _fbApp = firebase.initializeApp(firebaseConfig);
  _auth  = firebase.auth();
  _db    = firebase.firestore();
} catch(e) { console.warn('Firebase init error:', e); }

/* ═══════════ EMAILJS CONFIG (REST API — no CDN library needed) ═══════════ */
const EMAILJS_SERVICE_ID  = 'service_3ik6d2e';
const EMAILJS_TEMPLATE_ID = 'template_0zaypmd';
const EMAILJS_PUBLIC_KEY  = 'OOqUXRQAgjYrKa_Jo';

// Send email via EmailJS REST API directly — no <script> CDN required
async function _ejsSend(toEmail, toName, otpCode){
  const payload = {
    service_id   : EMAILJS_SERVICE_ID,
    template_id  : EMAILJS_TEMPLATE_ID,
    user_id      : EMAILJS_PUBLIC_KEY,
    accessToken  : EMAILJS_PUBLIC_KEY,
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
  const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body   : JSON.stringify(payload)
  });
  if(!res.ok){
    const errText = await res.text();
    throw new Error('EmailJS API error ' + res.status + ': ' + errText);
  }
  return res;
}

/* ═══════════ GLOBAL STATE ═══════════ */
let CU = null;
let allProds = [], cdTimer = null;
let sliderIndex = 0, sliderTimer = null, sliderSlides = [];
let touchStartX = 0, touchDeltaX = 0, isDragging = false;
let _currentBuyLink = '', _currentBuyName = '', _currentProofData = null;
let _chatUnsubscribe = null;

/* ═══════════ SAFE STORAGE ═══════════ */
const _mem = {};
function _lsGet(k,d){try{const v=localStorage.getItem(k);return v!==null?v:d;}catch(e){return k in _mem?_mem[k]:d;}}
function _lsSet(k,v){try{localStorage.setItem(k,v);}catch(e){_mem[k]=v;}}
function _lsRemove(k){try{localStorage.removeItem(k);}catch(e){delete _mem[k];}}

const S = {
  users:    ()  => JSON.parse(_lsGet('lk_users','{}')),
  saveU:    (u) => _lsSet('lk_users',JSON.stringify(u)),
  cur:      ()  => JSON.parse(_lsGet('az_cur','null')),
  saveCur:  (u) => {_lsSet('az_cur',JSON.stringify(u));CU=u;},
  prods:    ()  => JSON.parse(_lsGet('opg_admin_products','[]')),
  partners: ()  => JSON.parse(_lsGet('lk_partners','[]')),
  sliders:  ()  => JSON.parse(_lsGet('lk_sliders','[]')),
  hist:     (id)=> JSON.parse(_lsGet('az_ch_'+id,'[]')),
  saveHist: (id,h) => _lsSet('az_ch_'+id,JSON.stringify(h)),
  notifs:   ()  => JSON.parse(_lsGet('opg_notifs','[]')),
  orders:   ()  => JSON.parse(_lsGet('az_orders','[]')),
  saveOrders:(o) => _lsSet('az_orders',JSON.stringify(o)),
  withdrawals: () => JSON.parse(_lsGet('az_withdrawals','[]')),
  saveWD:   (w) => _lsSet('az_withdrawals',JSON.stringify(w)),
};

/* ═══════════ AUTH PANEL NAVIGATION ═══════════ */
function showMethodsPanel(){
  document.getElementById('auth-methods-panel').style.display='block';
  document.getElementById('email-otp-panel').style.display='none';
  document.getElementById('captcha-panel').style.display='none';
}
function showEmailOTPPanel(){
  document.getElementById('auth-methods-panel').style.display='none';
  document.getElementById('email-otp-panel').style.display='block';
  document.getElementById('captcha-panel').style.display='none';
  resetEmailOTP();
}
function showCaptchaPanel(){
  document.getElementById('auth-methods-panel').style.display='none';
  document.getElementById('email-otp-panel').style.display='none';
  document.getElementById('captcha-panel').style.display='block';
  showCapSignup();
}
function showCapSignup(){
  document.getElementById('cap-signup').style.display='block';
  document.getElementById('cap-login').style.display='none';
}
function showCapLogin(){
  document.getElementById('cap-signup').style.display='none';
  document.getElementById('cap-login').style.display='block';
}

/* ═══════════ GOOGLE LOGIN ═══════════ */
async function loginWithGoogle(){
  _showMainErr('');
  if(!_auth){_showMainErr('⚠️ Firebase not available');return;}
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    const result = await _auth.signInWithPopup(provider);
    const u = result.user;
    const users = S.users();
    let existingUser = Object.values(users).find(x=>x.email===u.email);
    if(!existingUser){
      const id='u_'+Date.now();
      const code='AVNZ'+Math.floor(Math.random()*100000);
      existingUser={id,name:u.displayName||'AvenZo User',username:u.displayName?.split(' ')[0]?.toLowerCase()||'user',email:u.email,phone:'',coins:50,referralCode:code,joinDate:new Date().toLocaleDateString(),avatar:u.photoURL||'👤'};
      users[id]=existingUser;
      S.saveU(users);
    }
    S.saveCur(existingUser);
    _showSuccessAndGo('Welcome! 🎉','Logged in with Google');
  } catch(e){
    _showMainErr('⚠️ Google login failed: '+e.message);
  }
}
function _showMainErr(msg){
  const el=document.getElementById('auth-main-error');
  if(!el)return;
  if(msg){el.textContent=msg;el.className='otp-error-box show';}
  else el.className='otp-error-box';
}

/* ═══════════ EMAIL OTP LOGIN ═══════════ */
let _eotpCode='', _eotpEmail='', _eotpName='', _eotpResendTimer=null;

async function sendEmailOTP(isResend=false){
  _showErr('eotp-error1','');
  const email = (document.getElementById('eotp-email')||{}).value?.trim().toLowerCase()||'';
  const name  = (document.getElementById('eotp-name')||{}).value?.trim()||'AvenZo User';

  if(!email || !/\S+@\S+\.\S+/.test(email)){
    _showErr('eotp-error1','Enter a valid email address');
    return;
  }

  _eotpEmail = email;
  _eotpName  = name;
  _eotpCode  = String(Math.floor(100000 + Math.random() * 900000));

  const btn = document.getElementById('eotp-send-btn');
  const txt = document.getElementById('eotp-send-text');
  if(btn) btn.disabled = true;
  if(txt) txt.innerHTML = '<div class="btn-spin"></div> Sending...';

  console.log('EmailJS REST | Sending to:', email, '| OTP:', _eotpCode);

  try{
    await _ejsSend(email, name, _eotpCode);
    console.log('EmailJS REST | Success');

    document.getElementById('email-step1').style.display = 'none';
    document.getElementById('email-step2').style.display = 'block';
    document.querySelectorAll('#eotp-boxes .otp-box').forEach(function(b){
      b.value = ''; b.classList.remove('filled','shake');
    });
    _showErr('eotp-error2','');
    _startEotpResend(60);
    showToast('OTP sent! Check your email inbox.');

  }catch(err){
    console.error('EmailJS REST | Error:', err);
    let msg = 'Failed to send OTP. ';
    if(err && err.message) msg += err.message;
    else if(typeof err === 'string') msg += err;
    else msg += 'Please try again.';
    _showErr('eotp-error1', msg);
  }finally{
    if(btn) btn.disabled = false;
    if(txt) txt.textContent = 'Send OTP';
  }
}
function _startEotpResend(s){
  clearInterval(_eotpResendTimer);
  const btn=document.getElementById('eotp-resend-btn');
  const timerEl=document.getElementById('eotp-resend-timer');
  if(btn)btn.disabled=true;
  let rem=s;
  if(timerEl)timerEl.innerHTML='Resend in <b id="eotp-countdown">'+s+'</b>s';
  _eotpResendTimer=setInterval(()=>{
    rem--;
    const cd=document.getElementById('eotp-countdown');
    if(cd)cd.textContent=rem;
    if(rem<=0){clearInterval(_eotpResendTimer);if(timerEl)timerEl.textContent='Code expired.';if(btn)btn.disabled=false;}
  },1000);
}
function verifyEmailOTP(){
  _showErr('eotp-error2','');
  const boxes=document.querySelectorAll('#eotp-boxes .otp-box');
  const entered=Array.from(boxes).map(b=>b.value).join('');
  if(entered.length!==6){_showErr('eotp-error2','⚠️ Enter all 6 digits');_shakeBoxes('#eotp-boxes .otp-box');return;}
  const btn=document.getElementById('eotp-verify-btn');
  const txt=document.getElementById('eotp-verify-text');
  if(btn)btn.disabled=true;
  if(txt)txt.innerHTML='<div class="btn-spin"></div> Verifying...';
  setTimeout(()=>{
    if(entered===_eotpCode){
      clearInterval(_eotpResendTimer);
      const users=S.users();
      let user=Object.values(users).find(u=>u.email===_eotpEmail);
      if(!user){
        const id='u_'+Date.now();
        const code='AVNZ'+Math.floor(Math.random()*100000);
        user={id,name:_eotpName||_eotpEmail.split('@')[0],username:_eotpEmail.split('@')[0],email:_eotpEmail,phone:'',coins:50,referralCode:code,joinDate:new Date().toLocaleDateString(),avatar:'👤'};
        users[id]=user;
        S.saveU(users);
      }
      S.saveCur(user);
      _showSuccessAndGo('Verified! 🎉','Welcome to AvenZo ⚡');
    } else {
      if(btn)btn.disabled=false;
      if(txt)txt.textContent='✅ Verify OTP';
      _showErr('eotp-error2','❌ Wrong OTP. Try again.');
      _shakeBoxes('#eotp-boxes .otp-box');
      boxes.forEach(b=>{b.value='';b.classList.remove('filled');});
      if(boxes[0])boxes[0].focus();
    }
  },500);
}
function resetEmailOTP(){
  clearInterval(_eotpResendTimer);
  document.getElementById('email-step1').style.display='block';
  document.getElementById('email-step2').style.display='none';
  _showErr('eotp-error1','');_showErr('eotp-error2','');
  const btn=document.getElementById('eotp-send-btn');
  if(btn)btn.disabled=false;
  const txt=document.getElementById('eotp-send-text');
  if(txt)txt.textContent='📨 Send OTP';
}
function eotpNav(input,boxNum){
  const boxes=document.querySelectorAll('#eotp-boxes .otp-box');
  _otpNav(input,boxNum,boxes,verifyEmailOTP);
}
function eotpBack(input,boxNum,e){
  const boxes=document.querySelectorAll('#eotp-boxes .otp-box');
  _otpBack(input,boxNum,boxes,e);
}

/* ═══════════ CAPTCHA SIGNUP ═══════════ */
const _cs={code:'',timers:[],resendTimer:null};
const _cl={code:'',timers:[],resendTimer:null,user:null};

function startCapSignup(){
  _showErr('cap-signup-error','');
  const uname=(document.getElementById('r-uname')||{}).value?.trim()||'';
  const email=(document.getElementById('r-email')||{}).value?.trim().toLowerCase()||'';
  const pass=(document.getElementById('r-pass')||{}).value?.trim()||'';
  if(!uname){_showErr('cap-signup-error','⚠️ Choose a username');return;}
  if(!email||!/\S+@\S+\.\S+/.test(email)){_showErr('cap-signup-error','⚠️ Enter a valid email');return;}
  if(!pass||pass.length<6){_showErr('cap-signup-error','⚠️ Password must be at least 6 characters');return;}
  const users=S.users();
  if(Object.values(users).find(u=>u.email===email)){_showErr('cap-signup-error','⚠️ Email already registered — use Login');return;}
  _cs._pending={uname,email,pass};
  document.getElementById('cap-signup-step1').style.display='none';
  const s2=document.getElementById('cap-signup-step2');
  s2.style.display='block';
  document.querySelectorAll('#cap-su-boxes .otp-box').forEach(b=>{b.value='';b.classList.remove('filled','shake');});
  _cs.code=_genCode();
  _runReveal('cap-su',_cs,()=>_startResend('cap-su',_cs,10));
}
function capSuNav(input,boxNum){const boxes=document.querySelectorAll('#cap-su-boxes .otp-box');_otpNav(input,boxNum,boxes,verifyCapSignup);}
function capSuBack(input,boxNum,e){const boxes=document.querySelectorAll('#cap-su-boxes .otp-box');_otpBack(input,boxNum,boxes,e);}
function verifyCapSignup(){
  _showErr('cap-signup-otp-error','');
  const boxes=document.querySelectorAll('#cap-su-boxes .otp-box');
  const entered=Array.from(boxes).map(b=>b.value).join('');
  if(entered.length!==6){_showErr('cap-signup-otp-error','⚠️ Enter all 6 digits');_shakeBoxes('#cap-su-boxes .otp-box');return;}
  const btn=document.getElementById('cap-su-verify-btn');
  const txt=document.getElementById('cap-su-verify-text');
  if(btn)btn.disabled=true;
  if(txt)txt.innerHTML='<div class="btn-spin"></div> Verifying...';
  setTimeout(()=>{
    if(entered===_cs.code){
      const{uname,email,pass}=_cs._pending||{};
      const users=S.users();
      const id='u_'+Date.now();
      const code='AVNZ'+uname.toUpperCase().slice(0,3)+Math.floor(Math.random()*10000);
      const newUser={id,name:uname,username:uname,email,phone:'',password:pass,coins:50,referralCode:code,joinDate:new Date().toLocaleDateString(),avatar:'👤'};
      users[id]=newUser;S.saveU(users);S.saveCur(newUser);
      _cs.timers.forEach(t=>clearTimeout(t));clearInterval(_cs.resendTimer);
      _showSuccessAndGo('Account Created! 🎉','Welcome to AvenZo ⚡');
    } else {
      if(btn)btn.disabled=false;
      if(txt)txt.innerHTML='✅ Verify &amp; Create Account';
      _showErr('cap-signup-otp-error','❌ Wrong code. Try again.');
      _shakeBoxes('#cap-su-boxes .otp-box');
      boxes.forEach(b=>{b.value='';b.classList.remove('filled');});
      if(boxes[0])boxes[0].focus();
    }
  },500);
}
function resendCapSu(){_cs.timers.forEach(t=>clearTimeout(t));_cs.code=_genCode();document.querySelectorAll('#cap-su-boxes .otp-box').forEach(b=>{b.value='';b.classList.remove('filled','shake');});document.getElementById('cap-su-entry').style.display='none';_showErr('cap-signup-otp-error','');const btn=document.getElementById('cap-su-verify-btn');if(btn)btn.disabled=false;_runReveal('cap-su',_cs,()=>_startResend('cap-su',_cs,10));}
function resetCapSignup(){_cs.timers.forEach(t=>clearTimeout(t));clearInterval(_cs.resendTimer);document.getElementById('cap-signup-step1').style.display='block';document.getElementById('cap-signup-step2').style.display='none';document.getElementById('cap-su-entry').style.display='none';_showErr('cap-signup-error','');_showErr('cap-signup-otp-error','');}

/* ═══════════ CAPTCHA LOGIN ═══════════ */
function startCapLogin(){
  _showErr('cap-login-error','');
  const email=(document.getElementById('cap-login-email')||{}).value?.trim().toLowerCase()||'';
  if(!email||!/\S+@\S+\.\S+/.test(email)){_showErr('cap-login-error','⚠️ Enter a valid email');return;}
  const users=S.users();
  const user=Object.values(users).find(u=>u.email===email);
  if(!user){_showErr('cap-login-error','❌ No account found. Create one first.');return;}
  _cl.user=user;
  document.getElementById('cap-login-step1').style.display='none';
  const s2=document.getElementById('cap-login-step2');
  s2.style.display='block';
  document.querySelectorAll('#cap-ln-boxes .otp-box').forEach(b=>{b.value='';b.classList.remove('filled','shake');});
  _cl.code=_genCode();
  _runReveal('cap-ln',_cl,()=>_startResend('cap-ln',_cl,10));
}
function capLnNav(input,boxNum){const boxes=document.querySelectorAll('#cap-ln-boxes .otp-box');_otpNav(input,boxNum,boxes,verifyCapLogin);}
function capLnBack(input,boxNum,e){const boxes=document.querySelectorAll('#cap-ln-boxes .otp-box');_otpBack(input,boxNum,boxes,e);}
function verifyCapLogin(){
  _showErr('cap-login-otp-error','');
  const boxes=document.querySelectorAll('#cap-ln-boxes .otp-box');
  const entered=Array.from(boxes).map(b=>b.value).join('');
  if(entered.length!==6){_showErr('cap-login-otp-error','⚠️ Enter all 6 digits');_shakeBoxes('#cap-ln-boxes .otp-box');return;}
  const btn=document.getElementById('cap-ln-verify-btn');
  const txt=document.getElementById('cap-ln-verify-text');
  if(btn)btn.disabled=true;
  if(txt)txt.innerHTML='<div class="btn-spin"></div> Verifying...';
  setTimeout(()=>{
    if(entered===_cl.code){
      const user=_cl.user;
      if(user){S.saveCur(user);_cl.timers.forEach(t=>clearTimeout(t));clearInterval(_cl.resendTimer);_showSuccessAndGo('Welcome Back! 👋',user.name||'User');}
    } else {
      if(btn)btn.disabled=false;
      if(txt)txt.innerHTML='✅ Verify &amp; Login';
      _showErr('cap-login-otp-error','❌ Wrong code. Try again.');
      _shakeBoxes('#cap-ln-boxes .otp-box');
      boxes.forEach(b=>{b.value='';b.classList.remove('filled');});
      if(boxes[0])boxes[0].focus();
    }
  },500);
}
function resendCapLn(){_cl.timers.forEach(t=>clearTimeout(t));_cl.code=_genCode();document.querySelectorAll('#cap-ln-boxes .otp-box').forEach(b=>{b.value='';b.classList.remove('filled','shake');});document.getElementById('cap-ln-entry').style.display='none';_showErr('cap-login-otp-error','');const btn=document.getElementById('cap-ln-verify-btn');if(btn)btn.disabled=false;_runReveal('cap-ln',_cl,()=>_startResend('cap-ln',_cl,10));}
function resetCapLogin(){_cl.timers.forEach(t=>clearTimeout(t));clearInterval(_cl.resendTimer);document.getElementById('cap-login-step1').style.display='block';document.getElementById('cap-login-step2').style.display='none';document.getElementById('cap-ln-entry').style.display='none';_showErr('cap-login-error','');_showErr('cap-login-otp-error','');}

/* ═══════════ DIGIT REVEAL CORE ═══════════ */
function _genCode(){return String(Math.floor(100000+Math.random()*900000));}
function _runReveal(prefix,flowObj,onDone){
  const dispEl=document.getElementById(prefix+'-digit');
  const posEl=document.getElementById(prefix+'-pos');
  const fillEl=document.getElementById(prefix+'-fill');
  const entryEl=document.getElementById(prefix+'-entry');
  flowObj.timers.forEach(t=>clearTimeout(t));flowObj.timers=[];
  if(dispEl){dispEl.textContent='';dispEl.className='digit-display';}
  if(posEl)posEl.textContent='';
  if(fillEl)fillEl.style.width='0%';
  if(entryEl)entryEl.style.display='none';
  const digits=flowObj.code.split('');
  digits.forEach((digit,idx)=>{
    const SHOW_AT=idx*1400;
    const tShow=setTimeout(()=>{
      if(!dispEl)return;
      dispEl.classList.remove('pop');
      if(idx>0){dispEl.classList.add('out');setTimeout(()=>{dispEl.classList.remove('out');_showDigit(dispEl,posEl,fillEl,digit,idx,digits.length);},200);}
      else _showDigit(dispEl,posEl,fillEl,digit,idx,digits.length);
    },SHOW_AT);
    flowObj.timers.push(tShow);
  });
  const tDone=setTimeout(()=>{
    if(dispEl){dispEl.classList.add('out');setTimeout(()=>{dispEl.textContent='';dispEl.className='digit-display';},230);}
    if(posEl)posEl.textContent='';
    if(fillEl)fillEl.style.width='100%';
    setTimeout(()=>{
      if(entryEl){entryEl.style.display='block';entryEl.style.animation='formIn .4s ease both';}
      const firstBox=entryEl&&entryEl.querySelector('.otp-box');
      if(firstBox)firstBox.focus();
      if(onDone)onDone();
    },350);
  },digits.length*1400+200);
  flowObj.timers.push(tDone);
}
function _showDigit(dispEl,posEl,fillEl,digit,idx,total){
  dispEl.textContent=digit;void dispEl.offsetWidth;dispEl.classList.add('pop');
  if(posEl)posEl.textContent=`Digit ${idx+1} of ${total}`;
  if(fillEl)fillEl.style.width=`${((idx+1)/total)*100}%`;
}
function _startResend(prefix,flowObj,seconds){
  clearInterval(flowObj.resendTimer);
  const countId=prefix+'-cd';
  const timerId=prefix+'-timer';
  const btnId=prefix+'-resend';
  const countEl=document.getElementById(countId);
  const timerEl=document.getElementById(timerId);
  const resendEl=document.getElementById(btnId);
  if(resendEl)resendEl.disabled=true;
  if(timerEl)timerEl.innerHTML=`Resend in <b id="${countId}">${seconds}</b>s`;
  let rem=seconds;
  flowObj.resendTimer=setInterval(()=>{
    rem--;
    const cd=document.getElementById(countId);
    if(cd)cd.textContent=rem;
    if(rem<=0){clearInterval(flowObj.resendTimer);if(timerEl)timerEl.textContent='Code expired.';if(resendEl)resendEl.disabled=false;}
  },1000);
}

/* ═══════════ OTP NAV HELPERS ═══════════ */
function _otpNav(input,boxNum,boxes,autoFn){
  const val=input.value;
  if(val.length>1){const digits=val.replace(/\D/g,'').slice(0,6);boxes.forEach((b,i)=>{b.value=digits[i]||'';b.classList.toggle('filled',!!digits[i]);});if(digits.length===6)setTimeout(autoFn,300);return;}
  if(/\d/.test(val)){input.classList.add('filled');if(boxNum<6)boxes[boxNum].focus();else{input.blur();const all=Array.from(boxes).map(b=>b.value).join('');if(all.length===6)setTimeout(autoFn,350);}}
  else{input.value='';input.classList.remove('filled');}
}
function _otpBack(input,boxNum,boxes,e){
  if(e.key==='Backspace'&&!input.value&&boxNum>1){boxes[boxNum-2].value='';boxes[boxNum-2].classList.remove('filled');boxes[boxNum-2].focus();}
  if(e.key==='ArrowLeft'&&boxNum>1)boxes[boxNum-2].focus();
  if(e.key==='ArrowRight'&&boxNum<6)boxes[boxNum].focus();
}
function _shakeBoxes(selector){document.querySelectorAll(selector).forEach(b=>{b.classList.remove('shake');void b.offsetWidth;b.classList.add('shake');b.addEventListener('animationend',()=>b.classList.remove('shake'),{once:true});});}
function _showErr(id,msg,type=''){const el=document.getElementById(id);if(!el)return;if(msg){el.textContent=msg;el.className='otp-error-box show'+(type==='success'?' success-msg':'');}else el.className='otp-error-box';}
function togglePw(inputId,btn){const inp=document.getElementById(inputId);if(!inp)return;if(inp.type==='password'){inp.type='text';btn.textContent='🙈';}else{inp.type='password';btn.textContent='👁';}}

/* ═══════════ SUCCESS OVERLAY ═══════════ */
function _showSuccessAndGo(title,sub){
  const ov=document.createElement('div');
  ov.className='verify-success-overlay';
  ov.innerHTML=`<div class="vso-circle">✓</div><div class="vso-text">${title}</div><div class="vso-sub">${sub}</div>`;
  document.body.appendChild(ov);
  confettiBurst();
  setTimeout(()=>{if(ov.parentNode)ov.remove();initApp();},1600);
}

/* ═══════════ APP INIT ═══════════ */
function initApp(){
  CU=S.cur();
  goS('s-app');
  updateUI();
  loadSlider();
  loadProducts();
  loadPartners();
  gotoSec('home');
  startCD();
  renderNotifsList();
  initChat();
  setInterval(()=>{if(CU){loadSlider();loadProducts();loadPartners();pollAdminNotifs();}},5000);
}

/* ═══════════ SCREEN NAV ═══════════ */
function goS(id){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));const el=document.getElementById(id);if(el)el.classList.add('active');}
function gotoSec(name,tabEl){
  document.querySelectorAll('.sec').forEach(s=>s.classList.remove('active'));
  const sec=document.getElementById('sec-'+name);if(sec)sec.classList.add('active');
  document.querySelectorAll('.bni').forEach(b=>b.classList.remove('active'));
  const nb=document.getElementById('bn-'+name);if(nb)nb.classList.add('active');
  if(name==='rewards'){renderRwdPage();renderLeaderboard();}
  if(name==='deals')renderDeals();
  if(name==='partners')renderPartnersPage();
  if(name==='orders')renderOrders();
  if(name==='wallet')renderWdHist();
  if(name==='notifications')renderNotifsList();
  if(name==='chat')scrollChatBottom();
}
function navCk(name,el){
  document.querySelectorAll('.bni').forEach(b=>b.classList.remove('active'));
  el.classList.add('active');
  gotoSec(name);
}

/* ═══════════ UI UPDATE ═══════════ */
function updateUI(){
  if(!CU)return;
  const c=CU.coins||0;
  const moneyStr=(c/100).toFixed(2);
  ['qs-c','rwd-coins','wallet-c','prof-coins'].forEach(id=>{const el=document.getElementById(id);if(el)animNum(el,parseInt(el.textContent)||0,c);});
  setEl('wallet-money',moneyStr);
  setEl('prof-n',CU.name||'User');
  setEl('prof-ph',CU.phone||'');
  setEl('prof-em',CU.email||'');
  setEl('prof-un',CU.username?'@'+CU.username:'');
  ['ref-code','prof-ref'].forEach(id=>setEl(id,CU.referralCode||'AVNZ01'));
  const today=new Date().toDateString();
  const cl=_lsGet('az_d_'+CU.id)===today;
  setEl('qs-d',cl?'✅':'Claim');
  ['daily-btn','daily-btn2'].forEach(id=>{const b=document.getElementById(id);if(b)b.textContent=cl?'✅ Claimed!':'Claim 10 🪙';});
}
function setEl(id,v){const el=document.getElementById(id);if(el)el.textContent=v;}
function animNum(el,from,to){if(from===to){el.textContent=to;return;}const step=(to-from)/20;let cur=from;const t=setInterval(()=>{cur+=step;if((step>0&&cur>=to)||(step<0&&cur<=to)){el.textContent=Math.round(to);clearInterval(t);}else el.textContent=Math.round(cur);},30);}
function addCoins(amt,lbl){
  CU.coins=(CU.coins||0)+amt;
  const u=S.users();u[CU.id]=CU;S.saveU(u);S.saveCur(CU);
  const h=S.hist(CU.id);
  h.unshift({lbl,amt,date:new Date().toLocaleString()});
  S.saveHist(CU.id,h.slice(0,50));
  updateUI();showToast('🪙 +'+amt+' coins! '+lbl);
}

/* ═══════════ LOGOUT ═══════════ */
function doLogout(){
  if(_chatUnsubscribe)_chatUnsubscribe();
  if(_auth)try{_auth.signOut();}catch(e){}
  _lsRemove('az_cur');CU=null;goS('s-auth');showMethodsPanel();
}

/* ═══════════ PRODUCTS ═══════════ */
const DEF=[
  {id:'d1',name:'Galaxy Smartwatch',image:'⌚',price:999,discount:60,category:'electronics',link:'#',status:'on'},
  {id:'d2',name:'Wireless Earbuds',image:'🎧',price:799,discount:55,category:'electronics',link:'#',status:'on'},
  {id:'d3',name:'RGB Gaming Mouse',image:'🖱️',price:199,discount:75,category:'electronics',link:'#',status:'on'},
  {id:'d4',name:'JBL Speaker',image:'🔊',price:899,discount:45,category:'electronics',link:'#',status:'on'},
  {id:'d5',name:'Smart LED Strip',image:'💡',price:499,discount:50,category:'home',link:'#',status:'on'},
  {id:'d6',name:'Running Shoes',image:'👟',price:1299,discount:40,category:'sports',link:'#',status:'on'},
];
function loadProducts(){
  const adminProds=S.prods().filter(p=>p.status==='on');
  if(adminProds.length>0){const seen=new Set();allProds=adminProds.filter(p=>{if(seen.has(p.id))return false;seen.add(p.id);return true;}).map(p=>({id:p.id,name:p.name,image:p.image||'🛍️',price:Number(p.price),discount:Number(p.discount)||0,category:p.category||'electronics',link:p.link||'#',status:'on',clicks:p.clicks||0}));}
  else allProds=[...DEF];
  setEl('qs-dn',allProds.length);
  renderHomeProds();
}
function pcHTML(p,i=0){
  const sl=(p.link||'#').replace(/'/g,"\\'");
  const sn=(p.name||'').replace(/'/g,"\\'");
  return `<div class="p-card" style="animation-delay:${i*.06}s" onclick="buyProd('${sl}','${sn}',${p.price||0})"><div class="p-img">${p.image||'🛍️'}<span class="disc-badge">${p.discount}% OFF</span></div><div class="p-info"><div class="p-name">${p.name}</div><div class="p-rat">⭐ 4.5</div><div class="p-row"><span class="p-price">₹${p.price.toLocaleString()}</span><button class="buy-btn" onclick="event.stopPropagation();buyProd('${sl}','${sn}',${p.price||0})">Buy Now</button></div></div></div>`;
}
function renderHomeProds(){const el=document.getElementById('home-prods');if(!el)return;el.innerHTML=allProds.length?allProds.slice(0,6).map((p,i)=>pcHTML(p,i)).join(''):'<div style="grid-column:1/-1;text-align:center;padding:40px 20px;color:var(--sub)"><div style="font-size:48px;margin-bottom:12px">🛍️</div><div>No products available</div></div>';}
function renderDeals(cat='all'){const el=document.getElementById('deals-prods');if(!el)return;const l=cat==='all'?allProds:allProds.filter(p=>p.category===cat);el.innerHTML=l.length?l.map((p,i)=>pcHTML(p,i)).join(''):'<p style="text-align:center;color:var(--sub);grid-column:1/-1;padding:28px">No products found</p>';}
function filterD(btn,cat){document.querySelectorAll('.ft').forEach(t=>t.classList.remove('active'));btn.classList.add('active');renderDeals(cat);}
function searchProds(q){const el=document.getElementById('home-prods');if(!el)return;if(!q){renderHomeProds();return;}const r=allProds.filter(p=>p.name.toLowerCase().includes(q.toLowerCase()));el.innerHTML=r.length?r.map((p,i)=>pcHTML(p,i)).join(''):'<p style="color:var(--sub);grid-column:1/-1;text-align:center;padding:20px">No results</p>';}

/* ═══════════ BUY FLOW ═══════════ */
function buyProd(link,name,price){
  const prods=S.prods();
  const idx=prods.findIndex(p=>p.link===link&&link!=='#');
  if(idx>-1){prods[idx].clicks=(prods[idx].clicks||0)+1;_lsSet('opg_admin_products',JSON.stringify(prods));}
  _currentBuyLink=link||'#';
  _currentBuyName=name||'Product';
  showBuyInstructions();
}
function showBuyInstructions(){document.getElementById('buy-instr-modal').classList.add('open');}
function openBuyLink(){
  closeModal('buy-instr-modal');
  if(_currentBuyLink&&_currentBuyLink!=='#')window.open(_currentBuyLink,'_blank');
  if(CU)addCoins(2,'Partner Link Click 🛍️');
  setTimeout(()=>document.getElementById('order-proof-modal').classList.add('open'),800);
}

/* ═══════════ ORDER PROOF ═══════════ */
function handleProofFile(input){
  const file=input.files[0];if(!file)return;
  const area=document.getElementById('proof-upload-area');
  const txt=document.getElementById('proof-upload-text');
  const reader=new FileReader();
  reader.onload=(e)=>{
    _currentProofData=e.target.result;
    area.classList.add('has-file');
    if(txt)txt.innerHTML=`<div style="font-size:28px;margin-bottom:6px">✅</div><div style="font-size:13px;font-weight:700;color:var(--green)">Screenshot uploaded!</div><div style="font-size:11px;color:var(--sub)">${file.name}</div>`;
  };
  reader.readAsDataURL(file);
}
function submitOrderProof(){
  _showErr('proof-error','');
  const upi=(document.getElementById('proof-upi')||{}).value?.trim()||'';
  if(!upi){_showErr('proof-error','⚠️ Enter your UPI ID');return;}
  if(!_currentProofData){_showErr('proof-error','⚠️ Please upload a screenshot');return;}
  if(!CU){_showErr('proof-error','⚠️ Not logged in');return;}
  const orders=S.orders();
  const order={id:'ord_'+Date.now(),userId:CU.id,userName:CU.name||CU.username,productName:_currentBuyName,productLink:_currentBuyLink,screenshotData:_currentProofData.substring(0,100)+'...',upiId:upi,status:'proof_submitted',date:new Date().toLocaleString()};
  orders.unshift(order);S.saveOrders(orders);
  addCoins(5,'Order Proof Submitted 📦');
  closeModal('order-proof-modal');
  _currentProofData=null;
  const area=document.getElementById('proof-upload-area');
  if(area)area.classList.remove('has-file');
  const txt=document.getElementById('proof-upload-text');
  if(txt)txt.innerHTML='<div style="font-size:36px;margin-bottom:8px">📸</div><div style="font-size:13px;font-weight:700;color:var(--wh);margin-bottom:4px">Tap to Upload Screenshot</div><div style="font-size:11px;color:var(--sub)">Order confirmation or cart screenshot</div>';
  const upiEl=document.getElementById('proof-upi');if(upiEl)upiEl.value='';
  const fEl=document.getElementById('proof-file-input');if(fEl)fEl.value='';
  showToast('✅ Order proof submitted! Admin will verify soon.');
}
function renderOrders(){
  const el=document.getElementById('orders-list');if(!el||!CU)return;
  const all=S.orders().filter(o=>o.userId===CU.id);
  if(!all.length){el.innerHTML='<div class="empty-b"><div>📦</div><p>No orders yet. Buy something!</p></div>';return;}
  el.innerHTML=all.map(o=>`<div class="order-card"><div class="oc-top"><div class="oc-name">${o.productName}</div><span class="oc-status ${o.status}">${o.status==='proof_submitted'?'📤 Submitted':'✅ Approved'}</span></div><div class="oc-date">📅 ${o.date}</div><div class="oc-upi">🏦 UPI: ${o.upiId}</div></div>`).join('');
}

/* ═══════════ PARTNERS ═══════════ */
const DEF_PARTNERS=[
  {id:'dp1',name:'Amazon',image:'📦',description:"World's largest online store",link:'https://amazon.in',status:'on'},
  {id:'dp2',name:'Flipkart',image:'🏬',description:"India's biggest marketplace",link:'https://flipkart.com',status:'on'},
  {id:'dp3',name:'Ajio',image:'👗',description:'Fashion & lifestyle deals',link:'https://ajio.com',status:'on'},
  {id:'dp4',name:'Myntra',image:'👠',description:'Top fashion brands',link:'https://myntra.com',status:'on'},
];
function loadPartners(){const adminP=S.partners().filter(p=>p.status==='on');renderHomePartners([...DEF_PARTNERS,...adminP]);}
function renderHomePartners(partners){const el=document.getElementById('home-partners');if(!el)return;el.innerHTML=(partners||[]).map((p,i)=>`<div class="ps-item" style="animation-delay:${i*.08}s" onclick="buyProd('${p.link}','${p.name}',0)"><div class="ps-img">${p.image}</div><div class="ps-name">${p.name}</div><div class="ps-link">Shop Now</div></div>`).join('');}
function renderPartnersPage(){const el=document.getElementById('partners-grid');if(!el)return;const adminP=S.partners().filter(p=>p.status==='on');const all=[...DEF_PARTNERS,...adminP];el.innerHTML=all.map((p,i)=>`<div class="pg-item" style="animation-delay:${i*.08}s"><div class="pgi-top">${p.image}</div><div class="pgi-info"><div class="pgi-name">${p.name}</div><div class="pgi-desc">${p.description||'Exclusive deals'}</div><button class="pgi-btn" onclick="buyProd('${p.link}','${p.name}',0)">Shop Now →</button></div></div>`).join('');}

/* ═══════════ DAILY CLAIM ═══════════ */
function claimDaily(){
  if(!CU)return;
  const today=new Date().toDateString();
  const key='az_d_'+CU.id;
  if(_lsGet(key,null)===today){showToast('✅ Already claimed today! Come back tomorrow 🌙');return;}
  _lsSet(key,today);addCoins(10,'Daily Login Reward 🎁');
  ['daily-btn','daily-btn2'].forEach(id=>{const b=document.getElementById(id);if(b){b.textContent='✅ Claimed!';b.style.background='rgba(0,230,160,.3)';}});
  setEl('qs-d','✅');
}

/* ═══════════ REWARDS ═══════════ */
function renderRwdPage(){const el=document.getElementById('coins-hist');if(!el||!CU)return;const h=S.hist(CU.id);el.innerHTML=h.length?h.slice(0,12).map(x=>`<div class="ch-item"><div class="chi-ico">🪙</div><div class="chi-info"><h4>${x.lbl}</h4><p>${x.date}</p></div><div class="chi-amt">+${x.amt}</div></div>`).join(''):'<div class="empty-b"><div>🪙</div><p>No coin history yet</p></div>';}
function renderLeaderboard(){
  const el=document.getElementById('leaderboard-list');if(!el)return;
  const users=Object.values(S.users()).sort((a,b)=>(b.coins||0)-(a.coins||0)).slice(0,100);
  if(!users.length){el.innerHTML='<div class="empty-b"><div>🏆</div><p>No users yet</p></div>';return;}
  el.innerHTML=users.map((u,i)=>{
    const rank=i+1;
    const rankClass=rank===1?'gold':rank===2?'silver':rank===3?'bronze':'';
    const rankEmoji=rank===1?'🥇':rank===2?'🥈':rank===3?'🥉':rank;
    const isMe=CU&&u.id===CU.id;
    return `<div class="lb-row${isMe?' me':''}"><span class="lb-rank ${rankClass}">${rankEmoji}</span><span class="lb-avatar">👤</span><span class="lb-name">${u.name||u.username||'User'}${isMe?' (You)':''}</span><span class="lb-coins">🪙 ${u.coins||0}</span></div>`;
  }).join('');
}

/* ═══════════ WALLET / WITHDRAW ═══════════ */
function submitWithdraw(){
  _showErr('wd-error','');
  if(!CU)return;
  const upi=(document.getElementById('wd-upi')||{}).value?.trim()||'';
  const msg=(document.getElementById('wd-msg')||{}).value?.trim()||'';
  const coinsInput=parseInt((document.getElementById('wd-coins-input')||{}).value||0);
  if(!upi){_showErr('wd-error','⚠️ Enter your UPI ID');return;}
  if(!coinsInput||coinsInput<1000){_showErr('wd-error','⚠️ Minimum 1000 coins required');return;}
  if(coinsInput%(1000)!==0){_showErr('wd-error','⚠️ Enter coins in multiples of 1000');return;}
  if((CU.coins||0)<coinsInput){_showErr('wd-error','⚠️ Insufficient coins');return;}
  const amount=(coinsInput/100).toFixed(2);
  CU.coins=(CU.coins||0)-coinsInput;
  const u=S.users();u[CU.id]=CU;S.saveU(u);S.saveCur(CU);
  const wds=S.withdrawals();
  wds.unshift({id:'wd_'+Date.now(),userId:CU.id,userName:CU.name||CU.username,coins:coinsInput,amount:'₹'+amount,upiId:upi,message:msg,status:'pending',date:new Date().toLocaleString()});
  S.saveWD(wds);
  updateUI();
  const upiEl=document.getElementById('wd-upi');if(upiEl)upiEl.value='';
  const msgEl=document.getElementById('wd-msg');if(msgEl)msgEl.value='';
  const cinEl=document.getElementById('wd-coins-input');if(cinEl)cinEl.value='';
  renderWdHist();
  showToast('💸 Withdrawal request submitted! Admin will process soon.');
}
function renderWdHist(){
  const el=document.getElementById('wd-hist-list');if(!el||!CU)return;
  const all=S.withdrawals().filter(w=>w.userId===CU.id);
  if(!all.length){el.innerHTML='<div class="empty-b"><div>💸</div><p>No withdrawals yet</p></div>';return;}
  el.innerHTML=all.map(w=>`<div class="wd-hist-item"><div class="whi-ico">💸</div><div class="whi-info"><h5>${w.coins}🪙 → ${w.amount}</h5><p>UPI: ${w.upiId} • ${w.date}</p></div><span class="whi-status ${w.status}">${w.status==='pending'?'⏳ Pending':'✅ Approved'}</span></div>`).join('');
}

/* ═══════════ NOTIFICATIONS ═══════════ */
function renderNotifsList(){
  const el=document.getElementById('notifs-list');if(!el)return;
  const notifs=S.notifs();if(!notifs.length){el.innerHTML='';return;}
  el.innerHTML=notifs.slice(0,10).map(n=>`<div class="ni"><div class="ni-i" style="background:rgba(168,85,247,.2)">🔔</div><div class="ni-t"><h4>${n.title}</h4><p>${n.message}</p><span class="nt">${n.date}</span></div></div>`).join('');
  const cnt=document.getElementById('notif-cnt');if(cnt)cnt.textContent=notifs.length;
  const badge=document.getElementById('prof-notif-badge');if(badge)badge.textContent=notifs.length;
}
function pollAdminNotifs(){const notifs=S.notifs();const lastSeen=parseInt(_lsGet('az_last_notif','0'));const fresh=notifs.filter(n=>parseInt(n.id.replace('n_',''))>lastSeen);if(fresh.length){_lsSet('az_last_notif',fresh[0].id.replace('n_',''));renderNotifsList();}}

/* ═══════════ CHAT (FIRESTORE) ═══════════ */
function initChat(){
  if(!CU||!_db)return;
  const chatRef=_db.collection('chats').doc(CU.id).collection('messages').orderBy('timestamp','asc');
  if(_chatUnsubscribe)_chatUnsubscribe();
  _chatUnsubscribe=chatRef.onSnapshot(snapshot=>{
    const el=document.getElementById('chat-msgs');if(!el)return;
    el.innerHTML='<div class="chat-bubble cb-admin">👋 Welcome to AvenZo Support! How can we help you?<span class="cb-time">AvenZo Team</span></div>';
    snapshot.forEach(doc=>{
      const d=doc.data();
      const bubble=document.createElement('div');
      bubble.className='chat-bubble '+(d.sender==='user'?'cb-user':'cb-admin');
      const time=d.timestamp?.toDate?new Date(d.timestamp.toDate()).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'';
      bubble.innerHTML=d.text+`<span class="cb-time">${d.sender==='user'?(CU.name||'You'):('AvenZo Support')}${time?' • '+time:''}</span>`;
      el.appendChild(bubble);
    });
    scrollChatBottom();
  });
}
async function sendChatMsg(){
  const input=document.getElementById('chat-input');
  const text=input?.value?.trim();
  if(!text||!CU)return;
  input.value='';
  if(!_db){
    // Fallback: localStorage chat
    const msgs=JSON.parse(_lsGet('az_chat_'+CU.id,'[]'));
    msgs.push({text,sender:'user',timestamp:Date.now()});
    _lsSet('az_chat_'+CU.id,JSON.stringify(msgs));
    renderLocalChat();
    return;
  }
  try {
    await _db.collection('chats').doc(CU.id).collection('messages').add({text,sender:'user',timestamp:firebase.firestore.FieldValue.serverTimestamp(),userId:CU.id,userName:CU.name||CU.username});
  } catch(e){
    showToast('⚠️ Message failed: '+e.message);
  }
}
function renderLocalChat(){
  const el=document.getElementById('chat-msgs');if(!el||!CU)return;
  const msgs=JSON.parse(_lsGet('az_chat_'+CU.id,'[]'));
  el.innerHTML='<div class="chat-bubble cb-admin">👋 Welcome to AvenZo Support! How can we help you?<span class="cb-time">AvenZo Team</span></div>';
  msgs.forEach(m=>{
    const bubble=document.createElement('div');
    bubble.className='chat-bubble '+(m.sender==='user'?'cb-user':'cb-admin');
    bubble.innerHTML=m.text+`<span class="cb-time">${m.sender==='user'?(CU.name||'You'):'AvenZo Support'}</span>`;
    el.appendChild(bubble);
  });
  scrollChatBottom();
}
function scrollChatBottom(){const el=document.getElementById('chat-msgs');if(el)setTimeout(()=>el.scrollTop=el.scrollHeight,100);}

/* ═══════════ REFERRAL ═══════════ */
function copyCode(){const c=CU?.referralCode||'AVNZ01';navigator.clipboard.writeText(c).catch(()=>{});showToast('📋 Copied: '+c);}

/* ═══════════ PROFILE ═══════════ */
function openEditModal(){
  const dn=document.getElementById('e-name'),dun=document.getElementById('e-uname');
  if(dn)dn.value=CU?.name||'';if(dun)dun.value=CU?.username||'';
  document.getElementById('edit-modal').classList.add('open');
}
function saveEdit(){
  if(!CU)return;
  const n=(document.getElementById('e-name')||{}).value?.trim();
  const un=(document.getElementById('e-uname')||{}).value?.trim();
  if(n)CU.name=n;if(un)CU.username=un;
  const u=S.users();u[CU.id]=CU;S.saveU(u);S.saveCur(CU);
  updateUI();closeModal('edit-modal');showToast('✅ Profile updated!');
}

/* ═══════════ SLIDER ═══════════ */
const DEF_SLIDES=[
  {id:'ds1',image:'',url:'#',label:'🔥 AvenZo Best Deals — Shop & Earn!',status:'on'},
  {id:'ds2',image:'',url:'#',label:'🎁 Refer Friends — Earn 100 Coins',status:'on'},
  {id:'ds3',image:'',url:'#',label:'⚡ AvenZo — Earn While You Shop',status:'on'},
];
const DEF_GRADS=['linear-gradient(135deg,#4c1d95,#7c3aed,#db2777)','linear-gradient(135deg,#1e1b4b,#7c3aed,#a855f7)','linear-gradient(135deg,#831843,#a21caf,#7c3aed)'];
const DEF_ICONS=['🔥','🎁','⚡'];
const DEF_SUBS=['Up to 80% off!','Get 100 coins per referral','Start earning today'];
function loadSlider(){const active=S.sliders().filter(s=>s.status==='on');sliderSlides=active.length?active:DEF_SLIDES;buildSlider();}
function buildSlider(){
  const wrap=document.getElementById('slider-wrap');const track=document.getElementById('slider-track');const dots=document.getElementById('sl-dots');
  if(!wrap||!track||!dots)return;
  if(!sliderSlides.length){return;}
  track.innerHTML=sliderSlides.map((s,i)=>{
    if(s.image&&s.image.trim())return `<div class="slide" onclick="slideClick('${s.url||'#'}')"><img class="slide-img" src="${s.image}" alt="${s.label||''}" onerror="this.parentElement.innerHTML='<div class=slide-fallback style=background:${DEF_GRADS[i%3]}><div class=sf-ico>${DEF_ICONS[i%3]}</div><div class=sf-text>${s.label||''}</div></div>'"/><div class="slide-overlay"></div>${s.label?`<div class="slide-label">${s.label}</div>`:''}</div>`;
    return `<div class="slide" onclick="slideClick('${s.url||'#'}')"><div class="slide-fallback" style="background:${DEF_GRADS[i%3]}"><div class="sf-ico">${DEF_ICONS[i%3]}</div><div class="sf-text">${s.label||'AvenZo Deals'}</div><div class="sf-sub">${DEF_SUBS[i%3]}</div></div></div>`;
  }).join('');
  dots.innerHTML=sliderSlides.map((_,i)=>`<div class="sl-dot ${i===0?'active':''}" onclick="goSlide(${i})"></div>`).join('');
  track.addEventListener('touchstart',e=>{touchStartX=e.touches[0].clientX;isDragging=true;track.classList.add('dragging');clearInterval(sliderTimer);},{passive:true});
  track.addEventListener('touchmove',e=>{if(!isDragging)return;touchDeltaX=e.touches[0].clientX-touchStartX;const base=-sliderIndex*100;const drag=(touchDeltaX/wrap.offsetWidth)*100;track.style.transform=`translateX(${base+drag}%)`;},{passive:true});
  track.addEventListener('touchend',()=>{isDragging=false;track.classList.remove('dragging');if(touchDeltaX<-50)sliderNext();else if(touchDeltaX>50)sliderPrev();else goSlide(sliderIndex);touchDeltaX=0;startSliderAuto();},{passive:true});
  sliderIndex=0;goSlide(0);startSliderAuto();
}
function goSlide(idx){if(!sliderSlides.length)return;sliderIndex=(idx+sliderSlides.length)%sliderSlides.length;const track=document.getElementById('slider-track');if(track)track.style.transform=`translateX(${-sliderIndex*100}%)`;document.querySelectorAll('.sl-dot').forEach((d,i)=>d.classList.toggle('active',i===sliderIndex));}
function sliderNext(){goSlide(sliderIndex+1);}function sliderPrev(){goSlide(sliderIndex-1);}
function startSliderAuto(){clearInterval(sliderTimer);if(sliderSlides.length>1)sliderTimer=setInterval(()=>sliderNext(),3500);}
function slideClick(url){if(url&&url!=='#'){_currentBuyLink=url;_currentBuyName='Slider Deal';showBuyInstructions();}}

/* ═══════════ COUNTDOWN ═══════════ */
function startCD(){if(cdTimer)clearInterval(cdTimer);let t=4*3600+23*60;const upd=()=>{const h=Math.floor(t/3600),m=Math.floor((t%3600)/60),s=t%60;updCD('cd-h',h.toString().padStart(2,'0'));updCD('cd-m',m.toString().padStart(2,'0'));updCD('cd-s',s.toString().padStart(2,'0'));if(t<=0)t=24*3600;else t--;};upd();cdTimer=setInterval(upd,1000);}
function updCD(id,v){const el=document.getElementById(id);if(!el)return;if(el.textContent!==v){el.textContent=v;}}

/* ═══════════ PARTICLES ═══════════ */
function initParticles(){
  const c=document.getElementById('p-canvas');if(!c)return;
  const ctx=c.getContext('2d');let W,H,pts;
  const resize=()=>{W=c.width=window.innerWidth;H=c.height=window.innerHeight;};
  const make=()=>{const n=Math.floor((W*H)/14000);pts=Array.from({length:n},()=>({x:Math.random()*W,y:Math.random()*H,r:Math.random()*1.6+.4,dx:(Math.random()-.5)*.35,dy:(Math.random()-.5)*.35,a:Math.random()*.5+.1,ph:Math.random()*Math.PI*2,ps:.02+Math.random()*.02}));};
  const draw=()=>{ctx.clearRect(0,0,W,H);pts.forEach(p=>{p.ph+=p.ps;const a=p.a*(.6+.4*Math.sin(p.ph));ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fillStyle=`rgba(168,85,247,${a})`;ctx.fill();p.x+=p.dx;p.y+=p.dy;if(p.x<0)p.x=W;if(p.x>W)p.x=0;if(p.y<0)p.y=H;if(p.y>H)p.y=0;});for(let i=0;i<pts.length;i++)for(let j=i+1;j<pts.length;j++){const dx=pts[i].x-pts[j].x,dy=pts[i].y-pts[j].y,d=Math.sqrt(dx*dx+dy*dy);if(d<90){ctx.beginPath();ctx.moveTo(pts[i].x,pts[i].y);ctx.lineTo(pts[j].x,pts[j].y);ctx.strokeStyle=`rgba(168,85,247,${.1*(1-d/90)})`;ctx.lineWidth=.5;ctx.stroke();}}requestAnimationFrame(draw);};
  resize();make();draw();window.addEventListener('resize',()=>{resize();make();});
}
function initCursor(){
  const dot=document.getElementById('cursor-dot');const ring=document.getElementById('cursor-ring');if(!dot||!ring)return;
  if(window.matchMedia('(pointer:coarse)').matches){dot.style.display='none';ring.style.display='none';return;}
  let mx=0,my=0,rx=0,ry=0;
  document.addEventListener('mousemove',e=>{mx=e.clientX;my=e.clientY;dot.style.left=mx+'px';dot.style.top=my+'px';dot.style.opacity='1';ring.style.opacity='1';});
  function animRing(){rx+=(mx-rx)*.15;ry+=(my-ry)*.15;ring.style.left=rx+'px';ring.style.top=ry+'px';requestAnimationFrame(animRing);}animRing();
}

/* ═══════════ MODAL ═══════════ */
function closeModal(id){document.getElementById(id).classList.remove('open');}

/* ═══════════ CONFETTI ═══════════ */
function confettiBurst(){const colors=['#a855f7','#c084fc','#ffd700','#ff4466','#00e89e','#7c3aed','#f9a8d4'];for(let i=0;i<60;i++){const d=document.createElement('div');const cx=(Math.random()-.5)*400,cy=200+Math.random()*300,cr=(360+Math.random()*360)+'deg';d.style.cssText=`position:fixed;z-index:9999;pointer-events:none;width:${6+Math.random()*6}px;height:${6+Math.random()*6}px;background:${colors[Math.floor(Math.random()*colors.length)]};border-radius:${Math.random()>.5?'50%':'2px'};left:${30+Math.random()*40}%;top:40%;--cx:${cx}px;--cy:${cy}px;--cr:${cr};animation:cfly ${1+Math.random()*1.5}s ease-out forwards`;document.body.appendChild(d);setTimeout(()=>d.remove(),3000);}}

/* ═══════════ TOAST ═══════════ */
function showToast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),3000);}

/* ═══════════ STORAGE SYNC ═══════════ */
window.addEventListener('storage',(e)=>{
  if(e.key==='opg_admin_products'){loadProducts();renderDeals();}
  if(e.key==='lk_sliders')loadSlider();
  if(e.key==='lk_partners')loadPartners();
  if(e.key==='opg_notifs')pollAdminNotifs();
});

/* ═══════════ BOOT ═══════════ */
window.addEventListener('load',function(){
  // No EmailJS CDN init needed — we use the REST API directly
  initParticles(); initCursor();
  var saved = null;
  try{ saved = S.cur(); }catch(e){}
  if(saved){ CU = saved; initApp(); }
  else{ goS('s-auth'); showMethodsPanel(); }
});
catch(e){
    /* Refund coins if DB write fails */
    CU.coins+=coins;try{await db.collection('users').doc(CU.id).update({coins:CU.coins});}catch{}
    updateUI();showErr('wd-err','❌ Failed. Coins refunded.');
  }
  btn.disabled=false;txt.innerHTML='💸 Submit Coins';
}

function loadWithdrawHistory(){
  if(!CU)return;
  const el=document.getElementById('wd-history');if(!el)return;
  db.collection('withdrawals').where('userId','==',CU.id).orderBy('createdAt','desc').limit(20).get()
    .then(snap=>{
      if(snap.empty){el.innerHTML='<div class="empty-b"><div>💸</div><p>No withdrawals yet</p></div>';return;}
      el.innerHTML=snap.docs.map(d=>{
        const w=d.data();const stCls='ws-'+(w.status||'pending');
        return`<div class="wd-item"><div class="mri" style="background:rgba(255,160,0,.15);font-size:20px;border-radius:10px;width:40px;height:40px;display:flex;align-items:center;justify-content:center;flex-shrink:0">💸</div><div class="wdi-info"><h4>🪙 ${w.coins} coins → ₹${w.amount}</h4><p>${w.upiId}</p></div><div class="wdi-right"><div class="wdi-coins">₹${w.amount}</div><div class="wdi-status ${stCls}">${w.status}</div><div style="font-size:9px;color:var(--sub);margin-top:2px">${w.date}</div></div></div>`;
      }).join('');
    }).catch(()=>{el.innerHTML='<div class="empty-b"><div>💸</div><p>No withdrawals yet</p></div>';});
}

/* ══════════════════════════════════════════════════════
   NOTIFICATIONS
══════════════════════════════════════════════════════ */
function loadNotifications(){
  if(!CU)return;
  const el=document.getElementById('notif-list');if(!el)return;

  if(notifsUnsub)notifsUnsub();
  notifsUnsub=db.collection('notifications').where('userId','==',CU.id).orderBy('createdAt','desc').limit(30)
    .onSnapshot(snap=>{
      const unread=snap.docs.filter(d=>!d.data().read).length;
      const badge=document.getElementById('notif-cnt');
      if(badge){badge.textContent=unread;badge.style.display=unread>0?'flex':'none';}
      const pb=document.getElementById('prof-notif-badge');
      if(pb){pb.textContent=unread;pb.style.display=unread>0?'inline':'none';}

      if(!el)return;
      if(snap.empty){el.innerHTML='<div class="empty-b"><div>🔔</div><p>No notifications yet</p></div>';return;}
      el.innerHTML=snap.docs.map(d=>{
        const n=d.data();const unreadCls=!n.read?'unread':'';
        const ico={reward:'🪙',withdrawal:'💸',order:'📦',referral:'👥'}[n.type]||'🔔';
        const bg={reward:'rgba(16,185,129,.15)',withdrawal:'rgba(255,160,0,.15)',order:'rgba(96,165,250,.15)',referral:'rgba(168,85,247,.15)'}[n.type]||'rgba(168,85,247,.15)';
        return`<div class="ni ${unreadCls}" onclick="markNotifRead('${d.id}')"><div class="ni-i" style="background:${bg}">${ico}</div><div class="ni-t"><h4>${n.title}</h4><p>${n.message}</p><span class="nt">${n.date}</span></div></div>`;
      }).join('');
    });
}

async function markNotifRead(id){
  try{await db.collection('notifications').doc(id).update({read:true});}catch{}
}

/* ══════════════════════════════════════════════════════
   CHAT / HELP & SUPPORT
══════════════════════════════════════════════════════ */
function openChat(){
  if(!CU)return;
  const messagesEl=document.getElementById('chat-messages');
  if(!messagesEl)return;

  if(chatUnsub)chatUnsub();
  chatUnsub=db.collection('chats').where('userId','==',CU.id).orderBy('createdAt','asc').limit(100)
    .onSnapshot(snap=>{
      if(!messagesEl)return;
      if(snap.empty){
        messagesEl.innerHTML=`<div style="text-align:center;padding:20px;color:var(--sub)"><div style="font-size:36px;margin-bottom:8px">💬</div><p style="font-size:12px">Chat with our support team. We reply within 24 hours!</p></div>`;
        return;
      }
      messagesEl.innerHTML=snap.docs.map(d=>{
        const m=d.data();const isUser=m.sender==='user';
        return`<div class="chat-msg ${isUser?'user-msg':'admin-msg'}">
          <div class="chat-bubble">${m.message}</div>
          <div class="chat-time">${m.senderName||''}  ${m.time||''}</div>
        </div>`;
      }).join('');
      messagesEl.scrollTop=messagesEl.scrollHeight;
    });
}

async function sendChatMessage(){
  if(!CU)return;
  const input=document.getElementById('chat-input');
  const msg=input?.value?.trim()||'';
  if(!msg)return;
  input.value='';
  try{
    await db.collection('chats').add({
      userId:CU.id,userName:CU.name||'User',userEmail:CU.email||'',
      message:msg,sender:'user',senderName:CU.name||'User',
      time:new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}),
      read:false,createdAt:firebase.firestore.FieldValue.serverTimestamp()
    });
  }catch(e){showToast('❌ Failed to send message');input.value=msg;}
}

/* ══════════════════════════════════════════════════════
   PROFILE EDIT
══════════════════════════════════════════════════════ */
function openEditModal(){
  const en=document.getElementById('e-name');if(en)en.value=CU?.name||'';
  document.getElementById('edit-modal').classList.add('open');
}
async function saveEdit(){
  if(!CU)return;
  const n=(document.getElementById('e-name')||{}).value?.trim();
  if(n)CU.name=n;
  try{await db.collection('users').doc(CU.id).update({name:CU.name});}catch{}
  updateUI();closePanel('edit-modal');showToast('✅ Profile updated!');
}

/* ══════════════════════════════════════════════════════
   LOGOUT
══════════════════════════════════════════════════════ */
async function doLogout(){
  clearInterval(sliderTimer);if(chatUnsub)chatUnsub();if(notifsUnsub)notifsUnsub();
  try{await auth.signOut();}catch{}
  CU=null;fireUser=null;ls.del('avenzo_uid');
  goScreen('s-auth');backToChooser();
  showToast('👋 Logged out from AvenZo');
}

/* ══════════════════════════════════════════════════════
   UTILS
══════════════════════════════════════════════════════ */
function showErr(id,msg){const el=document.getElementById(id);if(!el)return;el.textContent=msg;el.className='err-box'+(msg?' show':'');}
function showToast(msg){const t=document.getElementById('toast');if(!t)return;t.textContent=msg;t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),3000);}
function togglePw(id,btn){const inp=document.getElementById(id);if(!inp)return;inp.type=inp.type==='password'?'text':'password';btn.textContent=inp.type==='password'?'👁':'🙈';}

function confettiBurst(){
  const colors=['#a855f7','#c084fc','#ffd700','#ff4466','#00e89e','#7c3aed'];
  for(let i=0;i<50;i++){
    const d=document.createElement('div');
    const cx=(Math.random()-.5)*400,cy=200+Math.random()*300,cr=(360+Math.random()*360)+'deg';
    d.style.cssText=`position:fixed;z-index:9999;pointer-events:none;width:${6+Math.random()*6}px;height:${6+Math.random()*6}px;background:${colors[Math.floor(Math.random()*colors.length)]};border-radius:${Math.random()>.5?'50%':'2px'};left:${30+Math.random()*40}%;top:40%;--cx:${cx}px;--cy:${cy}px;--cr:${cr};animation:cfly ${1+Math.random()*1.5}s ease-out forwards`;
    document.body.appendChild(d);setTimeout(()=>d.remove(),3000);
  }
}

/* ══════════════════════════════════════════════════════
   FIREBASE AUTH LISTENER
══════════════════════════════════════════════════════ */
auth.onAuthStateChanged(async user=>{
  if(user){
    fireUser=user;
    /* Try to get Firestore user */
    try{
      const snap=await db.collection('users').doc(user.uid).get();
      if(snap.exists){CU={...snap.data(),id:user.uid};initApp();}
      else{await ensureFirestoreUser(user);}
    }catch{initApp();}
  }
});

/* ══════════════════════════════════════════════════════
   BOOT
══════════════════════════════════════════════════════ */
window.addEventListener('load',()=>{
  initParticles();
  initCursor();

  /* Handle Google redirect result FIRST (page reload after signInWithRedirect) */
  handleGoogleRedirect();

  /* Check local fallback user */
  const localUser=ls.get('avenzo_local_user',null);
  if(localUser&&!fireUser){
    try{CU=JSON.parse(localUser);if(CU&&CU.id){initApp();return;}}catch{}
  }

  /* Auth state handled by onAuthStateChanged above */
  /* Fallback: if no auth in 2.5s, stay on login */
  setTimeout(()=>{
    if(!CU)goScreen('s-auth');
  },2500);
});
��════════════
   LOGOUT
══════════════════════════════════════════════════════ */
async function doLogout() {
  clearInterval(sliderTimer);
  if (chatUnsub)   chatUnsub();
  if (notifsUnsub) notifsUnsub();
  try { await auth.signOut(); } catch {}
  CU = null; fireUser = null;
  ls.del('avnz_uid'); ls.del('avnz_local');
  goScreen('s-auth'); backToChooser();
  showToast('👋 Logged out from AvenZo');
}

/* ══════════════════════════════════════════════════════
   UTILS
══════════════════════════════════════════════════════ */
function showErr(id, msg) { const el = document.getElementById(id); if (!el) return; el.textContent = msg; el.className = 'err-box' + (msg ? ' show' : ''); }
function showToast(msg) { const t = document.getElementById('toast'); if (!t) return; t.textContent = msg; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 3000); }
function togglePw(id, btn) { const inp = document.getElementById(id); if (!inp) return; inp.type = inp.type === 'password' ? 'text' : 'password'; btn.textContent = inp.type === 'password' ? '👁' : '🙈'; }

/* ══════════════════════════════════════════════════════
   FIREBASE AUTH STATE LISTENER
══════════════════════════════════════════════════════ */
auth.onAuthStateChanged(async user => {
  if (user && !CU) {
    fireUser = user;
    try {
      const snap = await db.collection('users').doc(user.uid).get();
      if (snap.exists) { CU = { ...snap.data(), id: user.uid }; initApp(); }
      else await ensureFirestoreUser(user);
    } catch { console.warn('Firestore read failed, proceeding offline'); }
  }
});

/* ══════════════════════════════════════════════════════
   BOOT
══════════════════════════════════════════════════════ */
window.addEventListener('load', async () => {
  initParticles();
  initCursor();

  /* 1. Handle Google redirect result (MUST be first) */
  await handleGoogleRedirect();

  /* 2. Check local fallback user (CAPTCHA offline mode) */
  if (!CU) {
    const local = ls.get('avnz_local', null);
    if (local) {
      try { CU = JSON.parse(local); if (CU?.id) { initApp(); return; } } catch {}
    }
  }

  /* 3. Auth state change handles Firebase session restore */
  /* 4. Timeout fallback to login screen */
  setTimeout(() => { if (!CU) goScreen('s-auth'); }, 2500);
});

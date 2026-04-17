'use strict';

const socket = io();

const state = {
  authenticated: false,
  slides: [],
  currentSlide: 0,
  results: { byQuestion: {}, profiles: {} },
  participantCount: 0,
};

// DOM shortcuts
const $ = id => document.getElementById(id);

const loginScreen    = $('admin-login');
const dashboard      = $('admin-dashboard');
const adminPwd       = $('admin-pwd');
const loginBtn       = $('admin-login-btn');
const adminError     = $('admin-error');
const connDot        = $('conn-dot');
const slideBadge     = $('slide-badge');
const partBadge      = $('part-badge');
const spType         = $('sp-type');
const spTitle        = $('sp-title');
const spIdx          = $('sp-idx');
const btnPrev        = $('btn-prev');
const btnNext        = $('btn-next');
const slideThumbs    = $('slide-thumbs');
const qrImg          = $('qr-img');
const qrUrl          = $('qr-url');
const statParticipants = $('stat-participants');
const statSlide      = $('stat-slide');
const resultsGrid    = $('results-grid');
const profileDist    = $('profile-dist');
const btnReset       = $('btn-reset');

const COLORS = { A: '#4f46e5', B: '#7c3aed', C: '#0891b2', D: '#059669' };
const PROFILE_NAMES = {
  A: '👣 Guida',
  B: '🤝 Amico',
  C: '🛡️ Protettivo',
  D: '🌿 Permissivo',
};

// ── Login ─────────────────────────────────────────────────────────────────────
function doLogin() {
  const pwd = adminPwd.value.trim();
  if (!pwd) return;
  loginBtn.disabled = true;
  loginBtn.textContent = 'Accesso…';

  socket.emit('admin-auth', pwd, (res) => {
    if (res?.success) {
      state.authenticated = true;
      loginScreen.style.display = 'none';
      dashboard.classList.add('visible');
      loadQRCode();
      buildResultsUI();
      updateDashboard();
    } else {
      adminError.textContent = 'Password errata.';
      loginBtn.disabled = false;
      loginBtn.textContent = 'Accedi';
    }
  });
}

loginBtn.addEventListener('click', doLogin);
adminPwd.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

// ── Version ───────────────────────────────────────────────────────────────────
fetch('/api/version').then(r => r.json()).then(d => {
  const el = document.getElementById('version-badge');
  if (el) el.textContent = 'v ' + d.version;
}).catch(() => {});

// ── QR Code ───────────────────────────────────────────────────────────────────
async function loadQRCode() {
  try {
    const res = await fetch('/api/qrcode');
    const data = await res.json();
    qrImg.src = data.qr;
    qrImg.style.display = 'block';
    qrUrl.textContent = data.url;
    qrUrl.innerHTML = `<a href="${escHtml(data.url)}" target="_blank" style="color:#818cf8">${escHtml(data.url)}</a>`;
  } catch {
    qrUrl.textContent = 'Errore caricamento QR';
  }
}

// ── Build results UI (once slides are loaded) ─────────────────────────────────
function buildResultsUI() {
  const surveySlides = state.slides.filter(s => s.type === 'survey');
  resultsGrid.innerHTML = surveySlides.map(slide => `
    <div class="q-result-card" id="qcard-${slide.number}">
      <h3>Domanda ${slide.number}</h3>
      <p class="q-text">${escHtml(slide.question_genitore)} / ${escHtml(slide.question_animatore)}</p>
      <div class="bar-chart" id="barchart-${slide.number}">
        ${buildBars(slide.number)}
      </div>
    </div>`).join('');

  buildProfileDist();
  buildSlideThumbs();
}

function buildBars(qNum) {
  const counts = state.results.byQuestion[qNum] || { A: 0, B: 0, C: 0, D: 0 };
  const max = Math.max(...Object.values(counts), 1);
  return Object.entries(counts).map(([letter, count]) => `
    <div class="bar-row">
      <div class="bar-letter" style="background:${COLORS[letter]}">${letter}</div>
      <div class="bar-track">
        <div class="bar-fill" id="bar-${qNum}-${letter}"
          style="width:${Math.round(count / max * 100)}%;background:${COLORS[letter]}"></div>
      </div>
      <div class="bar-count" id="cnt-${qNum}-${letter}">${count}</div>
    </div>`).join('');
}

function buildProfileDist() {
  const { profiles } = state.results;
  const total = Math.max(Object.values(profiles).reduce((a, b) => a + b, 0), 1);
  profileDist.innerHTML = Object.entries(PROFILE_NAMES).map(([letter, name]) => {
    const cnt = profiles[letter] || 0;
    const pct = Math.round(cnt / total * 100);
    return `
      <div class="profile-dist-row">
        <span class="profile-dist-label">${escHtml(name)}</span>
        <div class="profile-dist-track">
          <div class="profile-dist-fill" id="pdist-${letter}"
            style="width:${pct}%;background:${COLORS[letter]}"></div>
        </div>
        <span class="profile-dist-count" id="pdcnt-${letter}">${cnt}</span>
      </div>`;
  }).join('');
}

function buildSlideThumbs() {
  slideThumbs.innerHTML = state.slides.map((s, i) => {
    const label = s.type === 'survey' ? `Q${s.number}` : (s.type === 'results' ? '🎉' : '📄');
    return `<button class="slide-thumb${i === state.currentSlide ? ' active' : ''}"
      data-idx="${i}" title="${escHtml(s.title || s.question_genitore || '')}">${label}</button>`;
  }).join('');
  slideThumbs.querySelectorAll('.slide-thumb').forEach(btn => {
    btn.addEventListener('click', () => socket.emit('goto-slide', parseInt(btn.dataset.idx, 10)));
  });
}

// ── Update results (after results-update event) ───────────────────────────────
function updateResultsUI() {
  const surveySlides = state.slides.filter(s => s.type === 'survey');
  for (const slide of surveySlides) {
    const counts = state.results.byQuestion[slide.number] || { A: 0, B: 0, C: 0, D: 0 };
    const max = Math.max(...Object.values(counts), 1);
    for (const letter of ['A', 'B', 'C', 'D']) {
      const bar = $(`bar-${slide.number}-${letter}`);
      const cnt = $(`cnt-${slide.number}-${letter}`);
      if (bar) bar.style.width = `${Math.round((counts[letter] || 0) / max * 100)}%`;
      if (cnt) cnt.textContent = counts[letter] || 0;
    }
  }

  const { profiles } = state.results;
  const total = Math.max(Object.values(profiles).reduce((a, b) => a + b, 0), 1);
  for (const letter of ['A', 'B', 'C', 'D']) {
    const cnt = profiles[letter] || 0;
    const pct = Math.round(cnt / total * 100);
    const fill = $(`pdist-${letter}`);
    const cntEl = $(`pdcnt-${letter}`);
    if (fill) fill.style.width = `${pct}%`;
    if (cntEl) cntEl.textContent = cnt;
  }
}

// ── Update slide display ──────────────────────────────────────────────────────
function updateDashboard() {
  if (!state.slides.length) return;
  const slide = state.slides[state.currentSlide];
  const total = state.slides.length;

  slideBadge.textContent = `Slide ${state.currentSlide + 1} / ${total}`;
  partBadge.textContent = `${state.participantCount} partecipant${state.participantCount === 1 ? 'e' : 'i'}`;
  statParticipants.textContent = state.participantCount;

  if (slide) {
    const typeLabels = { text: '📄 Testo', survey: `📊 Domanda ${slide.number}`, results: '🎉 Risultati' };
    spType.textContent = typeLabels[slide.type] || slide.type;
    spTitle.textContent = slide.type === 'survey' ? slide.question_genitore : (slide.title || '');
    spIdx.textContent = `Slide ${state.currentSlide + 1} di ${total}`;
    statSlide.textContent = typeLabels[slide.type] || '—';
  }

  btnPrev.disabled = state.currentSlide === 0;
  btnNext.disabled = state.currentSlide === state.slides.length - 1;

  // Update thumb highlights
  slideThumbs.querySelectorAll('.slide-thumb').forEach((btn, i) => {
    btn.classList.toggle('active', i === state.currentSlide);
  });
}

// ── Navigation ────────────────────────────────────────────────────────────────
btnNext.addEventListener('click', () => socket.emit('next-slide'));
btnPrev.addEventListener('click', () => socket.emit('prev-slide'));

document.addEventListener('keydown', e => {
  if (!state.authenticated) return;
  if (e.target.tagName === 'INPUT') return;
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') socket.emit('next-slide');
  if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   socket.emit('prev-slide');
});

// ── Reset ─────────────────────────────────────────────────────────────────────
btnReset.addEventListener('click', async () => {
  if (!confirm('Sei sicuro di voler azzerare tutte le risposte e ricominciare dall\'inizio?')) return;
  const pwd = adminPwd.value || prompt('Inserisci la password admin per confermare:') || '';
  const res = await fetch('/api/admin/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: pwd }),
  });
  const data = await res.json();
  if (!data.success) alert('Reset fallito: password errata?');
});

// ── Socket events ─────────────────────────────────────────────────────────────
socket.on('connect', () => {
  connDot.classList.add('connected');
  if (state.authenticated) {
    socket.emit('admin-auth', adminPwd.value, () => {});
  }
});

socket.on('disconnect', () => connDot.classList.remove('connected'));

socket.on('state', (data) => {
  state.slides = data.slides;
  state.currentSlide = data.slide;
  state.results = data.results;
  state.participantCount = data.participantCount;
  if (state.authenticated) {
    buildResultsUI();
    updateDashboard();
    updateResultsUI();
  }
});

socket.on('slide-change', (index) => {
  state.currentSlide = index;
  updateDashboard();
});

socket.on('results-update', (data) => {
  state.results = data.results;
  state.participantCount = data.participantCount;
  partBadge.textContent = `${data.participantCount} partecipant${data.participantCount === 1 ? 'e' : 'i'}`;
  statParticipants.textContent = data.participantCount;
  updateResultsUI();
});

socket.on('participant-count', (count) => {
  state.participantCount = count;
  partBadge.textContent = `${count} partecipant${count === 1 ? 'e' : 'i'}`;
  statParticipants.textContent = count;
});

socket.on('session-reset', () => {
  state.results = { byQuestion: {}, profiles: {} };
  state.currentSlide = 0;
  state.participantCount = 0;
  updateDashboard();
  updateResultsUI();
});

// ── Utilities ─────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

'use strict';

const socket = io();

// Stable participant ID across page refreshes
const PID = (() => {
  let id = sessionStorage.getItem('sondaggio_pid');
  if (!id) {
    id = 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
    sessionStorage.setItem('sondaggio_pid', id);
  }
  return id;
})();

const state = {
  joined: false,
  nickname: sessionStorage.getItem('sondaggio_nick') || '',
  currentSlide: 0,
  slides: [],
  answers: {},   // { [questionNumber]: 'A'|'B'|'C'|'D' }
  results: { byQuestion: {}, profiles: {} },
  participantCount: 0,
};

// DOM
const screens = {
  join: document.getElementById('screen-join'),
  main: document.getElementById('screen-main'),
};
const $ = id => document.getElementById(id);
const nicknameInput = $('nickname-input');
const joinBtn       = $('join-btn');
const joinError     = $('join-error');
const slideContainer = $('slide-container');
const progressBar   = $('progress-bar');
const slideCounter  = $('slide-counter');

// ── Navigation ───────────────────────────────────────────────────────────────
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.add('hidden'));
  screens[name]?.classList.remove('hidden');
}

// ── Join ─────────────────────────────────────────────────────────────────────
function joinSession() {
  const nickname = nicknameInput.value.trim();
  if (!nickname) {
    joinError.textContent = 'Inserisci un nome per continuare.';
    nicknameInput.focus();
    return;
  }
  joinBtn.disabled = true;
  joinBtn.textContent = 'Connessione…';

  socket.emit('join', { nickname, participantId: PID }, (res) => {
    if (res?.success) {
      state.nickname = nickname;
      state.joined = true;
      sessionStorage.setItem('sondaggio_nick', nickname);
      for (const a of res.answers) {
        state.answers[a.questionNumber] = a.answer;
      }
      showScreen('main');
      renderCurrentSlide();
    } else {
      joinError.textContent = 'Errore di connessione, riprova.';
      joinBtn.disabled = false;
      joinBtn.textContent = 'Entra →';
    }
  });
}

// ── Render ───────────────────────────────────────────────────────────────────
function renderCurrentSlide() {
  const slide = state.slides[state.currentSlide];
  if (!slide) {
    slideContainer.innerHTML = `
      <div class="waiting-msg">
        <span class="w-emoji">⏳</span>
        <p>In attesa dell'inizio…</p>
      </div>`;
    return;
  }
  updateProgress(slide);
  if (slide.type === 'text')    slideContainer.innerHTML = renderTextSlide(slide);
  else if (slide.type === 'survey')  slideContainer.innerHTML = renderSurveySlide(slide);
  else if (slide.type === 'results') slideContainer.innerHTML = renderResultsSlide(slide);
  attachHandlers(slide);
}

function updateProgress(slide) {
  const surveyCount = state.slides.filter(s => s.type === 'survey').length;
  const answered = Object.keys(state.answers).length;
  progressBar.style.width = surveyCount > 0 ? `${(answered / surveyCount) * 100}%` : '0%';

  if (slide.type === 'survey')       slideCounter.textContent = `${slide.number} / ${surveyCount}`;
  else if (slide.type === 'results') slideCounter.textContent = '🎉 Fine';
  else                               slideCounter.textContent = '';
}

// ── Text slide ────────────────────────────────────────────────────────────────
function renderTextSlide(slide) {
  return `
    <div class="slide-text">
      <h1 class="slide-title">${escHtml(slide.title)}</h1>
      <p class="slide-content">${escHtml(slide.content).replace(/\n/g, '<br>')}</p>
    </div>`;
}

// ── Survey slide ──────────────────────────────────────────────────────────────
function renderSurveySlide(slide) {
  const myAnswer = state.answers[slide.number];
  const answered = !!myAnswer;
  const colors = { A: 'var(--a)', B: 'var(--b)', C: 'var(--c)', D: 'var(--d)' };

  const optHtml = Object.entries(slide.options).map(([letter, text]) => {
    const selected = myAnswer === letter;
    return `
      <button
        class="option-btn${selected ? ' selected' : ''}${answered && !selected ? ' dimmed' : ''}"
        data-letter="${letter}"
        data-question="${slide.number}"
        style="--letter-color:${colors[letter]}"
        ${answered ? 'disabled' : ''}
      >
        <span class="option-badge" style="background:${colors[letter]}">${letter}</span>
        <span class="option-text">${escHtml(text)}</span>
        ${selected ? '<span class="option-check">✓</span>' : ''}
      </button>`;
  }).join('');

  return `
    <div class="slide-survey">
      <div class="question-number">Domanda ${slide.number} di 5</div>
      <h2 class="question-text">${escHtml(slide.question)}</h2>
      <div class="options-grid">${optHtml}</div>
      ${answered ? '<div class="answered-msg">✓ Risposta salvata!</div>' : ''}
    </div>`;
}

// ── Results slide ─────────────────────────────────────────────────────────────
function renderResultsSlide(slide) {
  const myCounts = { A: 0, B: 0, C: 0, D: 0 };
  for (const ans of Object.values(state.answers)) myCounts[ans]++;

  const answeredCount = Object.keys(state.answers).length;
  let dominant = null;
  if (answeredCount > 0) {
    dominant = Object.entries(myCounts).sort((x, y) => y[1] - x[1])[0][0];
  }

  const colors = { A: 'var(--a)', B: 'var(--b)', C: 'var(--c)', D: 'var(--d)' };
  const profile = dominant ? slide.profiles[dominant] : null;

  const personalHtml = profile ? `
    <div class="result-profile" style="--profile-color:${colors[dominant]}">
      <div class="profile-emoji">${profile.emoji}</div>
      <div class="profile-name">${profile.name}</div>
      <p class="profile-desc">${escHtml(profile.description)}</p>
      <div class="my-tally">
        ${Object.entries(myCounts).map(([l, c]) => `
          <span class="tally-item${dominant === l ? ' tally-dominant' : ''}" style="--tc:${colors[l]}">
            <b>${l}</b>&nbsp;${c}
          </span>`).join('')}
      </div>
    </div>` : `
    <div class="result-profile">
      <p>Non hai risposto a nessuna domanda.</p>
    </div>`;

  // Group profile distribution
  const { profiles: groupProfiles } = state.results;
  const total = Object.values(groupProfiles).reduce((a, b) => a + b, 0);
  const groupHtml = total > 0 ? `
    <div class="group-results">
      <h3>Il vostro gruppo</h3>
      <div class="profile-bars">
        ${Object.entries(slide.profiles).map(([l, p]) => {
          const cnt = groupProfiles[l] || 0;
          const pct = total > 0 ? Math.round(cnt / total * 100) : 0;
          return `
            <div class="profile-bar-row">
              <span class="profile-bar-label">${p.emoji} ${p.name}</span>
              <div class="profile-bar-track">
                <div class="profile-bar-fill" style="width:${pct}%;background:${colors[l]}"></div>
              </div>
              <span class="profile-bar-count">${cnt}</span>
            </div>`;
        }).join('')}
      </div>
    </div>` : '';

  return `
    <div class="slide-results">
      <h1 class="slide-title">${escHtml(slide.title)}</h1>
      ${personalHtml}
      ${groupHtml}
    </div>`;
}

// ── Event handlers ────────────────────────────────────────────────────────────
function attachHandlers(slide) {
  if (slide.type !== 'survey') return;
  slideContainer.querySelectorAll('.option-btn:not([disabled])').forEach(btn => {
    btn.addEventListener('click', () => {
      const letter = btn.dataset.letter;
      const qNum = parseInt(btn.dataset.question, 10);
      submitAnswer(qNum, letter);
    });
  });
}

function submitAnswer(questionNumber, answer) {
  socket.emit('answer', { questionNumber, answer, participantId: PID }, (res) => {
    if (res?.success) {
      state.answers[questionNumber] = answer;
      renderCurrentSlide();
    }
  });
}

// ── Socket events ─────────────────────────────────────────────────────────────
socket.on('state', (data) => {
  state.slides = data.slides;
  state.currentSlide = data.slide;
  state.results = data.results;
  state.participantCount = data.participantCount;
  if (state.joined) renderCurrentSlide();
});

socket.on('slide-change', (index) => {
  state.currentSlide = index;
  if (state.joined) renderCurrentSlide();
});

socket.on('results-update', (data) => {
  state.results = data.results;
  state.participantCount = data.participantCount;
  const slide = state.slides[state.currentSlide];
  if (slide?.type === 'results') renderCurrentSlide();
});

socket.on('session-reset', () => {
  state.answers = {};
  state.joined = false;
  state.currentSlide = 0;
  sessionStorage.removeItem('sondaggio_nick');
  joinBtn.disabled = false;
  joinBtn.textContent = 'Entra →';
  showScreen('join');
});

socket.on('connect', () => {
  if (state.joined) {
    socket.emit('join', { nickname: state.nickname, participantId: PID }, (res) => {
      if (res?.success) {
        for (const a of res.answers) state.answers[a.questionNumber] = a.answer;
        renderCurrentSlide();
      }
    });
  }
});

// ── Init ──────────────────────────────────────────────────────────────────────
joinBtn.addEventListener('click', joinSession);
nicknameInput.addEventListener('keydown', e => { if (e.key === 'Enter') joinSession(); });

if (state.nickname) {
  nicknameInput.value = state.nickname;
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

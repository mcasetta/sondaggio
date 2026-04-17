'use strict';
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const QRCode = require('qrcode');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin2024';
const PORT = process.env.PORT || 3000;

// ── In-memory state ──────────────────────────────────────────────────────────
// participants: pid -> { nickname, role, answers: Map<questionNumber, 'A'|'B'|'C'|'D'> }
const participants = new Map();
const adminSockets = new Set();
let currentSlide = 0;

// ── Slides data ──────────────────────────────────────────────────────────────
const slides = [
  {
    type: 'text',
    title_genitore: '🎯 Che tipo di genitore sei?',
    title_animatore: '🎯 Che tipo di educatore sei?',
    content: 'Cinque domande, nessuna risposta giusta o sbagliata.\n\nScegli per ogni domanda la risposta che più ti rappresenta — quella istintiva, non quella "ideale"!'
  },
  {
    type: 'survey',
    number: 1,
    question_genitore: 'Quando tuo figlio fa qualcosa di sbagliato…',
    question_animatore: 'Quando un ragazzo fa qualcosa di sbagliato…',
    options: {
      A: 'Spiego con calma e cerco di capire il motivo',
      B: 'Ne parlo come se fossimo amici',
      C: 'Intervengo subito per proteggerlo dalle conseguenze',
      D: 'Lascio correre, imparerà da solo'
    }
  },
  {
    type: 'survey',
    number: 2,
    question_genitore: 'Le regole in casa…',
    question_animatore: 'Le regole in oratorio…',
    options: {
      A: 'Sono chiare ma adattabili',
      B: 'Sono poche, privilegio il dialogo',
      C: 'Sono molte, per evitare problemi',
      D: 'Non sono così importanti'
    }
  },
  {
    type: 'survey',
    number: 3,
    question_genitore: 'Quando tuo figlio è in difficoltà…',
    question_animatore: 'Quando un ragazzo è in difficoltà…',
    options: {
      A: 'Lo accompagno senza sostituirmi',
      B: 'Cerco di stargli vicino emotivamente',
      C: 'Cerco subito una soluzione per lui',
      D: 'Aspetto che trovi da solo la soluzione'
    }
  },
  {
    type: 'survey',
    number: 4,
    question_genitore: 'Il dialogo con i figli…',
    question_animatore: 'Il dialogo con i ragazzi…',
    options: {
      A: 'È importante ma con ruoli chiari',
      B: 'È centrale, voglio essere un punto di riferimento amico',
      C: 'Serve, ma prima viene la sicurezza',
      D: 'Avviene solo quando necessario'
    }
  },
  {
    type: 'survey',
    number: 5,
    question_genitore: 'Il tuo obiettivo come genitore è…',
    question_animatore: 'Il tuo obiettivo come educatore è…',
    options: {
      A: 'Educare alla libertà responsabile',
      B: 'Costruire una relazione forte',
      C: 'Proteggere da errori e pericoli',
      D: 'Lasciare che cresca autonomamente'
    }
  },
  {
    type: 'results',
    title: 'Risultati 🎉',
    profiles: {
      A: {
        name: 'Genitore guida',
        emoji: '👣',
        description: 'Sai unire regole e ascolto, ma i figli a volte hanno bisogno anche di sbagliare.'
      },
      B: {
        name: 'Genitore amico',
        emoji: '🤝',
        description: 'Sei molto vicino ai figli, ma attenzione a mantenere il tuo ruolo educativo.'
      },
      C: {
        name: 'Genitore protettivo',
        emoji: '🛡️',
        description: "Ti prendi molta cura, ma prova a lasciare più spazio all'autonomia."
      },
      D: {
        name: 'Genitore permissivo',
        emoji: '🌿',
        description: 'Favorisci la libertà, ma i figli hanno bisogno anche di punti di riferimento.'
      }
    }
  }
];

const TOTAL_QUESTIONS = slides.filter(s => s.type === 'survey').length;

// ── Helpers ──────────────────────────────────────────────────────────────────
function getResults() {
  const byQuestion = {};
  for (let n = 1; n <= TOTAL_QUESTIONS; n++) {
    byQuestion[n] = { A: 0, B: 0, C: 0, D: 0 };
  }
  const profiles = { A: 0, B: 0, C: 0, D: 0 };

  for (const [, p] of participants) {
    for (const [qNum, answer] of p.answers) {
      if (byQuestion[qNum]) byQuestion[qNum][answer]++;
    }
    if (p.answers.size === TOTAL_QUESTIONS) {
      const counts = { A: 0, B: 0, C: 0, D: 0 };
      for (const [, a] of p.answers) counts[a]++;
      const dominant = Object.entries(counts).sort((x, y) => y[1] - x[1])[0][0];
      profiles[dominant]++;
    }
  }
  return { byQuestion, profiles };
}

function broadcastResults() {
  io.emit('results-update', {
    results: getResults(),
    participantCount: participants.size
  });
}

// ── Routes ───────────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.post('/api/admin/login', (req, res) => {
  res.json({ success: req.body.password === ADMIN_PASSWORD });
});

app.get('/api/qrcode', async (req, res) => {
  const url = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
  try {
    const qr = await QRCode.toDataURL(url, {
      width: 240,
      margin: 2,
      color: { dark: '#4f46e5', light: '#ffffff' }
    });
    res.json({ url, qr });
  } catch {
    res.status(500).json({ error: 'QR generation failed' });
  }
});

app.post('/api/admin/reset', (req, res) => {
  if (req.body.password !== ADMIN_PASSWORD) {
    return res.status(401).json({ success: false });
  }
  participants.clear();
  currentSlide = 0;
  io.emit('session-reset');
  io.emit('slide-change', 0);
  broadcastResults();
  res.json({ success: true });
});

// ── Socket.io ────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  socket.emit('state', {
    slide: currentSlide,
    slides,
    results: getResults(),
    participantCount: participants.size
  });

  socket.on('admin-auth', (password, cb) => {
    if (password === ADMIN_PASSWORD) {
      adminSockets.add(socket.id);
      socket.join('admins');
      cb?.({ success: true });
    } else {
      cb?.({ success: false });
    }
  });

  socket.on('join', ({ nickname, role, participantId }, cb) => {
    if (!participants.has(participantId)) {
      participants.set(participantId, { nickname, role, answers: new Map() });
    } else {
      const p = participants.get(participantId);
      p.nickname = nickname;
      p.role = role;
    }
    const p = participants.get(participantId);
    const answers = Array.from(p.answers.entries()).map(([questionNumber, answer]) => ({ questionNumber, answer }));
    io.to('admins').emit('participant-count', participants.size);
    cb?.({ success: true, answers });
  });

  socket.on('answer', ({ questionNumber, answer, participantId }, cb) => {
    const p = participants.get(participantId);
    if (!p) return cb?.({ success: false });
    p.answers.set(questionNumber, answer);
    broadcastResults();
    cb?.({ success: true });
  });

  socket.on('next-slide', () => {
    if (!adminSockets.has(socket.id)) return;
    if (currentSlide < slides.length - 1) {
      currentSlide++;
      io.emit('slide-change', currentSlide);
    }
  });

  socket.on('prev-slide', () => {
    if (!adminSockets.has(socket.id)) return;
    if (currentSlide > 0) {
      currentSlide--;
      io.emit('slide-change', currentSlide);
    }
  });

  socket.on('goto-slide', (index) => {
    if (!adminSockets.has(socket.id)) return;
    if (index >= 0 && index < slides.length) {
      currentSlide = index;
      io.emit('slide-change', currentSlide);
    }
  });

  socket.on('disconnect', () => {
    adminSockets.delete(socket.id);
    io.to('admins').emit('participant-count', participants.size);
  });
});

server.listen(PORT, () => {
  console.log(`\n🚀 Server avviato su http://localhost:${PORT}`);
  console.log(`📊 Pannello admin: http://localhost:${PORT}/admin`);
  console.log(`🔑 Password admin: ${ADMIN_PASSWORD}\n`);
});

/* ═══════════════════════════════════════════════════════
   LEGEND OF WELLNESS — Chapter Read-Aloud
   Uses Web Speech API (SpeechSynthesis) — no cost, no key
   ═══════════════════════════════════════════════════════ */
(function () {
  if (!window.speechSynthesis) return; // browser not supported

  // ── STYLES ─────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    #reader-bar {
      position: fixed; bottom: 0; left: 0; right: 0; z-index: 1000;
      background: rgba(7,9,15,0.97); backdrop-filter: blur(16px);
      border-top: 1px solid rgba(255,215,0,0.2);
      display: flex; align-items: center; gap: 10px;
      padding: 10px 20px; flex-wrap: wrap;
      font-family: 'Nunito', sans-serif;
      transform: translateY(100%);
      transition: transform .3s ease;
    }
    #reader-bar.open { transform: translateY(0); }
    #reader-toggle {
      position: fixed; bottom: 16px; right: 20px; z-index: 1001;
      background: rgba(255,215,0,0.12); border: 1px solid rgba(255,215,0,0.35);
      color: #FFD700; border-radius: 50px; padding: 8px 16px;
      font-size: 13px; font-weight: 700; cursor: pointer;
      font-family: 'Nunito', sans-serif; transition: all .2s;
      display: flex; align-items: center; gap: 6px;
    }
    #reader-toggle:hover { background: rgba(255,215,0,0.22); }
    #reader-toggle.hidden { display: none; }
    .rb-btn {
      background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12);
      color: #F0F4FF; border-radius: 8px; padding: 7px 14px;
      font-size: 13px; font-weight: 700; cursor: pointer;
      font-family: 'Nunito', sans-serif; transition: all .15s;
      white-space: nowrap;
    }
    .rb-btn:hover { background: rgba(255,255,255,0.12); }
    .rb-btn.active { background: rgba(255,215,0,0.15); border-color: rgba(255,215,0,0.4); color: #FFD700; }
    .rb-btn:disabled { opacity: .35; cursor: not-allowed; }
    #rb-progress {
      flex: 1; min-width: 120px; font-size: 12px; color: rgba(240,244,255,0.5);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    #rb-speed-label { font-size: 12px; color: rgba(240,244,255,0.5); white-space: nowrap; }
    .rb-speed-btn {
      background: none; border: 1px solid rgba(255,255,255,0.1); color: rgba(240,244,255,0.6);
      border-radius: 6px; padding: 4px 9px; font-size: 12px; font-weight: 700;
      cursor: pointer; font-family: 'Nunito', sans-serif; transition: all .15s;
    }
    .rb-speed-btn:hover { border-color: rgba(255,215,0,0.3); color: #FFD700; }
    .rb-speed-btn.sel { border-color: rgba(255,215,0,0.5); color: #FFD700; background: rgba(255,215,0,0.08); }
    .reader-highlight {
      background: rgba(255,215,0,0.12) !important;
      border-radius: 4px;
      outline: 2px solid rgba(255,215,0,0.3);
      transition: background .2s;
    }
    @media(max-width:600px) {
      #reader-bar { padding: 8px 12px; gap: 6px; }
      #rb-progress { display: none; }
    }
  `;
  document.head.appendChild(style);

  // ── TOGGLE BUTTON ───────────────────────────────────────
  const toggle = document.createElement('button');
  toggle.id = 'reader-toggle';
  toggle.innerHTML = '🔊 Read Aloud';
  document.body.appendChild(toggle);

  // ── BAR ────────────────────────────────────────────────
  const bar = document.createElement('div');
  bar.id = 'reader-bar';
  bar.innerHTML = `
    <button class="rb-btn active" id="rb-play">▶ Play</button>
    <button class="rb-btn" id="rb-pause" disabled>⏸ Pause</button>
    <button class="rb-btn" id="rb-stop" disabled>⏹ Stop</button>
    <div id="rb-progress">Press Play to begin reading…</div>
    <span id="rb-speed-label">Speed:</span>
    <button class="rb-speed-btn" data-rate="0.75">0.75×</button>
    <button class="rb-speed-btn sel" data-rate="1">1×</button>
    <button class="rb-speed-btn" data-rate="1.25">1.25×</button>
    <button class="rb-speed-btn" data-rate="1.5">1.5×</button>
    <button class="rb-btn" id="rb-close" style="margin-left:auto">✕ Close</button>
  `;
  document.body.appendChild(bar);

  // ── STATE ──────────────────────────────────────────────
  let segments = [];
  let current  = 0;
  let rate     = 1;
  let paused   = false;
  let activeEl = null;

  // ── COLLECT READABLE SEGMENTS ──────────────────────────
  function collectSegments() {
    const out = [];
    const selectors = [
      '.ch-sub',
      '.sec-title',
      '.act-title',
      '.act-desc',
      '.pdf-title',
      '.step-text',
      '.vocab-term',
      '.vocab-def',
      '.vc-title',
      '.vc-desc',
    ];
    // Walk DOM in order to preserve page flow
    document.querySelectorAll(selectors.join(',')).forEach(el => {
      const text = el.innerText.trim();
      if (text.length > 3) out.push({ el, text });
    });
    return out;
  }

  // ── SPEAK ──────────────────────────────────────────────
  function speakSegment(index) {
    if (index >= segments.length) { stopReading(); return; }
    current = index;
    const { el, text } = segments[index];

    // Highlight
    if (activeEl) activeEl.classList.remove('reader-highlight');
    activeEl = el;
    el.classList.add('reader-highlight');
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Progress
    document.getElementById('rb-progress').textContent =
      `${index + 1} / ${segments.length}  —  ${text.substring(0, 60)}${text.length > 60 ? '…' : ''}`;

    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = rate;
    utt.onend = () => { if (!paused) speakSegment(index + 1); };
    utt.onerror = () => speakSegment(index + 1);
    window.speechSynthesis.speak(utt);
  }

  function startReading() {
    window.speechSynthesis.cancel();
    paused = false;
    segments = collectSegments();
    if (!segments.length) {
      document.getElementById('rb-progress').textContent = 'No readable content found on this page.';
      return;
    }
    setButtons('playing');
    speakSegment(current);
  }

  function pauseReading() {
    if (window.speechSynthesis.speaking) {
      paused = true;
      window.speechSynthesis.pause();
      setButtons('paused');
    }
  }

  function resumeReading() {
    if (paused) {
      paused = false;
      window.speechSynthesis.resume();
      setButtons('playing');
    }
  }

  function stopReading() {
    paused = false;
    current = 0;
    window.speechSynthesis.cancel();
    if (activeEl) { activeEl.classList.remove('reader-highlight'); activeEl = null; }
    document.getElementById('rb-progress').textContent = 'Press Play to begin reading…';
    setButtons('stopped');
  }

  function setButtons(state) {
    const play  = document.getElementById('rb-play');
    const pause = document.getElementById('rb-pause');
    const stop  = document.getElementById('rb-stop');
    if (state === 'playing') {
      play.textContent = '▶ Play'; play.disabled = true; play.classList.remove('active');
      pause.disabled = false; pause.textContent = '⏸ Pause';
      stop.disabled = false;
    } else if (state === 'paused') {
      play.textContent = '▶ Resume'; play.disabled = false; play.classList.add('active');
      pause.disabled = true;
      stop.disabled = false;
    } else {
      play.textContent = '▶ Play'; play.disabled = false; play.classList.add('active');
      pause.disabled = true;
      stop.disabled = true;
    }
  }

  // ── EVENTS ─────────────────────────────────────────────
  toggle.addEventListener('click', () => {
    bar.classList.add('open');
    toggle.classList.add('hidden');
  });

  document.getElementById('rb-close').addEventListener('click', () => {
    stopReading();
    bar.classList.remove('open');
    toggle.classList.remove('hidden');
  });

  document.getElementById('rb-play').addEventListener('click', () => {
    if (paused) resumeReading();
    else startReading();
  });

  document.getElementById('rb-pause').addEventListener('click', pauseReading);
  document.getElementById('rb-stop').addEventListener('click', stopReading);

  bar.querySelectorAll('.rb-speed-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      bar.querySelectorAll('.rb-speed-btn').forEach(b => b.classList.remove('sel'));
      btn.classList.add('sel');
      rate = parseFloat(btn.dataset.rate);
      if (window.speechSynthesis.speaking && !paused) {
        window.speechSynthesis.cancel();
        speakSegment(current);
      }
    });
  });

  // Stop speech if user navigates away
  window.addEventListener('beforeunload', () => window.speechSynthesis.cancel());
})();

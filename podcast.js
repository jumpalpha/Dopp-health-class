/*
 * podcast.js — "Listen to this chapter" player on chapter pages (loaded by shared.js).
 * To add an episode: put the MP3 in podcasts/ and add a line to EPISODES below.
 * Episodes are AI Audio Overviews made in NotebookLM from the chapter page, reviewed by Mr. Dopp.
 */
(function () {
  var EPISODES = {
    1: { src: 'podcasts/ch01.mp3', title: 'Health Literacy and Cumulative Risk' }
  };

  var m = location.pathname.match(/chapter(\d{2})\.html$/i);
  if (!m) return;
  var n = parseInt(m[1], 10), ep = EPISODES[n];
  if (!ep) return;
  var KEY = 'dopp_pod_pos_' + n, SPEEDS = [1, 1.25, 1.5, 2];

  function fmt(s) { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2); }

  function build() {
    var hero = document.querySelector('.ch-hero');
    if (!hero || document.getElementById('dopp-pod')) return;
    var css = document.createElement('style');
    css.textContent =
      '#dopp-pod{position:relative;z-index:2;max-width:1100px;margin:-20px auto 24px;padding:0 22px}' +
      '#dopp-pod .pod{display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:16px 18px;border-radius:18px;color:#fff;' +
      'background:radial-gradient(circle at 15% 0%,#3b2a7a 0%,#1C1A2E 65%),#1C1A2E;box-shadow:0 8px 26px rgba(28,26,46,.22);border:1px solid rgba(255,215,0,.35)}' +
      '#dopp-pod .play{flex:0 0 54px;height:54px;border-radius:50%;border:none;cursor:pointer;font-size:22px;color:#1C1A2E;' +
      'background:linear-gradient(180deg,#FFE34D,#FFC400);box-shadow:0 3px 0 #a37d00}' +
      '#dopp-pod .play:active{transform:translateY(2px);box-shadow:0 1px 0 #a37d00}' +
      '#dopp-pod .info{flex:1 1 220px;min-width:0}' +
      '#dopp-pod .kick{font:800 11px Nunito,sans-serif;letter-spacing:1.5px;text-transform:uppercase;color:#FFD700}' +
      '#dopp-pod .ttl{font:800 16px Nunito,sans-serif;margin:2px 0 8px;color:#fff}' +
      '#dopp-pod input[type=range]{width:100%;accent-color:#FFD700;cursor:pointer}' +
      '#dopp-pod .row{display:flex;justify-content:space-between;font:700 12px Nunito,sans-serif;color:rgba(255,255,255,.7);margin-top:2px}' +
      '#dopp-pod .side{display:flex;flex-direction:column;gap:6px;align-items:flex-end}' +
      '#dopp-pod .spd,#dopp-pod .skip{font:800 12px Nunito,sans-serif;color:#fff;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.25);border-radius:999px;padding:5px 11px;cursor:pointer}' +
      '#dopp-pod .ask{font:800 12.5px Nunito,sans-serif;color:#FFD700;text-decoration:none}' +
      '#dopp-pod .ask:hover{text-decoration:underline}' +
      '#dopp-pod .note{flex-basis:100%;font:600 11.5px Nunito,sans-serif;color:rgba(255,255,255,.55)}' +
      '@media(max-width:600px){#dopp-pod{padding:0 16px;margin-top:6px}#dopp-pod .side{flex-direction:row;align-items:center;flex-wrap:wrap}}';
    document.head.appendChild(css);

    var box = document.createElement('section');
    box.id = 'dopp-pod';
    box.setAttribute('aria-label', 'Chapter podcast');
    box.innerHTML =
      '<div class="pod">' +
        '<button class="play" type="button" aria-label="Play">▶</button>' +
        '<div class="info"><div class="kick">🎧 Listen to this chapter</div>' +
          '<div class="ttl">Chapter ' + n + ' Podcast: ' + ep.title + '</div>' +
          '<input type="range" min="0" max="100" step="1" value="0" aria-label="Seek">' +
          '<div class="row"><span class="cur">0:00</span><span class="dur">--:--</span></div></div>' +
        '<div class="side"><div><button class="skip" type="button" aria-label="Back 15 seconds">↺ 15</button> ' +
          '<button class="spd" type="button" aria-label="Playback speed">1×</button></div>' +
          '<a class="ask" href="ask.html">🙋 Got a question? Ask Mr. Dopp</a></div>' +
        '<div class="note">AI-generated recap of this chapter, reviewed by Mr. Dopp. It doesn\'t replace the reading — your Quick Checks come from the text.</div>' +
      '</div>';
    hero.parentNode.insertBefore(box, hero.nextSibling);

    var a = new Audio(); a.preload = 'metadata'; a.src = ep.src;
    var play = box.querySelector('.play'), bar = box.querySelector('input'), cur = box.querySelector('.cur'),
        dur = box.querySelector('.dur'), spd = box.querySelector('.spd'), si = 0, seeking = false, lastSave = 0;

    a.addEventListener('loadedmetadata', function () {
      dur.textContent = fmt(a.duration);
      try { var p = parseFloat(localStorage.getItem(KEY)); if (p > 5 && p < a.duration - 10) { a.currentTime = p; } } catch (e) {}
    });
    a.addEventListener('timeupdate', function () {
      if (!seeking && a.duration) bar.value = a.currentTime / a.duration * 100;
      cur.textContent = fmt(a.currentTime);
      if (Date.now() - lastSave > 3000) { lastSave = Date.now(); try { localStorage.setItem(KEY, String(a.currentTime)); } catch (e) {} }
    });
    a.addEventListener('play', function () { play.textContent = '❚❚'; play.setAttribute('aria-label', 'Pause'); });
    a.addEventListener('pause', function () { play.textContent = '▶'; play.setAttribute('aria-label', 'Play'); });
    a.addEventListener('ended', function () { try { localStorage.removeItem(KEY); } catch (e) {} });
    a.addEventListener('error', function () { dur.textContent = 'unavailable'; play.disabled = true; play.style.opacity = '.5'; });

    play.addEventListener('click', function () { if (a.paused) a.play(); else a.pause(); });
    bar.addEventListener('input', function () { seeking = true; if (a.duration) cur.textContent = fmt(bar.value / 100 * a.duration); });
    bar.addEventListener('change', function () { if (a.duration) a.currentTime = bar.value / 100 * a.duration; seeking = false; });
    box.querySelector('.skip').addEventListener('click', function () { a.currentTime = Math.max(0, a.currentTime - 15); });
    spd.addEventListener('click', function () { si = (si + 1) % SPEEDS.length; a.playbackRate = SPEEDS[si]; spd.textContent = SPEEDS[si] + '×'; });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();

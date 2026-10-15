// ── PROGRESS TRACKING (for "resume where you left off") ──
(function trackChapterVisit() {
  try {
    var m = location.pathname.match(/chapter(\d{2})\.html$/i);
    if (!m) return;
    var n = parseInt(m[1], 10);
    var visited = JSON.parse(localStorage.getItem('lw_visited_chapters') || '[]');
    if (visited.indexOf(n) === -1) {
      visited.push(n);
      localStorage.setItem('lw_visited_chapters', JSON.stringify(visited));
    }
    localStorage.setItem('lw_last_chapter', JSON.stringify({
      n: n,
      title: document.title,
      url: location.pathname.split('/').pop(),
      ts: Date.now()
    }));
  } catch (e) {}
})();

// Trimester checklist evidence: quietly notes which reader lessons were actually read (see checklist_track.js).
(function loadChecklistTrack() {
  try {
    if (!/chapter\d{2}\.html$/i.test(location.pathname) || window.ChecklistTrack) return;
    var s = document.createElement('script'); s.src = 'checklist_track.js'; s.async = true;
    document.head.appendChild(s);
  } catch (e) {}
})();

function openAI(url, title, desc) {
  const msg = 'I am working on: ' + title + '. ' + desc;
  navigator.clipboard.writeText(msg).catch(() => {});
  const toast = document.createElement('div');
  toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#FFD700;color:#05070F;padding:12px 22px;border-radius:10px;font-weight:800;font-size:14px;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,0.4);white-space:nowrap';
  toast.textContent = '📋 Copied! Paste into the chat to begin.';
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.transition='opacity .4s'; toast.style.opacity='0'; setTimeout(() => toast.remove(), 400); }, 2800);
  window.open(url, '_blank');
}

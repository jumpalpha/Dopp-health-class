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
    var prev = JSON.parse(localStorage.getItem('lw_last_chapter') || 'null');
    var keep = prev && prev.n === n ? prev : {};          // same chapter: keep the lesson they were on
    localStorage.setItem('lw_last_chapter', JSON.stringify({
      n: n,
      title: document.title,
      url: location.pathname.split('/').pop(),
      lesson: keep.lesson, lessons: keep.lessons, lessonTitle: keep.lessonTitle,
      ts: Date.now()
    }));
  } catch (e) {}
})();

// Chapter pages: Quick Checks in the reader, the self-checking Chapter Path card, and the reading tracker.
// Loaded in this order (async = false keeps the order): the Quick Check boxes must be in each lesson
// before checklist_track.js adds its "end of lesson" marker, so finishing a lesson includes its Quick Check.
(function loadChapterTools() {
  try {
    if (!/chapter\d{2}\.html$/i.test(location.pathname)) return;
    var files = [];
    if (!window.TERM) files.push('term.js');                    // remembered-device login + current trimester
    if (!window.StudentSave) files.push('student-save.js');     // saves Quick Check answers to the student's account
    files.push('quick_checks_data.js', 'quick_checks.js', 'chapter_path.js');
    if (!window.ChecklistTrack) files.push('checklist_track.js');
    files.forEach(function (f) {
      var s = document.createElement('script'); s.src = f; s.async = false;
      document.head.appendChild(s);
    });
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

/*
 * student-save.js — shared save/load for Dopp's Class projects.
 *
 * Any page can include:
 *   <script src="student-save.js"></script>
 *
 * Then:
 *   const r = await StudentSave.load('wellness_pet');   // { data, source, updatedAt }
 *   await StudentSave.save('wellness_pet', { hunger: 3 }); // { ok, source }
 *   StudentSave.isSignedIn();  // true if the student logged in on quest.html
 *
 * Signed-in students save to Supabase (works on any device).
 * Not signed in → saves to this browser only (localStorage).
 * project_key must be lowercase letters, numbers, _ or - (max 40 chars).
 */
(function () {
  const SUPABASE_URL = 'https://gmeyamrlqfrabtslsweu.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_zClDCZZQEfC9DILpesPiHg_IcyRqW-c';
  const TRIMESTER = ((window.TERM && TERM.id) || '2026-T1');
  const SDK_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';
  const KEY_RE = /^[a-z0-9_-]{1,40}$/;

  let dbPromise = null;

  function getDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve) => {
      const make = () => resolve(window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null);
      if (window.supabase) return make();
      const s = document.createElement('script');
      s.src = SDK_URL;
      s.onload = make;
      s.onerror = () => resolve(null);
      document.head.appendChild(s);
    });
    return dbPromise;
  }

  function session() {
    try {
      const studentId = localStorage.getItem('qSID_' + TRIMESTER);
      const pinHash = sessionStorage.getItem('qPIN_' + TRIMESTER);
      return studentId && pinHash ? { studentId, pinHash } : null;
    } catch (e) { return null; }
  }

  function localKey(key) { return 'dopp_proj_' + TRIMESTER + '_' + key; }

  function readLocal(key) {
    try {
      const raw = localStorage.getItem(localKey(key));
      if (!raw) return null;
      const obj = JSON.parse(raw);
      return obj && typeof obj === 'object' && 'data' in obj ? obj : null;
    } catch (e) { return null; }
  }

  function writeLocal(key, data) {
    try {
      localStorage.setItem(localKey(key), JSON.stringify({ data, updatedAt: new Date().toISOString() }));
      return true;
    } catch (e) { return false; }
  }

  function checkKey(key) {
    if (!KEY_RE.test(key || '')) throw new Error('StudentSave: bad project key "' + key + '"');
  }

  async function load(key) {
    checkKey(key);
    const s = session();
    const local = readLocal(key);
    if (s) {
      const db = await getDb();
      if (db) {
        const { data, error } = await db.rpc('get_project_data', {
          p_student_id: s.studentId, p_pin_hash: s.pinHash,
          p_trimester: TRIMESTER, p_project_key: key
        });
        if (!error) {
          const row = Array.isArray(data) ? data[0] : null;
          if (row) {
            writeLocal(key, row.data); // keep an offline copy
            return { data: row.data, source: 'cloud', updatedAt: row.updated_at };
          }
          // Nothing in the cloud yet: fall back to this browser's copy, if any.
          if (local) return { data: local.data, source: 'local', updatedAt: local.updatedAt };
          return { data: null, source: 'cloud', updatedAt: null };
        }
        console.warn('StudentSave load failed, using local copy:', error.message);
      }
    }
    return local
      ? { data: local.data, source: 'local', updatedAt: local.updatedAt }
      : { data: null, source: 'local', updatedAt: null };
  }

  async function save(key, data) {
    checkKey(key);
    writeLocal(key, data); // always keep a local copy
    const s = session();
    if (!s) return { ok: true, source: 'local' };
    const db = await getDb();
    if (!db) return { ok: false, source: 'local', error: 'Could not reach the save server' };
    const { data: rows, error } = await db.rpc('save_project_data', {
      p_student_id: s.studentId, p_pin_hash: s.pinHash,
      p_trimester: TRIMESTER, p_project_key: key, p_data: data
    });
    if (error) return { ok: false, source: 'local', error: error.message };
    if (!rows || !rows.length) return { ok: false, source: 'local', error: 'Login expired — sign in again on the Quest page' };
    return { ok: true, source: 'cloud', updatedAt: rows[0].updated_at };
  }

  window.StudentSave = {
    load, save,
    isSignedIn: () => !!session(),
    trimester: TRIMESTER
  };
})();

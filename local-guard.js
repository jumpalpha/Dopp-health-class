// local-guard.js — LOCAL PREVIEW ONLY (dopps-class-next). Loaded first on every classic page.
// On localhost the copied classic pages must never write to the live Supabase project, so any
// fetch or realtime socket to *.supabase.co is refused here. On doppsclass.com this does nothing.
(function () {
  if (!/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) return;
  var blocked = function (u) { try { return /\.supabase\.co$/i.test(new URL(String(u && u.url || u), location.href).hostname); } catch (e) { return false; } };
  var realFetch = window.fetch;
  window.fetch = function (input, init) {
    if (blocked(input)) { console.warn('[local-guard] blocked live Supabase call:', String(input && input.url || input)); return Promise.reject(new TypeError('local preview: live database disabled')); }
    return realFetch.apply(this, arguments);
  };
  var RealWS = window.WebSocket;
  window.WebSocket = function (url, p) {
    if (blocked(String(url).replace(/^ws/, 'http'))) { console.warn('[local-guard] blocked live realtime socket'); throw new Error('local preview: live realtime disabled'); }
    return p === undefined ? new RealWS(url) : new RealWS(url, p);
  };
  window.WebSocket.prototype = RealWS.prototype;
  ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'].forEach(function (k) { window.WebSocket[k] = RealWS[k]; });
  var realBeacon = navigator.sendBeacon && navigator.sendBeacon.bind(navigator);
  if (realBeacon) navigator.sendBeacon = function (u, d) { return blocked(u) ? false : realBeacon(u, d); };
  window.DOPP_LOCAL_GUARD = true;
})();

// ── DEMO ACCOUNT ROUTER (added 2026-11-10) ───────────────────────────────────────────────
// When the signed-in student is the demo account, every database call from this page is sent
// through demo_call() on the server instead. The server runs it in a sub-transaction that is
// always rolled back and masks real student names — so the pages work, but nothing is ever saved.
// (This file only routes the calls; the actual protection lives in the database.)
(function () {
  var HOST = 'gmeyamrlqfrabtslsweu.supabase.co';
  var d = null;
  try {
    d = JSON.parse(localStorage.getItem('dopp_demo') || 'null');
    if (d) {
      var rem = JSON.parse(localStorage.getItem('dopp_remember') || 'null');
      var signedIn = !!(rem && rem.sid === d.sid);   // any trimester: the demo account never expires
      for (var i = 0; i < localStorage.length && !signedIn; i++) {
        var k = localStorage.key(i);
        if (/^qSID_/.test(k) && localStorage.getItem(k) === d.sid) signedIn = true;
      }
      if (!d.sid || !d.pin || !signedIn) d = null;   // signed out or someone else signed in
    }
  } catch (e) { d = null; }
  window.DoppDemo = {
    on: !!d,
    set: function (sid, pin, tri) { try { localStorage.setItem('dopp_demo', JSON.stringify({ sid: sid, pin: pin, tri: tri })); } catch (e) {} },
    clear: function () { try { localStorage.removeItem('dopp_demo'); localStorage.removeItem('dopp_tour'); } catch (e) {} }
  };
  if (!d) return;
  window.DoppDemo.sid = d.sid; window.DoppDemo.pin = d.pin; window.DoppDemo.tri = d.tri;
  document.documentElement.classList.add('dopp-demo');

  // teacher tools that would change something — the page gets a friendly "not saved" note
  var WRITES = /^(cl_teacher_config_set|cl_teacher_verify|cl_teacher_manual_test|briefing_teacher_set|ask_teacher_set|ask_teacher_delete|fin_teacher_return|fin_teacher_score|name_request_decide|sprite_admin_rename|sprite_admin_delete|teacher_merge_students|teacher_move_student|teacher_rename_student|teacher_delete_student|trail_teacher_remove|visitor_remove)$/;
  function note(msg) { try { window.dispatchEvent(new CustomEvent('dopp-demo-note', { detail: msg })); } catch (e) {} }
  function json(body, status) {
    return new Response(JSON.stringify(body), { status: status || 200, headers: { 'Content-Type': 'application/json' } });
  }
  function hdr(h, k) {
    if (!h) return null;
    if (typeof h.get === 'function') return h.get(k);
    for (var x in h) if (x.toLowerCase() === k.toLowerCase()) return h[x];
    return null;
  }

  var realFetch = window.fetch;
  window.fetch = function (input, init) {
    var url = String(input && input.url || input);
    var m = url.match(/^https:\/\/([^\/]+)\/rest\/v1\/(rpc\/)?([A-Za-z0-9_]+)(\?[^#]*)?/);
    if (!m || m[1] !== HOST) return realFetch.apply(this, arguments);
    init = init || {};
    var headers = init.headers || (input && input.headers);
    var method = String(init.method || (input && input.method) || 'GET').toUpperCase();
    if (!m[2]) {                                   // direct table access: reads pass, writes are faked
      if (method === 'GET' || method === 'HEAD') return realFetch.apply(this, arguments);
      note('Demo mode — that change was not saved.');
      return Promise.resolve(json([], 200));
    }
    var fn = m[3];
    if (fn === 'demo_call' || fn === 'demo_is') return realFetch.apply(this, arguments);
    var args = {};
    try {
      if (method === 'GET' || method === 'HEAD') {
        new URLSearchParams(m[4] || '').forEach(function (v, k) { args[k] = v; });
      } else if (init.body) {
        args = JSON.parse(typeof init.body === 'string' ? init.body : String(init.body)) || {};
      }
    } catch (e) { args = {}; }
    var key = hdr(headers, 'apikey');
    var auth = hdr(headers, 'Authorization') || (key ? 'Bearer ' + key : null);
    var wantOne = /vnd\.pgrst\.object/.test(hdr(headers, 'Accept') || '');
    var h = { 'Content-Type': 'application/json', Accept: 'application/json' };
    if (key) h.apikey = key; if (auth) h.Authorization = auth;
    if (WRITES.test(fn)) note('Demo mode — this would save for a real teacher, but nothing was changed.');
    return realFetch.call(window, 'https://' + HOST + '/rest/v1/rpc/demo_call', {
      method: 'POST', headers: h, signal: init.signal,
      body: JSON.stringify({ p_sid: d.sid, p_pin: d.pin, p_fn: fn, p_args: args })
    }).then(function (r) {
      if (!r.ok || !wantOne) return r;
      return r.json().then(function (v) {
        if (Array.isArray(v)) {
          if (v.length !== 1) return json({ code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: 'The result contains ' + v.length + ' rows', hint: null }, 406);
          v = v[0];
        }
        return json(v, 200);
      });
    });
  };
  var realBeacon = navigator.sendBeacon && navigator.sendBeacon.bind(navigator);
  if (realBeacon) navigator.sendBeacon = function (u, data) { return /supabase\.co/i.test(String(u)) ? true : realBeacon(u, data); };

  // load the guided tour + demo banner
  var s = document.createElement('script'); s.src = '/demo_tour.js'; s.defer = true;
  (document.head || document.documentElement).appendChild(s);
})();

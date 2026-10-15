// sw.js — makes doppsclass.com an installable web app that also works offline.
// Built by tools/build_pwa.py (it fills in VERSION and PRECACHE). Rerun that script after adding games.
//
// How it works:
//  • On install, the arcade games and the files they need are saved on the device.
//  • Every page load still tries the internet first, so students always get the newest version.
//    If there is no internet (or it takes more than 4 seconds), the saved copy is used instead.
//  • Every page a student opens while online is saved too, so it works offline next time.
//  • Supabase (logins, leaderboards) is never cached. Chapter PDFs are not saved (too big).

const VERSION = '/*VERSION*/8be6b8fb17f6/*END*/';
const CACHE = 'dopp-' + VERSION, FONTS = 'dopp-fonts';
const PRECACHE = /*PRECACHE*/["app/blast_blocks-180.png", "app/blast_blocks-192.png", "app/blast_blocks.webmanifest", "app/cup_pong-180.png", "app/cup_pong-192.png", "app/cup_pong.webmanifest", "app/field_day-180.png", "app/field_day-192.png", "app/field_day.webmanifest", "app/germ_invaders-180.png", "app/germ_invaders-192.png", "app/germ_invaders.webmanifest", "app/germ_sweeper-180.png", "app/germ_sweeper-192.png", "app/germ_sweeper.webmanifest", "app/habit_breaker-180.png", "app/habit_breaker-192.png", "app/habit_breaker.webmanifest", "app/habit_showdown-180.png", "app/habit_showdown-192.png", "app/habit_showdown.webmanifest", "app/how_smart-180.png", "app/how_smart-192.png", "app/how_smart.webmanifest", "app/immune_defense-180.png", "app/immune_defense-192.png", "app/immune_defense.webmanifest", "app/site-180.png", "app/site-192.png", "app/snack_2048-180.png", "app/snack_2048-192.png", "app/snack_2048.webmanifest", "app/snack_stack-180.png", "app/snack_stack-192.png", "app/snack_stack.webmanifest", "app/sprite_catch-180.png", "app/sprite_catch-192.png", "app/sprite_catch.webmanifest", "app/sprite_climb-180.png", "app/sprite_climb-192.png", "app/sprite_climb.webmanifest", "app/sprite_dash-180.png", "app/sprite_dash-192.png", "app/sprite_dash.webmanifest", "app/sprite_dodge-180.png", "app/sprite_dodge-192.png", "app/sprite_dodge.webmanifest", "app/sprite_flap-180.png", "app/sprite_flap-192.png", "app/sprite_flap.webmanifest", "app/sprite_hoops-180.png", "app/sprite_hoops-192.png", "app/sprite_hoops.webmanifest", "app/sprite_maze-180.png", "app/sprite_maze-192.png", "app/sprite_maze.webmanifest", "app/sprite_memory-180.png", "app/sprite_memory-192.png", "app/sprite_memory.webmanifest", "app/sprite_rider-180.png", "app/sprite_rider-192.png", "app/sprite_rider.webmanifest", "app/sprite_run-180.png", "app/sprite_run-192.png", "app/sprite_run.webmanifest", "app/sprite_slice-180.png", "app/sprite_slice-192.png", "app/sprite_slice.webmanifest", "app/sprite_sling-180.png", "app/sprite_sling-192.png", "app/sprite_sling.webmanifest", "app/sprite_snake-180.png", "app/sprite_snake-192.png", "app/sprite_snake.webmanifest", "app/tic_tac_toe-180.png", "app/tic_tac_toe-192.png", "app/tic_tac_toe.webmanifest", "app/vocab_slice-180.png", "app/vocab_slice-192.png", "app/vocab_slice.webmanifest", "app/word_quest-180.png", "app/word_quest-192.png", "app/word_quest.webmanifest", "arcade.html", "arcade_art.js", "arcade_kit.js", "blast_blocks.html", "cup_pong.html", "dopp_2048.html", "dopp_breakout.html", "dopp_corner.html", "dopp_drop.html", "dopp_dunk.html", "dopp_invaders.html", "dopp_kong.html", "dopp_match.html", "dopp_motomania.html", "dopp_pacman.html", "dopp_snake.html", "dopp_tetris.html", "dopp_wordle.html", "field_day.html", "germ_sweeper.html", "habit_showdown.html", "home_champions.js", "how_smart.html", "immune_defense.html", "index.html", "manifest.webmanifest", "offline.html", "pet_sprite.js", "pet_vocab.js", "pwa.js", "shared.css", "smart_questions.js", "sprite_dash.html", "sprite_flap.html", "sprite_run.html", "sprite_slice.html", "sprite_sling.html", "term.js", "tic_tac_toe.html", "vendor/matter.min.js", "vendor/supabase.js", "vocab_slice.html"]/*END*/;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(PRECACHE.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {})))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('dopp-') && k !== CACHE && k !== FONTS).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

function timeout(ms) { return new Promise((_, no) => setTimeout(() => no(new Error('slow')), ms)); }

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Google Fonts: use the saved copy right away, refresh it in the background.
  if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(caches.open(FONTS).then(c => c.match(req).then(hit => {
      const net = fetch(req).then(r => { if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    })));
    return;
  }
  if (url.origin !== location.origin) return;              // Supabase and everything else: straight to the network
  if (/\.pdf$/i.test(url.pathname)) return;                 // textbook PDFs: too big to keep offline

  // Our own pages and files: internet first, saved copy if offline or slow.
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const net = fetch(req).then(r => { if (r.ok && r.type === 'basic') cache.put(req, r.clone()); return r; });
    try {
      return await Promise.race([net, timeout(4000)]);
    } catch (err) {
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      try { return await net; }                              // nothing saved: keep waiting for the slow network
      catch (e2) {
        if (req.mode === 'navigate') return (await cache.match('offline.html')) || Response.error();
        return Response.error();
      }
    }
  })());
});

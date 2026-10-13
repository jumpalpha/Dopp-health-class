#!/usr/bin/env python3
"""Web-app (PWA) builder for doppsclass.com. Run from the repo folder after adding or renaming games:
    python3 tools/build_pwa.py
It reads the arcade game list from arcade.html and then:
  • draws missing home-screen icons in app/ (needs Playwright; see tools/make_app_icons.js)
  • writes manifest.webmanifest (the whole site, opens to the Arcade) and app/<game>.webmanifest (one per game)
  • writes offline.html (shown when a page isn't saved and there's no internet)
  • adds the web-app tags + pwa.js to every page (between <!-- PWA --> markers, safe to rerun)
  • fills sw.js with the list of files to save for offline play and a new VERSION"""
import glob, hashlib, json, os, re, subprocess

SITE_NAME, SITE_SHORT = "Doppsclass: The Legend of Wellness", "Doppsclass"
BG, THEME = "#0a0618", "#140c2e"
SHORT = {'how_smart': 'How Smart?', 'habit_showdown': 'Showdown', 'habit_breaker': 'Habit Break',
         'germ_invaders': 'Invaders', 'sprite_sling': 'Slingshot', 'sprite_memory': 'Memory'}

src = open('arcade.html', encoding='utf-8').read()
GAMES = [dict(zip(('key', 'title', 'file', 'icon'), m)) for m in
         re.findall(r"key:'(\w+)', title:'([^']+)', file:'([^']+)', icon:'([^']+)'", src)]
assert len(GAMES) >= 20, 'could not read the game list from arcade.html'
for i, g in enumerate(GAMES):
    g['short'] = SHORT.get(g['key'], g['title'] if len(g['title']) <= 12 else g['title'].split(' ', 1)[1])
    g['hue'] = round(i * 360 / len(GAMES) + 200) % 360
BY_FILE = {g['file']: g for g in GAMES}
os.makedirs('app', exist_ok=True)

# ---------- icons ----------
spec = [{'name': 'site', 'letter': 'D', 'badge': '⚔️', 'hue': 265}] + [{'name': g['key'], 'emoji': g['icon'], 'hue': g['hue']} for g in GAMES]
json.dump(spec, open('app/icons.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
if any(not os.path.exists('app/%s-%d.png' % (s['name'], n)) for s in spec for n in (180, 192, 512)):
    subprocess.run(['node', 'tools/make_app_icons.js', 'app/icons.json'], check=True,
                   env=dict(os.environ, NODE_PATH=os.environ.get('NODE_PATH', os.path.expanduser('~/.npm-global/lib/node_modules'))))

def icons(prefix, name):
    return [{'src': '%s%s-192.png' % (prefix, name), 'sizes': '192x192', 'type': 'image/png', 'purpose': 'any'},
            {'src': '%s%s-512.png' % (prefix, name), 'sizes': '512x512', 'type': 'image/png', 'purpose': 'any'},
            {'src': '%s%s-512.png' % (prefix, name), 'sizes': '512x512', 'type': 'image/png', 'purpose': 'maskable'}]

def write_json(path, obj):
    open(path, 'w', encoding='utf-8').write(json.dumps(obj, ensure_ascii=False, indent=2) + '\n')

# ---------- manifests ----------
write_json('manifest.webmanifest', {
    'id': './?app=doppsclass', 'name': SITE_NAME, 'short_name': SITE_SHORT,
    'description': "Dopp's health class: chapters, vocabulary, quests and the Wellness Sprite arcade.",
    'start_url': 'arcade.html', 'scope': './', 'display': 'standalone', 'background_color': BG, 'theme_color': THEME,
    'icons': icons('app/', 'site'),
    'shortcuts': [{'name': 'Arcade', 'url': 'arcade.html', 'icons': [{'src': 'app/site-192.png', 'sizes': '192x192'}]},
                  {'name': 'Chapters', 'url': 'chapters.html', 'icons': [{'src': 'app/site-192.png', 'sizes': '192x192'}]},
                  {'name': 'Quest', 'url': 'quest.html', 'icons': [{'src': 'app/site-192.png', 'sizes': '192x192'}]},
                  {'name': 'How Smart Am I?', 'url': 'how_smart.html', 'icons': [{'src': 'app/how_smart-192.png', 'sizes': '192x192'}]}]})
for g in GAMES:
    write_json('app/%s.webmanifest' % g['key'], {
        'id': '../%s' % g['file'], 'name': "%s · Dopp's Arcade" % g['title'], 'short_name': g['short'],
        'start_url': '../%s' % g['file'], 'scope': '../', 'display': 'standalone',
        'background_color': BG, 'theme_color': THEME, 'icons': icons('', g['key'])})
for old in glob.glob('app/*.webmanifest'):          # a game was removed from the arcade
    if os.path.basename(old)[:-12] not in {g['key'] for g in GAMES}: os.remove(old)

# ---------- offline page ----------
cards = ''.join('<a href="%s"><span>%s</span>%s</a>' % (g['file'], g['icon'], g['title']) for g in GAMES)
open('offline.html', 'w', encoding='utf-8').write('''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>You're offline · Doppsclass</title>
<meta name="robots" content="noindex">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{min-height:100vh;background:radial-gradient(ellipse at top,#22134a 0%,#0a0618 70%) fixed;color:#f4efff;font-family:Nunito,system-ui,sans-serif;padding:28px 16px;text-align:center}
h1{font-family:Cinzel,Georgia,serif;color:#FFD700;font-size:26px;margin-bottom:8px}
p{color:#d9d2f2;max-width:520px;margin:0 auto 18px;line-height:1.5}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;max-width:760px;margin:0 auto}
.grid a{display:flex;align-items:center;gap:10px;padding:12px;border-radius:12px;background:linear-gradient(135deg,#22134a,#140c2e);border:1px solid rgba(255,215,0,.35);color:#FFD700;font-weight:800;text-decoration:none;text-align:left}
.grid span{font-size:24px}
button{margin:18px auto 0;font:800 15px Nunito,system-ui,sans-serif;background:#FFD700;color:#1a1030;border:0;border-radius:999px;padding:10px 20px;cursor:pointer}
</style>
</head>
<body>
<h1>📴 You're offline</h1>
<p>This page isn't saved on your device yet. These arcade games work without internet. Scores you earn offline post to the leaderboard when you're back online.</p>
<div class="grid">@@CARDS@@</div>
<button onclick="location.reload()">↻ Try again</button>
</body>
</html>
'''.replace('@@CARDS@@', cards))

# ---------- tags on every page ----------
START, END = '<!-- PWA -->', '<!-- /PWA -->'
COMMON = ('<meta name="theme-color" content="%s"><meta name="mobile-web-app-capable" content="yes">'
          '<meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black">'
          '<script src="pwa.js" defer></script>' % THEME)
pages = sorted(glob.glob('*.html'))
for p in pages:
    s = open(p, encoding='utf-8').read()
    s = re.sub(r'\n?' + re.escape(START) + r'.*?' + re.escape(END), '', s, flags=re.S)
    s = re.sub(r'(<html\b[^>]*?) data-app-name="[^"]*"', r'\1', s, count=1)
    g = BY_FILE.get(p)
    if g:
        tags = ('<link rel="manifest" href="app/%s.webmanifest"><link rel="apple-touch-icon" href="app/%s-180.png">'
                '<meta name="apple-mobile-web-app-title" content="%s">' % (g['key'], g['key'], g['short']))
        s = re.sub(r'<html\b', '<html data-app-name="%s"' % g['title'].replace('"', '&quot;'), s, count=1)
    else:
        tags = ('<link rel="manifest" href="manifest.webmanifest"><link rel="apple-touch-icon" href="app/site-180.png">'
                '<meta name="apple-mobile-web-app-title" content="%s">' % SITE_SHORT)
    assert s.count('</head>') == 1, p
    s = s.replace('</head>', START + tags + COMMON + END + '\n</head>', 1)
    open(p, 'w', encoding='utf-8').write(s)

# ---------- sw.js: what to save for offline play ----------
pre = {'index.html', 'arcade.html', 'offline.html', 'pwa.js', 'manifest.webmanifest'}
for page in [g['file'] for g in GAMES] + ['index.html', 'arcade.html']:
    pre.add(page)
    for ref in re.findall(r'(?:src|href)="([^"#:?]+\.(?:js|css|png|jpg|svg|webp|mp3|json))"', open(page, encoding='utf-8').read()):
        if os.path.exists(ref): pre.add(ref)
pre |= {f for f in glob.glob('app/*') if f.endswith(('.webmanifest', '-192.png'))}   # big icons load only when installing
pre = sorted(pre)
h = hashlib.sha1()
for f in pre: h.update(open(f, 'rb').read())
sw = open('sw.js', encoding='utf-8').read()
sw = re.sub(r"/\*VERSION\*/.*?/\*END\*/", '/*VERSION*/' + h.hexdigest()[:12] + '/*END*/', sw)
sw = re.sub(r"/\*PRECACHE\*/.*?/\*END\*/", '/*PRECACHE*/' + json.dumps(pre) + '/*END*/', sw, flags=re.S)
open('sw.js', 'w', encoding='utf-8').write(sw)
print('games: %d · pages tagged: %d · offline files: %d · version %s' % (len(GAMES), len(pages), len(pre), h.hexdigest()[:12]))

#!/usr/bin/env python3
"""Adds (or refreshes) the "Practice in the Arcade" box on every chapter page.
Run from the repo folder:  python3 tools/add_arcade_links.py
Edit MAP below to change which games a chapter links to."""
import re

GAMES = {
  'catch':    ('dopp_drop.html',       '🧺', 'Sprite Catch',    'Catch fruits and veggies, dodge the junk'),
  'stack':    ('dopp_tetris.html',     '🟦', 'Snack Stack',     'Stack healthy snacks, clear lines'),
  'snake':    ('dopp_snake.html',      '🐍', 'Sprite Snake',    'Grow on fruit and veggies'),
  's2048':    ('dopp_2048.html',       '🔢', 'Snack 2048',      'Merge snacks up to the Healthy Heart'),
  'dodge':    ('dopp_corner.html',     '👑', 'Sprite Dodge',    'Out-dodge King Junk for 60 seconds'),
  'hoops':    ('dopp_dunk.html',       '🏀', 'Sprite Hoops',    'Shoot bad habits into the trash'),
  'showdown': ('habit_showdown.html',  '⚖️', 'Habit Showdown',  'Good habit or bad? Myth or fact?'),
  'breaker':  ('dopp_breakout.html',   '🧱', 'Habit Breaker',   'Smash a wall of bad habits'),
  'memory':   ('dopp_match.html',      '🧠', 'Sprite Memory',   'Match healthy pairs before time runs out'),
  'word':     ('dopp_wordle.html',     '🔤', 'Word Quest',      'Guess the 5-letter health word'),
  'invaders': ('dopp_invaders.html',   '🦠', 'Germ Invaders',   'Spray germs and stress clouds'),
  'maze':     ('dopp_pacman.html',     '🍎', 'Sprite Maze',     'Collect water, dodge junk monsters'),
  'field':    ('field_day.html',       '🏅', 'Field Day',       '5-event track meet'),
  'climb':    ('dopp_kong.html',       '🧗', 'Sprite Climb',    'Climb past rolling junk food'),
  'rider':    ('dopp_motomania.html',  '🏍️', 'Sprite Rider',    'Hills, ramps and safe landings'),
  'run':      ('sprite_run.html',      '🛕', 'Sprite Run',      'Swipe past soda, grab fruit'),
  'dash':     ('sprite_dash.html',     '🏃', 'Sprite Dash',     'Jump and duck past junk food'),
  'flap':     ('sprite_flap.html',     '🪽', 'Sprite Flap',     'Flap through junk-food towers'),
  'slice':    ('sprite_slice.html',    '🔪', 'Sprite Slice',    'Swipe fruit and veggies, skip the junk'),
  'pong':     ('cup_pong.html',        '🏓', 'Cup Pong',        'Dump 10 cups of sugary drinks'),
  'sweeper':  ('germ_sweeper.html',     '🦠', 'Germ Sweeper',    'Minesweeper with germs'),
  'ttt':      ('tic_tac_toe.html',     '⭕', 'Tic-Tac-Toe',     'Apples vs. King Junk\'s sodas'),
  'blast':    ('blast_blocks.html',     '🧊', 'Blast Blocks',    'Blast rows and columns, chain combos'),
  'sling':    ('sprite_sling.html',    '🎯', 'Sprite Slingshot','Topple towers of junk-food monsters'),
}
SMART = ('how_smart.html', '🧠', 'How Smart Am I?', 'Compare yourself, 3rd grade to grad school')

MAP = {
   1: ['showdown', 'breaker'],  2: ['showdown', 'hoops'],   3: ['memory', 'word'],     4: ['hoops', 'run'],
   5: ['showdown', 'word'],     6: ['showdown', 'memory'],  7: ['memory', 'word'],     8: ['showdown', 'hoops'],
   9: ['dodge', 'climb'],      10: ['catch', 'stack', 'snake', 'pong'], 11: ['s2048', 'slice', 'dodge', 'pong'], 12: ['field', 'run', 'rider'],
  13: ['maze', 'breaker'],     14: ['field', 'climb'],     15: ['dash', 'catch'],     16: ['word', 'memory'],
  17: ['word', 'memory'],      18: ['climb', 'showdown'],  19: ['showdown', 'hoops'], 20: ['hoops', 'flap'],
  21: ['showdown', 'dodge'],   22: ['dodge', 'breaker'],   23: ['invaders', 'maze'],  24: ['invaders', 'word'],
  25: ['s2048', 'dash'],       26: ['rider', 'sling'],     27: ['showdown', 'word'],  28: ['maze', 'stack'],
}

START, END = '<!-- ARCADE PRACTICE -->', '<!-- /ARCADE PRACTICE -->'
CSS = ('<style>.ap-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:9px}'
       '.ap-card{display:flex;gap:10px;align-items:center;padding:12px 14px;border-radius:12px;text-decoration:none;'
       'background:linear-gradient(135deg,#22134a,#140c2e);border:1px solid rgba(255,215,0,.35);color:#f4efff;transition:transform .15s,border-color .15s}'
       '.ap-card:hover{transform:translateY(-2px);border-color:#FFD700}.ap-ic{font-size:24px;flex:none}'
       '.ap-t{display:block;font-weight:800;font-size:14px;color:#FFD700}.ap-d{display:block;font-size:12px;color:#d9d2f2;line-height:1.35}'
       '.ap-card.smart{border-color:rgba(0,229,160,.5)}.ap-card.smart .ap-t{color:#00E5A0}</style>')

def card(g, cls=''):
    f, ic, t, d = g
    return ('<a class="ap-card%s" href="%s"><span class="ap-ic">%s</span><span><span class="ap-t">%s</span>'
            '<span class="ap-d">%s</span></span></a>' % (cls, f, ic, t, d))

def block(n):
    cards = ''.join(card(GAMES[k]) for k in MAP[n]) + card(SMART, ' smart')
    return ('%s\n    <div class="content-section">\n      <div class="sec-header"><span class="sec-icon">🕹</span>'
            '<span class="sec-title">Practice in the Arcade</span></div>\n      %s<div class="ap-grid">%s</div>\n    </div>\n    %s'
            % (START, CSS, cards, END))

for n in range(1, 29):
    p = 'chapter%02d.html' % n
    s = open(p, encoding='utf-8').read()
    s = re.sub(r'\n    ' + re.escape(START) + r'.*?' + re.escape(END), '', s, flags=re.S)   # refresh if already there
    marker = '\n  </div>\n  <div class="sidebar">' if n != 1 else '\n  </div>\n\n  <!-- SIDEBAR -->'
    assert s.count(marker) == 1, p
    s = s.replace(marker, '\n    ' + block(n) + marker)
    open(p, 'w', encoding='utf-8').write(s)
print('updated 28 chapter pages')

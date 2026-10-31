#!/usr/bin/env python3
"""
Leak guard for the PUBLIC doppsclass.com repository.

Fails if anything that must stay private could be published by GitHub Pages:
manuscript files, service-role / secret keys, links to the studio from the
classroom site, or a misconfigured studio shell. Run before every commit that
touches book-studio/ or _book-studio-backend/:

    python3 _book-studio-backend/tests/check_public_repo.py
"""
import base64, json, os, re, subprocess, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
os.chdir(ROOT)
files = subprocess.run(['git', 'ls-files', '--cached', '--others', '--exclude-standard'],
                       capture_output=True, text=True, check=True).stdout.split('\n')
files = [f for f in files if f and os.path.isfile(f)]
problems = []
def bad(msg): problems.append(msg)

STUDIO = ('book-studio/', '_book-studio-backend/')

# 1. No manuscript / office / audio files in studio paths, and the master file name nowhere.
for f in files:
    low = f.lower()
    if low.startswith(STUDIO) and re.search(r'\.(docx?|odt|rtf|pages|pdf|epub|mp3|m4a|wav|ogg|txt)$', low):
        bad(f'manuscript-type file in a studio path: {f}')
    if 'circumpunct_master' in low:
        bad(f'file named like the private master: {f}')

# 2. No secret keys anywhere in the repo.
JWT = re.compile(r'eyJ[A-Za-z0-9_-]{10,}\.(eyJ[A-Za-z0-9_-]{10,})\.[A-Za-z0-9_-]{10,}')
for f in files:
    if os.path.getsize(f) > 3_000_000 or f.endswith(('.png', '.jpg', '.pdf', '.zip', '.ico', '.webp')):
        continue
    try:
        text = open(f, encoding='utf-8', errors='ignore').read()
    except OSError:
        continue
    if re.search(r'\bsb_secret_[A-Za-z0-9_-]{10,}', text):
        bad(f'Supabase secret key in {f}')
    for m in JWT.finditer(text):
        try:
            payload = json.loads(base64.urlsafe_b64decode(m.group(1) + '=' * (-len(m.group(1)) % 4)))
        except Exception:
            continue
        if payload.get('role') not in (None, 'anon'):
            bad(f'non-anon JWT (role={payload.get("role")}) in {f}')
    if re.search(r'sk-ant-[A-Za-z0-9_-]{20,}|sk-(proj-)?[A-Za-z0-9]{32,}', text):
        bad(f'AI provider API key pattern in {f}')

# 3. The classroom site must not link to or list the studio.
for f in files:
    if f.startswith(STUDIO) or f in ('sw.js',) or not f.endswith(('.html', '.js', '.xml', '.json', '.webmanifest', '.txt', '.md')):
        continue
    if f.startswith('docs/') or f == 'README.md':
        continue
    text = open(f, encoding='utf-8', errors='ignore').read().lower()
    if 'book-studio' in text or 'circumpunct' in text:
        bad(f'classroom file mentions the studio: {f}')

# 4. Studio shell hygiene.
html = open('book-studio/index.html', encoding='utf-8').read()
if 'noindex' not in html: bad('book-studio/index.html is missing robots noindex')
if 'Content-Security-Policy' not in html: bad('book-studio/index.html is missing its CSP')
if re.search(r'<script(?![^>]*\bsrc=)[^>]*>\s*\S', html): bad('inline <script> in book-studio/index.html')
cfg = open('book-studio/config.js', encoding='utf-8').read()
if 'gmeyamrlqfrabtslsweu' in re.sub(r'//.*', '', cfg): bad('book-studio/config.js points at the CLASS project')
sw = open('sw.js', encoding='utf-8').read()
if "startsWith('/book-studio/')" not in sw: bad('sw.js no longer excludes /book-studio/ from offline caching')

# 5. No service-role usage in browser or edge-function code.
for f in files:
    if f.startswith(('book-studio/', '_book-studio-backend/supabase/functions/')):
        if re.search(r'SERVICE_ROLE_KEY|serviceRoleKey', open(f, encoding='utf-8', errors='ignore').read()):
            bad(f'service-role reference in {f}')

if problems:
    print('LEAK CHECK FAILED:'); [print('  -', p) for p in problems]; sys.exit(1)
print(f'Leak check passed ({len(files)} files scanned).')

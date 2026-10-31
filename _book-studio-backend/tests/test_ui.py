#!/usr/bin/env python3
"""
Headless browser checks for the Book Studio shell (synthetic text only).

    python3 _book-studio-backend/tests/test_ui.py [--shots DIR]

Serves the repo on localhost, then checks:
  * with no backend configured, the shell shows a notice, disables sign-in and
    makes no network calls to any backend
  * a config pointing at the CLASS project is refused
  * the Content-Security-Policy is never violated
  * reader, comment-on-selection offsets, word diff, TTS highlight, mobile drawer
"""
import contextlib, functools, http.server, os, sys, threading
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SHOTS = sys.argv[sys.argv.index('--shots') + 1] if '--shots' in sys.argv else None

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = f'http://127.0.0.1:{srv.server_address[1]}/book-studio/'

DEMO = [
  {'id': 'c1', 'chapter_no': 1, 'title': 'Chapter 1: The Point', 'current_version_id': 'v1',
   'body': 'This is synthetic placeholder text used only for testing the reader.\n\nA second paragraph sits here so that selection and comments can be checked across a paragraph break.\n\nThe third paragraph closes the sample chapter.'},
  {'id': 'c2', 'chapter_no': 2, 'title': 'Chapter 2: The Circle', 'current_version_id': 'v2',
   'body': 'Another synthetic paragraph for the second chapter.\n\nNothing here is from the real manuscript.'},
]
ANN = [{'id': 'a1', 'chapter_id': 'c1', 'version_id': 'v1', 'start_offset': 8, 'end_offset': 37,
        'quote': DEMO[0]['body'][8:37], 'comment': 'Sample editorial note.', 'resolved': False, 'updated_at': '2026-10-31T12:00:00Z'}]

results = []
def check(name, cond, detail=''):
    results.append((name, bool(cond), detail))

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])

    def page_for(**kw):
        ctx = browser.new_context(**kw)
        pg = ctx.new_page()
        pg.csp, pg.ext = [], []
        pg.on('console', lambda m: ('Content Security Policy' in m.text or 'Refused' in m.text) and pg.csp.append(m.text))
        pg.on('request', lambda r: (not r.url.startswith(f'http://127.0.0.1:{srv.server_address[1]}')) and pg.ext.append(r.url))
        return ctx, pg

    # 1. Unconfigured shell
    ctx, pg = page_for(viewport={'width': 1280, 'height': 860})
    pg.route('**/book-studio/config.js', lambda r: r.fulfill(content_type='text/javascript',
        body="window.BOOK_STUDIO_CONFIG={supabaseUrl:'',supabaseAnonKey:''};"))
    pg.goto(BASE); pg.wait_for_timeout(400)
    check('unconfigured: notice shown', pg.is_visible('#notConfigured'))
    check('unconfigured: sign-in disabled', pg.is_disabled('#loginBtn') and pg.is_disabled('#email'))
    check('unconfigured: no requests leave the site', not pg.ext, pg.ext)
    check('robots noindex meta present', 'noindex' in (pg.get_attribute('meta[name=robots]', 'content') or ''))
    if SHOTS: pg.screenshot(path=f'{SHOTS}/01-signin-not-connected.png')
    check('unconfigured: no CSP violations', not pg.csp, pg.csp)
    ctx.close()

    # 2. Class project config is refused
    ctx, pg = page_for(viewport={'width': 1280, 'height': 860})
    pg.route('**/book-studio/config.js', lambda r: r.fulfill(content_type='text/javascript',
        body="window.BOOK_STUDIO_CONFIG={supabaseUrl:'https://gmeyamrlqfrabtslsweu.supabase.co',supabaseAnonKey:'x.y.z'};"))
    pg.goto(BASE); pg.wait_for_timeout(400)
    check('class-project config refused', 'refused' in pg.inner_text('#notConfigured').lower() and pg.is_disabled('#loginBtn'))
    ctx.close()

    # 3. Configured (fake dedicated project): sign-in enabled, nothing fetched until submit
    ctx, pg = page_for(viewport={'width': 1280, 'height': 860})
    pg.route('**/book-studio/config.js', lambda r: r.fulfill(content_type='text/javascript',
        body="window.BOOK_STUDIO_CONFIG={supabaseUrl:'https://example-studio.supabase.co',supabaseAnonKey:'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.c2lnbmF0dXJlc2ln'};"))
    pg.route('https://example-studio.supabase.co/**', lambda r: r.fulfill(status=400, content_type='application/json',
        body='{"error":"invalid_grant","error_description":"Invalid login credentials"}'))
    pg.goto(BASE); pg.wait_for_timeout(400)
    check('configured: sign-in enabled', not pg.is_disabled('#loginBtn'))
    if SHOTS: pg.screenshot(path=f'{SHOTS}/02-signin.png')
    pg.fill('#email', 'someone@example.test'); pg.fill('#password', 'wrong-password-123'); pg.click('#loginBtn')
    pg.wait_for_timeout(600)
    check('bad password: generic error, studio stays hidden', 'Sign-in failed' in pg.inner_text('#gateMsg') and pg.is_hidden('#app'))
    check('bad password: password field cleared', pg.input_value('#password') == '')
    check('configured: no CSP violations', not pg.csp, pg.csp)
    ctx.close()

    # 4. Reader with synthetic data (local demo hook only)
    ctx, pg = page_for(viewport={'width': 1280, 'height': 860}, color_scheme='light')
    pg.goto(BASE + '?demo=1'); pg.wait_for_timeout(300)
    pg.evaluate('([c,a]) => window.__studioDemo("Sample Book", c, a)', [DEMO, ANN])
    pg.wait_for_timeout(300)
    check('reader shows chapter title', pg.inner_text('#reader h2') == DEMO[0]['title'])
    check('reader renders 3 paragraphs', pg.locator('#reader p').count() == 3)
    check('existing comment is highlighted', pg.inner_text('#reader mark') == ANN[0]['quote'])
    check('chapter list has 2 chapters', pg.locator('#chapterList li').count() == 2)

    # Select across the paragraph break and comment
    body = DEMO[0]['body']; s0 = body.index('second paragraph'); s1 = body.index('third paragraph') + len('third')
    pg.evaluate('''() => {
      const ps = document.querySelectorAll('#reader p');
      const t1 = ps[1].firstChild, t2 = ps[2].firstChild;
      const r = document.createRange();
      r.setStart(t1, t1.textContent.indexOf('second paragraph'));
      r.setEnd(t2, t2.textContent.indexOf('third paragraph') + 5);
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    }''')
    pg.wait_for_timeout(400)
    check('comment button appears on selection', pg.is_visible('#commentFab'))
    if SHOTS: pg.screenshot(path=f'{SHOTS}/03-reader-select-to-comment.png')
    pg.click('#commentFab'); pg.wait_for_timeout(200)
    q = pg.text_content('#dlgBody q')
    check('comment quote matches the exact selected manuscript offsets', q == body[s0:s1], repr(q))
    pg.keyboard.press('Escape')

    # Word diff
    d = pg.evaluate('() => StudioDiff.words("the quick brown fox", "the slow brown fox jumps")')
    check('word diff', d == [{'op': 'eq', 'text': 'the '}, {'op': 'del', 'text': 'quick'}, {'op': 'ins', 'text': 'slow'},
                             {'op': 'eq', 'text': ' brown fox'}, {'op': 'ins', 'text': ' jumps'}], d)

    # TTS highlights a paragraph (headless may have no voices; highlight is ours)
    has_tts = pg.evaluate('() => !!window.speechSynthesis')
    if has_tts:
        pg.click('#ttsPlay'); pg.wait_for_timeout(300)
        check('listen: current paragraph highlighted', pg.locator('#reader p.speaking').count() == 1)
        pg.click('[data-action=tts-stop]')

    pg.click('[data-action=theme]'); pg.wait_for_timeout(200)
    check('dark mode toggles', pg.evaluate('document.documentElement.dataset.theme') == 'dark')
    if SHOTS: pg.screenshot(path=f'{SHOTS}/04-reader-dark.png')
    check('reader: no CSP violations', not pg.csp, pg.csp)
    ctx.close()

    # 5. Demo hook is unavailable without ?demo=1 (and on any non-localhost host by construction)
    ctx, pg = page_for()
    pg.goto(BASE); pg.wait_for_timeout(200)
    check('demo hook disabled without ?demo=1', pg.evaluate('typeof window.__studioDemo') == 'undefined')
    ctx.close()

    # 6. Mobile
    ctx, pg = page_for(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, device_scale_factor=2)
    pg.goto(BASE + '?demo=1'); pg.wait_for_timeout(300)
    pg.evaluate('([c,a]) => window.__studioDemo("Sample Book", c, a)', [DEMO, ANN]); pg.wait_for_timeout(300)
    nav_box = pg.locator('#nav').bounding_box()
    check('mobile: chapter drawer hidden by default', nav_box['x'] + nav_box['width'] <= 1)
    check('mobile: no horizontal scroll', pg.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'))
    if SHOTS: pg.screenshot(path=f'{SHOTS}/05-mobile-reader.png')
    pg.click('[data-action=toggle-nav]'); pg.wait_for_timeout(350)
    check('mobile: drawer opens', pg.locator('#nav').bounding_box()['x'] >= -1)
    if SHOTS: pg.screenshot(path=f'{SHOTS}/06-mobile-chapters.png')
    ctx.close()
    browser.close()

srv.shutdown()
for name, ok, detail in results:
    print(f"{'PASS' if ok else 'FAIL'}  {name}" + ('' if ok or not detail else f'\n      {detail}'))
failed = sum(1 for r in results if not r[1])
print(f'\n{len(results) - failed}/{len(results)} passed')
sys.exit(1 if failed else 0)

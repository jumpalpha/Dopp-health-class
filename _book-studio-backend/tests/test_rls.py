#!/usr/bin/env python3
"""
Book Studio security tests — run against a real PostgreSQL.

Proves that only the listed owner, with a 2FA (aal2) session, can read or
change manuscript data, and that history is append-only.

Usage:
    python3 _book-studio-backend/tests/test_rls.py            # spins up a throwaway local cluster
    DATABASE_URL=postgres://... python3 test_rls.py           # use an existing EMPTY database

Never point DATABASE_URL at a live project: the script creates and drops tables.
"""
import json, os, shutil, subprocess, sys, tempfile, time, uuid, atexit, pwd

HERE = os.path.dirname(os.path.abspath(__file__))
MIGR = os.path.join(HERE, '..', 'supabase', 'migrations')

OWNER    = '11111111-1111-1111-1111-111111111111'
INTRUDER = '22222222-2222-2222-2222-222222222222'

def claims(sub, aal='aal2', role='authenticated'):
    return json.dumps({'sub': sub, 'role': role, 'aal': aal})

# ---------------------------------------------------------------- database
def start_cluster():
    pgbin = None
    for d in sorted(os.listdir('/usr/lib/postgresql'), reverse=True):
        p = f'/usr/lib/postgresql/{d}/bin'
        if os.path.exists(f'{p}/initdb'):
            pgbin = p; break
    if not pgbin:
        sys.exit('PostgreSQL server binaries not found; set DATABASE_URL instead.')
    base = tempfile.mkdtemp(prefix='bs-pg-')
    run_as = []
    if os.geteuid() == 0:   # initdb refuses to run as root
        try: pwd.getpwnam('postgres')
        except KeyError: subprocess.run(['useradd', '-M', 'postgres'], check=True)
        shutil.chown(base, 'postgres')
        run_as = ['runuser', '-u', 'postgres', '--']
    data, sock = os.path.join(base, 'data'), base
    subprocess.run(run_as + [f'{pgbin}/initdb', '-D', data, '-U', 'postgres', '-A', 'trust'], check=True, capture_output=True)
    subprocess.run(run_as + [f'{pgbin}/pg_ctl', '-D', data, '-o', f'-k {sock} -c listen_addresses=', '-l', f'{base}/log', '-w', 'start'],
                   check=True, capture_output=True)
    atexit.register(lambda: (subprocess.run(run_as + [f'{pgbin}/pg_ctl', '-D', data, '-m', 'immediate', 'stop'], capture_output=True),
                             shutil.rmtree(base, ignore_errors=True)))
    return f'postgresql://postgres@/postgres?host={sock}'

DB = os.environ.get('DATABASE_URL') or start_cluster()

def psql(sql, expect_error=None):
    """Run SQL; return stdout lines. If expect_error is set, require that error text."""
    r = subprocess.run(['psql', DB, '-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1'], input=sql, text=True, capture_output=True)
    if expect_error is not None:
        if r.returncode == 0:
            raise AssertionError(f'expected error containing {expect_error!r}, but it succeeded:\n{sql}\n-> {r.stdout}')
        if expect_error not in r.stderr:
            raise AssertionError(f'expected error containing {expect_error!r}, got:\n{r.stderr}')
        return r.stderr
    if r.returncode != 0:
        raise AssertionError(f'SQL failed:\n{sql}\n{r.stderr}')
    return [l for l in r.stdout.splitlines() if l != '']

def as_role(role, sub=None, aal='aal2'):
    if role == 'anon':
        return "set role anon; set request.jwt.claims = '{\"role\":\"anon\"}';\n"
    return f"set role authenticated; set request.jwt.claims = '{claims(sub, aal)}';\n"

def owner(sql, **kw):    return psql('begin;\n' + as_role('authenticated', OWNER) + sql + '\ncommit;', **kw)
def owner1(sql, **kw):   return psql('begin;\n' + as_role('authenticated', OWNER, 'aal1') + sql + '\ncommit;', **kw)
def intruder(sql, **kw): return psql('begin;\n' + as_role('authenticated', INTRUDER) + sql + '\ncommit;', **kw)
def anon(sql, **kw):     return psql('begin;\n' + as_role('anon') + sql + '\ncommit;', **kw)

# ---------------------------------------------------------------- setup
psql(open(os.path.join(HERE, 'supabase_stub.sql')).read())
for f in sorted(os.listdir(MIGR)):
    psql(open(os.path.join(MIGR, f)).read())
psql(f"insert into auth.users values ('{OWNER}','owner@example.test'), ('{INTRUDER}','intruder@example.test');"
     f"insert into public.bs_owners (user_id, note) values ('{OWNER}', 'test owner');")

SAMPLE = json.dumps([{'chapter_no': i, 'title': f'Chapter {i}', 'body': f'Placeholder test text for chapter {i}. Not real manuscript.'}
                     for i in range(1, 16)])
def import_sql(chapters, label='test master'):
    return (f"select public.bs_import_master('Test Book', '{label}', '2026-10-31', 'test.docx', 'uploads/test.docx', 'abc', "
            f"$j${chapters}$j$::jsonb);")

# ---------------------------------------------------------------- tests
results = []
def test(name):
    def wrap(fn):
        try:
            fn(); results.append((name, True, ''))
        except AssertionError as e:
            results.append((name, False, str(e)))
        return fn
    return wrap

@test('owner with 2FA can import a master (seeds 15 chapters)')
def _():
    out = owner(import_sql(SAMPLE))
    assert json.loads(out[-1])['seeded'] == 15, out

@test('anonymous visitor cannot read chapters (permission denied)')
def _(): anon('select count(*) from public.bs_chapters;', expect_error='permission denied')

@test('anonymous visitor cannot read masters / versions / comments / audit log')
def _():
    for t in ['masters', 'master_chapters', 'chapter_versions', 'annotations', 'audit_log', 'proposals', 'manuscripts']:
        anon(f'select 1 from public.bs_{t} limit 1;', expect_error='permission denied')

@test('anonymous visitor cannot call import / approve / rollback RPCs')
def _():
    anon(import_sql(SAMPLE), expect_error='permission denied')
    anon(f"select public.bs_approve_proposal('{uuid.uuid4()}');", expect_error='permission denied')
    anon(f"select public.bs_rollback_chapter('{uuid.uuid4()}', '{uuid.uuid4()}');", expect_error='permission denied')

@test('another signed-in account (even with 2FA) sees zero rows everywhere')
def _():
    for t in ['chapters', 'masters', 'master_chapters', 'chapter_versions', 'proposals', 'annotations', 'audit_log', 'manuscripts', 'bookmarks', 'reading_state']:
        n = intruder(f'select count(*) from public.bs_{t};')[-1]
        assert n == '0', f'{t}: intruder saw {n} rows'

@test('another account cannot add itself to the owner list (no privilege escalation)')
def _():
    intruder(f"insert into public.bs_owners (user_id) values ('{INTRUDER}');", expect_error='permission denied')
    intruder('select * from public.bs_owners;', expect_error='permission denied')

@test('another account cannot import, approve, roll back, or burn rate limits')
def _():
    intruder(import_sql(SAMPLE), expect_error='not authorized')
    intruder(f"select public.bs_approve_proposal('{uuid.uuid4()}');", expect_error='not authorized')
    intruder(f"select public.bs_rollback_chapter('{uuid.uuid4()}', '{uuid.uuid4()}');", expect_error='not authorized')
    intruder("select public.bs_consume_rate_limit('export');", expect_error='not authorized')

@test('another account cannot write comments, bookmarks or proposals')
def _():
    cid, vid = owner('select id, current_version_id from public.bs_chapters where chapter_no = 1;')[-1].split('|')
    intruder(f"insert into public.bs_annotations (chapter_id, version_id, start_offset, end_offset, quote, comment) "
             f"values ('{cid}', '{vid}', 0, 5, 'Place', 'x');", expect_error='row-level security')
    intruder(f"insert into public.bs_bookmarks (chapter_id) values ('{cid}');", expect_error='row-level security')
    intruder(f"insert into public.bs_proposals (chapter_id, base_version_id, proposed_title, proposed_body) "
             f"values ('{cid}', '{vid}', 't', 'b');", expect_error='row-level security')

@test('whoami reveals nothing beyond "not an owner" to other accounts')
def _():
    w = json.loads(intruder('select public.bs_whoami();')[-1])
    assert w == {'owner_listed': False, 'aal': 'aal2'}, w

@test('owner WITHOUT completing 2FA (aal1) sees nothing and cannot import')
def _():
    assert owner1('select count(*) from public.bs_chapters;')[-1] == '0'
    owner1(import_sql(SAMPLE), expect_error='not authorized')

@test('owner with 2FA reads all 15 chapters')
def _(): assert owner('select count(*) from public.bs_chapters;')[-1] == '15'

@test('owner cannot edit current text directly (must go through proposals)')
def _():
    owner("update public.bs_chapters set body = 'hacked';", expect_error='permission denied')
    owner("delete from public.bs_chapters;", expect_error='permission denied')

@test('masters, versions and audit log are immutable — even for a database superuser')
def _():
    owner("update public.bs_masters set label = 'x';", expect_error='permission denied')
    owner("delete from public.bs_chapter_versions;", expect_error='permission denied')
    psql("update public.bs_masters set label = 'x';", expect_error='immutable')
    psql("delete from public.bs_master_chapters;", expect_error='immutable')
    psql("update public.bs_chapter_versions set body = 'x';", expect_error='immutable')
    psql("delete from public.bs_audit_log;", expect_error='immutable')

@test('proposal -> explicit approval creates version 2 and updates current text')
def _():
    cid, vid = owner('select id, current_version_id from public.bs_chapters where chapter_no = 2;')[-1].split('|')
    pid = owner(f"insert into public.bs_proposals (chapter_id, base_version_id, proposed_title, proposed_body, author_label) "
                f"values ('{cid}', '{vid}', 'Chapter 2', 'Revised placeholder text.', 'claude') returning id;")[-1]
    body_before = owner(f"select body from public.bs_chapters where id = '{cid}';")[-1]
    assert 'Revised' not in body_before, 'text changed before approval'
    owner(f"select public.bs_approve_proposal('{pid}', 'looks good');")
    row = owner(f"select c.body, v.version_no, v.source from public.bs_chapters c join public.bs_chapter_versions v on v.id = c.current_version_id where c.id = '{cid}';")[-1]
    assert row == 'Revised placeholder text.|2|approved_proposal', row
    assert owner(f"select count(*) from public.bs_audit_log where action = 'approve_proposal' and entity_id = '{cid}';")[-1] == '1'

@test('a stale proposal (written against an old version) is refused with a conflict')
def _():
    cid, v2 = owner('select id, current_version_id from public.bs_chapters where chapter_no = 2;')[-1].split('|')
    v1 = owner(f"select id from public.bs_chapter_versions where chapter_id = '{cid}' and version_no = 1;")[-1]
    owner(f"insert into public.bs_proposals (chapter_id, base_version_id, proposed_title, proposed_body) "
          f"values ('{cid}', '{v1}', 't', 'b');", expect_error='row-level security')
    p_a = owner(f"insert into public.bs_proposals (chapter_id, base_version_id, proposed_title, proposed_body) values ('{cid}', '{v2}', 'A', 'A text') returning id;")[-1]
    p_b = owner(f"insert into public.bs_proposals (chapter_id, base_version_id, proposed_title, proposed_body) values ('{cid}', '{v2}', 'B', 'B text') returning id;")[-1]
    owner(f"select public.bs_approve_proposal('{p_a}');")
    owner(f"select public.bs_approve_proposal('{p_b}');", expect_error='conflict')

@test('owner cannot forge decisions by inserting pre-approved proposals')
def _():
    cid, vid = owner('select id, current_version_id from public.bs_chapters where chapter_no = 3;')[-1].split('|')
    owner(f"insert into public.bs_proposals (chapter_id, base_version_id, proposed_title, proposed_body, status) "
          f"values ('{cid}', '{vid}', 't', 'b', 'approved');", expect_error='row-level security')

@test('rollback restores old text as a NEW version (history kept)')
def _():
    cid = owner('select id from public.bs_chapters where chapter_no = 2;')[-1]
    v1 = owner(f"select id from public.bs_chapter_versions where chapter_id = '{cid}' and version_no = 1;")[-1]
    owner(f"select public.bs_rollback_chapter('{cid}', '{v1}');")
    rows = owner(f"select version_no, source from public.bs_chapter_versions where chapter_id = '{cid}' order by version_no;")
    assert rows[-1].endswith('|rollback') and len(rows) == 4, rows
    assert owner(f"select body from public.bs_chapters where id = '{cid}';")[-1].startswith('Placeholder test text for chapter 2')

@test('re-importing a changed Word file proposes changes instead of overwriting')
def _():
    ch = json.loads(SAMPLE); ch[4]['body'] = 'Changed in Word.'
    out = json.loads(owner(import_sql(json.dumps(ch), 'second master'))[-1])
    assert out['proposed'] == 1 and out['seeded'] == 0, out
    assert owner('select body from public.bs_chapters where chapter_no = 5;')[-1].startswith('Placeholder')
    assert owner('select count(*) from public.bs_masters;')[-1] == '2'

@test('owner comments: own rows only, cannot spoof another author')
def _():
    cid, vid = owner('select id, current_version_id from public.bs_chapters where chapter_no = 1;')[-1].split('|')
    owner(f"insert into public.bs_annotations (chapter_id, version_id, start_offset, end_offset, quote, comment) "
          f"values ('{cid}', '{vid}', 0, 11, 'Placeholder', 'Tighten this.');")
    owner(f"insert into public.bs_annotations (chapter_id, version_id, start_offset, end_offset, quote, comment, created_by) "
          f"values ('{cid}', '{vid}', 0, 11, 'Placeholder', 'x', '{INTRUDER}');", expect_error='row-level security')
    owner("update public.bs_annotations set comment = 'Tighten this sentence.';")
    assert owner("select count(*) from public.bs_audit_log where action = 'annotation_update';")[-1] == '1'

@test('private storage: other accounts cannot list, read or upload manuscript files')
def _():
    owner("insert into storage.objects (bucket_id, name) values ('bs-manuscripts', 'uploads/master.docx');")
    assert intruder("select count(*) from storage.objects;")[-1] == '0'
    assert owner1("select count(*) from storage.objects;")[-1] == '0'
    intruder("insert into storage.objects (bucket_id, name) values ('bs-manuscripts', 'evil.docx');", expect_error='row-level security')
    assert psql("select bool_or(public) from storage.buckets where id in ('bs-manuscripts','bs-audio');")[-1] == 'f'

@test('owner cannot overwrite or delete an uploaded master file')
def _():
    n = owner("with u as (update storage.objects set name = 'x' where bucket_id = 'bs-manuscripts' returning 1) select count(*) from u;")[-1]
    assert n == '0', n
    n = owner("with d as (delete from storage.objects where bucket_id = 'bs-manuscripts' returning 1) select count(*) from d;")[-1]
    assert n == '0', n

@test('rate limiting kicks in on privileged calls')
def _():
    owner("select public.bs_consume_rate_limit('export') from generate_series(1, 30);")
    owner("select public.bs_consume_rate_limit('export');", expect_error='rate limit exceeded')

@test('shared project: other apps\' tables and functions keep their access')
def _():
    assert anon('select title from public.songs;')[-1] == 'existing song'
    assert anon('select public.rate(5);')[-1] == '5'

# ---------------------------------------------------------------- report
w = max(len(n) for n, _, _ in results)
for name, ok, err in results:
    print(f"{'PASS' if ok else 'FAIL'}  {name}")
    if not ok: print('      ' + err.replace('\n', '\n      '))
failed = sum(1 for _, ok, _ in results if not ok)
print(f'\n{len(results) - failed}/{len(results)} passed')
sys.exit(1 if failed else 0)

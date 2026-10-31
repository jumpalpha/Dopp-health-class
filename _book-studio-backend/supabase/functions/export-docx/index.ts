// POST /functions/v1/export-docx   Body: { "source": "current" | "<master uuid>" }
// Builds a .docx of the current manuscript (or a specific immutable master)
// AS THE OWNER (RLS applies) and streams it back. Rate-limited.
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'npm:docx@9.0.2';
import { corsHeaders, json, requireOwner } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, 405, { error: 'POST only' });

  const client = await requireOwner(req);
  if (client instanceof Response) return client;

  const { error: rl } = await client.rpc('consume_rate_limit', { p_bucket: 'export' });
  if (rl) return json(req, rl.code === 'P0429' ? 429 : 403, { error: rl.message });

  let source = 'current';
  try { source = String((await req.json())?.source ?? 'current'); } catch { /* default */ }

  let title = 'The Circumpunct', stamp = new Date().toISOString().slice(0, 10);
  let rows: { chapter_no: number; title: string; body: string }[] = [];

  if (source === 'current') {
    const { data: ms } = await client.from('manuscripts').select('title').order('created_at').limit(1).maybeSingle();
    if (ms?.title) title = ms.title;
    const { data, error } = await client.from('chapters').select('chapter_no,title,body').order('chapter_no');
    if (error) return json(req, 400, { error: error.message });
    rows = data ?? [];
  } else {
    if (!/^[0-9a-f-]{36}$/i.test(source)) return json(req, 400, { error: 'bad master id' });
    const { data: m } = await client.from('masters').select('label,master_date').eq('id', source).maybeSingle();
    if (!m) return json(req, 404, { error: 'master not found' });
    stamp = `${m.master_date}-master`;
    const { data, error } = await client.from('master_chapters').select('chapter_no,title,body').eq('master_id', source).order('chapter_no');
    if (error) return json(req, 400, { error: error.message });
    rows = data ?? [];
  }
  if (!rows.length) return json(req, 404, { error: 'nothing to export' });

  const children: Paragraph[] = [new Paragraph({ text: title, heading: HeadingLevel.TITLE })];
  for (const r of rows) {
    children.push(new Paragraph({ text: r.title, heading: HeadingLevel.HEADING_1, pageBreakBefore: r !== rows[0] }));
    for (const para of r.body.split(/\n{2,}/)) {
      children.push(new Paragraph({ children: [new TextRun(para.replace(/\n/g, ' '))], spacing: { after: 200 } }));
    }
  }
  const doc = new Document({ creator: 'Circumpunct Book Studio', title, sections: [{ children }] });
  const buf = await Packer.toBuffer(doc);

  const fname = `${title.replace(/[^A-Za-z0-9]+/g, '_')}_${stamp}.docx`;
  return new Response(buf, {
    status: 200,
    headers: {
      ...corsHeaders(req),
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${fname}"`,
    },
  });
});

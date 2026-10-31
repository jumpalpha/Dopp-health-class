// POST /functions/v1/import-docx
// Body: { "storage_path": "uploads/<file>.docx", "label": "...", "master_date": "YYYY-MM-DD", "title": "..." }
//
// The browser first uploads the .docx into the PRIVATE `manuscripts` bucket
// (allowed only for the 2FA owner by storage RLS), then calls this function.
// This function downloads it AS THE OWNER, splits it into chapters, and calls
// import_master(), which records an immutable dated master. The first import
// seeds the chapters; later imports become pending proposals for review.
import mammoth from 'npm:mammoth@1.8.0';
import { Buffer } from 'node:buffer';
import { corsHeaders, json, requireOwner } from '../_shared/auth.ts';
import { htmlToBlocks, splitChapters } from '../_shared/chapters.js';

const MAX_BYTES = 25 * 1024 * 1024;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, 405, { error: 'POST only' });

  const client = await requireOwner(req);
  if (client instanceof Response) return client;

  let body: { storage_path?: string; label?: string; master_date?: string; title?: string };
  try { body = await req.json(); } catch { return json(req, 400, { error: 'invalid JSON' }); }

  const path = String(body.storage_path ?? '');
  if (!/^uploads\/[A-Za-z0-9._ -]{1,180}\.docx$/.test(path) || path.includes('..')) {
    return json(req, 400, { error: 'storage_path must look like uploads/<name>.docx' });
  }
  const date = String(body.master_date ?? new Date().toISOString().slice(0, 10));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json(req, 400, { error: 'master_date must be YYYY-MM-DD' });
  const label = String(body.label ?? `Master ${date}`).slice(0, 200);
  const title = String(body.title ?? 'The Circumpunct').slice(0, 200);

  const { data: file, error: dlErr } = await client.storage.from('manuscripts').download(path);
  if (dlErr || !file) return json(req, 404, { error: 'file not found in private storage' });
  if (file.size > MAX_BYTES) return json(req, 413, { error: 'file too large' });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const sha256 = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');

  let chapters;
  try {
    const { value: html } = await mammoth.convertToHtml({ buffer: Buffer.from(bytes) });
    chapters = splitChapters(htmlToBlocks(html));
  } catch (e) {
    return json(req, 422, { error: `could not read the Word file: ${(e as Error).message}` });
  }

  const { data, error } = await client.rpc('import_master', {
    p_title: title,
    p_label: label,
    p_master_date: date,
    p_source_filename: path.split('/').pop(),
    p_storage_path: path,
    p_sha256: sha256,
    p_chapters: chapters,
  });
  if (error) {
    const status = error.code === 'P0429' ? 429 : error.code === '42501' ? 403 : 400;
    return json(req, status, { error: error.message });
  }
  // Return counts only — never echo manuscript text back in logs or errors.
  return json(req, 200, { ...data, chapters: chapters.length, sha256 });
});

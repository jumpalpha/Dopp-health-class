// Pure helpers shared by the edge functions (and unit-tested in Node).
// No network, no secrets.

const WORD_NUMS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20,
};

function romanToInt(s) {
  const v = { i: 1, v: 5, x: 10, l: 50, c: 100 };
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const a = v[s[i]], b = v[s[i + 1]] || 0;
    if (!a) return NaN;
    total += a < b ? -a : a;
  }
  return total;
}

const HEADING_RE = /^\s*chapter\s+([0-9]+|[ivxlc]+|[a-z]+)\b[\s.:—–-]*(.*)$/i;

/** Returns { number, rest } if the line looks like "Chapter 3: Title", else null. */
export function parseChapterHeading(line) {
  const m = HEADING_RE.exec(line || '');
  if (!m) return null;
  const tok = m[1].toLowerCase();
  let n = /^\d+$/.test(tok) ? parseInt(tok, 10) : WORD_NUMS[tok] ?? romanToInt(tok);
  if (!Number.isFinite(n) || n <= 0) return null;
  return { number: n, rest: m[2].trim() };
}

function decode(s) {
  return s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/** mammoth HTML -> [{ kind: 'h1'|'h2'|...|'p', text }] */
export function htmlToBlocks(html) {
  const blocks = [];
  const re = /<(h[1-6]|p|li|blockquote)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = re.exec(html))) {
    const text = decode(m[2]);
    if (text) blocks.push({ kind: m[1].toLowerCase(), text });
  }
  return blocks;
}

/**
 * Split blocks into chapters. A new chapter starts at any paragraph or heading that
 * reads like "Chapter N ..." (N as digits, words or Roman numerals); if the file never
 * says "Chapter", Heading 1 paragraphs are used instead. Text before the first chapter becomes
 * chapter 0 ("Front matter") when present. A heading directly following a bare
 * "Chapter N" line is used as the chapter title.
 */
export function splitChapters(blocks) {
  const chapters = [];
  let cur = null, front = [], seq = 0;

  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const parsed = parseChapterHeading(b.text);
    if (parsed) {
      seq += 1;
      let title = b.text.trim();
      if (!parsed.rest) {
        const nxt = blocks[i + 1];
        if (nxt && (nxt.kind.startsWith('h') || nxt.text.length < 120) && !parseChapterHeading(nxt.text)) {
          title = `${b.text.trim()}: ${nxt.text.trim()}`;
          i += 1;
        }
      }
      cur = { chapter_no: parsed.number || seq, title, paras: [] };
      chapters.push(cur);
      continue;
    }
    (cur ? cur.paras : front).push(b.text);
  }

  // Fall back to h1 headings when the document never says "Chapter N".
  if (chapters.length === 0) {
    seq = 0; front = []; cur = null;
    for (const b of blocks) {
      if (b.kind === 'h1') { seq += 1; cur = { chapter_no: seq, title: b.text, paras: [] }; chapters.push(cur); }
      else (cur ? cur.paras : front).push(b.text);
    }
    if (chapters.length === 0 && front.length) {   // no headings at all: one chapter
      chapters.push({ chapter_no: 1, title: 'Manuscript', paras: front });
      front = [];
    }
  }

  const out = [];
  if (front.length) out.push({ chapter_no: 0, title: 'Front matter', body: front.join('\n\n') });
  const seen = new Set();
  for (const c of chapters) {
    if (seen.has(c.chapter_no)) throw new Error(`Chapter ${c.chapter_no} appears twice; check the headings in the Word file.`);
    seen.add(c.chapter_no);
    out.push({ chapter_no: c.chapter_no, title: c.title, body: c.paras.join('\n\n') });
  }
  if (!out.length) throw new Error('No text found in the document.');
  return out;
}

export function wordCount(chapters) {
  return chapters.reduce((n, c) => n + (c.body.trim() ? c.body.trim().split(/\s+/).length : 0), 0);
}

/** Markdown export of the current manuscript. */
export function toMarkdown(title, chapters) {
  const parts = [`# ${title}`, ''];
  for (const c of chapters) {
    parts.push(`## ${c.title}`, '', c.body, '');
  }
  return parts.join('\n');
}

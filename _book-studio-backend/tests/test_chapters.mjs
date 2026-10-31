// Unit tests for the Word -> chapters splitter, using a synthetic .docx built
// in memory (no real manuscript text). Requires `mammoth` and `docx`:
//   npm i --prefix /some/tmp/dir mammoth@1.8.0 docx@9.0.2
//   STUDIO_NODE_MODULES=/some/tmp/dir/node_modules node test_chapters.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { parseChapterHeading, htmlToBlocks, splitChapters, wordCount, toMarkdown } from '../supabase/functions/_shared/chapters.js';

const mods = process.env.STUDIO_NODE_MODULES;
if (!mods) { console.error('Set STUDIO_NODE_MODULES to a node_modules dir containing mammoth and docx'); process.exit(2); }
const require = createRequire(path.join(mods, 'x.js'));
const mammoth = require('mammoth');
const { Document, HeadingLevel, Packer, Paragraph } = require('docx');

let pass = 0, fail = 0;
async function t(name, fn) {
  try { await fn(); console.log('PASS ', name); pass++; }
  catch (e) { console.log('FAIL ', name, '\n      ', e.message); fail++; }
}

await t('heading parser: digits, words, roman numerals, titles', () => {
  assert.deepEqual(parseChapterHeading('Chapter 3: The Point'), { number: 3, rest: 'The Point' });
  assert.deepEqual(parseChapterHeading('CHAPTER FIFTEEN'), { number: 15, rest: '' });
  assert.deepEqual(parseChapterHeading('Chapter XIV — Circles'), { number: 14, rest: 'Circles' });
  assert.equal(parseChapterHeading('The chapter ends here'), null);
  assert.equal(parseChapterHeading('Chapter and verse'), null);
});

async function makeDocx(paragraphs) {
  const doc = new Document({ sections: [{ children: paragraphs }] });
  return Packer.toBuffer(doc);
}
const P = (text) => new Paragraph({ text });
const H1 = (text) => new Paragraph({ text, heading: HeadingLevel.HEADING_1 });

await t('real .docx round trip: 15 chapters + front matter, titles kept', async () => {
  const paras = [P('Test Book Title'), P('A dedication line.')];
  for (let i = 1; i <= 15; i++) {
    paras.push(H1(`Chapter ${i}`), H1(`Synthetic Title ${i}`), P(`First test paragraph of ${i}.`), P(`Second test paragraph of ${i}.`));
  }
  const buf = await makeDocx(paras);
  const { value: html } = await mammoth.convertToHtml({ buffer: buf });
  const ch = splitChapters(htmlToBlocks(html));
  assert.equal(ch.length, 16);
  assert.equal(ch[0].chapter_no, 0);
  assert.equal(ch[0].body, 'Test Book Title\n\nA dedication line.');
  assert.equal(ch[15].chapter_no, 15);
  assert.equal(ch[15].title, 'Chapter 15: Synthetic Title 15');
  assert.equal(ch[3].body, 'First test paragraph of 3.\n\nSecond test paragraph of 3.');
});

await t('falls back to Heading 1 when the file never says "Chapter"', async () => {
  const buf = await makeDocx([H1('Beginnings'), P('alpha beta'), H1('Middles'), P('gamma')]);
  const { value: html } = await mammoth.convertToHtml({ buffer: buf });
  const ch = splitChapters(htmlToBlocks(html));
  assert.deepEqual(ch.map((c) => [c.chapter_no, c.title]), [[1, 'Beginnings'], [2, 'Middles']]);
  assert.equal(wordCount(ch), 3);
});

await t('duplicate chapter numbers are rejected instead of silently merged', () => {
  assert.throws(() => splitChapters([{ kind: 'p', text: 'Chapter 1: A' }, { kind: 'p', text: 'x' }, { kind: 'p', text: 'Chapter 1: B' }]), /appears twice/);
});

await t('HTML entities and inline tags decode cleanly', () => {
  const b = htmlToBlocks('<p>Fish &amp; <em>chips</em>&nbsp;&quot;now&quot;</p>');
  assert.equal(b[0].text, 'Fish & chips "now"');
});

await t('markdown export', () => {
  const md = toMarkdown('T', [{ title: 'Chapter 1: A', body: 'x\n\ny' }]);
  assert.equal(md, '# T\n\n## Chapter 1: A\n\nx\n\ny\n');
});

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);

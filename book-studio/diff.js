// Word-level diff (LCS) for reviewing proposed edits. Pure, no network.
// window.StudioDiff.words(a, b) -> [{ op: 'eq'|'ins'|'del', text }]
(function () {
  function tokenize(s) { return s.match(/\s+|[^\s]+/g) || []; }

  function words(a, b) {
    const A = tokenize(a), B = tokenize(b);
    // Trim shared prefix/suffix to keep the table small.
    let pre = 0;
    while (pre < A.length && pre < B.length && A[pre] === B[pre]) pre++;
    let suf = 0;
    while (suf < A.length - pre && suf < B.length - pre && A[A.length - 1 - suf] === B[B.length - 1 - suf]) suf++;
    const a2 = A.slice(pre, A.length - suf), b2 = B.slice(pre, B.length - suf);
    const n = a2.length, m = b2.length;
    const out = [];
    if (pre) out.push({ op: 'eq', text: A.slice(0, pre).join('') });

    if (n * m > 4e6) {                     // huge rewrite: show as replace
      if (n) out.push({ op: 'del', text: a2.join('') });
      if (m) out.push({ op: 'ins', text: b2.join('') });
    } else {
      const w = m + 1, T = new Uint32Array((n + 1) * w);
      for (let i = n - 1; i >= 0; i--)
        for (let j = m - 1; j >= 0; j--)
          T[i * w + j] = a2[i] === b2[j] ? T[(i + 1) * w + j + 1] + 1 : Math.max(T[(i + 1) * w + j], T[i * w + j + 1]);
      let i = 0, j = 0;
      const push = (op, text) => {
        const last = out[out.length - 1];
        if (last && last.op === op) last.text += text; else out.push({ op, text });
      };
      while (i < n && j < m) {
        if (a2[i] === b2[j]) { push('eq', a2[i]); i++; j++; }
        else if (T[(i + 1) * w + j] >= T[i * w + j + 1]) { push('del', a2[i]); i++; }
        else { push('ins', b2[j]); j++; }
      }
      while (i < n) push('del', a2[i++]);
      while (j < m) push('ins', b2[j++]);
    }
    if (suf) out.push({ op: 'eq', text: A.slice(A.length - suf).join('') });
    return out;
  }

  /** Render into a container element using text nodes only (no innerHTML). */
  function render(container, a, b) {
    container.textContent = '';
    container.classList.add('diff');
    let changes = 0;
    for (const part of words(a, b)) {
      const node = part.op === 'eq' ? document.createTextNode(part.text) : document.createElement(part.op);
      if (part.op !== 'eq') { node.textContent = part.text; if (part.text.trim()) changes++; }
      container.appendChild(node);
    }
    return changes;
  }

  window.StudioDiff = { words, render };
})();

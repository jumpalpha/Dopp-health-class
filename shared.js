function openAI(url, title, desc) {
  const msg = 'I am working on: ' + title + '. ' + desc;
  navigator.clipboard.writeText(msg).catch(() => {});
  const toast = document.createElement('div');
  toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#FFD700;color:#05070F;padding:12px 22px;border-radius:10px;font-weight:800;font-size:14px;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,0.4);white-space:nowrap';
  toast.textContent = '📋 Copied! Paste into the chat to begin.';
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.transition='opacity .4s'; toast.style.opacity='0'; setTimeout(() => toast.remove(), 400); }, 2800);
  window.open(url, '_blank');
}

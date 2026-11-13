/* ═══════════════════════════════════════════════════════════════
   INKWELL — PDF STUDIO · application logic
   ═══════════════════════════════════════════════════════════════ */
'use strict';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ───────────── icons (inline SVG, stroke-based) ───────────── */
const I = {
  organize: '<rect x="3" y="3" width="18" height="18" rx="2.5"/><path d="M9.5 3v18M15 3v18"/>',
  forms: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4.5 1L4.5 14.5 16.5 3.5z"/>',
  sign: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4.5 1L4.5 14.5 16.5 3.5z"/>',
  penNib: '<path d="M4 20c1.2-4.8.4-8.9 3-12l5-5 5 5-5 12c-3.2 2.6-8 3.4-8 0z" transform="rotate(0)"/><path d="M12 3l5 5-6.5 11c-2 .8-4 .3-5.5-1.5L12 3z"/>',
  watermark: '<path d="M12 2.7l5.7 5.7a8 8 0 1 1-11.4 0z"/>',
  shield: '<path d="M12 22s8-3.6 8-9.8V5.2L12 2 4 5.2v7C4 18.4 12 22 12 22z"/><path d="M9.5 12l2 2 3.5-3.5"/>',
  tag: '<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><circle cx="7" cy="7" r="1.4"/>',
  zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  check: '<polyline points="20 6 9 17 4 10"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  extract: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>',
  pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4.5 1L4.5 14.5 16.5 3.5z"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  unlock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
  info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
  layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 12 12 17 22 12"/><polyline points="2 17 12 22 22 17"/>',
  scissors: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/>',
  arrowRight: '<line x1="4" y1="12" x2="20" y2="12"/><polyline points="14 6 20 12 14 18"/>',
  stamp: '<path d="M5 21h14"/><path d="M8 21v-2a4 4 0 0 1 4-4h0a4 4 0 0 1 4 4v2"/><path d="M12 15V6"/><path d="M8 9l4-6 4 6a4 4 0 0 1-8 0z"/>',
};

const svg = (paths, cls = '') =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="${cls}">${paths}</svg>`;

const TOOLS = [
  { id: 'organize', label: 'Organize', icon: I.organize },
  { id: 'edit',     label: 'Edit',     icon: I.pen },
  { id: 'forms',    label: 'Forms',    icon: I.forms },
  { id: 'sign',     label: 'Sign',     icon: '<path d="M17 3a2.8 2.8 0 1 1 4 4L9 19l-5 1 1-5L17 3z"/>' },
  { id: 'watermark',label: 'Watermark',icon: I.watermark },
  { id: 'protect',  label: 'Protect',  icon: I.shield },
  { id: 'metadata', label: 'Metadata', icon: I.tag },
  { id: 'optimize', label: 'Optimize', icon: I.zap },
];

/* ───────────── state ───────────── */
const state = {
  pdfBytes: null,           // the whole PDF, held in browser memory
  fileName: '',             // display + download name
  password: null,           // session password for encrypted PDFs (never leaves the tab)
  objectUrls: [],           // blob URLs handed to <img>, revoked on regeneration
  current: null,            // { id:'local', name, pages, size_bytes, encrypted, metadata, field_count, source }
  tool: 'organize',
  selected: new Set(),
  signature: null,          // { dataUrl, aspect }
  placement: false,
  undoStack: [],            // client-side undo — array of previous ArrayBuffers
  generation: 0,            // bumped on every mutation; stale blob URLs get discarded
  dragFromIndex: null,
  mergeQueue: [],          // File objects queued for merging
  viewZoom: 'fit',          // 'fit' or a multiplier from VIEW_STEPS
  pageAspect: 1.294,        // h/w of pages — recalibrated from the first loaded thumb
  aspectLocked: false,
};

const UNDO_CAP = 10;
const MAX_PDF_BYTES = 4_300_000;
const fileStem = () => (state.fileName || 'document.pdf').replace(/\.pdf$/i, '');
const saveBlob = (blob, name) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
};
const revokeObjectUrls = () => { (state.objectUrls || []).forEach(URL.revokeObjectURL); state.objectUrls = []; };

/* ───────────── helpers ───────────── */
const fmtBytes = (n) => {
  if (!n && n !== 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let u = 0, v = n;
  while (v >= 1024 && u < units.length - 1) { v /= 1024; u++; }
  return `${v >= 100 ? Math.round(v) : v.toFixed(1)} ${units[u]}`;
};
const fmtDate = (ts) => new Date(ts * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

async function errMsg(res) {
  try { const d = await res.json(); return d.detail || `Request failed (${res.status})`; }
  catch { return `Request failed (${res.status})`; }
}
function makeFormData(params, extraFiles) {
  const fd = new FormData();
  fd.append('file', new Blob([state.pdfBytes], { type: 'application/pdf' }), state.fileName || 'document.pdf');
  if (extraFiles) for (const [name, blob, filename] of extraFiles) fd.append(name, blob, filename || name);
  fd.append('params', JSON.stringify(params || {}));
  return fd;
}
async function postOp(op, params, extraFiles) {
  const res = await fetch(`/api/op/${op}`, { method: 'POST', body: makeFormData(params, extraFiles) });
  if (!res.ok) throw new Error(await errMsg(res));
  return res;
}
const withPw = (params) => ({ ...(params || {}), password: state.password || undefined });
async function postOpJson(op, params, extraFiles) {
  const res = await postOp(op, withPw(params), extraFiles);
  return res.json();
}
async function opPdf(op, params, extraFiles) {
  const res = await postOp(op, withPw(params), extraFiles);
  return {
    bytes: await res.arrayBuffer(),
    pages: Number(res.headers.get('X-Page-Count') || 0),
    encrypted: res.headers.get('X-Encrypted') === '1',
  };
}
async function fetchInfo(bytes, name, password) {
  const fd = new FormData();
  fd.append('file', new Blob([bytes], { type: 'application/pdf' }), name || 'document.pdf');
  fd.append('params', JSON.stringify({ password: password || undefined }));
  const res = await fetch('/api/op/info', { method: 'POST', body: fd });
  if (!res.ok) throw new Error(await errMsg(res));
  return res.json();
}
function reRenderActivePanel() {
  if (['forms', 'protect', 'optimize', 'organize', 'edit', 'metadata'].includes(state.tool)) renderPanel(state.tool);
}
function updateUndoBtn() { $('#btnUndo').disabled = state.undoStack.length === 0; }
async function applyOp(op, params, successMsg, extraFiles) {
  if (!state.pdfBytes) return null;
  const prev = state.pdfBytes;
  try {
    const r = await opPdf(op, params, extraFiles);
    state.undoStack.push(prev);
    if (state.undoStack.length > UNDO_CAP) state.undoStack.shift();
    state.pdfBytes = r.bytes;
    const merged = { ...state.current, pages: r.pages || state.current.pages,
                     size_bytes: r.bytes.byteLength, encrypted: r.encrypted };
    if (op === 'metadata' && params) merged.metadata = { ...(merged.metadata || {}), ...params };
    state.current = merged;
    state.generation++;
    state.selected.clear();
    updateDocChrome();
    syncSelectionUI();
    renderPages();
    updateToolbar();
    updateUndoBtn();
    reRenderActivePanel();
    if (successMsg) toast(successMsg, 'success');
    return r;
  } catch (err) {
    toast(err.message, 'error');
    return null;
  }
}
async function doUndo() {
  const prev = state.undoStack.pop();
  if (!prev) { toast('Nothing to undo yet.', 'info'); return; }
  state.pdfBytes = prev;
  state.generation++;
  try {
    const info = await fetchInfo(prev, state.fileName, state.password);
    state.current = { ...state.current, ...info, size_bytes: prev.byteLength };
  } catch {
    state.current = { ...state.current, size_bytes: prev.byteLength };
  }
  state.selected.clear();
  updateDocChrome();
  syncSelectionUI();
  renderPages();
  updateToolbar();
  updateUndoBtn();
  reRenderActivePanel();
  toast('Reverted the last change.', 'info', 'Undo');
}

const iconFor = (id) => (TOOLS.find(t => t.id === id) || {}).icon || I.file;

function toast(message, type = 'info', title = null) {
  const titles = { success: 'Done', error: 'Something went wrong', info: 'Inkwell' };
  const icons = {
    success: '<polyline points="20 6 9 17 4 10"/>',
    error: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
    info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
  };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `${svg(icons[type] || icons.info)}<div><strong>${title || titles[type]}</strong>${message}</div>`;
  $('#toasts').appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateX(30px)'; }, 4200);
  setTimeout(() => el.remove(), 4650);
}

const withBusy = (btn, fn) => async (...args) => {
  if (!btn) return fn(...args);
  const orig = btn.innerHTML;
  btn.classList.add('btn-is-loading');
  btn.innerHTML = '<span class="spinner"></span> Working…';
  try { return await fn(...args); }
  finally { btn.classList.remove('btn-is-loading'); btn.innerHTML = orig; }
};

const setDownloadUrl = () => { $('#btnDownload').disabled = !state.pdfBytes; };

/* ═════════════ documents (stateless) ═════════════ */
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function openBytes(bytes, fileName, password, knownInfo) {
  let info = knownInfo;
  if (!info) {
    try { info = await fetchInfo(bytes, fileName, password); }
    catch (err) { toast(err.message, 'error'); return false; }
  }
  revokeObjectUrls();
  state.pdfBytes = bytes;
  state.fileName = fileName;
  state.password = password || null;
  state.undoStack = [];
  state.generation++;
  state.viewZoom = 'fit';
  state.aspectLocked = false;
  state.current = { id: 'local', name: fileName, pages: info.pages, size_bytes: bytes.byteLength,
                    encrypted: info.encrypted, metadata: info.metadata || {}, field_count: info.field_count || 0,
                    source: 'local', modified: Date.now() / 1000, created: Date.now() / 1000 };
  $('#emptyState').classList.add('hidden');
  $('#docView').classList.remove('hidden');
  $('#docChip').hidden = false;
  $('#btnDeleteDoc').disabled = false;
  setRailEnabled(true);
  exitPlacementMode(true);
  updateDocChrome();
  renderPages();
  updateToolbar();
  updateUndoBtn();
  renderPanel(state.tool);
  setDownloadUrl();
  return true;
}

function updateDocChrome() {
  const c = state.current;
  if (!c) return;
  $('#docChipName').textContent = c.name;
  $('#docChipPages').textContent = `${c.pages} page${c.pages === 1 ? '' : 's'}`;
  $('#docChipSize').textContent = fmtBytes(c.size_bytes);
  $('#lockBadge').hidden = !c.encrypted;
  $('#pageTotal').textContent = `${c.pages} page${c.pages === 1 ? '' : 's'}`;
  document.title = `${c.name} — Inkwell · Online`;
}

function closeToEmpty() {
  exitPlacementMode(true);
  revokeObjectUrls();
  state.pdfBytes = null;
  state.fileName = '';
  state.password = null;
  state.current = null;
  state.selected.clear();
  state.undoStack = [];
  state.generation++;
  state.viewZoom = 'fit';
  state.aspectLocked = false;
  $('#docView').classList.add('hidden');
  $('#emptyState').classList.remove('hidden');
  $('#docChip').hidden = true;
  $('#btnUndo').disabled = true;
  $('#btnDeleteDoc').disabled = true;
  setDownloadUrl();
  setRailEnabled(false);
  document.title = 'Inkwell — PDF Studio · Online';
}


/* thumbnail failure — a tappable Retry button on the page card */
function addThumbRetry(img, retryFn) {
  const wrap = img.closest('.page-img-wrap');
  if (!wrap || wrap.querySelector('.thumb-retry')) return;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'thumb-retry';
  btn.setAttribute('aria-label', 'Retry rendering page preview');
  btn.innerHTML = `${svg('<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>')}<span>Retry</span>`;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    btn.remove();
    img.removeAttribute('src');
    img.alt = img.alt.split(' — ')[0];
    retryFn();
  });
  wrap.appendChild(btn);
}

/* ═════════════ pages grid ═════════════ */
const zoom = 1.35;                // server render zoom — stays crisp when CSS-scaled up

/* ── view zoom: fit-to-screen by default, Ctrl/Cmd + wheel or ± to zoom ── */
const BASE_CARD_W = 250;
const VIEW_STEPS = [0.55, 0.7, 0.85, 1, 1.2, 1.45, 1.75, 2.1, 2.5];

function pageAspect() { return state.pageAspect || 1.294; }   // h / w

function computeFitW() {
  const scroller = $('#pagesScroll');
  const box = scroller ? scroller.getBoundingClientRect() : { width: 900, height: 620 };
  const availW = Math.max(220, box.width - 48);             // breathing room either side
  const availH = Math.max(240, box.height - 44 - 58);       // scroller padding + card footer
  const byHeight = availH / pageAspect();
  return Math.max(220, Math.floor(Math.min(availW, byHeight, 1150)));
}

function applyViewZoom() {
  const grid = $('#pagesGrid');
  if (!grid) return;
  const fit = state.viewZoom === 'fit';
  const w = fit ? computeFitW() : Math.round(BASE_CARD_W * state.viewZoom);
  grid.style.setProperty('--page-w', `${w}px`);
  const label = $('#zoomLabel');
  if (label) label.textContent = fit ? 'Fit' : `${Math.round(state.viewZoom * 100)}%`;
  const fitBtn = $('#btnZoomFit');
  if (fitBtn) fitBtn.classList.toggle('active', fit);
}

function stepZoom(dir) {
  const cur = state.viewZoom === 'fit' ? computeFitW() / BASE_CARD_W : state.viewZoom;
  let idx = 0;
  while (idx < VIEW_STEPS.length - 1 && VIEW_STEPS[idx] < cur) idx++;
  let next = dir > 0
    ? (VIEW_STEPS[idx] > cur + 1e-6 ? idx : idx + 1)
    : (VIEW_STEPS[idx] < cur - 1e-6 ? idx : idx - 1);
  next = Math.min(Math.max(next, 0), VIEW_STEPS.length - 1);
  state.viewZoom = VIEW_STEPS[next];
  applyViewZoom();
}

function resetZoomToFit() { state.viewZoom = 'fit'; applyViewZoom(); }

async function renderPages() {
  const grid = $('#pagesGrid');
  const c = state.current;
  if (!c) { grid.innerHTML = ''; return; }
  revokeObjectUrls();
  const gen = state.generation;
  grid.innerHTML = Array.from({ length: c.pages }, (_, i) => {
    const n = i + 1;
    return `
    <div class="page-card" draggable="true" data-page="${n}" tabindex="0" aria-label="Page ${n} of ${c.pages}">
      <div class="page-img-wrap">
        <span class="page-num">${n}</span>
        <button class="page-check" aria-label="Select page ${n}">${svg(I.check)}</button>
        <img loading="lazy" alt="Page ${n}" data-page="${n}" />
      </div>
      <div class="page-card-foot">
        <span class="page-dims">Page ${n}</span>
        <div class="page-mini-actions">
          <button class="mini-btn" data-act="edit" title="Edit text &amp; images on this page">${svg(I.pen)}</button>
          <button class="mini-btn" data-act="sign" title="Stamp signature on this page">${svg('<path d="M17 3a2.8 2.8 0 1 1 4 4L9 19l-5 1 1-5L17 3z"/>')}</button>
          <button class="mini-btn" data-act="extract" title="Extract this page to a new PDF">${svg(I.extract)}</button>
          <button class="mini-btn" data-act="rotate" title="Rotate this page 90°">${svg('<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>')}</button>
          <button class="mini-btn danger" data-act="delete" title="Delete this page">${svg(I.trash)}</button>
        </div>
      </div>
    </div>`;
  }).join('');

  // fetch thumbnails as bytes (serverless function renders them), with quiet
  // retries — a transient failure must not leave a broken image behind
  const loadThumb = async (img, page, attempt = 1) => {
    try {
      const res = await postOp('page-image', withPw({ page, zoom }));
      if (gen !== state.generation) return; // stale — a newer doc replaced this one
      const url = URL.createObjectURL(await res.blob());
      state.objectUrls.push(url);
      img.src = url;
    } catch (err) {
      if (gen !== state.generation) return;
      if (attempt < 3) { setTimeout(() => loadThumb(img, page, attempt + 1), 900 * attempt); return; }
      img.alt = `Page ${page} — ${err.message}`;
      addThumbRetry(img, () => loadThumb(img, page));
    }
  };
  $$('.page-card img', grid).forEach(img => loadThumb(img, Number(img.dataset.page)));
  // annotate dims once each image is up
  $$('.page-card img', grid).forEach(img => {
    img.addEventListener('load', () => {
      const card = img.closest('.page-card');
      const dims = card && $('.page-dims', card);
      if (dims) dims.textContent = `${Math.round(img.naturalWidth / zoom)} × ${Math.round(img.naturalHeight / zoom)} pt`;
      if (!state.aspectLocked && img.naturalWidth > 0) {
        state.pageAspect = img.naturalHeight / img.naturalWidth;
        state.aspectLocked = true;
      }
      if (state.viewZoom === 'fit') applyViewZoom();
    }, { once: true });
  });
  applyViewZoom();
  syncSelectionUI();
}

function syncSelectionUI() {
  $$('#pagesGrid .page-card').forEach(card => {
    card.classList.toggle('selected', state.selected.has(Number(card.dataset.page)));
  });
  updateToolbar();
}

function updateToolbar() {
  const n = state.selected.size;
  const pages = state.current?.pages || 0;
  $('#selectionCount').textContent = n === 0 ? 'None selected' : `${n} selected`;
  $('#btnDeletePages').disabled = n === 0;
  $('#btnExtractPages').disabled = n === 0;
  $('#btnRotateCCW').disabled = n === 0;
  $('#btnRotateCW').disabled = n === 0;
  const all = $('#checkAll');
  all.checked = n > 0 && n === pages;
  all.indeterminate = n > 0 && n < pages;
  const extBtn = $('#btnExtractPages');
  if (extBtn) extBtn.innerHTML = `${svg(I.extract)} Extract${n ? ` (${n})` : ''}`;
  const wmSel = $('#wmSelCount');
  if (wmSel) wmSel.textContent = n;
}

const selectedSorted = () => [...state.selected].sort((a, b) => a - b);

async function mutateAndRefresh(op, params, successMsg) {
  return !!(await applyOp(op, params, successMsg));
}

/* drag-to-reorder */
function wirePagesGrid() {
  const grid = $('#pagesGrid');

  /* ctrl/cmd + wheel zooms the pages, like a proper viewer */
  const scroller = $('#pagesScroll');
  scroller.addEventListener('wheel', (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    stepZoom(e.deltaY < 0 ? 1 : -1);
  }, { passive: false });
  window.addEventListener('resize', () => { if (state.viewZoom === 'fit') applyViewZoom(); });

  grid.addEventListener('click', (e) => {
    if (e.target.closest('.sig-overlay')) return;
    const card = e.target.closest('.page-card');
    if (!card) return;
    const page = Number(card.dataset.page);

    // placement mode: clicking an image stamps instead of selecting
    if (state.placement) {
      const wrap = e.target.closest('.page-img-wrap');
      if (wrap) {
        const r = wrap.getBoundingClientRect();
        placeSignature(wrap, page, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, true);
      }
      return;
    }

    const actBtn = e.target.closest('[data-act]');
    if (actBtn) {
      e.stopPropagation();
      handleMiniAction(actBtn.dataset.act, page, card);
      return;
    }
    // toggle selection
    state.selected.has(page) ? state.selected.delete(page) : state.selected.add(page);
    syncSelectionUI();
  });

  grid.addEventListener('keydown', (e) => {
    const card = e.target.closest('.page-card');
    if (!card) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const page = Number(card.dataset.page);
      state.selected.has(page) ? state.selected.delete(page) : state.selected.add(page);
      syncSelectionUI();
    }
  });

  grid.addEventListener('dragstart', (e) => {
    const card = e.target.closest('.page-card');
    if (!card) return;
    state.dragFromIndex = Number(card.dataset.page);
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', card.dataset.page);
  });

  grid.addEventListener('dragover', (e) => {
    if (state.dragFromIndex == null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const card = e.target.closest('.page-card');
    $$('.page-card', grid).forEach(c => c.classList.remove('drop-before', 'drop-after'));
    if (!card) return;
    const r = card.getBoundingClientRect();
    const before = (e.clientX - r.left) < r.width / 2;
    card.classList.add(before ? 'drop-before' : 'drop-after');
  });

  grid.addEventListener('drop', async (e) => {
    e.preventDefault();
    if (state.dragFromIndex == null) return;
    const from = state.dragFromIndex;
    const card = e.target.closest('.page-card');
    const order = Array.from({ length: state.current.pages }, (_, i) => i + 1);
    order.splice(order.indexOf(from), 1);
    let insertAt = order.length;
    if (card) {
      const target = Number(card.dataset.page);
      const r = card.getBoundingClientRect();
      const before = (e.clientX - r.left) < r.width / 2;
      insertAt = order.indexOf(target) + (before ? 0 : 1);
    }
    order.splice(insertAt, 0, from);
    state.dragFromIndex = null;
    await mutateAndRefresh('reorder', { order }, 'Pages reordered');
  });

  grid.addEventListener('dragend', () => {
    state.dragFromIndex = null;
    $$('.page-card', grid).forEach(c => c.classList.remove('dragging', 'drop-before', 'drop-after'));
  });
}

async function handleMiniAction(act, page, card) {
  if (act === 'edit') {
    openEditor(page);
  } else if (act === 'delete') {
    if (!confirm(`Delete page ${page}? You can undo this.`)) return;
    await mutateAndRefresh('delete', { pages: [page] }, `Deleted page ${page}`);
  } else if (act === 'rotate') {
    await mutateAndRefresh('rotate', { pages: [page], angle: 90 });
  } else if (act === 'extract') {
    try {
      const r = await opPdf('extract', { pages: [page] });
      saveBlob(new Blob([r.bytes], { type: 'application/pdf' }), `${fileStem()}-page-${page}.pdf`);
      toast(`Extracted page ${page} — download started.`, 'success', 'Extract');
    } catch (err) { toast(err.message, 'error'); }
  } else if (act === 'sign') {
    if (!state.signature) { toast('Create a signature first — it takes ten seconds.', 'info', 'Sign'); activateTool('sign'); return; }
    const wrap = $('.page-img-wrap', card);
    enterPlacementMode();
    placeSignature(wrap, page, 0.5, 0.82, false);
  }
}

/* ═════════════ rail / tools ═════════════ */
function renderRail() {
  $('#rail').innerHTML = TOOLS.map(t => `
    <button class="rail-btn${t.id === state.tool ? ' active' : ''}" data-tool="${t.id}" disabled aria-pressed="${t.id === state.tool}">
      ${svg(t.icon)}<span>${t.label}</span>
    </button>`).join('') + '<div class="rail-foot">Stateless<br>PDF power</div>';
  $('#rail').addEventListener('click', (e) => {
    const btn = e.target.closest('.rail-btn');
    if (!btn || btn.disabled) return;
    activateTool(btn.dataset.tool);
  });
}

function setRailEnabled(on) {
  $$('#rail .rail-btn').forEach(b => { b.disabled = !on; });
}

function activateTool(toolId) {
  exitPlacementMode(true);
  state.tool = toolId;
  $$('#rail .rail-btn').forEach(b => {
    const on = b.dataset.tool === toolId;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', String(on));
  });
  renderPanel(toolId);
}

/* ═════════════ panel ═════════════ */
function renderPanel(tool) {
  const panel = $('#panel');
  const c = state.current;
  if (!c) { panel.innerHTML = '<div class="empty-note">Open a PDF to unlock the toolset.</div>'; return; }
  const fns = {
    organize: panelOrganize, edit: panelEdit, forms: panelForms, sign: panelSign,
    watermark: panelWatermark, protect: panelProtect, metadata: panelMetadata, optimize: panelOptimize,
  };
  panel.innerHTML = (fns[tool] || panelOrganize)(c);
  bindPanel(tool, c);
}

const panelHead = (tool, title, desc) => `
  <div class="panel-title">${svg(iconFor(tool))}${title}</div>
  <p class="panel-desc">${desc}</p>`;

/* ─── ORGANIZE ─── */
function panelOrganize(c) {
  const queueHtml = state.mergeQueue.map((f, i) =>
    `<div class="mini-doc"><span class="md-icon">PDF</span><span class="md-name">${i + 1}. ${escapeHtml(f.name)}</span><span class="md-meta">${fmtBytes(f.size)}</span><button class="mini-btn" data-unqueue="${i}" title="Remove from merge queue">${svg(I.x)}</button></div>`).join('');
  return `
    ${panelHead('organize', 'Organize pages', 'Merge, insert, extract, split and reorder. Drag page thumbnails to rearrange them.')}

    <div class="panel-card">
      <h3><span class="num">1</span>Merge PDFs</h3>
      <label class="check-row"><input type="checkbox" id="mergeIncludeCurrent" checked><span>Include current document<small>“${escapeHtml(c.name)}” merged first</small></span></label>
      <label class="field-label" for="mergeFilePick">Add PDFs to merge in</label>
      <input class="text-input" id="mergeFilePick" type="file" accept="application/pdf,.pdf" multiple />
      <div class="mini-doc-list" id="mergeQueueList">${queueHtml}</div>
      <input class="text-input" id="mergeName" type="text" placeholder="Output name (${escapeHtml(fileStem())}-merged.pdf)" autocomplete="off" />
      <button class="btn-block primary" id="btnMerge" ${state.mergeQueue.length ? '' : 'disabled'}>${svg(I.layers)} Merge into one PDF</button>
      <p class="field-hint">Each PDF must be under ~4 MB. Locked PDFs can’t be used as merge sources.</p>
    </div>

    <div class="panel-card">
      <h3><span class="num">2</span>Insert another PDF</h3>
      <div class="text-row">
        <div>
          <label class="field-label" for="insertFile">Source PDF</label>
          <input class="text-input" id="insertFile" type="file" accept="application/pdf,.pdf" />
        </div>
        <div style="max-width:96px">
          <label class="field-label" for="insertAt">Before page</label>
          <input class="text-input" id="insertAt" type="number" min="1" max="${c.pages + 1}" value="${c.pages + 1}" />
        </div>
      </div>
      <button class="btn-block outline" id="btnInsert">${svg(I.arrowRight)} Insert pages</button>
      <p class="field-hint">The source PDF must be under ~4 MB.</p>
    </div>

    <div class="panel-card">
      <h3><span class="num">3</span>Extract &amp; split</h3>
      <button class="btn-block outline" id="btnExtractSel" ${state.selected.size ? '' : 'disabled'}>${svg(I.extract)} Extract ${state.selected.size || ''} selected page(s)</button>
      <label class="field-label" for="splitRanges" style="margin-top:4px">Split by ranges</label>
      <input class="text-input" id="splitRanges" type="text" placeholder="e.g. 1-3, 5, 8-10" autocomplete="off" spellcheck="false" />
      <button class="btn-block outline" id="btnSplit">${svg(I.scissors)} Split &amp; download .zip</button>
    </div>

    <div class="hint-box">${svg(I.info)}<span>Tip: drag any page thumbnail onto another to reorder. Use the toolbar to rotate, delete or extract selected pages — <strong>Ctrl/Cmd+A</strong> selects everything.</span></div>`;
}


/* ─── EDIT ─── */
function panelEdit(c) {
  return `
    ${panelHead('edit', 'Edit text & images', 'Change any existing text — names, dates, answers, details — or place your own text and PNG/JPEG images anywhere on the page. Everything is baked straight into the PDF on save.')}
    <div class="panel-card">
      <h3><span class="num">1</span>Open the editor</h3>
      <button class="btn-block primary" id="btnOpenEditor">${svg(I.pen)} Edit page 1</button>
      <p class="field-hint">Or click the pencil on any page card. The page opens large with every text line selectable — no Word conversion needed.</p>
    </div>
    <div class="panel-card">
      <h3><span class="num">2</span>Inside the editor</h3>
      <ul class="edit-tips">
        <li>Click existing text and type to replace it</li>
        <li>Empty a line to delete it entirely</li>
        <li>“Add text” — click anywhere on the page to type</li>
        <li>“Add image” — PNG or JPEG: drag, resize, rotate, front or behind</li>
        <li>Font family, size, colour, bold and italic from the toolbar</li>
      </ul>
    </div>
    <div class="hint-box">${svg(I.info)}<span>Works on any PDF, including locked or scanned ones — existing text can be replaced, and new text and images can always sit on top.</span></div>`;
}

/* ─── FORMS ─── */
function panelForms(c) {
  return `
    ${panelHead('forms', 'AcroForm fields', 'Inkwell detected the fillable fields in this document. Type values and apply them in one shot.')}
    <div id="formsContainer"><div class="empty-note"><span class="spinner"></span><br>Reading form fields…</div></div>
    <label class="check-row"><input type="checkbox" id="flattenAfterFill" /><span>Flatten after filling<small>Bake the values into the page — fields can no longer be edited</small></span></label>
    <button class="btn-block primary" id="btnApplyFields">${svg(I.check)} Apply values to PDF</button>`;
}

async function hydrateForms() {
  const box = $('#formsContainer');
  if (!box) return;
  try {
    const { fields } = await postOpJson('fields', {});
    if (!fields.length) {
      box.innerHTML = '<div class="empty-note">No fillable AcroForm fields detected in this PDF.<br>Try the sample document to see forms in action.</div>';
      return;
    }
    box.innerHTML = '<div style="display:flex;flex-direction:column;gap:10px">' + fields.map(f => {
      const head = `<div class="form-field-head"><span class="form-field-name" title="${escapeHtml(f.name)}">${escapeHtml(f.label || f.name)}</span><span class="form-type-tag">${f.type}</span></div>`;
      let control = '';
      if (f.type === 'checkbox') {
        control = `<label class="check-row"><input type="checkbox" data-field="${escapeHtml(f.name)}" ${f.value ? 'checked' : ''}><span>Checked</span></label>`;
      } else if (f.type === 'combobox' || f.type === 'listbox' || f.type === 'radio') {
        const opts = (f.choices || []).map(o => `<option value="${escapeHtml(o)}" ${o === f.value ? 'selected' : ''}>${escapeHtml(o)}</option>`).join('');
        control = `<select class="text-input" data-field="${escapeHtml(f.name)}"><option value="">—</option>${opts}</select>`;
      } else if (f.type === 'signature') {
        control = `<div class="empty-note" style="padding:10px">Signature field —<br>use the <strong>Sign</strong> panel instead.</div>`;
      } else if (f.type === 'button') {
        control = `<div class="empty-note" style="padding:10px">Button field (read-only).</div>`;
      } else {
        control = `<input type="text" class="text-input" data-field="${escapeHtml(f.name)}" value="${escapeHtml(f.value || '')}" autocomplete="off">`;
      }
      return `<div class="form-field">${head}${control}<span class="form-field-page">page ${f.page}</span></div>`;
    }).join('') + '</div>';
  } catch (err) {
    box.innerHTML = `<div class="empty-note">Couldn’t read fields: ${escapeHtml(err.message)}</div>`;
  }
}

/* ─── SIGN ─── */
function panelSign(c) {
  const sig = state.signature;
  return `
    ${panelHead('sign', 'E-sign document', 'Draw with your mouse or trackpad — or type your name in a script face — then stamp it exactly where it belongs.')}
    <div class="panel-card">
      <h3><span class="num">1</span>Your signature</h3>
      ${sig ? `
        <div class="sig-preview-box"><img src="${sig.dataUrl}" alt="Your signature" /></div>
        <div class="text-row">
          <button class="btn-block outline" id="btnChangeSig">${svg(I.pen)} Change</button>
          <button class="btn-block outline" id="btnClearSig">${svg(I.trash)} Remove</button>
        </div>` : `
        <div class="sig-empty">
          <p>No signature saved yet.</p>
          <button class="btn-block primary" id="btnCreateSig">${svg(I.pen)} Create signature</button>
        </div>`}
    </div>
    <div class="panel-card">
      <h3><span class="num">2</span>Stamp it</h3>
      <button class="btn-block primary" id="btnStartPlacing" ${sig ? '' : 'disabled'}>${svg(I.stamp)} Place signature on pages…</button>
      <p class="panel-desc" style="font-size:.72rem">Click any page, drag the signature where it belongs, resize from the corner dot, then confirm with the green check. Nothing is baked in until you confirm.</p>
    </div>
    <div class="hint-box">${svg(I.info)}<span>Your signature is rendered to a transparent PNG and embedded into the page — it looks identical in every PDF viewer.</span></div>`;
}

/* ─── WATERMARK ─── */
function panelWatermark(c) {
  return `
    ${panelHead('watermark', 'Watermark', 'Stamp translucent text diagonally across pages — great for drafts, confidentiality notices and branding.')}
    <div class="panel-card">
      <label class="field-label" for="wmText">Text</label>
      <input class="text-input" id="wmText" type="text" value="CONFIDENTIAL" maxlength="64" autocomplete="off" />
      <label class="field-label" for="wmSize" style="margin-top:6px">Size — <span id="wmSizeOut">54 pt</span></label>
      <div class="slider-row"><input type="range" id="wmSize" min="16" max="140" step="2" value="54"><output id="wmSizeVal">54</output></div>
      <label class="field-label" for="wmOpacity" style="margin-top:6px">Opacity — <span id="wmOpacityOut">16%</span></label>
      <div class="slider-row"><input type="range" id="wmOpacity" min="4" max="60" step="1" value="16"><output id="wmOpacityVal">16%</output></div>
      <label class="field-label" for="wmAngle" style="margin-top:6px">Angle — <span id="wmAngleOut">-45°</span></label>
      <div class="slider-row"><input type="range" id="wmAngle" min="-90" max="90" step="5" value="-45"><output id="wmAngleVal">-45°</output></div>
      <div class="text-row" style="margin-top:6px">
        <div>
          <label class="field-label" for="wmColor">Color</label>
          <input class="text-input" id="wmColor" type="color" value="#8a8f9e" style="padding:4px;height:44px" />
        </div>
        <div style="display:flex;flex-direction:column;justify-content:flex-end">
          <label class="check-row"><input type="checkbox" id="wmTiled" /><span>Tile 3 × 3</span></label>
        </div>
      </div>
      <label class="check-row"><input type="checkbox" id="wmSelectedOnly" /><span>Only the <span id="wmSelCount">${state.selected.size || 0}</span> selected page(s)<small>Uncheck to watermark every page</small></span></label>
      <button class="btn-block primary" id="btnWatermark">${svg(I.watermark)} Apply watermark</button>
    </div>`;
}

/* ─── PROTECT ─── */
function panelProtect(c) {
  if (c.encrypted) {
    return `
      ${panelHead('protect', 'Protect', 'This document is currently encrypted with AES-256.')}
      <div class="panel-card">
        <h3>${svg(I.lock)} Encryption active</h3>
        <p class="panel-desc">Every time this file is opened — here or in any viewer — a password is required. Inkwell remembers yours so your work continues uninterrupted, and every download is encrypted.</p>
        <label class="field-label" for="decryptPw">Password <span style="text-transform:none;font-weight:400">(leave blank to use the stored one)</span></label>
        <input class="text-input" id="decryptPw" type="password" placeholder="Current password" autocomplete="off" />
        <button class="btn-block outline" id="btnDecrypt">${svg(I.unlock)} Remove password</button>
      </div>`;
  }
  return `
    ${panelHead('protect', 'Protect', 'Lock this PDF with AES-256 encryption. Anyone who opens the file anywhere will need the password.')}
    <div class="panel-card">
      <h3><span class="num">1</span>Set a password</h3>
      <label class="field-label" for="encPw">User password <small style="text-transform:none">(required to open)</small></label>
      <input class="text-input" id="encPw" type="password" placeholder="At least 3 characters" autocomplete="new-password" />
      <label class="field-label" for="encPw2" style="margin-top:6px">Confirm password</label>
      <input class="text-input" id="encPw2" type="password" placeholder="Repeat it" autocomplete="new-password" />
      <label class="field-label" for="encOwner" style="margin-top:6px">Owner password <small style="text-transform:none">(optional, for permissions)</small></label>
      <input class="text-input" id="encOwner" type="password" placeholder="Defaults to the user password" autocomplete="new-password" />
      <button class="btn-block primary" id="btnEncrypt">${svg(I.lock)} Encrypt document</button>
      <p class="panel-desc" style="font-size:.7rem">Printing and copying stay allowed. For full lockdown, open the file elsewhere after encryption.</p>
    </div>`;
}

/* ─── METADATA ─── */
function panelMetadata(c) {
  const m = c.metadata || {};
  const v = (k) => escapeHtml(m[k] || '');
  return `
    ${panelHead('metadata', 'Metadata', 'Document properties — what search engines, viewers and archivists see first. Changes apply instantly.')}
    <div class="panel-card">
      <label class="field-label" for="mdTitle">Title</label><input class="text-input" id="mdTitle" value="${v('title')}" autocomplete="off">
      <label class="field-label" for="mdAuthor" style="margin-top:6px">Author</label><input class="text-input" id="mdAuthor" value="${v('author')}" autocomplete="off">
      <label class="field-label" for="mdSubject" style="margin-top:6px">Subject</label><input class="text-input" id="mdSubject" value="${v('subject')}" autocomplete="off">
      <label class="field-label" for="mdKeywords" style="margin-top:6px">Keywords</label><input class="text-input" id="mdKeywords" value="${v('keywords')}" placeholder="comma, separated" autocomplete="off">
      <label class="field-label" for="mdCreator" style="margin-top:6px">Creator</label><input class="text-input" id="mdCreator" value="${v('creator')}" autocomplete="off">
      <label class="field-label" for="mdProducer" style="margin-top:6px">Producer</label><input class="text-input" id="mdProducer" value="${v('producer')}" autocomplete="off">
      <button class="btn-block primary" id="btnSaveMetadata">${svg(I.check)} Save metadata</button>
      <div class="hint-box" style="margin-top:4px">${svg(I.info)}<span>Clearing a field blanks it. “Modified” is updated automatically to now.</span></div>
    </div>`;
}

/* ─── OPTIMIZE ─── */
function panelOptimize(c) {
  return `
    ${panelHead('optimize', 'Optimize & compress', 'Strip unused objects, recompress streams and fonts, and optionally downsample images.')}
    <div class="panel-card">
      <label class="field-label">Current size</label>
      <div class="size-readout"><span class="sz">${fmtBytes(c.size_bytes)}<small> on disk</small></span></div>
      <label class="check-row" style="margin-top:4px"><input type="checkbox" id="optImages" /><span>Aggressively recompress images<small>JPEG re-encode + resample large images to 150 DPI. Best for scans and photo-heavy PDFs.</small></span></label>
      <label class="field-label" for="optQuality" style="margin-top:4px">Image quality — <span id="optQualityOut">72</span></label>
      <div class="slider-row"><input type="range" id="optQuality" min="40" max="95" step="1" value="72"><output id="optQualityVal">72</output></div>
      <button class="btn-block primary" id="btnOptimize">${svg(I.zap)} Optimize now</button>
      <div class="opt-result" id="optResult">
        <div style="font-size:.82rem">Before <b id="optBefore">—</b> → after <b id="optAfter">—</b></div>
        <div class="opt-bar"><div class="opt-bar-fill" id="optBarFill" style="width:0%"></div></div>
        <div style="font-size:.86rem;font-weight:700">Saved <span id="optSaved">0%</span> <span style="color:var(--muted);font-weight:500">(<span id="optSavedBytes">0 KB</span>)</span></div>
      </div>
    </div>
    <div class="hint-box">${svg(I.info)}<span>Optimization is lossless by default (object garbage collection + stream deflate + font subsetting). The pre-optimize version is kept in undo history.</span></div>`;
}

/* ─── bind panel events ─── */
function bindPanel(tool, c) {
  if (tool === 'organize') {
    $('#mergeFilePick')?.addEventListener('change', (e) => {
      for (const f of [...(e.target.files || [])]) {
        if (!/\.pdf$/i.test(f.name)) { toast(`“${f.name}” isn’t a PDF — skipped.`, 'error', 'Merge'); continue; }
        if (f.size > MAX_PDF_BYTES) { toast(`“${f.name}” is over the ~4 MB online limit — skipped.`, 'error', 'Merge'); continue; }
        state.mergeQueue.push(f);
      }
      e.target.value = '';
      renderPanel('organize');
    });
    $('#mergeQueueList')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-unqueue]');
      if (!btn) return;
      state.mergeQueue.splice(Number(btn.dataset.unqueue), 1);
      renderPanel('organize');
    });
    $('#btnMerge')?.addEventListener('click', async (e) => {
      const includeCurrent = $('#mergeIncludeCurrent')?.checked;
      const queue = state.mergeQueue;
      const total = (includeCurrent ? 1 : 0) + queue.length;
      if (total < 2) { toast('Add at least one other PDF to merge.', 'error', 'Merge'); return; }
      const nameRaw = $('#mergeName')?.value.trim();
      const btn = e.currentTarget;
      await withBusy(btn, async () => {
        try {
          const fd = new FormData();
          fd.append('file', new Blob([state.pdfBytes], { type: 'application/pdf' }), state.fileName || 'document.pdf');
          queue.forEach(f => fd.append('others', f, f.name));
          fd.append('params', JSON.stringify(withPw({ include_current: includeCurrent })));
          const res = await fetch('/api/op/merge', { method: 'POST', body: fd });
          if (!res.ok) throw new Error(await errMsg(res));
          const bytes = await res.arrayBuffer();
          const name = (nameRaw || `${fileStem()}-merged.pdf`).replace(/(\.pdf)?$/i, '.pdf');
          state.mergeQueue = [];
          await openBytes(bytes, name, state.password);
          toast(`Merged ${total} PDFs → “${name}”. It’s now the working document — download it when ready.`, 'success', 'Merge');
        } catch (err) { toast(err.message, 'error', 'Merge failed'); }
      })();
    });
    $('#btnInsert')?.addEventListener('click', async () => {
      const f = $('#insertFile')?.files?.[0];
      const at = Number($('#insertAt')?.value || (state.current ? state.current.pages + 1 : 1));
      if (!f) { toast('Choose a source PDF to insert.', 'error'); return; }
      if (!/\.pdf$/i.test(f.name)) { toast('Source must be a PDF.', 'error'); return; }
      if (f.size > MAX_PDF_BYTES) { toast('Source PDF is over the ~4 MB online limit.', 'error'); return; }
      await applyOp('insert', { at }, 'Pages inserted', [['source', f, f.name]]);
    });
    $('#btnExtractSel')?.addEventListener('click', async () => {
      const pages = selectedSorted();
      if (!pages.length) return;
      try {
        const r = await opPdf('extract', { pages });
        saveBlob(new Blob([r.bytes], { type: 'application/pdf' }), `${fileStem()}-extract.pdf`);
        toast(`Extracted ${pages.length} page(s) — download started.`, 'success', 'Extract');
        state.selected.clear();
        syncSelectionUI();
      } catch (err) { toast(err.message, 'error'); }
    });
    $('#btnSplit')?.addEventListener('click', async (e) => {
      const ranges = $('#splitRanges')?.value.trim();
      if (!ranges) { toast('Enter ranges like “1-3, 5, 8-10”.', 'error'); return; }
      const btn = e.currentTarget;
      await withBusy(btn, async () => {
        try {
          const res = await postOp('split', withPw({ ranges }));
          saveBlob(await res.blob(), `${fileStem()}-split.zip`);
          toast('Split archive downloaded.', 'success', 'Split');
        } catch (err) { toast(err.message, 'error', 'Split failed'); }
      })();
    });
  }

  if (tool === 'edit') {
    $('#btnOpenEditor')?.addEventListener('click', () => openEditor(1));
  }

  if (tool === 'forms') {
    hydrateForms();
    $('#btnApplyFields')?.addEventListener('click', async (e) => {
      const values = {};
      $$('#formsContainer [data-field]').forEach(el => {
        const name = el.dataset.field;
        if (el.type === 'checkbox') values[name] = el.checked;
        else values[name] = el.value;
      });
      const flatten = $('#flattenAfterFill')?.checked;
      const btn = e.currentTarget;
      await withBusy(btn, async () => {
        await applyOp('fill', { values, flatten }, flatten ? 'Fields applied and flattened into the pages.' : 'Field values applied.');
      })();
    });
  }

  if (tool === 'sign') {
    $('#btnCreateSig')?.addEventListener('click', openSignatureModal);
    $('#btnChangeSig')?.addEventListener('click', openSignatureModal);
    $('#btnClearSig')?.addEventListener('click', () => {
      state.signature = null;
      localStorage.removeItem('inkwell.signature');
      renderPanel('sign');
      toast('Signature removed.', 'info');
    });
    $('#btnStartPlacing')?.addEventListener('click', () => {
      if (!state.signature) return;
      enterPlacementMode();
      toast('Click the spot on any page where the signature should land.', 'info', 'Place signature');
    });
  }

  if (tool === 'watermark') {
    const bind = (id, out, fmt) => { const el = $(id); if (el) el.addEventListener('input', () => { const o = $(out); if (o) o.textContent = fmt(el.value); }); };
    bind('#wmSize', '#wmSizeVal', v => v); bind('#wmSize', '#wmSizeOut', v => `${v} pt`);
    bind('#wmOpacity', '#wmOpacityVal', v => `${v}%`); bind('#wmOpacity', '#wmOpacityOut', v => `${v}%`);
    bind('#wmAngle', '#wmAngleVal', v => `${v}°`); bind('#wmAngle', '#wmAngleOut', v => `${v}°`);
    $('#btnWatermark')?.addEventListener('click', async (e) => {
      const selectedOnly = $('#wmSelectedOnly')?.checked;
      const pages = selectedOnly ? selectedSorted() : null;
      if (selectedOnly && !pages.length) { toast('No pages selected — uncheck “Only selected” or select pages.', 'error'); return; }
      const btn = e.currentTarget;
      await withBusy(btn, async () => {
        await mutateAndRefresh('watermark', {
          text: $('#wmText').value.trim() || 'CONFIDENTIAL',
          size: Number($('#wmSize').value),
          opacity: Number($('#wmOpacity').value) / 100,
          angle: Number($('#wmAngle').value),
          color: $('#wmColor').value,
          tiled: $('#wmTiled').checked,
          all_pages: !selectedOnly,
          pages: pages || undefined,
        }, 'Watermark applied');
      })();
    });
  }

  if (tool === 'protect') {
    $('#btnEncrypt')?.addEventListener('click', async () => {
      const pw = $('#encPw').value, pw2 = $('#encPw2').value, owner = $('#encOwner').value;
      if (pw.length < 3) { toast('Password must be at least 3 characters.', 'error'); return; }
      if (pw !== pw2) { toast('Passwords don’t match.', 'error'); return; }
      const r = await applyOp('encrypt', { user_password: pw, owner_password: owner || undefined }, 'Document encrypted with AES-256.');
      if (r) { state.password = pw; $('#encPw').value = ''; $('#encPw2').value = ''; $('#encOwner').value = ''; }
    });
    $('#btnDecrypt')?.addEventListener('click', async () => {
      const pw = $('#decryptPw').value;
      if (pw) state.password = pw;   // the password needed to OPEN this document, if any
      const r = await applyOp('decrypt', {}, 'Password removed.');
      if (r) { state.password = null; $('#decryptPw').value = ''; }
    });
  }

  if (tool === 'metadata') {
    $('#btnSaveMetadata')?.addEventListener('click', async () => {
      const body = {
        title: $('#mdTitle').value, author: $('#mdAuthor').value, subject: $('#mdSubject').value,
        keywords: $('#mdKeywords').value, creator: $('#mdCreator').value, producer: $('#mdProducer').value,
      };
      await mutateAndRefresh('metadata', body, 'Metadata saved');
    });
  }

  if (tool === 'optimize') {
    $('#optQuality')?.addEventListener('input', (e) => {
      $('#optQualityVal').textContent = e.target.value;
      $('#optQualityOut').textContent = e.target.value;
    });
    $('#btnOptimize')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      await withBusy(btn, async () => {
        const before = state.pdfBytes ? state.pdfBytes.byteLength : 0;
        const r = await applyOp('optimize', { recompress_images: $('#optImages').checked, image_quality: Number($('#optQuality').value) }, null);
        if (r) {
          const after = r.bytes.byteLength;
          const saved = Math.max(0, before - after);
          const savedPct = before ? Math.round((saved / before) * 100) : 0;
          $('#optBefore').textContent = fmtBytes(before);
          $('#optAfter').textContent = fmtBytes(after);
          $('#optSaved').textContent = `${savedPct}%`;
          $('#optSavedBytes').textContent = fmtBytes(saved);
          $('#optBarFill').style.width = `${Math.min(100, Math.max(3, savedPct))}%`;
          $('#optResult').classList.add('show');
          toast(saved ? `Optimized: saved ${savedPct}% (${fmtBytes(saved)}).` : 'Already as small as we can get it.', 'success', 'Optimize');
        }
      })();
    });
  }
}

/* ═════════════ signature modal ═════════════ */
const SIG_FONTS = [
  { name: 'Casual',  css: "'Segoe Script','Brush Script MT','Lucida Handwriting',cursive" },
  { name: 'Round',   css: "'Snell Roundhand','Apple Chancery','Comic Sans MS',cursive" },
  { name: 'Elegant', css: "Georgia,'Times New Roman',serif", italic: true },
  { name: 'Modern',  css: "'Trebuchet MS','Avenir Next',sans-serif", bold: true },
];
const SIG_INKS = ['#17203a', '#1d3fbe', '#c22e2e', '#0e6e4e'];

const sigState = {
  mode: 'draw',          // 'draw' | 'type'
  drawing: false,
  strokes: [],           // array of {color, width, points: [[x,y], ...]}
  currentStroke: null,
  ink: SIG_INKS[0],
  inkType: SIG_INKS[0],
  strokeWidth: 4,
  fontIdx: 0,
};

function openSignatureModal() {
  $('#sigModal').hidden = false;
  switchSigTab(sigState.mode);
  renderFontCards();
}
const closeSignatureModal = () => { $('#sigModal').hidden = true; };

function switchSigTab(mode) {
  sigState.mode = mode;
  $('#tabDraw').classList.toggle('active', mode === 'draw');
  $('#tabType').classList.toggle('active', mode === 'type');
  $('#paneDraw').classList.toggle('hidden', mode !== 'draw');
  $('#paneType').classList.toggle('hidden', mode !== 'type');
}

/* --- drawing on canvas --- */
function sigCanvasCtx() {
  const canvas = $('#sigCanvas');
  return { canvas, ctx: canvas.getContext('2d') };
}
function canvasPos(e) {
  const { canvas } = sigCanvasCtx();
  const r = canvas.getBoundingClientRect();
  const cx = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
  const cy = (e.touches ? e.touches[0].clientY : e.clientY) - r.top;
  return [cx * (canvas.width / r.width), cy * (canvas.height / r.height)];
}
function redrawSigCanvas() {
  const { canvas, ctx } = sigCanvasCtx();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const s of sigState.strokes) {
    if (s.points.length < 2) { // dot
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.points[0][0], s.points[0][1], s.width / 2, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    ctx.strokeStyle = s.color; ctx.lineWidth = s.width;
    ctx.beginPath();
    ctx.moveTo(s.points[0][0], s.points[0][1]);
    for (let i = 1; i < s.points.length - 1; i++) {
      const mx = (s.points[i][0] + s.points[i + 1][0]) / 2;
      const my = (s.points[i][1] + s.points[i + 1][1]) / 2;
      ctx.quadraticCurveTo(s.points[i][0], s.points[i][1], mx, my);
    }
    const last = s.points[s.points.length - 1];
    ctx.lineTo(last[0], last[1]);
    ctx.stroke();
  }
  $('#canvasPlaceholder').style.opacity = sigState.strokes.length ? '0' : '1';
}
function wireSigCanvas() {
  const canvas = $('#sigCanvas');
  const down = (e) => {
    e.preventDefault();
    sigState.drawing = true;
    const p = canvasPos(e);
    sigState.currentStroke = { color: sigState.ink, width: sigState.strokeWidth * (canvas.width / 520), points: [p] };
    sigState.strokes.push(sigState.currentStroke);
    redrawSigCanvas();
  };
  const move = (e) => {
    if (!sigState.drawing || !sigState.currentStroke) return;
    e.preventDefault();
    sigState.currentStroke.points.push(canvasPos(e));
    redrawSigCanvas();
  };
  const up = () => { sigState.drawing = false; sigState.currentStroke = null; };
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
}
function trimTransparent(canvas) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const img = ctx.getImageData(0, 0, width, height);
  const d = img.data;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (d[(y * width + x) * 4 + 3] > 12) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  const pad = 12;
  minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad); maxY = Math.min(height - 1, maxY + pad);
  const out = document.createElement('canvas');
  out.width = maxX - minX + 1; out.height = maxY - minY + 1;
  out.getContext('2d').drawImage(canvas, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

/* --- typed signature rendering --- */
function renderTypedSignature(name, fontCss, ink, italic, bold) {
  const size = 120;
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const fontStr = `${italic ? 'italic ' : ''}${bold ? '800' : '400'} ${size}px ${fontCss}`;
  ctx.font = fontStr;
  const metrics = ctx.measureText(name);
  const pad = 26;
  c.width = Math.max(2, Math.ceil(metrics.width) + pad * 2);
  c.height = size * 1.9;
  const ctx2 = c.getContext('2d');
  ctx2.font = fontStr;
  ctx2.textBaseline = 'middle';
  ctx2.fillStyle = ink;
  ctx2.fillText(name, pad, c.height / 2);
  return trimTransparent(c) || c;
}
function renderFontCards() {
  const wrap = $('#fontCards');
  const name = $('#sigTypeInput').value.trim() || 'Your Name';
  wrap.innerHTML = SIG_FONTS.map((f, i) => {
    const color = sigState.inkType;
    const style = `font-family:${f.css};color:${color};font-style:${f.italic ? 'italic' : 'normal'};font-weight:${f.bold ? 800 : 400}`;
    return `<button class="font-card${i === sigState.fontIdx ? ' active' : ''}" data-idx="${i}">
      <span class="fc-sig" style="${style}">${escapeHtml(name)}</span>
      <span class="fc-name">${f.name}</span>
    </button>`;
  }).join('');
}

function captureSignaturePng() {
  if (sigState.mode === 'draw') {
    const out = trimTransparent($('#sigCanvas'));
    if (!out) { toast('Draw something first — the canvas is empty.', 'error'); return null; }
    return out;
  }
  const name = $('#sigTypeInput').value.trim();
  if (!name) { toast('Type your name first.', 'error'); return null; }
  const f = SIG_FONTS[sigState.fontIdx];
  return renderTypedSignature(name, f.css, sigState.inkType, f.italic, f.bold);
}

function useSignature() {
  const png = captureSignaturePng();
  if (!png) return;
  const dataUrl = png.toDataURL('image/png');
  state.signature = { dataUrl, aspect: png.height / png.width };
  try { localStorage.setItem('inkwell.signature', JSON.stringify(state.signature)); } catch { /* quota */ }
  closeSignatureModal();
  renderPanel('sign');
  toast('Signature saved — click any page to place it.', 'success', 'Sign');
  enterPlacementMode();
}

/* ═════════════ placement mode ═════════════ */
function enterPlacementMode() {
  if (!state.signature) return;
  state.placement = true;
  document.body.classList.add('placement-armed');
  $('#placeBar').hidden = false;
}
function exitPlacementMode(silent = false) {
  if (!state.placement && $('#placeBar').hidden) return;
  state.placement = false;
  document.body.classList.remove('placement-armed');
  $('#placeBar').hidden = true;
  $$('.sig-overlay').forEach(el => el.remove());
  if (!silent) toast('Placement mode off.', 'info');
}

function placeSignature(wrap, page, fx, fy, replaceExisting = false) {
  if (!state.signature) return;
  if (replaceExisting) $$('.sig-overlay').forEach(el => el.remove());
  const existing = $('.sig-overlay', wrap);
  if (existing) existing.remove();

  const wrapW = wrap.clientWidth;
  let w = Math.round(wrapW * 0.36);
  let h = Math.round(w * state.signature.aspect);
  const overlay = document.createElement('div');
  overlay.className = 'sig-overlay';
  overlay.style.width = `${w}px`;
  overlay.style.height = `${h}px`;
  overlay.style.left = `${Math.min(Math.max(fx * wrapW - w / 2, 0), wrapW - w)}px`;
  overlay.style.top = `${Math.min(Math.max(fy * wrap.clientHeight - h / 2, 0), wrap.clientHeight - h)}px`;
  overlay.innerHTML = `
    <img src="${state.signature.dataUrl}" alt="Signature" />
    <div class="sig-handle" title="Drag to resize"></div>
    <div class="sig-confirm">
      <button class="ok" title="Stamp signature here">${svg(I.check)}</button>
      <button class="cancel" title="Remove this placement">${svg(I.x)}</button>
    </div>`;
  wrap.appendChild(overlay);

  /* drag to move */
  overlay.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.sig-handle') || e.target.closest('.sig-confirm')) return;
    e.preventDefault();
    const startX = e.clientX, startY = e.clientY;
    const origL = overlay.offsetLeft, origT = overlay.offsetTop;
    const move = (ev) => {
      const maxL = wrap.clientWidth - overlay.offsetWidth;
      const maxT = wrap.clientHeight - overlay.offsetHeight;
      overlay.style.left = `${Math.min(Math.max(origL + ev.clientX - startX, 0), maxL)}px`;
      overlay.style.top = `${Math.min(Math.max(origT + ev.clientY - startY, 0), maxT)}px`;
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  });

  /* resize from corner */
  $('.sig-handle', overlay).addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation();
    const startX = e.clientX;
    const origW = overlay.offsetWidth;
    const move = (ev) => {
      const newW = Math.min(Math.max(origW + (ev.clientX - startX), 40), wrap.clientWidth);
      overlay.style.width = `${newW}px`;
      overlay.style.height = `${Math.round(newW * state.signature.aspect)}px`;
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  });

  $('.ok', overlay).addEventListener('click', async (e) => {
    e.stopPropagation();
    const btn = e.currentTarget;
    const all = $('#placeAllPages').checked;
    const body = {
      image_base64: state.signature.dataUrl,
      x: overlay.offsetLeft / wrap.clientWidth,
      y: overlay.offsetTop / wrap.clientHeight,
      width: overlay.offsetWidth / wrap.clientWidth,
      height: overlay.offsetHeight / wrap.clientHeight,
      all_pages: all,
      page: all ? undefined : page,
    };
    await withBusy(btn, async () => {
      try {
        const r = await applyOp('stamp', body, all ? 'Signature stamped on every page.' : `Signature stamped on page ${page}.`);
        if (r) {
          overlay.remove();
          if (all) exitPlacementMode(true);
        }
      } catch (err) { toast(err.message, 'error', 'Stamp failed'); }
    })();
  });
  $('.cancel', overlay).addEventListener('click', (e) => { e.stopPropagation(); overlay.remove(); });
}

/* ═════════════ upload (bytes stay in the browser) ═════════════ */
let pendingPasswordFile = null;

async function handleUpload(file, password) {
  if (!file) return;
  if (!/\.pdf$/i.test(file.name)) { toast('That doesn’t look like a PDF.', 'error', 'Upload'); return; }
  if (file.size > MAX_PDF_BYTES) { toast('That PDF is larger than the ~4 MB limit for the online edition. The desktop build has no size cap.', 'error', 'Too large'); return; }
  let bytes;
  try { bytes = await file.arrayBuffer(); }
  catch { toast('Couldn’t read the file.', 'error', 'Upload'); return; }
  try {
    const info = await fetchInfo(bytes, file.name, password);   // also our password check
    await openBytes(bytes, file.name, password, info);
    toast(`“${file.name}” opened — ${info.pages} page(s).`, 'success', 'Upload');
    pendingPasswordFile = null;
    $('#pwModal').hidden = true;
  } catch (err) {
    if (!password && /password/i.test(err.message)) {
      pendingPasswordFile = file;
      $('#pwFileName').textContent = file.name;
      $('#pwError').hidden = true;
      $('#pwInput').value = '';
      $('#pwModal').hidden = false;
      setTimeout(() => $('#pwInput').focus(), 60);
      return;
    }
    toast(err.message, 'error', password ? 'Unlock failed' : 'Upload failed');
    if (password) { $('#pwError').textContent = err.message; $('#pwError').hidden = false; }
  }
}

/* ═════════════ wiring ═════════════ */
function wireTopbar() {
  $('#btnNewDoc').addEventListener('click', closeToEmpty);
  $('#btnUndo').addEventListener('click', doUndo);
  $('#btnDeleteDoc').addEventListener('click', () => {
    if (!state.current) return;
    if (!confirm(`Close “${state.current.name}” and discard it?\nAny edits you haven’t downloaded will be lost.`)) return;
    toast('Document closed.', 'info');
    closeToEmpty();
  });
  $('#btnDownload').addEventListener('click', () => {
    if (!state.pdfBytes) return;
    const name = /\.pdf$/i.test(state.fileName) ? state.fileName : `${state.fileName}.pdf`;
    saveBlob(new Blob([state.pdfBytes], { type: 'application/pdf' }), name);
  });

  /* inline rename on double-click */
  const nameEl = $('#docChipName');
  nameEl.addEventListener('dblclick', () => {
    if (!state.current) return;
    nameEl.contentEditable = 'true';
    nameEl.focus();
    const range = document.createRange(); range.selectNodeContents(nameEl);
    const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
  });
  const commitRename = async () => {
    if (nameEl.contentEditable !== 'true') return;
    nameEl.contentEditable = 'false';
    const v = nameEl.textContent.trim();
    if (!v || v === state.current?.name) { updateDocChrome(); return; }
    const name = /\.pdf$/i.test(v) ? v : `${v}.pdf`;
    state.fileName = name;
    if (state.current) state.current.name = name;
    updateDocChrome();
    toast(`Renamed to “${name}”.`, 'success');
  };
  nameEl.addEventListener('blur', commitRename);
  nameEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); nameEl.blur(); }
    else if (e.key === 'Escape') { nameEl.contentEditable = 'false'; updateDocChrome(); }
  });
}

function wireEmptyState() {
  const dz = $('#dropzone');
  const input = $('#fileInput');
  dz.addEventListener('click', () => input.click());
  dz.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
  input.addEventListener('change', () => { if (input.files[0]) handleUpload(input.files[0]); input.value = ''; });
  $('#btnBrowse').addEventListener('click', (e) => { e.stopPropagation(); input.click(); });
  $('#btnSample').addEventListener('click', async (e) => {
    e.stopPropagation();
    const btn = e.currentTarget;
    await withBusy(btn, async () => {
      try {
        const res = await fetch('/api/op/sample', { method: 'POST' });
        if (!res.ok) throw new Error(await errMsg(res));
        const bytes = await res.arrayBuffer();
        await openBytes(bytes, 'Inkwell Sample.pdf', null);
        toast('Sample document ready — check page 2 for the live form.', 'success', 'Sample');
      } catch (err) { toast(err.message, 'error'); }
    })();
  });

  ['dragover', 'dragenter'].forEach(evt => dz.addEventListener(evt, (e) => { e.preventDefault(); dz.classList.add('drag-over'); }));
  ['dragleave', 'drop'].forEach(evt => dz.addEventListener(evt, (e) => { e.preventDefault(); dz.classList.remove('drag-over'); }));
  dz.addEventListener('drop', (e) => { const f = e.dataTransfer?.files?.[0]; if (f) handleUpload(f); });

  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('drop', (e) => e.preventDefault());

}

function wireToolbar() {
  $('#btnZoomOut').addEventListener('click', () => stepZoom(-1));
  $('#btnZoomIn').addEventListener('click', () => stepZoom(1));
  $('#zoomLabel').addEventListener('click', resetZoomToFit);
  $('#btnZoomFit').addEventListener('click', resetZoomToFit);
  $('#checkAll').addEventListener('change', (e) => {
    const n = state.current?.pages || 0;
    state.selected = e.target.checked ? new Set(Array.from({ length: n }, (_, i) => i + 1)) : new Set();
    syncSelectionUI();
  });
  $('#btnRotateCCW').addEventListener('click', () => rotateSelected(-90));
  $('#btnRotateCW').addEventListener('click', () => rotateSelected(90));
  $('#btnDeletePages').addEventListener('click', async () => {
    const pages = selectedSorted();
    if (!pages.length) return;
    if (!confirm(`Delete ${pages.length} page(s)? You can undo this.`)) return;
    const ok = await mutateAndRefresh('delete', { pages }, `Deleted ${pages.length} page(s)`);
    if (ok) { state.selected.clear(); syncSelectionUI(); }
  });
  $('#btnExtractPages').addEventListener('click', async () => {
    const pages = selectedSorted();
    if (!pages.length) return;
    try {
      const r = await opPdf('extract', { pages });
      saveBlob(new Blob([r.bytes], { type: 'application/pdf' }), `${fileStem()}-extract.pdf`);
      toast(`Extracted ${pages.length} page(s) — download started.`, 'success', 'Extract');
      state.selected.clear();
      syncSelectionUI();
    } catch (err) { toast(err.message, 'error'); }
  });
}
async function rotateSelected(angle) {
  const pages = selectedSorted();
  if (!pages.length) return;
  await mutateAndRefresh('rotate', { pages, angle });
}

function wirePanelAndModals() {
  /* signature modal */
  $('#sigClose').addEventListener('click', closeSignatureModal);
  $('#sigCancel').addEventListener('click', closeSignatureModal);
  $('#sigModal').addEventListener('click', (e) => { if (e.target.id === 'sigModal') closeSignatureModal(); });
  $('#tabDraw').addEventListener('click', () => switchSigTab('draw'));
  $('#tabType').addEventListener('click', () => switchSigTab('type'));
  $('#sigClear').addEventListener('click', () => { sigState.strokes = []; redrawSigCanvas(); });
  $('#strokeWidth').addEventListener('input', (e) => { sigState.strokeWidth = Number(e.target.value); });
  $('#sigTypeInput').addEventListener('input', renderFontCards);
  $('#fontCards').addEventListener('click', (e) => {
    const card = e.target.closest('.font-card');
    if (!card) return;
    sigState.fontIdx = Number(card.dataset.idx);
    renderFontCards();
  });
  $('#inkColors').addEventListener('click', (e) => {
    const dot = e.target.closest('.ink-dot'); if (!dot) return;
    sigState.ink = dot.dataset.color;
    $$('#inkColors .ink-dot').forEach(d => d.classList.toggle('active', d === dot));
  });
  $('#inkColorsType').addEventListener('click', (e) => {
    const dot = e.target.closest('.ink-dot'); if (!dot) return;
    sigState.inkType = dot.dataset.color;
    $$('#inkColorsType .ink-dot').forEach(d => d.classList.toggle('active', d === dot));
    renderFontCards();
  });
  $('#sigUse').addEventListener('click', useSignature);

  /* password modal */
  $('#pwCancel').addEventListener('click', () => { $('#pwModal').hidden = true; pendingPasswordFile = null; });
  $('#pwModal').addEventListener('click', (e) => { if (e.target.id === 'pwModal') { $('#pwModal').hidden = true; pendingPasswordFile = null; } });
  $('#pwSubmit').addEventListener('click', () => { const f = pendingPasswordFile; if (f) handleUpload(f, $('#pwInput').value); });
  $('#pwInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#pwSubmit').click(); });

  /* placement bar */
  $('#placeDone').addEventListener('click', () => exitPlacementMode());
}

function wireKeyboard() {
  document.addEventListener('keydown', (e) => {
    const inField = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'z' && !inField) { e.preventDefault(); $('#btnUndo').click(); return; }
    if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); $('#btnDownload').click(); return; }
    if (mod && (e.key === '=' || e.key === '+')) { e.preventDefault(); stepZoom(1); return; }
    if (mod && (e.key === '-' || e.key === '_')) { e.preventDefault(); stepZoom(-1); return; }
    if (mod && e.key === '0') { e.preventDefault(); resetZoomToFit(); return; }
    if (mod && e.key.toLowerCase() === 'a' && state.pdfBytes && !inField) {
      e.preventDefault();
      state.selected = new Set(Array.from({ length: state.current.pages }, (_, i) => i + 1));
      syncSelectionUI();
      return;
    }
    if (e.key === 'Escape') {
      if (!$('#sigModal').hidden) return closeSignatureModal();
      if (!$('#pwModal').hidden) { $('#pwModal').hidden = true; pendingPasswordFile = null; return; }
      if (state.placement) return exitPlacementMode();
      if (state.selected.size) { state.selected.clear(); syncSelectionUI(); }
      return;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && !inField && state.selected.size) {
      e.preventDefault(); $('#btnDeletePages').click();
    }
  });
}

/* ═════════════ init ═════════════ */
function restoreSavedSignature() {
  try {
    const raw = localStorage.getItem('inkwell.signature');
    if (raw) {
      const sig = JSON.parse(raw);
      if (sig && sig.dataUrl) state.signature = sig;
    }
  } catch { /* ignore */ }
}

restoreSavedSignature();
renderRail();
wireTopbar();
wireEmptyState();
wireToolbar();
wirePanelAndModals();
wireKeyboard();
wireSigCanvas();
redrawSigCanvas();
wirePagesGrid();
renderPanel('organize');
applyViewZoom();

/* ═════════════ inline PDF editor — edit text, drop images ═════════════ */
const INKWELL_EDITION = 'online';

async function edFetchPageText(page) {
  if (INKWELL_EDITION === 'local') return api(`/api/documents/${state.currentId}/pages/${page}/text`);
  return postOpJson('page-text', { page });   // password already merged by postOpJson
}
async function edPageImageSrc(page, zoom) {
  if (INKWELL_EDITION === 'local') return `/api/documents/${state.currentId}/pages/${page}/image?zoom=${zoom}&v=${Date.now()}`;
  const res = await postOp('page-image', withPw({ page, zoom }));
  const url = URL.createObjectURL(await res.blob());
  state.objectUrls.push(url);
  return url;
}
async function edApplyEdits(edits) {
  if (INKWELL_EDITION === 'local') {
    await api(`/api/documents/${state.currentId}/edits`, { method: 'POST', body: { edits } });
    await refreshCurrent();
    try { await refreshDocs(); } catch { /* dock unavailable — fine */ }
    toast('Changes saved — everything is baked into the PDF.', 'success', 'Editor');
    return true;
  }
  return applyOp('apply-edits', { edits }, 'Changes saved — everything is baked into the PDF.');
}

const EDITOR = { page: 1, pageW: 595, pageH: 842, scale: 1, imageZoom: 1.6, mode: 'select',
                 dirty: false, selected: null, pendingDeletes: [], spans: [], bgSample: null };
const ED = {};
function edCache() {
  if (!ED.overlay) {
    ED.overlay = $('#editorOverlay'); ED.stage = $('#editorStage'); ED.pageEl = $('#editorPage');
    ED.img = $('#editorPageImg');    ED.layer = $('#editorLayer');
  }
  return ED;
}
const edRound2 = (n) => Math.round(n * 100) / 100;
const edPages = () => (state.current ? state.current.pages : 1);

async function openEditor(page) {
  if (!state.current) { toast('Open a PDF first.', 'info'); return; }
  edCache();
  EDITOR.pendingDeletes = []; EDITOR.dirty = false; EDITOR.selected = null;
  ED.overlay.classList.remove('hidden');
  document.body.classList.add('editor-open');
  await edRenderPage(page || 1);
}
function closeEditor() {
  if (EDITOR.dirty && !confirm('Discard unapplied changes on this page?')) return;
  const o = edCache().overlay;
  o.classList.add('hidden');
  document.body.classList.remove('editor-open');
  ED.layer.innerHTML = '';
  EDITOR.dirty = false; EDITOR.pendingDeletes = []; EDITOR.selected = null;
  edSetMode('select');
}

async function edRenderPage(page) {
  const pages = edPages();
  page = Math.min(Math.max(1, Number(page) || 1), pages);
  EDITOR.page = page; EDITOR.dirty = false; EDITOR.pendingDeletes = []; EDITOR.selected = null;
  $('#edPageNum').textContent = page;
  $('#edPageTotal').textContent = '/ ' + pages;
  $('#edPrev').disabled = page <= 1;
  $('#edNext').disabled = page >= pages;
  edCache();
  const img = ED.img;
  img.style.visibility = 'hidden';
  ED.layer.innerHTML = '';
  try {
    const [imgSrc, data] = await Promise.all([
      edPageImageSrc(page, EDITOR.imageZoom),
      edFetchPageText(page),
    ]);
    EDITOR.pageW = data.page_width; EDITOR.pageH = data.page_height;
    EDITOR.spans = data.spans || [];
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('The page image failed to load.'));
      img.src = imgSrc;
    });
    img.style.visibility = 'visible';
    EDITOR.bgSample = edMakeBgSampler(img);
    edLayout();
    edBuildTextLines();
    edSelect(null);
    $('#editorHint').textContent = EDITOR.spans.length
      ? 'Click any existing text and type to replace it — or use “Add text” to click anywhere and type anew.'
      : 'No text layer on this page (scanned?) — use “Add text” to type on top, or “Add image”.';
  } catch (err) {
    toast(err.message || String(err), 'error');
    closeEditor();
  }
}

function edLayout() {
  const stage = ED.stage, img = ED.img;
  if (!stage || !img) return;
  const natW = EDITOR.pageW * EDITOR.imageZoom, natH = EDITOR.pageH * EDITOR.imageZoom;
  const availW = Math.max(140, stage.clientWidth - 44);
  const availH = Math.max(140, stage.clientHeight - 44);
  const w = Math.max(140, Math.floor(Math.min(availW, natW, (availH * natW) / natH)));
  EDITOR.scale = w / EDITOR.pageW;
  img.style.width = w + 'px';
  ED.pageEl.style.width = w + 'px';
  $$('.text-line, .text-add', ED.layer).forEach(positionTextOverlay);
  $$('.img-overlay', ED.layer).forEach(positionImageOverlay);
}

/* ── text overlays (existing lines) ── */
function positionTextOverlay(el) {
  const s = EDITOR.scale;
  if (el.dataset.kind === 'line') {
    const rect = JSON.parse(el.dataset.rect);
    if (el._mask) {
      Object.assign(el._mask.style, {
        left: rect[0] * s - 2 + 'px',
        top: rect[1] * s - 2.5 + 'px',
        width: (rect[2] - rect[0]) * s + 4 + 'px',
        height: (rect[3] - rect[1]) * s + 5 + 'px',
      });
    }
    const base = Math.max(24, (rect[2] - rect[0]) * s + 6);
    Object.assign(el.style, {
      left: rect[0] * s + 'px',
      top: rect[1] * s - 1 + 'px',
      height: Math.max(14, (rect[3] - rect[1]) * s + 3) + 'px',
      fontSize: Number(el.dataset.size) * s + 'px',
    });
    el.style.lineHeight = el.style.height;
    edAutosizeLine(el);
  } else {
    const pt = JSON.parse(el.dataset.point);
    const fs = Number(el.dataset.size) * s;
    el.style.fontSize = fs + 'px';
    el.style.left = pt[0] * s + 'px';
    el.style.top = (pt[1] - Number(el.dataset.size)) * s + 'px';
    el.style.height = fs * 1.4 + 'px';
    el.style.lineHeight = fs * 1.4 + 'px';
    el.style.width = Math.max(8, (el.value || '').length + 2) + 'ch';
  }
}
/* measure with the same font the overlay paints — exact width, no guessing */
const _measureCtx = (typeof document !== 'undefined' && document.createElement)
  ? document.createElement('canvas').getContext('2d') : null;
function edTextWidth(el) {
  const s = EDITOR.scale;
  const size = Number(el.dataset.size || 12) * s;
  const weight = el.dataset.bold === '1' ? '700' : '400';
  const style = el.dataset.italic === '1' ? 'italic ' : '';
  const fam = ({ sans: "'Helvetica Neue', Helvetica, Arial, sans-serif",
                 serif: "Georgia, 'Times New Roman', serif",
                 mono: "'Courier New', ui-monospace, monospace" })[el.dataset.family || 'sans'];
  if (_measureCtx) {
    _measureCtx.font = `${style}${weight} ${size}px ${fam}`;
    return _measureCtx.measureText(el.value || '').width;
  }
  return (el.value || '').length * size * 0.56;
}
function edAutosizeLine(el) {
  const s = EDITOR.scale;
  const rect = JSON.parse(el.dataset.rect);
  const base = Math.max(24, (rect[2] - rect[0]) * s + 6);
  const need = Math.ceil(edTextWidth(el) + 16);
  el.style.width = Math.ceil(Math.min(ED.pageEl.clientWidth, Math.max(base, need))) + 'px';
}
/* sample the rendered page behind each text line so the editor mask blends in —
   white pages get white masks, coloured banners (e.g. white-on-red headers) get
   their real colour, so overlay text stays legible everywhere */
function edMakeBgSampler(img) {
  try {
    const c = document.createElement('canvas');
    c.width = Math.max(1, img.naturalWidth || 1);
    c.height = Math.max(1, img.naturalHeight || 1);
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return { ctx, w: c.width, h: c.height };
  } catch { return null; }
}
function edSampleBg(rect) {
  const S = EDITOR.bgSample;
  if (!S) return '#ffffff';
  try {
    const kx = S.w / EDITOR.pageW, ky = S.h / EDITOR.pageH;
    const x0 = Math.max(0, Math.floor(rect[0] * kx));
    const x1 = Math.min(S.w - 1, Math.ceil(rect[2] * kx));
    const rows = [Math.max(0, Math.floor(rect[1] * ky) - 4), Math.min(S.h - 1, Math.ceil(rect[3] * ky) + 4)];
    const pts = [];
    for (const yy of rows) {
      const span = Math.max(0, x1 - x0);
      const step = Math.max(1, Math.floor(span / 12));
      for (let x = x0; x <= x1; x += step) {
        const d = S.ctx.getImageData(x, yy, 1, 1).data;
        pts.push([d[0], d[1], d[2]]);
      }
    }
    if (!pts.length) return '#ffffff';
    pts.sort((a, b) => (a[0] + a[1] + a[2]) - (b[0] + b[1] + b[2]));
    const m = pts[pts.length >> 1];
    return `rgb(${m[0]},${m[1]},${m[2]})`;
  } catch { return '#ffffff'; }
}
function edBuildTextLines() {
  const frag = document.createDocumentFragment();
  for (const span of EDITOR.spans) {
    const mask = document.createElement('div');
    mask.className = 'line-mask';
    mask.style.background = edSampleBg(span.rect);
    frag.appendChild(mask);
    const el = document.createElement('input');
    el.type = 'text';
    el.spellcheck = false; el.autocomplete = 'off';
    const spanFam = edNormFamily(span.family);
    el.className = 'text-line f-' + spanFam + (span.bold ? ' bold' : '') + (span.italic ? ' italic' : '');
    el.value = span.text;
    el.dataset.kind = 'line';
    el.dataset.orig = span.text;
    el.dataset.rect = JSON.stringify(span.rect);
    el.dataset.origin = JSON.stringify(span.origin);
    el.dataset.size = span.size; el.dataset.color = span.color; el.dataset.family = spanFam;
    el.dataset.bold = span.bold ? '1' : '0'; el.dataset.italic = span.italic ? '1' : '0';
    if (span.color) el.style.color = span.color;
    el._mask = mask;
    el.addEventListener('input', () => { EDITOR.dirty = true; el.dataset.changed = '1'; edAutosizeLine(el); });
    el.addEventListener('focus', () => edSelect(el));
    el.addEventListener('pointerdown', () => edSelect(el));
    frag.appendChild(el);
  }
  ED.layer.appendChild(frag);
  $$('.text-line', ED.layer).forEach(positionTextOverlay);
}

/* ── selection + toolbar ── */
const edLegacyFamilyMap = { sans: 'helvetica', serif: 'times-new-roman', mono: 'courier-new' };
function edNormFamily(fam) {
  const f = (fam || '').toLowerCase().trim();
  if (!f) return 'helvetica';
  return edLegacyFamilyMap[f] || f;
}
const ED_PREVIEW_TEXT = {
  // Farrington 7B has no letters — preview the MICR symbols instead of tofu boxes
  'farrington-7b': '0123456789 \u00A7\u00A9\u00C6\u00DF\u2202',
  'micr-cmc-7': 'CMC-7 0123 \u00A7\u00A9\u00C6\u00DF',
};
function edUpdateFontPreview(fam) {
  const p = $('#edFontPreview');
  if (!p) return;
  const key = edNormFamily(fam);
  p.className = 'ed-font-preview f-' + key;
  p.textContent = ED_PREVIEW_TEXT[key] || 'AaBb Gg 0123';
}
function edSelect(el) {
  EDITOR.selected = el || null;
  $$('.text-line, .text-add, .img-overlay', ED.layer).forEach(x => x.classList.toggle('selected', x === el));
  edSyncToolbar();
}
function edSyncToolbar() {
  const el = EDITOR.selected;
  const textSel = !!el && (el.dataset.kind === 'line' || el.dataset.kind === 'add');
  const imgSel = !!el && el.dataset.kind === 'image';
  $('#edTextTools').hidden = !textSel;
  $('#edImageTools').hidden = !imgSel;
  $('#edDelete').disabled = !el;
  if (textSel) {
    $('#edFontSize').value = Math.round(Number(el.dataset.size) || 12);
    $('#edColor').value = /^#[0-9a-f]{6}$/i.test(el.dataset.color || '') ? el.dataset.color : '#111111';
    $('#edFontFamily').value = edNormFamily(el.dataset.family);
    edUpdateFontPreview(el.dataset.family);
    $('#edBold').classList.toggle('active', el.dataset.bold === '1');
    $('#edItalic').classList.toggle('active', el.dataset.italic === '1');
  }
  if (imgSel) $('#edLayer').textContent = el.dataset.behind === '1' ? 'Send in front' : 'Send behind text';
}
function edApplyTextStyle(key, value) {
  const el = EDITOR.selected;
  if (!el || el.dataset.kind === 'image') return;
  if (key === 'size') el.dataset.size = value;
  else if (key === 'color') { el.dataset.color = value; el.style.color = value; }
  else if (key === 'family') {
    const fam = edNormFamily(value);
    el.dataset.family = fam;
    el.className = el.className.split(/\s+/).filter(c => c && !c.startsWith('f-')).join(' ') + ' f-' + fam;
    edUpdateFontPreview(fam);
  } else return;
  EDITOR.dirty = true; el.dataset.changed = '1';
  positionTextOverlay(el);
}
function edToggleStyle(key) {
  const el = EDITOR.selected;
  if (!el || el.dataset.kind === 'image') return;
  const on = el.dataset[key] === '1';
  el.dataset[key] = on ? '0' : '1';
  el.classList.toggle(key, !on);
  EDITOR.dirty = true; el.dataset.changed = '1';
  $('#edBold').classList.toggle('active', el.dataset.bold === '1');
  $('#edItalic').classList.toggle('active', el.dataset.italic === '1');
}
function edDeleteSelected() {
  const el = EDITOR.selected;
  if (!el) return;
  if (el.dataset.kind === 'line') {
    EDITOR.pendingDeletes.push({
      type: 'line', page: EDITOR.page,
      rect: JSON.parse(el.dataset.rect), origin: JSON.parse(el.dataset.origin),
      text: '', size: Number(el.dataset.size) || 11,
    });
  }
  if (el._mask && el._mask.remove) el._mask.remove();
  el.remove();
  EDITOR.dirty = true;
  edSelect(null);
}

/* ── mode segmented control ── */
function edSetMode(mode) {
  EDITOR.mode = mode;
  $$('.ed-mode').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  const hints = {
    select: 'Click any text on the page and type to replace it — or use “Add text” to click anywhere and type anew.',
    addtext: 'Click anywhere on the page to place a new text box, then type. Size, colour, font and styles follow the toolbar.',
    addimage: 'Choose a PNG or JPEG, then drag it around, resize from the corner dot, rotate it from the toolbar, and set front or behind.',
  };
  $('#editorHint').textContent = hints[mode] || hints.select;
  edCache().stage.dataset.mode = mode;
  if (mode === 'addimage') $('#editorImageInput').click();
}

/* ── stage interactions ── */
function edStagePointerDown(e) {
  const t = e.target;
  if (t.closest('.img-overlay') || t.closest('.text-line') || t.closest('.text-add')) return;
  if (EDITOR.mode === 'addtext') {
    const layerRect = ED.layer.getBoundingClientRect();
    const x = (e.clientX - layerRect.left) / EDITOR.scale;
    const y = (e.clientY - layerRect.top) / EDITOR.scale;
    if (x < 0 || y < 0 || x > EDITOR.pageW || y > EDITOR.pageH) return;
    const el = document.createElement('input');
    el.type = 'text'; el.spellcheck = false; el.autocomplete = 'off'; el.placeholder = 'Type…';
    el.className = 'text-add f-helvetica';
    el.dataset.kind = 'add';
    el.dataset.point = JSON.stringify([edRound2(x), edRound2(y)]);
    el.dataset.size = 16; el.dataset.color = '#111111'; el.dataset.family = 'helvetica';
    el.dataset.bold = '0'; el.dataset.italic = '0';
    el.style.color = '#111111';
    el.addEventListener('input', () => { EDITOR.dirty = true; positionTextOverlay(el); });
    el.addEventListener('focus', () => edSelect(el));
    el.addEventListener('pointerdown', () => edSelect(el));
    ED.layer.appendChild(el);
    positionTextOverlay(el);
    EDITOR.dirty = true;
    edSelect(el);
    edSetMode('select');
    setTimeout(() => el.focus(), 0);
    return;
  }
  if (EDITOR.mode === 'select') edSelect(null);
}

/* ── images ── */
function fileToDataUrl(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(new Error('Couldn’t read that image.'));
    r.readAsDataURL(file);
  });
}
async function edImagePicked(e) {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;
  if (!/^image\/(png|jpeg)$/.test(file.type)) { toast('Please choose a PNG or JPEG image.', 'error'); return; }
  if (file.size > 2_000_000) { toast('Images must be under ~2 MB.', 'error'); return; }
  try { edAddImageOverlay(await fileToDataUrl(file)); }
  catch (err) { toast(err.message, 'error'); }
}
function edAddImageOverlay(dataUrl) {
  const img = new Image();
  img.onload = () => {
    const w = EDITOR.pageW * 0.4;
    const h = w * (img.naturalHeight / Math.max(1, img.naturalWidth));
    const el = document.createElement('div');
    el.className = 'img-overlay';
    el.dataset.kind = 'image';
    el.dataset.x = edRound2((EDITOR.pageW - w) / 2);
    el.dataset.y = edRound2((EDITOR.pageH - h) / 2);
    el.dataset.w = edRound2(w); el.dataset.h = edRound2(h);
    el.dataset.rotation = 0; el.dataset.behind = '0';
    el.dataset.b64 = dataUrl;
    el.innerHTML = '<img alt="Placed image" /><div class="img-handle" title="Resize"></div><div class="img-badge front">Front</div>';
    $('img', el).src = dataUrl;
    wireImageOverlay(el);
    ED.layer.appendChild(el);
    positionImageOverlay(el);
    edSelect(el);
    EDITOR.dirty = true;
    edSetMode('select');
    toast('Drag to move, corner dot to resize, toolbar to rotate or send behind text.', 'info', 'Image added');
  };
  img.onerror = () => toast('That image could not be opened.', 'error');
  img.src = dataUrl;
}
function positionImageOverlay(el) {
  const s = EDITOR.scale;
  Object.assign(el.style, {
    left: Number(el.dataset.x) * s + 'px',
    top: Number(el.dataset.y) * s + 'px',
    width: Number(el.dataset.w) * s + 'px',
    height: Number(el.dataset.h) * s + 'px',
  });
  el.style.transform = 'rotate(' + Number(el.dataset.rotation || 0) + 'deg)';
}
function wireImageOverlay(el) {
  el.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.img-handle')) return;
    edSelect(el);
    e.preventDefault();
    const startX = e.clientX, startY = e.clientY;
    const origX = Number(el.dataset.x), origY = Number(el.dataset.y);
    const move = (ev) => {
      el.dataset.x = edRound2(origX + (ev.clientX - startX) / EDITOR.scale);
      el.dataset.y = edRound2(origY + (ev.clientY - startY) / EDITOR.scale);
      positionImageOverlay(el);
      EDITOR.dirty = true;
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  });
  $('.img-handle', el).addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation();
    edSelect(el);
    const startX = e.clientX, startY = e.clientY;
    const origW = Number(el.dataset.w), origH = Number(el.dataset.h);
    const move = (ev) => {
      el.dataset.w = edRound2(Math.max(8, origW + (ev.clientX - startX) / EDITOR.scale));
      el.dataset.h = edRound2(Math.max(8, origH + (ev.clientY - startY) / EDITOR.scale));
      positionImageOverlay(el);
      EDITOR.dirty = true;
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  });
}
function edRotateSelected(deg) {
  const el = EDITOR.selected;
  if (!el || el.dataset.kind !== 'image') return;
  el.dataset.rotation = (Number(el.dataset.rotation || 0) + deg) % 360;
  el.style.transform = 'rotate(' + el.dataset.rotation + 'deg)';
  EDITOR.dirty = true;
}
function edToggleLayer() {
  const el = EDITOR.selected;
  if (!el || el.dataset.kind !== 'image') return;
  const behind = el.dataset.behind === '1';
  el.dataset.behind = behind ? '0' : '1';
  el.classList.toggle('behind', !behind);
  const badge = $('.img-badge', el);
  badge.textContent = behind ? 'Front' : 'Behind text';
  badge.classList.toggle('front', behind);
  badge.classList.toggle('behind-badge', !behind);
  $('#edLayer').textContent = behind ? 'Send behind text' : 'Send in front';
  EDITOR.dirty = true;
}

/* ── apply everything ── */
async function edApply() {
  const ops = [];
  $$('.text-line', ED.layer).forEach(el => {
    if (el.dataset.changed !== '1' && el.value === el.dataset.orig) return;
    ops.push({
      type: 'line', page: EDITOR.page,
      rect: JSON.parse(el.dataset.rect), origin: JSON.parse(el.dataset.origin),
      text: el.value, size: Number(el.dataset.size), color: el.dataset.color,
      family: el.dataset.family, bold: el.dataset.bold === '1', italic: el.dataset.italic === '1',
    });
  });
  $$('.text-add', ED.layer).forEach(el => {
    if (!el.value.trim()) return;
    ops.push({
      type: 'text', page: EDITOR.page, point: JSON.parse(el.dataset.point),
      text: el.value, size: Number(el.dataset.size), color: el.dataset.color,
      family: el.dataset.family, bold: el.dataset.bold === '1', italic: el.dataset.italic === '1',
    });
  });
  $$('.img-overlay', ED.layer).forEach(el => {
    const x = Number(el.dataset.x), y = Number(el.dataset.y);
    ops.push({
      type: 'image', page: EDITOR.page,
      rect: [edRound2(x), edRound2(y), edRound2(x + Number(el.dataset.w)), edRound2(y + Number(el.dataset.h))],
      rotation: Number(el.dataset.rotation || 0), behind: el.dataset.behind === '1',
      image_b64: el.dataset.b64,
    });
  });
  ops.push(...EDITOR.pendingDeletes);
  if (!ops.length) { toast('No changes to save on this page.', 'info'); return; }
  const btn = $('#edApply');
  btn.disabled = true;
  try {
    const ok = await edApplyEdits(ops);
    if (ok) { EDITOR.dirty = false; closeEditor(); }
  } finally {
    btn.disabled = false;
  }
}
function edKeydown(e) {
  const overlay = $('#editorOverlay');
  if (!overlay || overlay.classList.contains('hidden')) return;
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key === 'Enter') { e.preventDefault(); edApply(); return; }
  if (e.key === 'Escape') { e.preventDefault(); closeEditor(); return; }
  if ((e.key === 'Delete' || e.key === 'Backspace') && EDITOR.selected) {
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) return;   // typing in a text field
    e.preventDefault();
    edDeleteSelected();
  }
}
function wireEditor() {
  edCache();
  $('#edClose').addEventListener('click', closeEditor);
  $('#edCancel').addEventListener('click', closeEditor);
  $('#edApply').addEventListener('click', edApply);
  $('#edPrev').addEventListener('click', () => edRenderPage(EDITOR.page - 1));
  $('#edNext').addEventListener('click', () => edRenderPage(EDITOR.page + 1));
  $$('.ed-mode').forEach(btn => btn.addEventListener('click', () => edSetMode(btn.dataset.mode)));
  ED.stage.addEventListener('pointerdown', edStagePointerDown);
  window.addEventListener('resize', () => { if (!$('#editorOverlay').classList.contains('hidden')) edLayout(); });
  $('#edFontSize').addEventListener('input', () => {
    const v = Math.max(4, Math.min(120, Number($('#edFontSize').value) || 12));
    edApplyTextStyle('size', v);
  });
  $('#edColor').addEventListener('input', () => edApplyTextStyle('color', $('#edColor').value));
  $('#edFontFamily').addEventListener('change', () => edApplyTextStyle('family', $('#edFontFamily').value));
  $('#edBold').addEventListener('click', () => edToggleStyle('bold'));
  $('#edItalic').addEventListener('click', () => edToggleStyle('italic'));
  $('#edDelete').addEventListener('click', edDeleteSelected);
  $('#edRotL').addEventListener('click', () => edRotateSelected(-15));
  $('#edRotR').addEventListener('click', () => edRotateSelected(15));
  $('#edLayer').addEventListener('click', edToggleLayer);
  $('#editorImageInput').addEventListener('change', edImagePicked);
  document.addEventListener('keydown', edKeydown);
}

/* boot: editor wiring deferred until its consts exist */
wireEditor();

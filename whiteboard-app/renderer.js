// ── PDF.js worker ─────────────────────────────────────────────────────────────

if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    './node_modules/pdfjs-dist/build/pdf.worker.min.js';
}

// ── State ─────────────────────────────────────────────────────────────────────

const state = {
  // Tools
  tool:          'pen',
  color:         '#000000',
  lineWidth:     4,

  // Viewport
  zoom:          1.0,
  panX:          0,
  panY:          0,
  isPanning:     false,
  panStart:      { x: 0, y: 0 },

  // Drawing
  isDrawing:     false,
  strokes:       [],        // always points to the currently active strokes array
  currentStroke: null,

  // Background
  bgImage:       null,

  // Mode
  mode:          'whiteboard', // 'whiteboard' | 'pdf'

  // PDF-specific
  pdfDoc:        null,
  currentPage:   1,
  totalPages:    0,
  pdfStrokes:    {},           // { pageNum: stroke[] }
};

// ── Canvas setup ──────────────────────────────────────────────────────────────

const canvas    = document.getElementById('canvas');
const container = document.getElementById('canvas-container');
const ctx       = canvas.getContext('2d');

const bgCanvas  = document.createElement('canvas');
bgCanvas.id     = 'bg-canvas';
container.prepend(bgCanvas);
const bgCtx     = bgCanvas.getContext('2d');

function resizeCanvases() {
  const w = container.clientWidth;
  const h = container.clientHeight;
  canvas.width   = bgCanvas.width  = w;
  canvas.height  = bgCanvas.height = h;
  redrawBackground();
  redraw();
}

window.addEventListener('resize', resizeCanvases);

// ── Start screen ──────────────────────────────────────────────────────────────

const startScreen = document.getElementById('start-screen');
const appEl       = document.getElementById('app');

function showApp() {
  startScreen.style.display = 'none';
  appEl.style.display       = 'flex';
  resizeCanvases();
}

function showStartScreen() {
  appEl.style.display       = 'none';
  startScreen.style.display = 'flex';
}

document.getElementById('mode-whiteboard').addEventListener('click', () => {
  state.mode = 'whiteboard';
  setMode('whiteboard');
  showApp();
});

document.getElementById('mode-pdf').addEventListener('click', () => {
  state.mode = 'pdf';
  setMode('pdf');
  showApp();
  // Auto-prompt PDF load
  document.getElementById('file-pdf-input').click();
});

document.getElementById('back-btn').addEventListener('click', () => {
  resetState();
  setMode('whiteboard');
  showStartScreen();
});

function resetState() {
  state.strokes       = [];
  state.currentStroke = null;
  state.pdfDoc        = null;
  state.currentPage   = 1;
  state.totalPages    = 0;
  state.pdfStrokes    = {};
  state.bgImage       = null;
  state.zoom          = 1;
  state.panX          = 0;
  state.panY          = 0;
  bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
  redraw();
  updateZoomLabel();
}

function setMode(mode) {
  state.mode = mode;
  const isPdf = mode === 'pdf';

  document.getElementById('wb-import-controls').style.display      = isPdf ? 'none' : '';
  document.getElementById('pdf-controls').style.display            = isPdf ? ''     : 'none';
  document.getElementById('export-wb-pdf-btn').style.display       = isPdf ? 'none' : '';
  document.getElementById('export-annotated-pdf-btn').style.display = isPdf ? ''    : 'none';
  document.getElementById('export-annotated-pdf-btn').disabled     = true;

  if (!isPdf) {
    document.getElementById('pdf-prev-btn').disabled = true;
    document.getElementById('pdf-next-btn').disabled = true;
    document.getElementById('pdf-page-label').textContent = '\u2014 / \u2014';
  }
}

// ── Coordinate transform ──────────────────────────────────────────────────────

function screenToWorld(sx, sy) {
  return {
    x: (sx - state.panX) / state.zoom,
    y: (sy - state.panY) / state.zoom,
  };
}

function applyTransform(c) {
  c.setTransform(state.zoom, 0, 0, state.zoom, state.panX, state.panY);
}

// ── Drawing ───────────────────────────────────────────────────────────────────

function drawStroke(c, stroke) {
  if (stroke.points.length < 2) return;
  c.save();
  c.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';
  c.strokeStyle = stroke.color;
  c.lineWidth   = stroke.lineWidth;
  c.lineCap     = 'round';
  c.lineJoin    = 'round';
  c.beginPath();
  c.moveTo(stroke.points[0].x, stroke.points[0].y);
  for (let i = 1; i < stroke.points.length; i++) {
    c.lineTo(stroke.points[i].x, stroke.points[i].y);
  }
  c.stroke();
  c.restore();
}

function redraw() {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.restore();

  ctx.save();
  applyTransform(ctx);
  const all = state.currentStroke
    ? [...state.strokes, state.currentStroke]
    : state.strokes;
  for (const s of all) drawStroke(ctx, s);
  ctx.restore();
}

function redrawBackground() {
  bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
  if (!state.bgImage) return;
  bgCtx.save();
  applyTransform(bgCtx);
  bgCtx.drawImage(state.bgImage, 0, 0);
  bgCtx.restore();
}

// ── Mouse events ──────────────────────────────────────────────────────────────

canvas.addEventListener('mousedown', e => {
  if (e.button === 1 || (e.button === 0 && e.altKey)) {
    state.isPanning = true;
    state.panStart  = { x: e.clientX - state.panX, y: e.clientY - state.panY };
    canvas.style.cursor = 'grabbing';
    return;
  }
  if (e.button !== 0) return;
  state.isDrawing     = true;
  state.currentStroke = {
    tool:      state.tool,
    color:     state.color,
    lineWidth: state.lineWidth,
    points:    [screenToWorld(e.offsetX, e.offsetY)],
  };
});

canvas.addEventListener('mousemove', e => {
  if (state.isPanning) {
    state.panX = e.clientX - state.panStart.x;
    state.panY = e.clientY - state.panStart.y;
    redrawBackground();
    redraw();
    return;
  }
  if (!state.isDrawing) return;
  state.currentStroke.points.push(screenToWorld(e.offsetX, e.offsetY));
  redraw();
});

canvas.addEventListener('mouseup',    endDraw);
canvas.addEventListener('mouseleave', endDraw);

function endDraw() {
  if (state.isPanning) {
    state.isPanning     = false;
    canvas.style.cursor = 'crosshair';
    return;
  }
  if (!state.isDrawing) return;
  state.isDrawing = false;
  if (state.currentStroke?.points.length > 0) {
    state.strokes.push(state.currentStroke);
  }
  state.currentStroke = null;
}

// ── Touch support ─────────────────────────────────────────────────────────────

canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const t    = e.touches[0];
  state.isDrawing     = true;
  state.currentStroke = {
    tool: state.tool, color: state.color, lineWidth: state.lineWidth,
    points: [screenToWorld(t.clientX - rect.left, t.clientY - rect.top)],
  };
}, { passive: false });

canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  if (!state.isDrawing) return;
  const rect = canvas.getBoundingClientRect();
  const t    = e.touches[0];
  state.currentStroke.points.push(screenToWorld(t.clientX - rect.left, t.clientY - rect.top));
  redraw();
}, { passive: false });

canvas.addEventListener('touchend', endDraw);

// ── Zoom ──────────────────────────────────────────────────────────────────────

canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
  state.panX = e.offsetX - (e.offsetX - state.panX) * factor;
  state.panY = e.offsetY - (e.offsetY - state.panY) * factor;
  state.zoom = Math.max(0.05, Math.min(20, state.zoom * factor));
  updateZoomLabel();
  redrawBackground();
  redraw();
}, { passive: false });

function setZoom(newZoom) {
  const cx     = canvas.width  / 2;
  const cy     = canvas.height / 2;
  const factor = newZoom / state.zoom;
  state.panX   = cx - (cx - state.panX) * factor;
  state.panY   = cy - (cy - state.panY) * factor;
  state.zoom   = Math.max(0.05, Math.min(20, newZoom));
  updateZoomLabel();
  redrawBackground();
  redraw();
}

function updateZoomLabel() {
  document.getElementById('zoom-reset').textContent = Math.round(state.zoom * 100) + '%';
}

document.getElementById('zoom-in').addEventListener('click',    () => setZoom(state.zoom * 1.25));
document.getElementById('zoom-out').addEventListener('click',   () => setZoom(state.zoom / 1.25));
document.getElementById('zoom-reset').addEventListener('click', () => setZoom(1));

// ── Toolbar controls ──────────────────────────────────────────────────────────

document.querySelectorAll('.tool-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.tool = btn.dataset.tool;
  });
});

document.getElementById('color-picker').addEventListener('input', e => {
  state.color = e.target.value;
});

const strokeSlider = document.getElementById('stroke-width');
const strokeLabel  = document.getElementById('stroke-label');
strokeSlider.addEventListener('input', e => {
  state.lineWidth = parseInt(e.target.value, 10);
  strokeLabel.textContent = state.lineWidth + 'px';
});

document.getElementById('clear-btn').addEventListener('click', () => {
  state.strokes.length = 0;
  state.currentStroke  = null;
  redraw();
});

document.getElementById('undo-btn').addEventListener('click', () => {
  state.strokes.pop();
  redraw();
});

// ── Keyboard shortcuts ────────────────────────────────────────────────────────

document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if (e.key === 'p' || e.key === 'P') {
    document.querySelector('[data-tool="pen"]').click();
  } else if (e.key === 'e' || e.key === 'E') {
    document.querySelector('[data-tool="eraser"]').click();
  } else if (e.key === '+' || e.key === '=') {
    setZoom(state.zoom * 1.25);
  } else if (e.key === '-') {
    setZoom(state.zoom / 1.25);
  } else if (e.key === '0') {
    setZoom(1);
  } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    state.strokes.pop();
    redraw();
  } else if (e.key === 'ArrowLeft'  && state.mode === 'pdf') {
    switchToPdfPage(state.currentPage - 1);
  } else if (e.key === 'ArrowRight' && state.mode === 'pdf') {
    switchToPdfPage(state.currentPage + 1);
  }
});

// ── Browser file helpers ──────────────────────────────────────────────────────

function pickFile(inputId) {
  return new Promise(resolve => {
    const input    = document.getElementById(inputId);
    input.onchange = e => {
      resolve(e.target.files[0] || null);
      input.value = '';
    };
    input.click();
  });
}

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r   = new FileReader();
    r.onload  = e => resolve(e.target.result);
    r.onerror = () => reject(new Error('Read failed'));
    r.readAsDataURL(file);
  });
}

function readAsText(file) {
  return new Promise((resolve, reject) => {
    const r   = new FileReader();
    r.onload  = e => resolve(e.target.result);
    r.onerror = () => reject(new Error('Read failed'));
    r.readAsText(file);
  });
}

function downloadBlob(content, filename, mimeType) {
  const blob = typeof content === 'string'
    ? new Blob([content], { type: mimeType })
    : content;
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function dataURLtoBlob(dataURL) {
  const [header, data] = dataURL.split(',');
  const mime  = header.match(/:(.*?);/)[1];
  const bytes = atob(data);
  const arr   = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

// ── Image import (whiteboard mode) ───────────────────────────────────────────

function loadBackgroundImage(dataURL) {
  const img  = new Image();
  img.onload = () => {
    state.bgImage = img;
    const scale   = Math.min(bgCanvas.width / img.width, bgCanvas.height / img.height);
    state.zoom    = scale;
    state.panX    = (bgCanvas.width  - img.width  * scale) / 2;
    state.panY    = (bgCanvas.height - img.height * scale) / 2;
    updateZoomLabel();
    redrawBackground();
    redraw();
  };
  img.src = dataURL;
}

document.getElementById('import-image-btn').addEventListener('click', async () => {
  const file = await pickFile('file-image-input');
  if (file) loadBackgroundImage(await readAsDataURL(file));
});

document.getElementById('screenshot-btn').addEventListener('click', async () => {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    showToast('Screenshot requires HTTPS or localhost');
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    const video  = document.createElement('video');
    video.srcObject = stream;
    await video.play();
    const tmp = document.createElement('canvas');
    tmp.width = video.videoWidth; tmp.height = video.videoHeight;
    tmp.getContext('2d').drawImage(video, 0, 0);
    stream.getTracks().forEach(t => t.stop());
    loadBackgroundImage(tmp.toDataURL('image/png'));
  } catch (err) {
    if (err.name !== 'NotAllowedError') showToast('Screenshot failed: ' + err.message);
  }
});

// ── PDF inking mode ───────────────────────────────────────────────────────────

document.getElementById('pdf-load-btn').addEventListener('click', async () => {
  document.getElementById('file-pdf-input').click();
});

document.getElementById('file-pdf-input').addEventListener('change', async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    await loadPDF(file);
  } catch (err) {
    showToast('Failed to load PDF: ' + err.message);
  }
});

async function loadPDF(file) {
  showToast('Loading PDF…');
  const buf     = await file.arrayBuffer();
  state.pdfDoc  = await pdfjsLib.getDocument({ data: buf }).promise;
  state.totalPages  = state.pdfDoc.numPages;
  state.pdfStrokes  = {};
  state.currentPage = 1;
  state.strokes     = [];
  state.pdfStrokes[1] = state.strokes;

  document.getElementById('export-annotated-pdf-btn').disabled = false;
  updatePageLabel();
  await renderPdfPage(1);
}

async function renderPdfPage(pageNum) {
  if (!state.pdfDoc) return;
  const page     = await state.pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale: 1 });

  const offscreen = document.createElement('canvas');
  offscreen.width  = Math.round(viewport.width);
  offscreen.height = Math.round(viewport.height);
  await page.render({ canvasContext: offscreen.getContext('2d'), viewport }).promise;

  loadBackgroundImage(offscreen.toDataURL('image/png'));
}

function switchToPdfPage(newPage) {
  if (newPage < 1 || newPage > state.totalPages) return;
  // Save current page strokes (state.strokes already IS pdfStrokes[currentPage])
  state.pdfStrokes[state.currentPage] = state.strokes;
  // Switch
  if (!state.pdfStrokes[newPage]) state.pdfStrokes[newPage] = [];
  state.strokes     = state.pdfStrokes[newPage];
  state.currentPage = newPage;
  updatePageLabel();
  renderPdfPage(newPage);
}

function updatePageLabel() {
  document.getElementById('pdf-page-label').textContent =
    `${state.currentPage} / ${state.totalPages}`;
  document.getElementById('pdf-prev-btn').disabled = state.currentPage <= 1;
  document.getElementById('pdf-next-btn').disabled = state.currentPage >= state.totalPages;
}

document.getElementById('pdf-prev-btn').addEventListener('click', () => switchToPdfPage(state.currentPage - 1));
document.getElementById('pdf-next-btn').addEventListener('click', () => switchToPdfPage(state.currentPage + 1));

// ── Composite helper ──────────────────────────────────────────────────────────

function buildCompositeCanvas() {
  const ec   = document.createElement('canvas');
  ec.width   = canvas.width;
  ec.height  = canvas.height;
  const ectx = ec.getContext('2d');
  ectx.fillStyle = '#ffffff';
  ectx.fillRect(0, 0, ec.width, ec.height);
  if (state.bgImage) ectx.drawImage(bgCanvas, 0, 0);
  ectx.drawImage(canvas, 0, 0);
  return ec;
}

// ── Exports ───────────────────────────────────────────────────────────────────

document.getElementById('export-png-btn').addEventListener('click', () => {
  downloadBlob(dataURLtoBlob(buildCompositeCanvas().toDataURL('image/png')), 'whiteboard.png', 'image/png');
  showToast('Downloaded whiteboard.png');
});

function buildSVG() {
  const w     = canvas.width;
  const h     = canvas.height;
  const lines = [`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`];
  lines.push(`  <rect width="${w}" height="${h}" fill="white"/>`);

  if (state.bgImage) {
    const tmp = document.createElement('canvas');
    tmp.width = bgCanvas.width; tmp.height = bgCanvas.height;
    tmp.getContext('2d').drawImage(bgCanvas, 0, 0);
    lines.push(`  <image href="${tmp.toDataURL()}" width="${w}" height="${h}"/>`);
  }

  for (const stroke of state.strokes) {
    const pts = stroke.points
      .map(p => `${(p.x * state.zoom + state.panX).toFixed(2)},${(p.y * state.zoom + state.panY).toFixed(2)}`)
      .join(' ');
    const blend = stroke.tool === 'eraser' ? ' style="mix-blend-mode:destination-out"' : '';
    lines.push(
      `  <polyline points="${pts}" stroke="${stroke.color}" ` +
      `stroke-width="${(stroke.lineWidth * state.zoom).toFixed(2)}" ` +
      `stroke-linecap="round" stroke-linejoin="round" fill="none"${blend}/>`
    );
  }
  lines.push('</svg>');
  return lines.join('\n');
}

document.getElementById('export-svg-btn').addEventListener('click', () => {
  downloadBlob(buildSVG(), 'whiteboard.svg', 'image/svg+xml');
  showToast('Downloaded whiteboard.svg');
});

// Whiteboard-mode PDF (current view only)
document.getElementById('export-wb-pdf-btn').addEventListener('click', () => {
  const { jsPDF } = window.jspdf;
  const w = canvas.width, h = canvas.height;
  const doc = new jsPDF({ orientation: w >= h ? 'landscape' : 'portrait', unit: 'px', format: [w, h] });
  doc.addImage(buildCompositeCanvas().toDataURL('image/png'), 'PNG', 0, 0, w, h);
  doc.save('whiteboard.pdf');
  showToast('Downloaded whiteboard.pdf');
});

// PDF-mode: export every page with its annotations
document.getElementById('export-annotated-pdf-btn').addEventListener('click', async () => {
  if (!state.pdfDoc) return;
  // Flush current page strokes
  state.pdfStrokes[state.currentPage] = state.strokes;

  const { jsPDF } = window.jspdf;
  let doc = null;
  showToast('Exporting all pages\u2026 please wait');

  for (let n = 1; n <= state.totalPages; n++) {
    const page     = await state.pdfDoc.getPage(n);
    const viewport = page.getViewport({ scale: 2 }); // 2× for sharpness
    const w0       = viewport.width  / 2;             // logical pt width
    const h0       = viewport.height / 2;

    const pc   = document.createElement('canvas');
    pc.width   = Math.round(viewport.width);
    pc.height  = Math.round(viewport.height);
    const pctx = pc.getContext('2d');
    await page.render({ canvasContext: pctx, viewport }).promise;

    // Draw annotations at render scale
    pctx.save();
    pctx.setTransform(2, 0, 0, 2, 0, 0);
    for (const s of (state.pdfStrokes[n] || [])) drawStroke(pctx, s);
    pctx.restore();

    if (!doc) {
      doc = new jsPDF({ orientation: w0 >= h0 ? 'landscape' : 'portrait', unit: 'px', format: [w0, h0] });
    } else {
      doc.addPage([w0, h0], w0 >= h0 ? 'l' : 'p');
    }
    doc.addImage(pc.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, w0, h0);
  }

  doc.save('annotated.pdf');
  showToast('Downloaded annotated.pdf');
});

// ── JSON export / import ──────────────────────────────────────────────────────

document.getElementById('export-json-btn').addEventListener('click', () => {
  let payload;

  if (state.mode === 'pdf') {
    state.pdfStrokes[state.currentPage] = state.strokes;
    payload = {
      version:     2,
      mode:        'pdf',
      totalPages:  state.totalPages,
      currentPage: state.currentPage,
      zoom:        state.zoom,
      panX:        state.panX,
      panY:        state.panY,
      pdfStrokes:  state.pdfStrokes,
      _note:       'Re-load your original PDF to restore page backgrounds.',
    };
    downloadBlob(JSON.stringify(payload, null, 2), 'whiteboard-annotations.json', 'application/json');
  } else {
    let bgDataURL = null;
    if (state.bgImage) {
      const tmp  = document.createElement('canvas');
      tmp.width  = state.bgImage.naturalWidth;
      tmp.height = state.bgImage.naturalHeight;
      tmp.getContext('2d').drawImage(state.bgImage, 0, 0);
      bgDataURL  = tmp.toDataURL('image/png');
    }
    payload = {
      version:        1,
      mode:           'whiteboard',
      zoom:           state.zoom,
      panX:           state.panX,
      panY:           state.panY,
      bgImageDataURL: bgDataURL,
      strokes:        state.strokes,
    };
    downloadBlob(JSON.stringify(payload, null, 2), 'whiteboard.json', 'application/json');
  }

  showToast('Downloaded session JSON');
});

document.getElementById('import-json-btn').addEventListener('click', async () => {
  const file = await pickFile('file-json-input');
  if (!file) return;
  try {
    const text    = await readAsText(file);
    const payload = JSON.parse(text);

    if (payload.mode === 'pdf' || payload.version === 2) {
      // Must be in PDF mode to restore PDF annotations
      if (state.mode !== 'pdf') {
        showToast('Switch to PDF mode first, then re-open your PDF, then load this JSON.');
        return;
      }
      state.pdfStrokes  = payload.pdfStrokes || {};
      state.totalPages  = payload.totalPages || state.totalPages;
      state.currentPage = payload.currentPage || 1;
      state.zoom        = payload.zoom ?? 1;
      state.panX        = payload.panX ?? 0;
      state.panY        = payload.panY ?? 0;
      state.strokes     = state.pdfStrokes[state.currentPage] || [];
      state.pdfStrokes[state.currentPage] = state.strokes;
      updateZoomLabel();
      updatePageLabel();
      redraw();
      showToast('Annotations restored. Re-open your PDF to restore backgrounds.');
    } else {
      state.strokes = payload.strokes || [];
      state.zoom    = payload.zoom    ?? 1;
      state.panX    = payload.panX    ?? 0;
      state.panY    = payload.panY    ?? 0;
      updateZoomLabel();

      if (payload.bgImageDataURL) {
        loadBackgroundImage(payload.bgImageDataURL);
      } else {
        state.bgImage = null;
        bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
        redraw();
      }
    }
  } catch (err) {
    showToast('Failed to load: ' + err.message);
  }
});

// ── Toast ─────────────────────────────────────────────────────────────────────

function showToast(msg) {
  const toast       = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 3000);
}

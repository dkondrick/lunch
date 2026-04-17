// ── State ─────────────────────────────────────────────────────────────────────

const state = {
  tool:          'pen',
  color:         '#000000',
  lineWidth:     4,

  zoom:          1.0,
  panX:          0,
  panY:          0,
  isPanning:     false,
  panStart:      { x: 0, y: 0 },

  isDrawing:     false,
  strokes:       [],
  currentStroke: null,

  overlayMode:   false,
  clickThrough:  false,

  bgImage:       null,
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
resizeCanvases();

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
  // Middle mouse or Alt+Left = pan
  if (e.button === 1 || (e.button === 0 && e.altKey)) {
    state.isPanning = true;
    state.panStart  = { x: e.clientX - state.panX, y: e.clientY - state.panY };
    canvas.style.cursor = 'grabbing';
    return;
  }
  if (e.button !== 0) return;
  state.isDrawing    = true;
  const pt           = screenToWorld(e.offsetX, e.offsetY);
  state.currentStroke = {
    tool:      state.tool,
    color:     state.color,
    lineWidth: state.lineWidth,
    points:    [pt],
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
  if (state.currentStroke && state.currentStroke.points.length > 0) {
    state.strokes.push(state.currentStroke);
  }
  state.currentStroke = null;
}

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
  const cx = canvas.width  / 2;
  const cy = canvas.height / 2;
  const factor = newZoom / state.zoom;
  state.panX = cx - (cx - state.panX) * factor;
  state.panY = cy - (cy - state.panY) * factor;
  state.zoom = Math.max(0.05, Math.min(20, newZoom));
  updateZoomLabel();
  redrawBackground();
  redraw();
}

function updateZoomLabel() {
  document.getElementById('zoom-reset').textContent = Math.round(state.zoom * 100) + '%';
}

document.getElementById('zoom-in').addEventListener('click', () => setZoom(state.zoom * 1.25));
document.getElementById('zoom-out').addEventListener('click', () => setZoom(state.zoom / 1.25));
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
  state.strokes = [];
  state.currentStroke = null;
  redraw();
});

document.getElementById('undo-btn').addEventListener('click', () => {
  state.strokes.pop();
  redraw();
});

// ── Keyboard shortcuts ────────────────────────────────────────────────────────

document.addEventListener('keydown', async e => {
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
  } else if (e.key === 'o' || e.key === 'O') {
    document.getElementById('overlay-toggle').click();
  } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    state.strokes.pop();
    redraw();
  } else if (e.key === 'Escape' && state.clickThrough) {
    state.clickThrough = false;
    await window.api.setClickThrough(false);
    document.getElementById('click-through').classList.remove('active');
    document.getElementById('overlay-hint').style.display = 'none';
  }
});

// ── Overlay mode ──────────────────────────────────────────────────────────────

document.getElementById('overlay-toggle').addEventListener('click', async () => {
  state.overlayMode = !state.overlayMode;
  await window.api.toggleOverlay(state.overlayMode);

  const btn   = document.getElementById('overlay-toggle');
  const ctBtn = document.getElementById('click-through');

  if (state.overlayMode) {
    btn.textContent = 'Overlay: ON';
    btn.classList.add('active');
    document.body.classList.add('overlay-mode');
    ctBtn.disabled = false;
  } else {
    btn.textContent = 'Overlay: OFF';
    btn.classList.remove('active');
    document.body.classList.remove('overlay-mode');
    if (state.clickThrough) {
      state.clickThrough = false;
      await window.api.setClickThrough(false);
      ctBtn.classList.remove('active');
      document.getElementById('overlay-hint').style.display = 'none';
    }
    ctBtn.disabled = true;
  }
});

document.getElementById('click-through').addEventListener('click', async () => {
  state.clickThrough = !state.clickThrough;
  await window.api.setClickThrough(state.clickThrough);
  document.getElementById('click-through').classList.toggle('active', state.clickThrough);
  document.getElementById('overlay-hint').style.display = state.clickThrough ? 'block' : 'none';
});

// ── Image import ──────────────────────────────────────────────────────────────

function loadBackgroundImage(dataURL) {
  const img  = new Image();
  img.onload = () => {
    state.bgImage = img;
    const scaleX = bgCanvas.width  / img.width;
    const scaleY = bgCanvas.height / img.height;
    const scale  = Math.min(scaleX, scaleY);
    state.zoom   = scale;
    state.panX   = (bgCanvas.width  - img.width  * scale) / 2;
    state.panY   = (bgCanvas.height - img.height * scale) / 2;
    updateZoomLabel();
    redrawBackground();
    redraw();
  };
  img.src = dataURL;
}

document.getElementById('import-image-btn').addEventListener('click', async () => {
  const dataURL = await window.api.importImage();
  if (dataURL) loadBackgroundImage(dataURL);
});

document.getElementById('screenshot-btn').addEventListener('click', async () => {
  const dataURL = await window.api.screenshot();
  if (dataURL) loadBackgroundImage(dataURL);
});

// ── Composite helper (bg + strokes) ──────────────────────────────────────────

function buildCompositeCanvas() {
  const ec   = document.createElement('canvas');
  ec.width   = canvas.width;
  ec.height  = canvas.height;
  const ectx = ec.getContext('2d');
  // White background so PNG isn't transparent by default
  ectx.fillStyle = '#ffffff';
  ectx.fillRect(0, 0, ec.width, ec.height);
  if (state.bgImage) ectx.drawImage(bgCanvas, 0, 0);
  ectx.drawImage(canvas, 0, 0);
  return ec;
}

// ── PNG export ────────────────────────────────────────────────────────────────

document.getElementById('export-png-btn').addEventListener('click', async () => {
  const dataURL = buildCompositeCanvas().toDataURL('image/png');
  const res = await window.api.exportPng(dataURL);
  if (res.ok) showToast('Saved: ' + res.filePath);
});

// ── SVG export ────────────────────────────────────────────────────────────────

function buildSVG() {
  const w     = canvas.width;
  const h     = canvas.height;
  const lines = [`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`];
  lines.push(`  <rect width="${w}" height="${h}" fill="white"/>`);

  if (state.bgImage) {
    const tmp  = document.createElement('canvas');
    tmp.width  = bgCanvas.width;
    tmp.height = bgCanvas.height;
    tmp.getContext('2d').drawImage(bgCanvas, 0, 0);
    lines.push(`  <image href="${tmp.toDataURL()}" width="${w}" height="${h}"/>`);
  }

  for (const stroke of state.strokes) {
    const pts = stroke.points
      .map(p => `${(p.x * state.zoom + state.panX).toFixed(2)},${(p.y * state.zoom + state.panY).toFixed(2)}`)
      .join(' ');
    const blendAttr = stroke.tool === 'eraser'
      ? ' style="mix-blend-mode:destination-out"' : '';
    lines.push(
      `  <polyline points="${pts}" stroke="${stroke.color}" ` +
      `stroke-width="${(stroke.lineWidth * state.zoom).toFixed(2)}" ` +
      `stroke-linecap="round" stroke-linejoin="round" fill="none"${blendAttr}/>`
    );
  }

  lines.push('</svg>');
  return lines.join('\n');
}

document.getElementById('export-svg-btn').addEventListener('click', async () => {
  const res = await window.api.exportSvg(buildSVG());
  if (res.ok) showToast('Saved: ' + res.filePath);
});

// ── PDF export ────────────────────────────────────────────────────────────────

document.getElementById('export-pdf-btn').addEventListener('click', async () => {
  const { jsPDF } = window.jspdf;
  const w = canvas.width;
  const h = canvas.height;
  const orientation = w >= h ? 'landscape' : 'portrait';
  const doc  = new jsPDF({ orientation, unit: 'px', format: [w, h] });
  const data = buildCompositeCanvas().toDataURL('image/png');
  doc.addImage(data, 'PNG', 0, 0, w, h);
  const res = await window.api.exportPdf(doc.output('datauristring'));
  if (res.ok) showToast('Saved: ' + res.filePath);
});

// ── JSON export / import ──────────────────────────────────────────────────────

document.getElementById('export-json-btn').addEventListener('click', async () => {
  let bgDataURL = null;
  if (state.bgImage) {
    const tmp  = document.createElement('canvas');
    tmp.width  = state.bgImage.naturalWidth;
    tmp.height = state.bgImage.naturalHeight;
    tmp.getContext('2d').drawImage(state.bgImage, 0, 0);
    bgDataURL  = tmp.toDataURL('image/png');
  }
  const payload = {
    version:      1,
    canvasW:      canvas.width,
    canvasH:      canvas.height,
    zoom:         state.zoom,
    panX:         state.panX,
    panY:         state.panY,
    bgImageDataURL: bgDataURL,
    strokes:      state.strokes,
  };
  const res = await window.api.exportJson(JSON.stringify(payload, null, 2));
  if (res.ok) showToast('Saved: ' + res.filePath);
});

document.getElementById('import-json-btn').addEventListener('click', async () => {
  const text = await window.api.importJson();
  if (!text) return;
  const payload    = JSON.parse(text);
  state.strokes    = payload.strokes || [];
  state.zoom       = payload.zoom    ?? 1;
  state.panX       = payload.panX    ?? 0;
  state.panY       = payload.panY    ?? 0;
  updateZoomLabel();

  if (payload.bgImageDataURL) {
    loadBackgroundImage(payload.bgImageDataURL);
  } else {
    state.bgImage = null;
    bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
    redraw();
  }
});

// ── Toast notification ────────────────────────────────────────────────────────

function showToast(msg) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast    = document.createElement('div');
    toast.id = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 3000);
}

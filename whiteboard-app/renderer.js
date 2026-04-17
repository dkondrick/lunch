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
  if (e.button === 1 || (e.button === 0 && e.altKey)) {
    state.isPanning = true;
    state.panStart  = { x: e.clientX - state.panX, y: e.clientY - state.panY };
    canvas.style.cursor = 'grabbing';
    return;
  }
  if (e.button !== 0) return;
  state.isDrawing     = true;
  const pt            = screenToWorld(e.offsetX, e.offsetY);
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

// ── Touch support ─────────────────────────────────────────────────────────────

canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const t    = e.touches[0];
  const pt   = screenToWorld(t.clientX - rect.left, t.clientY - rect.top);
  state.isDrawing     = true;
  state.currentStroke = { tool: state.tool, color: state.color, lineWidth: state.lineWidth, points: [pt] };
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
  state.strokes       = [];
  state.currentStroke = null;
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
  }
});

// ── Browser file helpers ──────────────────────────────────────────────────────

function pickImageFile() {
  return new Promise(resolve => {
    const input = document.getElementById('file-image-input');
    input.onchange = e => {
      const file = e.target.files[0];
      if (!file) { resolve(null); return; }
      const reader  = new FileReader();
      reader.onload = ev => resolve(ev.target.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
      input.value = '';
    };
    input.click();
  });
}

function pickJsonFile() {
  return new Promise(resolve => {
    const input = document.getElementById('file-json-input');
    input.onchange = e => {
      const file = e.target.files[0];
      if (!file) { resolve(null); return; }
      const reader  = new FileReader();
      reader.onload = ev => resolve(ev.target.result);
      reader.onerror = () => resolve(null);
      reader.readAsText(file);
      input.value = '';
    };
    input.click();
  });
}

function downloadBlob(content, filename, mimeType) {
  const blob = typeof content === 'string'
    ? new Blob([content], { type: mimeType })
    : content;
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
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

// ── Image import ──────────────────────────────────────────────────────────────

function loadBackgroundImage(dataURL) {
  const img  = new Image();
  img.onload = () => {
    state.bgImage = img;
    const scaleX  = bgCanvas.width  / img.width;
    const scaleY  = bgCanvas.height / img.height;
    const scale   = Math.min(scaleX, scaleY);
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
  const dataURL = await pickImageFile();
  if (dataURL) loadBackgroundImage(dataURL);
});

// Screenshot via getDisplayMedia — requires HTTPS or localhost
document.getElementById('screenshot-btn').addEventListener('click', async () => {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    showToast('Screenshot requires HTTPS or localhost — open via a local server');
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    const video  = document.createElement('video');
    video.srcObject = stream;
    await video.play();

    const tmp  = document.createElement('canvas');
    tmp.width  = video.videoWidth;
    tmp.height = video.videoHeight;
    tmp.getContext('2d').drawImage(video, 0, 0);
    stream.getTracks().forEach(t => t.stop());

    loadBackgroundImage(tmp.toDataURL('image/png'));
  } catch (err) {
    if (err.name !== 'NotAllowedError') showToast('Screenshot failed: ' + err.message);
  }
});

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

// ── PNG export ────────────────────────────────────────────────────────────────

document.getElementById('export-png-btn').addEventListener('click', () => {
  downloadBlob(dataURLtoBlob(buildCompositeCanvas().toDataURL('image/png')), 'whiteboard.png', 'image/png');
  showToast('Downloaded whiteboard.png');
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
    const blendAttr = stroke.tool === 'eraser' ? ' style="mix-blend-mode:destination-out"' : '';
    lines.push(
      `  <polyline points="${pts}" stroke="${stroke.color}" ` +
      `stroke-width="${(stroke.lineWidth * state.zoom).toFixed(2)}" ` +
      `stroke-linecap="round" stroke-linejoin="round" fill="none"${blendAttr}/>`
    );
  }

  lines.push('</svg>');
  return lines.join('\n');
}

document.getElementById('export-svg-btn').addEventListener('click', () => {
  downloadBlob(buildSVG(), 'whiteboard.svg', 'image/svg+xml');
  showToast('Downloaded whiteboard.svg');
});

// ── PDF export ────────────────────────────────────────────────────────────────

document.getElementById('export-pdf-btn').addEventListener('click', () => {
  const { jsPDF } = window.jspdf;
  const w   = canvas.width;
  const h   = canvas.height;
  const doc = new jsPDF({ orientation: w >= h ? 'landscape' : 'portrait', unit: 'px', format: [w, h] });
  doc.addImage(buildCompositeCanvas().toDataURL('image/png'), 'PNG', 0, 0, w, h);
  doc.save('whiteboard.pdf');
  showToast('Downloaded whiteboard.pdf');
});

// ── JSON export / import ──────────────────────────────────────────────────────

document.getElementById('export-json-btn').addEventListener('click', () => {
  let bgDataURL = null;
  if (state.bgImage) {
    const tmp  = document.createElement('canvas');
    tmp.width  = state.bgImage.naturalWidth;
    tmp.height = state.bgImage.naturalHeight;
    tmp.getContext('2d').drawImage(state.bgImage, 0, 0);
    bgDataURL  = tmp.toDataURL('image/png');
  }
  const payload = {
    version:        1,
    zoom:           state.zoom,
    panX:           state.panX,
    panY:           state.panY,
    bgImageDataURL: bgDataURL,
    strokes:        state.strokes,
  };
  downloadBlob(JSON.stringify(payload, null, 2), 'whiteboard.json', 'application/json');
  showToast('Downloaded whiteboard.json');
});

document.getElementById('import-json-btn').addEventListener('click', async () => {
  const text = await pickJsonFile();
  if (!text) return;
  try {
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

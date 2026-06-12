import { getEffectiveExportWidth } from './state.js';

const canvas = document.getElementById('previewCanvas');
const ctx = canvas.getContext('2d');

const miniCanvas = document.getElementById('miniPreviewCanvas');
const miniCtx = miniCanvas.getContext('2d');

const MINI_PREVIEW_MAX = 240;

let rafId = null;

export function scheduleRender(state) {
  if (rafId !== null) return;
  rafId = requestAnimationFrame(() => {
    rafId = null;
    render(state);
  });
}

export function render(state) {
  const layout = computeLayout(state);
  if (!layout) {
    canvas.width = 0;
    canvas.height = 0;
    miniCanvas.width = 0;
    miniCanvas.height = 0;
    return;
  }

  canvas.width = layout.canvasWidth;
  canvas.height = layout.canvasHeight;

  ctx.fillStyle = layout.marginColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  layout.items.forEach((item, i) => {
    const pos = layout.positions[i];
    if (pos.source) {
      const { sx, sy, sw, sh } = pos.source;
      ctx.drawImage(item.img, sx, sy, sw, sh, pos.x, pos.y, pos.width, pos.height);
    } else {
      ctx.drawImage(item.img, pos.x, pos.y, pos.width, pos.height);
    }
  });

  renderMiniPreview();
}

function renderMiniPreview() {
  const scale = Math.min(MINI_PREVIEW_MAX / canvas.width, MINI_PREVIEW_MAX / canvas.height, 1);
  miniCanvas.width = Math.max(1, Math.round(canvas.width * scale));
  miniCanvas.height = Math.max(1, Math.round(canvas.height * scale));
  miniCtx.drawImage(canvas, 0, 0, miniCanvas.width, miniCanvas.height);
}

export function computeItemGeometry(item, exportWidth) {
  if (item.fillMode === 'custom' && item.crop) {
    const crop = item.crop;

    const height = crop.heightRatio * exportWidth;
    const baseScale = Math.max(exportWidth / item.naturalWidth, height / item.naturalHeight);
    const effectiveScale = baseScale * crop.zoom;
    const sw = exportWidth / effectiveScale;
    const sh = height / effectiveScale;
    const sx = clamp(crop.offsetX * item.naturalWidth - sw / 2, 0, item.naturalWidth - sw);
    const sy = clamp(crop.offsetY * item.naturalHeight, 0, item.naturalHeight - sh);

    if (item.centerLock) {
      const renderWidth = exportWidth * (crop.widthPercent / 100);
      const renderHeight = renderWidth * crop.heightRatio;
      return {
        height: renderHeight,
        dx: (exportWidth - renderWidth) / 2,
        dw: renderWidth,
        dh: renderHeight,
        source: { sx, sy, sw, sh },
      };
    }

    return { height, dx: 0, dw: exportWidth, dh: height, source: { sx, sy, sw, sh } };
  }

  const height = item.naturalHeight * (exportWidth / item.naturalWidth);
  return { height, dx: 0, dw: exportWidth, dh: height, source: null };
}

function clamp(value, lo, hi) {
  return Math.min(Math.max(value, lo), Math.max(lo, hi));
}

export function getItemAtPoint(state, px, py) {
  const layout = computeLayout(state);
  if (!layout) return null;

  for (let i = 0; i < layout.positions.length; i += 1) {
    const pos = layout.positions[i];
    if (px >= pos.x && px <= pos.x + pos.width && py >= pos.y && py <= pos.y + pos.height) {
      return layout.items[i];
    }
  }

  return null;
}

function computeLayout(state) {
  const items = state.items.filter((item) => item.naturalWidth > 0);
  if (items.length === 0) return null;

  const exportWidth = getEffectiveExportWidth();
  if (exportWidth <= 0) return null;

  const m = state.margin.size;
  const outer = state.margin.outerBorder;

  const geometries = items.map((item) => computeItemGeometry(item, exportWidth));

  const canvasWidth = exportWidth + (outer ? 2 * m : 0);
  const canvasHeight =
    geometries.reduce((sum, g) => sum + g.height, 0) + (items.length - 1) * m + (outer ? 2 * m : 0);

  const positions = [];
  let y = outer ? m : 0;
  const x = outer ? m : 0;
  items.forEach((item, i) => {
    const geo = geometries[i];
    positions.push({
      x: x + geo.dx,
      y,
      width: geo.dw,
      height: geo.dh,
      source: geo.source,
    });
    y += geo.height + m;
  });

  return {
    canvasWidth,
    canvasHeight,
    positions,
    items,
    marginColor: state.margin.color,
  };
}

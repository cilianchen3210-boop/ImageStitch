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
    if (pos.cells) {
      pos.cells.forEach((cell) => {
        const { sx, sy, sw, sh } = cell.source;
        ctx.drawImage(
          cell.child.img,
          sx, sy, sw, sh,
          pos.x + cell.x + cell.offX, pos.y + cell.offY, cell.renderWidth, cell.renderHeight
        );
      });
    } else {
      const { sx, sy, sw, sh } = pos.source;
      ctx.drawImage(item.img, sx, sy, sw, sh, pos.x, pos.y, pos.width, pos.height);
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

export function computeCoverSource(child, w, h) {
  const { crop } = child;
  const baseScale = Math.max(w / child.naturalWidth, h / child.naturalHeight);
  const effectiveScale = baseScale * crop.zoom;
  const sw = w / effectiveScale;
  const sh = h / effectiveScale;
  const sx = clamp(crop.offsetX * child.naturalWidth - sw / 2, 0, child.naturalWidth - sw);
  const sy = clamp(crop.offsetY * child.naturalHeight - sh / 2, 0, child.naturalHeight - sh);
  return { sx, sy, sw, sh };
}

export function computeItemGeometry(item, exportWidth) {
  if (item.type === 'group') {
    const cellHeight = item.heightRatio * exportWidth;
    const n = item.children.length;
    let x = 0;
    const cells = item.children.map((child) => {
      const widthRatio = child.widthRatio ?? 1 / n;
      const cellWidth = widthRatio * exportWidth;
      const source = computeCoverSource(child, cellWidth, cellHeight);
      let renderWidth = cellWidth;
      let renderHeight = cellHeight;
      let offX = 0;
      let offY = 0;
      if (child.centerLock) {
        const wp = child.crop.widthPercent / 100;
        renderWidth = cellWidth * wp;
        renderHeight = cellHeight * wp;
        offX = (cellWidth - renderWidth) / 2;
        offY = (cellHeight - renderHeight) / 2;
      }
      const cell = { x, width: cellWidth, source, renderWidth, renderHeight, offX, offY, child };
      x += cellWidth;
      return cell;
    });
    return { height: cellHeight, dx: 0, dw: exportWidth, dh: cellHeight, source: null, cells };
  }

  const crop = item.crop;
  const height = crop.heightRatio * exportWidth;

  if (item.centerLock) {
    const widthRatio = item.widthRatio ?? 1;
    const baseScale = Math.max(exportWidth / item.naturalWidth, height / item.naturalHeight);
    const effectiveScale = baseScale * crop.zoom;
    const sw0 = exportWidth / effectiveScale;
    const sh = height / effectiveScale;
    const sw = sw0 * widthRatio;
    const sx = clamp(crop.offsetX * item.naturalWidth - sw0 / 2, 0, item.naturalWidth - sw);
    const sy = clamp(crop.offsetY * item.naturalHeight, 0, item.naturalHeight - sh);

    const renderWidth = exportWidth * (crop.widthPercent / 100);
    const renderHeight = renderWidth * (sh / sw);
    return {
      height: renderHeight,
      dx: (exportWidth - renderWidth) / 2,
      dw: renderWidth,
      dh: renderHeight,
      source: { sx, sy, sw, sh },
    };
  }

  const widthRatio = item.widthRatio ?? 1;
  const baseScale = Math.max(exportWidth / item.naturalWidth, height / item.naturalHeight);
  const effectiveScale = baseScale * crop.zoom;
  const sw0 = exportWidth / effectiveScale;
  const sh = height / effectiveScale;
  const sw = sw0 * widthRatio;
  const sx = clamp(crop.offsetX * item.naturalWidth - sw0 / 2, 0, item.naturalWidth - sw);
  const sy = clamp(crop.offsetY * item.naturalHeight, 0, item.naturalHeight - sh);

  const dh = height / widthRatio;
  return { height: dh, dx: 0, dw: exportWidth, dh, source: { sx, sy, sw, sh } };
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
      const item = layout.items[i];
      if (pos.cells) {
        const cell = pos.cells.find((c) => px >= pos.x + c.x && px <= pos.x + c.x + c.width);
        return cell ? { item: cell.child, group: item } : null;
      }
      return { item, group: null };
    }
  }

  return null;
}

function isItemReady(item) {
  if (item.type === 'group') {
    return item.children.length > 0 && item.children.every((c) => c.naturalWidth > 0);
  }
  return item.naturalWidth > 0;
}

function computeLayout(state) {
  const items = state.items.filter(isItemReady);
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
      cells: geo.cells,
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

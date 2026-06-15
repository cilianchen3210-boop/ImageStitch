import { getEffectiveExportSize } from './state.js';

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
          pos.x + cell.x + cell.offX, pos.y + cell.y + cell.offY, cell.renderWidth, cell.renderHeight
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

export function computeItemGeometry(item, crossSize, stitchMode = 'vertical') {
  const horizontal = stitchMode === 'horizontal';

  if (item.type === 'group') {
    const mainRatio = horizontal ? 1 / item.heightRatio : item.heightRatio;
    const mainSize = mainRatio * crossSize;
    const n = item.children.length;
    let pos = 0;
    const cells = item.children.map((child) => {
      const widthRatio = child.widthRatio ?? 1 / n;
      const crossCell = widthRatio * crossSize;
      const cellWidth = horizontal ? mainSize : crossCell;
      const cellHeight = horizontal ? crossCell : mainSize;
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
      const cell = {
        x: horizontal ? 0 : pos,
        y: horizontal ? pos : 0,
        width: cellWidth,
        height: cellHeight,
        source,
        renderWidth,
        renderHeight,
        offX,
        offY,
        child,
      };
      pos += crossCell;
      return cell;
    });
    return horizontal
      ? { main: mainSize, dx: 0, dy: 0, dw: mainSize, dh: crossSize, source: null, cells }
      : { main: mainSize, dx: 0, dy: 0, dw: crossSize, dh: mainSize, source: null, cells };
  }

  const crop = item.crop;
  const mainRatio = horizontal ? 1 / crop.heightRatio : crop.heightRatio;
  const mainFull = mainRatio * crossSize;
  const wr = item.widthRatio ?? 1;

  const natCross = horizontal ? item.naturalHeight : item.naturalWidth;
  const natMain = horizontal ? item.naturalWidth : item.naturalHeight;
  const offCross = horizontal ? crop.offsetY : crop.offsetX;
  const offMain = horizontal ? crop.offsetX : crop.offsetY;

  const baseScale = Math.max(crossSize / natCross, mainFull / natMain);
  const effectiveScale = baseScale * crop.zoom;
  const sCross0 = crossSize / effectiveScale;
  const sMain0 = mainFull / effectiveScale;

  const sCross = sCross0 * wr;
  const sMain = sMain0;
  const sCrossPos = clamp(offCross * natCross - sCross0 / 2, 0, natCross - sCross);
  const sMainPos = clamp(offMain * natMain, 0, natMain - sMain);

  if (item.centerLock) {
    const renderCross = crossSize * (crop.widthPercent / 100);
    const renderMain = renderCross * (sMain / sCross);
    const crossOffset = (crossSize - renderCross) / 2;

    const dw = horizontal ? renderMain : renderCross;
    const dh = horizontal ? renderCross : renderMain;
    const source = horizontal
      ? { sx: sMainPos, sy: sCrossPos, sw: sMain, sh: sCross }
      : { sx: sCrossPos, sy: sMainPos, sw: sCross, sh: sMain };

    return horizontal
      ? { main: renderMain, dx: 0, dy: crossOffset, dw, dh, source }
      : { main: renderMain, dx: crossOffset, dy: 0, dw, dh, source };
  }

  const dMain = mainFull / wr;
  const dw = horizontal ? dMain : crossSize;
  const dh = horizontal ? crossSize : dMain;
  const source = horizontal
    ? { sx: sMainPos, sy: sCrossPos, sw: sMain, sh: sCross }
    : { sx: sCrossPos, sy: sMainPos, sw: sCross, sh: sMain };

  return { main: dMain, dx: 0, dy: 0, dw, dh, source };
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
        const cell = pos.cells.find((c) =>
          px >= pos.x + c.x && px <= pos.x + c.x + c.width &&
          py >= pos.y + c.y && py <= pos.y + c.y + c.height
        );
        return cell ? { item: cell.child, group: item } : null;
      }
      return { item, group: null };
    }
  }

  return null;
}

export function isItemReady(item) {
  if (item.type === 'group') {
    return item.children.length > 0 && item.children.every((c) => c.naturalWidth > 0);
  }
  return item.naturalWidth > 0;
}

function computeLayout(state) {
  const items = state.items.filter(isItemReady);
  if (items.length === 0) return null;

  const crossSize = getEffectiveExportSize();
  if (crossSize <= 0) return null;

  const horizontal = state.stitchMode === 'horizontal';
  const m = state.margin.size;
  const outer = state.margin.outerBorder;

  const geometries = items.map((item) => computeItemGeometry(item, crossSize, state.stitchMode));

  const mainTotal = geometries.reduce((sum, g) => sum + g.main, 0) + (items.length - 1) * m + (outer ? 2 * m : 0);
  const crossTotal = crossSize + (outer ? 2 * m : 0);

  const canvasWidth = horizontal ? mainTotal : crossTotal;
  const canvasHeight = horizontal ? crossTotal : mainTotal;

  const positions = [];
  let mainPos = outer ? m : 0;
  const crossBase = outer ? m : 0;
  items.forEach((item, i) => {
    const geo = geometries[i];
    positions.push({
      x: horizontal ? mainPos + geo.dx : crossBase + geo.dx,
      y: horizontal ? crossBase + geo.dy : mainPos + geo.dy,
      width: geo.dw,
      height: geo.dh,
      source: geo.source,
      cells: geo.cells,
    });
    mainPos += geo.main + m;
  });

  return {
    canvasWidth,
    canvasHeight,
    positions,
    items,
    marginColor: state.margin.color,
  };
}

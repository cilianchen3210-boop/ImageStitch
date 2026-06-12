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
    ctx.drawImage(item.img, pos.x, pos.y, pos.width, pos.height);
  });

  renderMiniPreview();
}

function renderMiniPreview() {
  const scale = Math.min(MINI_PREVIEW_MAX / canvas.width, MINI_PREVIEW_MAX / canvas.height, 1);
  miniCanvas.width = Math.max(1, Math.round(canvas.width * scale));
  miniCanvas.height = Math.max(1, Math.round(canvas.height * scale));
  miniCtx.drawImage(canvas, 0, 0, miniCanvas.width, miniCanvas.height);
}

function computeLayout(state) {
  const items = state.items.filter((item) => item.naturalWidth > 0);
  if (items.length === 0) return null;

  const exportWidth = getEffectiveExportWidth();
  if (exportWidth <= 0) return null;

  const m = state.margin.size;
  const outer = state.margin.outerBorder;

  const scaledHeights = items.map((item) => item.naturalHeight * (exportWidth / item.naturalWidth));

  const canvasWidth = exportWidth + (outer ? 2 * m : 0);
  const canvasHeight =
    scaledHeights.reduce((sum, h) => sum + h, 0) + (items.length - 1) * m + (outer ? 2 * m : 0);

  const positions = [];
  let y = outer ? m : 0;
  const x = outer ? m : 0;
  items.forEach((item, i) => {
    positions.push({ x, y, width: exportWidth, height: scaledHeights[i] });
    y += scaledHeights[i] + m;
  });

  return {
    canvasWidth,
    canvasHeight,
    positions,
    items,
    marginColor: state.margin.color,
  };
}

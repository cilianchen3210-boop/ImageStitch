import {
  getState,
  onChange,
  setItemFillMode,
  setItemCenterLock,
  updateItemCrop,
  resetItemCustom,
} from './state.js';
import { computeItemGeometry, getItemAtPoint } from './render.js';

const previewCanvas = document.getElementById('previewCanvas');

const editorEmptyHint = document.getElementById('editorEmptyHint');
const editorSelectedLabel = document.getElementById('editorSelectedLabel');
const imageEditorBody = document.getElementById('imageEditorBody');
const fillModeScale = document.getElementById('fillModeScale');
const fillModeCustom = document.getElementById('fillModeCustom');
const customCropControls = document.getElementById('customCropControls');
const centerLockInput = document.getElementById('centerLockInput');
const freeCropControls = document.getElementById('freeCropControls');
const centerLockControls = document.getElementById('centerLockControls');
const cropPreviewCanvas = document.getElementById('cropPreviewCanvas');
const cropPreviewCtx = cropPreviewCanvas.getContext('2d');
const cropResizeHandle = document.getElementById('cropResizeHandle');
const cropZoomInput = document.getElementById('cropZoomInput');
const cropPreviewCanvasLocked = document.getElementById('cropPreviewCanvasLocked');
const cropPreviewLockedCtx = cropPreviewCanvasLocked.getContext('2d');
const cropWidthPercentInput = document.getElementById('cropWidthPercentInput');
const cropResetButton = document.getElementById('cropResetButton');

const PREVIEW_W = 360;

let currentItem = null;

export function initEditor() {
  previewCanvas.addEventListener('click', (e) => {
    const rect = previewCanvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const px = ((e.clientX - rect.left) / rect.width) * previewCanvas.width;
    const py = ((e.clientY - rect.top) / rect.height) * previewCanvas.height;
    const item = getItemAtPoint(getState(), px, py);
    if (item) selectItem(item);
  });

  fillModeScale.addEventListener('change', () => {
    if (!fillModeScale.checked || !currentItem) return;
    setItemFillMode(currentItem.id, 'scale');
    refreshEditor();
  });

  fillModeCustom.addEventListener('change', () => {
    if (!fillModeCustom.checked || !currentItem) return;
    setItemFillMode(currentItem.id, 'custom');
    refreshEditor();
  });

  centerLockInput.addEventListener('change', () => {
    if (!currentItem) return;
    setItemCenterLock(currentItem.id, centerLockInput.checked);
    refreshEditor();
  });

  cropZoomInput.addEventListener('input', () => {
    if (!currentItem) return;
    updateItemCrop(currentItem.id, { zoom: parseFloat(cropZoomInput.value) });
    renderFreeCropPreview();
  });

  cropWidthPercentInput.addEventListener('input', () => {
    if (!currentItem) return;
    updateItemCrop(currentItem.id, { widthPercent: Number(cropWidthPercentInput.value) });
    renderLockedPreview();
  });

  cropResetButton.addEventListener('click', () => {
    if (!currentItem) return;
    resetItemCustom(currentItem.id);
    refreshEditor();
  });

  onChange((state) => {
    if (currentItem && !state.items.some((item) => item.id === currentItem.id)) {
      deselectItem();
    }
  });

  initDragToPan();
  initResizeHandle();
}

function selectItem(item) {
  currentItem = item;
  editorEmptyHint.hidden = true;
  imageEditorBody.hidden = false;
  updateSelectedLabel();
  refreshEditor();
}

function deselectItem() {
  currentItem = null;
  editorEmptyHint.hidden = false;
  imageEditorBody.hidden = true;
  updateSelectedLabel();
}

function updateSelectedLabel() {
  if (!currentItem) {
    editorSelectedLabel.textContent = '';
    return;
  }
  const index = getState().items.findIndex((item) => item.id === currentItem.id);
  editorSelectedLabel.textContent = ` - 图片 ${index + 1}`;
}

function refreshEditor() {
  if (!currentItem) return;

  fillModeScale.checked = currentItem.fillMode !== 'custom';
  fillModeCustom.checked = currentItem.fillMode === 'custom';
  customCropControls.hidden = currentItem.fillMode !== 'custom';

  if (currentItem.fillMode !== 'custom') return;

  centerLockInput.checked = currentItem.centerLock;
  freeCropControls.hidden = currentItem.centerLock;
  centerLockControls.hidden = !currentItem.centerLock;

  if (currentItem.centerLock) {
    cropWidthPercentInput.value = String(currentItem.crop.widthPercent);
    renderLockedPreview();
  } else {
    cropZoomInput.value = String(currentItem.crop.zoom);
    renderFreeCropPreview();
  }
}

function renderFreeCropPreview() {
  const item = currentItem;
  const geo = computeItemGeometry(item, PREVIEW_W);

  cropPreviewCanvas.width = PREVIEW_W;
  cropPreviewCanvas.height = Math.max(1, Math.round(geo.height));

  if (geo.source) {
    const { sx, sy, sw, sh } = geo.source;
    cropPreviewCtx.drawImage(item.img, sx, sy, sw, sh, geo.dx, 0, geo.dw, geo.dh);
  } else {
    cropPreviewCtx.drawImage(item.img, geo.dx, 0, geo.dw, geo.dh);
  }
}

function renderLockedPreview() {
  const item = currentItem;
  const geo = computeItemGeometry(item, PREVIEW_W);

  cropPreviewCanvasLocked.width = PREVIEW_W;
  cropPreviewCanvasLocked.height = Math.max(1, Math.round(geo.height));

  cropPreviewLockedCtx.fillStyle = getState().margin.color;
  cropPreviewLockedCtx.fillRect(0, 0, cropPreviewCanvasLocked.width, cropPreviewCanvasLocked.height);

  if (geo.source) {
    const { sx, sy, sw, sh } = geo.source;
    cropPreviewLockedCtx.drawImage(item.img, sx, sy, sw, sh, geo.dx, 0, geo.dw, geo.dh);
  } else {
    cropPreviewLockedCtx.drawImage(item.img, geo.dx, 0, geo.dw, geo.dh);
  }
}

function initDragToPan() {
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let startOffsetX = 0.5;
  let startOffsetY = 0.5;

  cropPreviewCanvas.addEventListener('mousedown', (e) => {
    if (!currentItem || currentItem.centerLock) return;
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    startOffsetX = currentItem.crop.offsetX;
    startOffsetY = currentItem.crop.offsetY;
    e.preventDefault();
  });

  window.addEventListener('mousemove', (e) => {
    if (!dragging || !currentItem) return;

    const geo = computeItemGeometry(currentItem, PREVIEW_W);
    if (!geo.source) return;

    const rect = cropPreviewCanvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const scaleX = geo.source.sw / rect.width;
    const scaleY = geo.source.sh / rect.height;

    const deltaX = (e.clientX - startX) * scaleX;
    const deltaY = (e.clientY - startY) * scaleY;

    const offsetX = clamp(startOffsetX - deltaX / currentItem.naturalWidth, 0, 1);
    const offsetY = clamp(startOffsetY - deltaY / currentItem.naturalHeight, 0, 1);

    updateItemCrop(currentItem.id, { offsetX, offsetY });
    renderFreeCropPreview();
  });

  window.addEventListener('mouseup', () => {
    dragging = false;
  });
}

function initResizeHandle() {
  let dragging = false;
  let startY = 0;
  let startRatio = 1;

  cropResizeHandle.addEventListener('mousedown', (e) => {
    if (!currentItem || currentItem.centerLock) return;
    dragging = true;
    startY = e.clientY;
    startRatio = currentItem.crop.heightRatio;
    e.preventDefault();
  });

  window.addEventListener('mousemove', (e) => {
    if (!dragging || !currentItem) return;

    const rect = cropPreviewCanvas.getBoundingClientRect();
    if (rect.width === 0) return;

    const deltaRatio = (e.clientY - startY) / rect.width;
    const heightRatio = clamp(startRatio + deltaRatio, 0.1, 5);

    updateItemCrop(currentItem.id, { heightRatio });
    renderFreeCropPreview();
  });

  window.addEventListener('mouseup', () => {
    dragging = false;
  });
}

function clamp(value, lo, hi) {
  return Math.min(Math.max(value, lo), hi);
}

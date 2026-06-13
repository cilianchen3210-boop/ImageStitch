import {
  getState,
  onChange,
  setItemCenterLock,
  updateItemCrop,
  resetItemCrop,
  updateGroupChildCrop,
  setGroupChildCenterLock,
  resetGroupChildCrop,
  updateGroupHeightRatio,
  updateGroupChildWidthRatio,
  updateItemWidthRatio,
} from './state.js';
import { computeItemGeometry, computeCoverSource, getItemAtPoint } from './render.js';

const previewCanvas = document.getElementById('previewCanvas');

const editorEmptyHint = document.getElementById('editorEmptyHint');
const editorSelectedLabel = document.getElementById('editorSelectedLabel');
const imageEditorBody = document.getElementById('imageEditorBody');
const centerLockInput = document.getElementById('centerLockInput');
const freeCropControls = document.getElementById('freeCropControls');
const centerLockControls = document.getElementById('centerLockControls');
const cropPreviewCanvas = document.getElementById('cropPreviewCanvas');
const cropPreviewCtx = cropPreviewCanvas.getContext('2d');
const cropResizeHandle = document.getElementById('cropResizeHandle');
const cropResizeHandleH = document.getElementById('cropResizeHandleH');
const cropZoomInput = document.getElementById('cropZoomInput');
const cropPreviewCanvasLocked = document.getElementById('cropPreviewCanvasLocked');
const cropPreviewLockedCtx = cropPreviewCanvasLocked.getContext('2d');
const cropWidthPercentInput = document.getElementById('cropWidthPercentInput');
const cropResetButton = document.getElementById('cropResetButton');
const cropDoneButton = document.getElementById('cropDoneButton');

const PREVIEW_W = 360;

let currentItem = null;
let currentGroup = null;

export function initEditor() {
  previewCanvas.addEventListener('click', (e) => {
    const rect = previewCanvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const px = ((e.clientX - rect.left) / rect.width) * previewCanvas.width;
    const py = ((e.clientY - rect.top) / rect.height) * previewCanvas.height;
    const hit = getItemAtPoint(getState(), px, py);
    if (hit) selectItem(hit.item, hit.group);
  });

  centerLockInput.addEventListener('change', () => {
    if (!currentItem) return;
    setCurrentCenterLock(centerLockInput.checked);
    refreshEditor();
  });

  cropZoomInput.addEventListener('input', () => {
    if (!currentItem) return;
    updateCurrentCrop({ zoom: parseFloat(cropZoomInput.value) });
    renderFreeCropPreview();
  });

  cropWidthPercentInput.addEventListener('input', () => {
    if (!currentItem) return;
    updateCurrentCrop({ widthPercent: Number(cropWidthPercentInput.value) });
    renderLockedPreview();
  });

  cropResetButton.addEventListener('click', () => {
    if (!currentItem) return;
    resetCurrentCrop();
    refreshEditor();
  });

  cropDoneButton.addEventListener('click', () => {
    deselectItem();
  });

  onChange((state) => {
    if (!currentItem) return;

    if (currentGroup) {
      const group = state.items.find((item) => item.id === currentGroup.id && item.type === 'group');
      if (!group || !group.children.some((c) => c.id === currentItem.id)) {
        deselectItem();
      }
      return;
    }

    if (!state.items.some((item) => item.id === currentItem.id)) {
      deselectItem();
    }
  });

  initDragToPan();
  initResizeHandle();
  initResizeHandleH();
}

function selectItem(item, group) {
  currentItem = item;
  currentGroup = group;
  editorEmptyHint.hidden = true;
  imageEditorBody.hidden = false;
  updateSelectedLabel();
  refreshEditor();
}

function deselectItem() {
  currentItem = null;
  currentGroup = null;
  editorEmptyHint.hidden = false;
  imageEditorBody.hidden = true;
  updateSelectedLabel();
}

function updateSelectedLabel() {
  if (!currentItem) {
    editorSelectedLabel.textContent = '';
    return;
  }

  const targetId = currentGroup ? currentGroup.id : currentItem.id;
  const rowIndex = getState().items.findIndex((item) => item.id === targetId);

  if (currentGroup) {
    const childIndex = currentGroup.children.findIndex((c) => c.id === currentItem.id);
    editorSelectedLabel.textContent = ` - 第${rowIndex + 1}行 · ${childIndex + 1}/${currentGroup.children.length}`;
  } else {
    editorSelectedLabel.textContent = ` - 行${rowIndex + 1}`;
  }
}

function updateCurrentCrop(partial) {
  if (currentGroup) {
    updateGroupChildCrop(currentGroup.id, currentItem.id, partial);
  } else {
    updateItemCrop(currentItem.id, partial);
  }
}

function setCurrentCenterLock(value) {
  if (currentGroup) {
    setGroupChildCenterLock(currentGroup.id, currentItem.id, value);
  } else {
    setItemCenterLock(currentItem.id, value);
  }
}

function resetCurrentCrop() {
  if (currentGroup) {
    resetGroupChildCrop(currentGroup.id, currentItem.id);
  } else {
    resetItemCrop(currentItem.id);
  }
}

function refreshEditor() {
  if (!currentItem) return;

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

function getPreviewGeometry() {
  if (currentGroup) {
    const widthRatio = currentItem.widthRatio ?? 1 / currentGroup.children.length;
    const cellHeight = (PREVIEW_W * currentGroup.heightRatio) / widthRatio;
    return { cellWidth: PREVIEW_W, cellHeight, source: computeCoverSource(currentItem, PREVIEW_W, cellHeight) };
  }
  const geo = computeItemGeometry(currentItem, PREVIEW_W);
  return { cellWidth: PREVIEW_W, cellHeight: geo.height, source: geo.source };
}

function renderFreeCropPreview() {
  const item = currentItem;
  const { cellWidth, cellHeight, source } = getPreviewGeometry();

  cropPreviewCanvas.width = cellWidth;
  cropPreviewCanvas.height = Math.max(1, Math.round(cellHeight));

  const { sx, sy, sw, sh } = source;
  cropPreviewCtx.drawImage(item.img, sx, sy, sw, sh, 0, 0, cropPreviewCanvas.width, cropPreviewCanvas.height);
}

function renderLockedPreview() {
  const item = currentItem;
  const { cellWidth, cellHeight, source } = getPreviewGeometry();
  const { sx, sy, sw, sh } = source;
  const wp = item.crop.widthPercent / 100;

  let renderWidth;
  let renderHeight;
  let offX;
  let offY;
  let canvasW;
  let canvasH;

  if (currentGroup) {
    renderWidth = cellWidth * wp;
    renderHeight = cellHeight * wp;
    offX = (cellWidth - renderWidth) / 2;
    offY = (cellHeight - renderHeight) / 2;
    canvasW = cellWidth;
    canvasH = cellHeight;
  } else {
    renderWidth = cellWidth * wp;
    renderHeight = renderWidth * (sh / sw);
    offX = (cellWidth - renderWidth) / 2;
    offY = 0;
    canvasW = cellWidth;
    canvasH = renderHeight;
  }

  cropPreviewCanvasLocked.width = canvasW;
  cropPreviewCanvasLocked.height = Math.max(1, Math.round(canvasH));

  cropPreviewLockedCtx.fillStyle = getState().margin.color;
  cropPreviewLockedCtx.fillRect(0, 0, cropPreviewCanvasLocked.width, cropPreviewCanvasLocked.height);

  cropPreviewLockedCtx.drawImage(item.img, sx, sy, sw, sh, offX, offY, renderWidth, renderHeight);
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

    const { source } = getPreviewGeometry();

    const rect = cropPreviewCanvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const scaleX = source.sw / rect.width;
    const scaleY = source.sh / rect.height;

    const deltaX = (e.clientX - startX) * scaleX;
    const deltaY = (e.clientY - startY) * scaleY;

    const offsetX = clamp(startOffsetX - deltaX / currentItem.naturalWidth, 0, 1);
    const offsetY = clamp(startOffsetY - deltaY / currentItem.naturalHeight, 0, 1);

    updateCurrentCrop({ offsetX, offsetY });
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
    startRatio = currentGroup ? currentGroup.heightRatio : currentItem.crop.heightRatio;
    e.preventDefault();
  });

  window.addEventListener('mousemove', (e) => {
    if (!dragging || !currentItem) return;

    const rect = cropPreviewCanvas.getBoundingClientRect();
    if (rect.width === 0) return;

    const deltaRatio = (e.clientY - startY) / rect.width;

    if (currentGroup) {
      const widthRatio = currentItem.widthRatio ?? 1 / currentGroup.children.length;
      const heightRatio = clamp(startRatio + deltaRatio * widthRatio, 0.1, 5);
      updateGroupHeightRatio(currentGroup.id, heightRatio);
    } else {
      const heightRatio = clamp(startRatio + deltaRatio, 0.1, 5);
      updateItemCrop(currentItem.id, { heightRatio });
    }

    renderFreeCropPreview();
  });

  window.addEventListener('mouseup', () => {
    dragging = false;
  });
}

function initResizeHandleH() {
  let dragging = false;
  let startX = 0;
  let startRatio = 1;

  cropResizeHandleH.addEventListener('mousedown', (e) => {
    if (!currentItem || currentItem.centerLock) return;
    dragging = true;
    startX = e.clientX;
    startRatio = currentGroup
      ? currentItem.widthRatio ?? 1 / currentGroup.children.length
      : currentItem.widthRatio ?? 1;
    e.preventDefault();
  });

  window.addEventListener('mousemove', (e) => {
    if (!dragging || !currentItem) return;

    const rect = cropPreviewCanvas.getBoundingClientRect();
    if (rect.width === 0) return;

    const deltaRatio = (e.clientX - startX) / rect.width;

    if (currentGroup) {
      const widthRatio = startRatio + deltaRatio * startRatio;
      updateGroupChildWidthRatio(currentGroup.id, currentItem.id, widthRatio);
    } else {
      updateItemWidthRatio(currentItem.id, startRatio + deltaRatio);
    }

    renderFreeCropPreview();
  });

  window.addEventListener('mouseup', () => {
    dragging = false;
  });
}

function clamp(value, lo, hi) {
  return Math.min(Math.max(value, lo), hi);
}

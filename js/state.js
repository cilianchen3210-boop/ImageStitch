import { createImageItem, loadImageElement } from './utils.js';

const state = {
  items: [],
  margin: { size: 20, color: '#ffffff', outerBorder: false },
  exportWidth: { custom: null }, // null = 使用最宽图片宽度作为默认值
  exportFormat: { type: 'image/jpeg', quality: 0.92 },
};

const listeners = new Set();

export function getState() {
  return state;
}

export function onChange(fn) {
  listeners.add(fn);
}

function notifyChange() {
  listeners.forEach((fn) => fn(state));
}

export function addImages(files) {
  const newItems = files.map(createImageItem);
  state.items.push(...newItems);
  notifyChange();

  newItems.forEach((item) => {
    loadImageElement(item.src)
      .then((img) => {
        item.img = img;
        item.naturalWidth = img.naturalWidth;
        item.naturalHeight = img.naturalHeight;
        notifyChange();
      })
      .catch(() => {
        removeImage(item.id);
      });
  });
}

export function removeImage(id) {
  const index = state.items.findIndex((item) => item.id === id);
  if (index === -1) return;
  const [removed] = state.items.splice(index, 1);
  URL.revokeObjectURL(removed.src);
  notifyChange();
}

export function reorderImages(fromIndex, toIndex) {
  if (fromIndex === toIndex) return;
  if (fromIndex < 0 || fromIndex >= state.items.length) return;
  const clampedTo = Math.max(0, Math.min(toIndex, state.items.length - 1));
  const [item] = state.items.splice(fromIndex, 1);
  state.items.splice(clampedTo, 0, item);
  notifyChange();
}

export function setMarginSize(px) {
  state.margin.size = px;
  notifyChange();
}

export function setMarginColor(hex) {
  state.margin.color = hex;
  notifyChange();
}

export function setOuterBorder(value) {
  state.margin.outerBorder = value;
  notifyChange();
}

export function setExportWidthCustom(value) {
  state.exportWidth.custom = value;
  notifyChange();
}

export function setExportFormat(type) {
  state.exportFormat.type = type;
  notifyChange();
}

export function setExportQuality(quality) {
  state.exportFormat.quality = quality;
  notifyChange();
}

function findItem(id) {
  return state.items.find((item) => item.id === id);
}

export function setItemFillMode(id, mode) {
  const item = findItem(id);
  if (!item) return;
  item.fillMode = mode;
  if (mode === 'custom' && !item.crop) {
    item.crop = {
      heightRatio: item.naturalHeight / item.naturalWidth,
      zoom: 1,
      offsetX: 0.5,
      offsetY: 0,
      widthPercent: 100,
    };
  }
  notifyChange();
}

export function setItemCenterLock(id, value) {
  const item = findItem(id);
  if (!item) return;
  item.centerLock = value;
  notifyChange();
}

export function updateItemCrop(id, partial) {
  const item = findItem(id);
  if (!item || !item.crop) return;
  Object.assign(item.crop, partial);
  notifyChange();
}

export function resetItemCustom(id) {
  const item = findItem(id);
  if (!item) return;
  item.fillMode = 'scale';
  item.centerLock = false;
  item.crop = null;
  notifyChange();
}

export function getMaxNaturalWidth() {
  const widths = state.items
    .filter((item) => item.naturalWidth > 0)
    .map((item) => item.naturalWidth);
  return widths.length ? Math.max(...widths) : 0;
}

export function getEffectiveExportWidth() {
  const custom = state.exportWidth.custom;
  if (custom && custom > 0) return custom;
  return getMaxNaturalWidth();
}

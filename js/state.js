import { createImageItem, loadImageElement, generateId } from './utils.js';

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
        item.crop = {
          heightRatio: img.naturalHeight / img.naturalWidth,
          zoom: 1,
          offsetX: 0.5,
          offsetY: 0,
          widthPercent: 100,
        };
        item.widthRatio = 1;
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
  if (removed.type === 'group') {
    removed.children.forEach((c) => URL.revokeObjectURL(c.src));
  } else {
    URL.revokeObjectURL(removed.src);
  }
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

export function resetItemCrop(id) {
  const item = findItem(id);
  if (!item) return;
  item.centerLock = false;
  item.crop = {
    heightRatio: item.naturalHeight / item.naturalWidth,
    zoom: 1,
    offsetX: 0.5,
    offsetY: 0,
    widthPercent: 100,
  };
  item.widthRatio = 1;
  notifyChange();
}

export function updateItemWidthRatio(id, widthRatio) {
  const item = findItem(id);
  if (!item) return;
  item.widthRatio = clamp(widthRatio, 0.05, 1);
  notifyChange();
}

export function mergeIntoGroup(ids) {
  const indices = ids
    .map((id) => state.items.findIndex((i) => i.id === id))
    .filter((i) => i !== -1)
    .sort((a, b) => a - b);
  if (indices.length < 2) return;

  const children = indices.map((i) => state.items[i]);
  children.forEach((child) => {
    child.centerLock = false;
    child.crop = { zoom: 1, offsetX: 0.5, offsetY: 0.5, widthPercent: 100 };
    child.widthRatio = 1 / children.length;
  });

  const ratios = children.map((c) => (c.naturalWidth > 0 ? c.naturalHeight / c.naturalWidth : 1));
  const maxRatio = Math.max(...ratios);

  const group = {
    id: generateId(),
    type: 'group',
    heightRatio: maxRatio / children.length,
    children,
  };

  for (let k = indices.length - 1; k >= 0; k--) state.items.splice(indices[k], 1);
  state.items.splice(indices[0], 0, group);
  notifyChange();
}

export function ungroupItem(groupId) {
  const idx = state.items.findIndex((i) => i.id === groupId && i.type === 'group');
  if (idx === -1) return;
  const group = state.items[idx];
  group.children.forEach((child) => {
    child.centerLock = false;
    child.crop = {
      heightRatio: child.naturalHeight / child.naturalWidth,
      zoom: 1,
      offsetX: 0.5,
      offsetY: 0,
      widthPercent: 100,
    };
    child.widthRatio = 1;
  });
  state.items.splice(idx, 1, ...group.children);
  notifyChange();
}

function findGroupChild(groupId, childId) {
  const group = state.items.find((i) => i.id === groupId && i.type === 'group');
  const child = group?.children.find((c) => c.id === childId);
  return child ? { group, child } : {};
}

export function updateGroupChildCrop(groupId, childId, partial) {
  const { child } = findGroupChild(groupId, childId);
  if (!child) return;
  Object.assign(child.crop, partial);
  notifyChange();
}

export function setGroupChildCenterLock(groupId, childId, value) {
  const { child } = findGroupChild(groupId, childId);
  if (!child) return;
  child.centerLock = value;
  notifyChange();
}

export function resetGroupChildCrop(groupId, childId) {
  const { child } = findGroupChild(groupId, childId);
  if (!child) return;
  child.centerLock = false;
  child.crop = { zoom: 1, offsetX: 0.5, offsetY: 0.5, widthPercent: 100 };
  notifyChange();
}

export function updateGroupHeightRatio(groupId, heightRatio) {
  const group = state.items.find((i) => i.id === groupId && i.type === 'group');
  if (!group) return;
  group.heightRatio = heightRatio;
  notifyChange();
}

export function updateGroupChildWidthRatio(groupId, childId, widthRatio) {
  const group = state.items.find((i) => i.id === groupId && i.type === 'group');
  if (!group) return;

  const n = group.children.length;
  if (n < 2) return;

  const minRatio = 0.05;
  const clamped = clamp(widthRatio, minRatio, 1 - minRatio * (n - 1));

  const target = group.children.find((c) => c.id === childId);
  if (!target) return;

  const others = group.children.filter((c) => c.id !== childId);
  const othersSum = others.reduce((sum, c) => sum + (c.widthRatio ?? 1 / n), 0);
  const remaining = 1 - clamped;

  target.widthRatio = clamped;
  others.forEach((c) => {
    const current = c.widthRatio ?? 1 / n;
    c.widthRatio = othersSum > 0 ? (current / othersSum) * remaining : remaining / others.length;
  });

  notifyChange();
}

function clamp(value, lo, hi) {
  return Math.min(Math.max(value, lo), hi);
}

export function getMaxNaturalWidth() {
  const widths = state.items
    .map((item) => {
      if (item.type === 'group') {
        const maxChildWidth = Math.max(...item.children.map((c) => c.naturalWidth || 0));
        return maxChildWidth * item.children.length;
      }
      return item.naturalWidth || 0;
    })
    .filter((w) => w > 0);
  return widths.length ? Math.max(...widths) : 0;
}

export function getEffectiveExportWidth() {
  const custom = state.exportWidth.custom;
  if (custom && custom > 0) return custom;
  return getMaxNaturalWidth();
}

import { createImageItem, loadImageElement, generateId } from './utils.js';

const state = {
  items: [],
  stitchMode: 'vertical', // 'vertical' | 'horizontal'
  margin: { size: 20, color: '#ffffff', outerBorder: false },
  exportWidth: { custom: null }, // null = 使用最宽/最高图片尺寸作为默认值
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
          ...defaultCropOffsets(),
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

export function clearAllImages() {
  state.items.forEach((item) => {
    if (item.type === 'group') {
      item.children.forEach((c) => URL.revokeObjectURL(c.src));
    } else {
      URL.revokeObjectURL(item.src);
    }
  });
  state.items = [];
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

export function setStitchMode(mode) {
  if (state.stitchMode === mode) return;
  state.stitchMode = mode;
  resetAllAdjustments();
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
    ...defaultCropOffsets(),
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

  const group = {
    id: generateId(),
    type: 'group',
    heightRatio: defaultGroupHeightRatio(children, state.stitchMode === 'horizontal'),
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
      ...defaultCropOffsets(),
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

// 非分组图片裁剪的默认偏移：交叉轴居中（0.5），主轴锚定起点（0）。
// 垂直拼接时交叉轴为 offsetX、主轴为 offsetY；水平拼接时两者互换。
function defaultCropOffsets() {
  return state.stitchMode === 'horizontal'
    ? { offsetX: 0, offsetY: 0.5 }
    : { offsetX: 0.5, offsetY: 0 };
}

// 分组默认高度比：垂直拼接取“最高比例的子图”作为基准，
// 水平拼接取“最宽比例的子图”作为基准（对称推广）。
function defaultGroupHeightRatio(children, horizontal) {
  const ratios = children.map((c) => (c.naturalWidth > 0 ? c.naturalHeight / c.naturalWidth : 1));
  const n = children.length;
  return horizontal ? Math.min(...ratios) * n : Math.max(...ratios) / n;
}

// 切换拼接模式后，裁剪/比例等参数在两种模式下含义互调，直接重置为默认值。
function resetAllAdjustments() {
  const horizontal = state.stitchMode === 'horizontal';
  const offsets = defaultCropOffsets();

  state.items.forEach((item) => {
    if (item.type === 'group') {
      if (item.children.some((c) => !(c.naturalWidth > 0))) return;
      item.heightRatio = defaultGroupHeightRatio(item.children, horizontal);
      item.children.forEach((child) => {
        child.centerLock = false;
        child.crop = { zoom: 1, offsetX: 0.5, offsetY: 0.5, widthPercent: 100 };
        child.widthRatio = 1 / item.children.length;
      });
    } else {
      if (!(item.naturalWidth > 0)) return;
      item.centerLock = false;
      item.crop = {
        heightRatio: item.naturalHeight / item.naturalWidth,
        zoom: 1,
        ...offsets,
        widthPercent: 100,
      };
      item.widthRatio = 1;
    }
  });
}

export function getMaxNaturalCrossSize() {
  const horizontal = state.stitchMode === 'horizontal';
  const dims = state.items
    .map((item) => {
      if (item.type === 'group') {
        const maxChildSize = Math.max(...item.children.map((c) => (horizontal ? c.naturalHeight : c.naturalWidth) || 0));
        return maxChildSize * item.children.length;
      }
      return (horizontal ? item.naturalHeight : item.naturalWidth) || 0;
    })
    .filter((w) => w > 0);
  return dims.length ? Math.max(...dims) : 0;
}

export function getEffectiveExportSize() {
  const custom = state.exportWidth.custom;
  if (custom && custom > 0) return custom;
  return getMaxNaturalCrossSize();
}

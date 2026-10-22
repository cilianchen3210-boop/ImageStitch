import {
  getState,
  onChange,
  addImages,
  removeImage,
  reorderImages,
  mergeIntoGroup,
  ungroupItem,
  clearAllImages,
} from './state.js';

const uploadRegion = document.getElementById('uploadRegion');
const uploadGrid = document.getElementById('uploadGrid');
const uploadPlaceholder = document.getElementById('uploadPlaceholder');
const fileInput = document.getElementById('fileInput');
const mergeButton = document.getElementById('mergeButton');
const ungroupButton = document.getElementById('ungroupButton');
const clearButton = document.getElementById('clearButton');

let draggedId = null;
const coarsePointer = window.matchMedia('(pointer: coarse)');
const selectedIds = new Set();

export function initUpload() {
  uploadPlaceholder.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) {
      addImages(Array.from(fileInput.files));
    }
    fileInput.value = '';
  });

  uploadRegion.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadRegion.classList.add('drag-over');
  });

  uploadRegion.addEventListener('dragleave', (e) => {
    if (!uploadRegion.contains(e.relatedTarget)) {
      uploadRegion.classList.remove('drag-over');
    }
  });

  uploadRegion.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadRegion.classList.remove('drag-over');
    const files = e.dataTransfer.files;
    if (!files || !files.length) return;
    const images = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (images.length) addImages(images);
  });

  uploadGrid.addEventListener('click', (e) => {
    const deleteBtn = e.target.closest('.thumb-delete');
    if (deleteBtn) {
      e.stopPropagation();
      const thumb = deleteBtn.closest('.thumb');
      selectedIds.delete(thumb.dataset.id);
      removeImage(thumb.dataset.id);
      return;
    }

    if (e.target.closest('.add-tile')) {
      fileInput.click();
    }

    const thumb = e.target.closest('.thumb');
    if (thumb && !thumb.classList.contains('add-tile')) {
      const id = thumb.dataset.id;
      if (selectedIds.has(id)) {
        selectedIds.delete(id);
      } else {
        selectedIds.add(id);
      }
      thumb.classList.toggle('selected');
      updateToolbarState();
    }
  });

  mergeButton.addEventListener('click', () => {
    const state = getState();
    const ids = [...selectedIds].filter((id) => {
      const item = state.items.find((i) => i.id === id);
      return item && item.type === 'image';
    });
    mergeIntoGroup(ids);
    selectedIds.clear();
  });

  ungroupButton.addEventListener('click', () => {
    const state = getState();
    const ids = [...selectedIds].filter((id) => {
      const item = state.items.find((i) => i.id === id);
      return item && item.type === 'group';
    });
    ids.forEach((id) => ungroupItem(id));
    selectedIds.clear();
  });

  clearButton.addEventListener('click', () => {
    selectedIds.clear();
    clearAllImages();
  });

  uploadGrid.addEventListener('dragstart', (e) => {
    const thumb = e.target.closest('.thumb');
    if (!thumb || thumb.classList.contains('add-tile')) return;
    draggedId = thumb.dataset.id;
    e.dataTransfer.setData('text/plain', draggedId);
    e.dataTransfer.effectAllowed = 'move';
    thumb.classList.add('dragging');
  });

  uploadGrid.addEventListener('dragover', (e) => {
    const thumb = e.target.closest('.thumb');
    if (!thumb || draggedId === null) return;
    e.preventDefault();

    markDropTarget(thumb, e.clientX);
  });

  uploadGrid.addEventListener('drop', (e) => {
    const thumb = e.target.closest('.thumb');
    if (!thumb || draggedId === null) return;
    e.preventDefault();

    dropOn(thumb, e.clientX);
  });

  uploadGrid.addEventListener('dragend', clearDragState);

  initTouchReorder();

  onChange(syncThumbnails);
  syncThumbnails(getState());
}

function clearDragState() {
  draggedId = null;
  uploadGrid.querySelectorAll('.dragging, .drag-over-left, .drag-over-right').forEach((el) => {
    el.classList.remove('dragging', 'drag-over-left', 'drag-over-right');
  });
}

function markDropTarget(thumb, clientX) {
  uploadGrid.querySelectorAll('.drag-over-left, .drag-over-right').forEach((el) => {
    el.classList.remove('drag-over-left', 'drag-over-right');
  });
  const rect = thumb.getBoundingClientRect();
  const isBefore = clientX < rect.left + rect.width / 2;
  thumb.classList.add(isBefore ? 'drag-over-left' : 'drag-over-right');
}

function dropOn(thumb, clientX) {
  const state = getState();
  const fromIndex = state.items.findIndex((item) => item.id === draggedId);
  if (fromIndex === -1) return;

  let toIndex;
  if (thumb.classList.contains('add-tile')) {
    toIndex = state.items.length - 1;
  } else {
    const rect = thumb.getBoundingClientRect();
    const isBefore = clientX < rect.left + rect.width / 2;
    const targetIndex = state.items.findIndex((item) => item.id === thumb.dataset.id);
    toIndex = isBefore ? targetIndex : targetIndex + 1;
    if (fromIndex < toIndex) toIndex -= 1;
  }

  reorderImages(fromIndex, toIndex);
}

// 触屏没有 HTML5 拖放：长按缩略图后进入拖动状态，手指移到目标缩略图上松开即排序。
// 长按之前的滑动仍是正常的页面滚动。
function initTouchReorder() {
  const LONG_PRESS_MS = 350;
  const MOVE_TOLERANCE = 8;
  let timer = null;
  let active = false;
  let startX = 0;
  let startY = 0;
  let sourceThumb = null;
  let hoverThumb = null;

  const cancelTimer = () => {
    clearTimeout(timer);
    timer = null;
  };

  const finish = () => {
    cancelTimer();
    active = false;
    sourceThumb = null;
    hoverThumb = null;
    clearDragState();
  };

  const thumbAt = (x, y) => {
    const el = document.elementFromPoint(x, y);
    return el ? el.closest('.thumb') : null;
  };

  uploadGrid.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return finish();
    const thumb = e.target.closest('.thumb');
    if (!thumb || thumb.classList.contains('add-tile') || e.target.closest('.thumb-delete')) return;

    const touch = e.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    sourceThumb = thumb;
    timer = setTimeout(() => {
      active = true;
      draggedId = thumb.dataset.id;
      thumb.classList.add('dragging');
      navigator.vibrate?.(15);
    }, LONG_PRESS_MS);
  }, { passive: true });

  // 必须是非 passive，长按激活后才能阻止页面滚动
  uploadGrid.addEventListener('touchmove', (e) => {
    const touch = e.touches[0];
    if (!active) {
      if (timer && Math.hypot(touch.clientX - startX, touch.clientY - startY) > MOVE_TOLERANCE) finish();
      return;
    }
    e.preventDefault();
    const thumb = thumbAt(touch.clientX, touch.clientY);
    if (!thumb || thumb === sourceThumb || !uploadGrid.contains(thumb)) {
      hoverThumb = null;
      uploadGrid.querySelectorAll('.drag-over-left, .drag-over-right').forEach((el) => {
        el.classList.remove('drag-over-left', 'drag-over-right');
      });
      return;
    }
    hoverThumb = thumb;
    markDropTarget(thumb, touch.clientX);
  }, { passive: false });

  uploadGrid.addEventListener('touchend', (e) => {
    if (active) {
      e.preventDefault(); // 避免松手后触发 click 导致选中状态被切换
      if (hoverThumb) dropOn(hoverThumb, e.changedTouches[0].clientX);
    }
    finish();
  });

  uploadGrid.addEventListener('touchcancel', finish);

  // 长按时不弹系统菜单
  uploadGrid.addEventListener('contextmenu', (e) => {
    if (e.target.closest('.thumb')) e.preventDefault();
  });
}

export function syncThumbnails(state) {
  uploadGrid.innerHTML = '';

  const itemIds = new Set(state.items.map((item) => item.id));
  [...selectedIds].forEach((id) => {
    if (!itemIds.has(id)) selectedIds.delete(id);
  });

  if (state.items.length === 0) {
    uploadPlaceholder.hidden = false;
    uploadGrid.appendChild(uploadPlaceholder);
    updateToolbarState();
    return;
  }

  uploadPlaceholder.hidden = true;

  state.items.forEach((item) => {
    const thumb = document.createElement('div');
    thumb.className = 'thumb';
    thumb.dataset.id = item.id;
    thumb.draggable = !coarsePointer.matches;

    if (item.type === 'group') {
      thumb.classList.add('thumb-group');

      const children = document.createElement('div');
      children.className = 'thumb-group-children';
      item.children.forEach((child) => {
        const img = document.createElement('img');
        img.src = child.src;
        img.draggable = false;
        img.alt = '';
        children.appendChild(img);
      });
      thumb.appendChild(children);
    } else {
      const img = document.createElement('img');
      img.className = 'thumb-img';
      img.src = item.src;
      img.draggable = false;
      img.alt = '';
      thumb.appendChild(img);
    }

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'thumb-delete';
    deleteBtn.setAttribute('aria-label', '删除');
    deleteBtn.textContent = '×';
    thumb.appendChild(deleteBtn);

    if (selectedIds.has(item.id)) thumb.classList.add('selected');

    uploadGrid.appendChild(thumb);
  });

  const addTile = document.createElement('div');
  addTile.className = 'thumb add-tile';
  addTile.textContent = '+';
  uploadGrid.appendChild(addTile);

  updateToolbarState();
}

function updateToolbarState() {
  const state = getState();
  const selectedItems = [...selectedIds].map((id) => state.items.find((i) => i.id === id)).filter(Boolean);
  const images = selectedItems.filter((i) => i.type === 'image');
  const groups = selectedItems.filter((i) => i.type === 'group');
  mergeButton.disabled = !(images.length >= 2 && groups.length === 0);
  ungroupButton.disabled = !(groups.length >= 1 && images.length === 0);
  clearButton.disabled = state.items.length === 0;
}
